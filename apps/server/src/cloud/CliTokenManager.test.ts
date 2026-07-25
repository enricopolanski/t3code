import { readConnectAuthorizeRequest } from "@t3tools/shared/connectAuth";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Crypto from "effect/Crypto";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Schema from "effect/Schema";
import * as Terminal from "effect/Terminal";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ExternalLauncher from "../process/externalLauncher.ts";
import * as CliTokenManager from "./CliTokenManager.ts";
import type { OutOfBandOAuthPromptInput } from "./CliTokenManager.ts";

// pk_test_<base64 of "clerk.example.test$">
const TEST_ENV = {
  T3CODE_CLERK_PUBLISHABLE_KEY: "pk_test_Y2xlcmsuZXhhbXBsZS50ZXN0JA==",
  T3CODE_CLERK_CLI_OAUTH_CLIENT_ID: "oauth_client_test",
  T3CODE_HOSTED_APP_URL: "https://hosted.example.test",
};

interface RecordedTokenRequest {
  readonly url: string;
  readonly params: URLSearchParams;
}

// A JWT whose payload claims { email: "theo@example.test" } (signature is not
// verified — the CLI only reads the claim to display the connected account).
const TestIdTokenHeaderJson = Schema.fromJsonString(Schema.Struct({ alg: Schema.Literal("none") }));
const TestIdTokenPayloadJson = Schema.fromJsonString(Schema.Struct({ email: Schema.String }));
const encodeTestIdTokenHeader = Schema.encodeSync(TestIdTokenHeaderJson);
const encodeTestIdTokenPayload = Schema.encodeSync(TestIdTokenPayloadJson);
const idTokenWithEmail = (() => {
  const header = Encoding.encodeBase64Url(encodeTestIdTokenHeader({ alg: "none" }));
  const payload = Encoding.encodeBase64Url(
    encodeTestIdTokenPayload({ email: "theo@example.test" }),
  );
  return `${header}.${payload}.`;
})();

const TestTokenResponseJson = Schema.fromJsonString(
  Schema.Struct({
    access_token: Schema.String,
    refresh_token: Schema.String,
    id_token: Schema.String,
    expires_in: Schema.Number,
    token_type: Schema.String,
  }),
);
const encodeTestTokenResponse = Schema.encodeSync(TestTokenResponseJson);

const makeTokenEndpointLayer = (
  requests: Array<RecordedTokenRequest>,
  options?: { readonly idToken?: string },
) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        const body =
          request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : "";
        requests.push({ url: request.url, params: new URLSearchParams(body) });
        return HttpClientResponse.fromWeb(
          request,
          new Response(
            encodeTestTokenResponse({
              access_token: "access-token-1",
              refresh_token: "refresh-token-1",
              id_token: options?.idToken ?? idTokenWithEmail,
              expires_in: 3600,
              token_type: "bearer",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }),
    ),
  );

// Clerk omits id_token on refresh grants, so this response has no identity to derive.
const TestRefreshResponseJson = Schema.fromJsonString(
  Schema.Struct({
    access_token: Schema.String,
    refresh_token: Schema.String,
    expires_in: Schema.Number,
    token_type: Schema.String,
  }),
);
const encodeTestRefreshResponse = Schema.encodeSync(TestRefreshResponseJson);

const makeTokenEndpointLayerWithoutIdToken = (requests: Array<RecordedTokenRequest>) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        const body =
          request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : "";
        requests.push({ url: request.url, params: new URLSearchParams(body) });
        return HttpClientResponse.fromWeb(
          request,
          new Response(
            encodeTestRefreshResponse({
              access_token: "access-token-1",
              refresh_token: "refresh-token-1",
              expires_in: 3600,
              token_type: "bearer",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }),
    ),
  );

// Mirrors the private constant and PersistedToken shape in CliTokenManager.ts; the module
// exports neither. Structural here on purpose -- the test asserts on the persisted bytes,
// not on the class identity.
const CLOUD_CLI_OAUTH_TOKEN_SECRET = "cloud-cli-oauth-token";

const TestPersistedTokenJson = Schema.fromJsonString(
  Schema.Struct({
    accessToken: Schema.String,
    refreshToken: Schema.String,
    expiresAtEpochMs: Schema.Number,
    identity: Schema.optional(Schema.String),
  }),
);
const encodeTestPersistedToken = Schema.encodeSync(TestPersistedTokenJson);
const decodeTestPersistedToken = Schema.decodeSync(TestPersistedTokenJson);

function makeMemorySecretStore() {
  const values = new Map<string, Uint8Array>();
  const store = {
    get: ((name) =>
      Effect.sync(() => {
        const value = values.get(name);
        return value === undefined ? Option.none() : Option.some(Uint8Array.from(value));
      })) satisfies ServerSecretStore.ServerSecretStore["Service"]["get"],
    set: ((name, value) =>
      Effect.sync(() => {
        values.set(name, Uint8Array.from(value));
      })) satisfies ServerSecretStore.ServerSecretStore["Service"]["set"],
    create: ((name, value) =>
      Effect.sync(() => {
        values.set(name, Uint8Array.from(value));
      })) satisfies ServerSecretStore.ServerSecretStore["Service"]["create"],
    getOrCreateRandom: ((name, bytes) =>
      Effect.sync(() => {
        const existing = values.get(name);
        if (existing) {
          return existing;
        }
        const generated = new Uint8Array(bytes);
        values.set(name, generated);
        return generated;
      })) satisfies ServerSecretStore.ServerSecretStore["Service"]["getOrCreateRandom"],
    remove: ((name) =>
      Effect.sync(() => {
        values.delete(name);
      })) satisfies ServerSecretStore.ServerSecretStore["Service"]["remove"],
  } satisfies ServerSecretStore.ServerSecretStore["Service"];
  return {
    store,
    setString: (name: string, value: string) => store.set(name, new TextEncoder().encode(value)),
  };
}

const provideTestEnv = Effect.provide(
  ConfigProvider.layer(ConfigProvider.fromEnv({ env: TEST_ENV })),
);

const isAuthorizationError = Schema.is(CliTokenManager.CloudCliAuthorizationError);

class PromptRejectedError extends Schema.TaggedErrorClass<PromptRejectedError>()(
  "PromptRejectedError",
  { message: Schema.String },
) {}

it("formats loopback authorization with a headless-host fallback", () => {
  assert.equal(
    CliTokenManager.formatLoopbackAuthorizationPrompt("https://clerk.example.test/authorize"),
    [
      "Open this URL to authorize T3 Connect:",
      "  https://clerk.example.test/authorize",
      "",
      "Press \u001b[1mEnter\u001b[22m to open it in your browser.",
      "No browser on this device? Press \u001b[1mH\u001b[22m to switch to headless mode.",
    ].join("\n"),
  );
});

const makeTestTerminal = (queue: Queue.Queue<Terminal.UserInput>) =>
  Terminal.make({
    columns: Effect.succeed(80),
    rows: Effect.succeed(24),
    readInput: Effect.succeed(Queue.asDequeue(queue)),
    readLine: Effect.never,
    display: () => Effect.void,
  });

const userInput = (name: string): Terminal.UserInput => ({
  input: Option.some(name),
  key: { name, ctrl: false, meta: false, shift: name !== name.toLowerCase() },
});

it.effect("opens the browser on Enter and switches the active flow on H", () =>
  Effect.gen(function* () {
    const queue = yield* Queue.make<Terminal.UserInput>();
    yield* Queue.offerAll(queue, [userInput("enter"), userInput("H")]);
    const opened: Array<string> = [];

    const result = yield* CliTokenManager.waitForLoopbackAuthorization({
      authorizationUrl: "https://clerk.example.test/authorize",
      callback: Effect.never,
      terminal: makeTestTerminal(queue),
      launchBrowser: (url) =>
        Effect.sync(() => {
          opened.push(url);
        }),
    });

    assert.deepEqual(opened, ["https://clerk.example.test/authorize"]);
    assert.deepEqual(result, { _tag: "HeadlessRequested" });
  }),
);

it.effect("finishes normally when the browser callback wins", () =>
  Effect.gen(function* () {
    const queue = yield* Queue.make<Terminal.UserInput>();
    const callback = yield* Deferred.make<string>();
    yield* Deferred.succeed(callback, "clerk-code-123");

    const result = yield* CliTokenManager.waitForLoopbackAuthorization({
      authorizationUrl: "https://clerk.example.test/authorize",
      callback: Deferred.await(callback),
      terminal: makeTestTerminal(queue),
      launchBrowser: () => Effect.die("browser launch should not run"),
    });

    assert.deepEqual(result, { _tag: "AuthorizationCode", code: "clerk-code-123" });
  }),
);

it.layer(NodeServices.layer)("CliTokenManager.outOfBandOAuthLogin", (it) => {
  it.effect("prints a hosted authorize URL and exchanges the out-of-band code with PKCE", () =>
    Effect.gen(function* () {
      const requests: Array<RecordedTokenRequest> = [];
      let seenAuthorizeUrl = "";

      const { token, identity } = yield* CliTokenManager.outOfBandOAuthLogin(
        ({ authorizeUrl, validate }: OutOfBandOAuthPromptInput) =>
          Effect.gen(function* () {
            seenAuthorizeUrl = authorizeUrl;
            const request = readConnectAuthorizeRequest(new URL(authorizeUrl));
            assert.isNotNull(request);
            return yield* validate(`clerk-code-123.${request!.state}`).pipe(
              Effect.mapError((message) => new PromptRejectedError({ message })),
            );
          }),
      ).pipe(Effect.provide(makeTokenEndpointLayer(requests)), provideTestEnv);

      const authorizeUrl = new URL(seenAuthorizeUrl);
      assert.equal(authorizeUrl.origin, "https://hosted.example.test");
      assert.equal(authorizeUrl.pathname, "/connect");
      const request = readConnectAuthorizeRequest(authorizeUrl);
      assert.isNotNull(request);
      assert.match(request!.state, /^[A-Za-z0-9_-]{22}$/);

      assert.equal(token.accessToken, "access-token-1");
      assert.equal(token.refreshToken, "refresh-token-1");
      assert.equal(token.identity, "theo@example.test");
      // The id_token's email claim is surfaced so connect can show the account.
      assert.equal(identity, "theo@example.test");

      assert.lengthOf(requests, 1);
      const exchange = requests[0]!;
      assert.equal(exchange.url, "https://clerk.example.test/oauth/token");
      assert.equal(exchange.params.get("grant_type"), "authorization_code");
      assert.equal(exchange.params.get("code"), "clerk-code-123");
      assert.equal(
        exchange.params.get("redirect_uri"),
        "https://hosted.example.test/connect/callback",
      );
      assert.equal(exchange.params.get("client_id"), "oauth_client_test");
      // The verifier must hash to the challenge advertised in the authorize URL.
      const verifier = exchange.params.get("code_verifier");
      assert.isNotNull(verifier);
      const crypto = yield* Crypto.Crypto;
      const digest = yield* crypto.digest("SHA-256", new TextEncoder().encode(verifier!));
      assert.equal(Encoding.encodeBase64Url(digest), request!.challenge);
    }),
  );

  it.effect("rejects out-of-band codes whose state does not match the request", () =>
    Effect.gen(function* () {
      const requests: Array<RecordedTokenRequest> = [];

      const validationErrors: Array<string> = [];
      const result = yield* CliTokenManager.outOfBandOAuthLogin(
        ({ validate }: OutOfBandOAuthPromptInput) =>
          validate("clerk-code-123.wrong-state").pipe(
            Effect.tapError((message) => Effect.sync(() => validationErrors.push(message))),
            Effect.mapError((message) => new PromptRejectedError({ message })),
          ),
      ).pipe(Effect.provide(makeTokenEndpointLayer(requests)), provideTestEnv, Effect.flip);

      assert.lengthOf(requests, 0);
      assert.lengthOf(validationErrors, 1);
      assert.include(validationErrors[0], "different connect request");
      assert.instanceOf(result, PromptRejectedError);
    }),
  );

  it.effect("ignores an id_token whose claims are not valid JSON", () =>
    Effect.gen(function* () {
      const requests: Array<RecordedTokenRequest> = [];
      const malformedIdToken = `header.${Encoding.encodeBase64Url("not-json")}.signature`;

      const { identity } = yield* CliTokenManager.outOfBandOAuthLogin(
        ({ authorizeUrl }: OutOfBandOAuthPromptInput) => {
          const request = readConnectAuthorizeRequest(new URL(authorizeUrl));
          assert.isNotNull(request);
          return Effect.succeed(`clerk-code-123.${request!.state}`);
        },
      ).pipe(
        Effect.provide(makeTokenEndpointLayer(requests, { idToken: malformedIdToken })),
        provideTestEnv,
      );

      assert.isNull(identity);
      assert.lengthOf(requests, 1);
    }),
  );

  it.effect("fails without touching the token endpoint when the prompt returns garbage", () =>
    Effect.gen(function* () {
      const requests: Array<RecordedTokenRequest> = [];

      const result = yield* CliTokenManager.outOfBandOAuthLogin(() =>
        Effect.succeed("not-a-connect-code"),
      ).pipe(Effect.provide(makeTokenEndpointLayer(requests)), provideTestEnv, Effect.flip);

      assert.lengthOf(requests, 0);
      assert.isTrue(isAuthorizationError(result));
    }),
  );
});

// Refresh responses legitimately omit id_token, so the stored identity has to be carried
// forward onto the refreshed token. That carry-forward is the one branch that rebuilds the
// token from a spread, and spreading a Schema.Class yields a plain object that the encode in
// persist() rejects nominally -- while still typechecking. Only an end-to-end getExisting
// exercises it, because persist is internal.
it.layer(NodeServices.layer)("CliTokenManager.getExisting", (it) => {
  it.effect("carries the stored identity onto a refreshed token that omits id_token", () =>
    Effect.gen(function* () {
      const requests: Array<RecordedTokenRequest> = [];
      const secrets = makeMemorySecretStore();
      // expiresAtEpochMs 0 forces the refresh branch rather than returning the stored token.
      yield* secrets.setString(
        CLOUD_CLI_OAUTH_TOKEN_SECRET,
        encodeTestPersistedToken({
          accessToken: "access-token-0",
          refreshToken: "refresh-token-0",
          expiresAtEpochMs: 0,
          identity: "theo@example.test",
        }),
      );

      const token = yield* Effect.gen(function* () {
        const manager = yield* CliTokenManager.CloudCliTokenManager;
        return yield* manager.getExisting;
      }).pipe(
        Effect.provide(
          CliTokenManager.layer.pipe(
            Layer.provide([
              makeTokenEndpointLayerWithoutIdToken(requests),
              Layer.succeed(ServerSecretStore.ServerSecretStore, secrets.store),
              Layer.succeed(ExternalLauncher.ExternalLauncher, {
                resolveAvailableEditors: () => Effect.succeed([]),
                launchBrowser: () => Effect.void,
                launchEditor: () => Effect.void,
              }),
            ]),
          ),
        ),
        provideTestEnv,
      );

      assert.isTrue(Option.isSome(token));
      const refreshed = Option.getOrThrow(token);
      assert.equal(refreshed.accessToken, "access-token-1");
      assert.equal(refreshed.identity, "theo@example.test");

      assert.lengthOf(requests, 1);
      assert.equal(requests[0]!.params.get("grant_type"), "refresh_token");
      assert.equal(requests[0]!.params.get("refresh_token"), "refresh-token-0");

      // The refreshed token must have round-tripped through persist()'s encode. Reading it
      // back is what would have caught the plain-object regression.
      const stored = yield* secrets.store.get(CLOUD_CLI_OAUTH_TOKEN_SECRET);
      assert.isTrue(Option.isSome(stored));
      const persisted = decodeTestPersistedToken(
        new TextDecoder().decode(Option.getOrThrow(stored)),
      );
      assert.deepStrictEqual(persisted, {
        accessToken: "access-token-1",
        refreshToken: "refresh-token-1",
        expiresAtEpochMs: refreshed.expiresAtEpochMs,
        identity: "theo@example.test",
      });
    }),
  );
});
