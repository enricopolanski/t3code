import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";

import { AuthEnvironmentScopes } from "@t3tools/contracts";

import {
  type AuthPairingLinkRepositoryError,
  PersistenceDecodeError,
  type PersistenceErrorCorrelation,
  PersistenceSqlError,
} from "./Errors.ts";

class AuthPairingLinkRecord extends Schema.Class<AuthPairingLinkRecord>("AuthPairingLinkRecord")({
  id: Schema.String,
  credential: Schema.String,
  method: Schema.Literals(["desktop-bootstrap", "one-time-token"]),
  scopes: Schema.fromJsonString(AuthEnvironmentScopes),
  subject: Schema.String,
  label: Schema.NullOr(Schema.String),
  proofKeyThumbprint: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.DateTimeUtcFromString,
  consumedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
}) {}

export class CreateAuthPairingLinkInput extends Schema.Class<CreateAuthPairingLinkInput>(
  "CreateAuthPairingLinkInput",
)({
  id: Schema.String,
  credential: Schema.String,
  method: Schema.Literals(["desktop-bootstrap", "one-time-token"]),
  scopes: AuthEnvironmentScopes,
  subject: Schema.String,
  label: Schema.NullOr(Schema.String),
  proofKeyThumbprint: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.DateTimeUtcFromString,
}) {}

export class ConsumeAuthPairingLinkInput extends Schema.Class<ConsumeAuthPairingLinkInput>(
  "ConsumeAuthPairingLinkInput",
)({
  credential: Schema.String,
  proofKeyThumbprint: Schema.NullOr(Schema.String),
  consumedAt: Schema.DateTimeUtcFromString,
  now: Schema.DateTimeUtcFromString,
}) {}

const RevokeAuthPairingLinkRequest = Schema.Struct({
  id: Schema.String,
  revokedAt: Schema.DateTimeUtcFromString,
});

class AuthPairingLinkRawDbRow extends Schema.Class<AuthPairingLinkRawDbRow>(
  "AuthPairingLinkRawDbRow",
)({
  id: Schema.String,
  credential: Schema.Unknown,
  method: Schema.Unknown,
  scopes: Schema.Unknown,
  subject: Schema.Unknown,
  label: Schema.Unknown,
  proofKeyThumbprint: Schema.Unknown,
  createdAt: Schema.Unknown,
  expiresAt: Schema.Unknown,
  consumedAt: Schema.Unknown,
  revokedAt: Schema.Unknown,
}) {}

const decodeAuthPairingLinkDbRow = Schema.decodeUnknownEffect(AuthPairingLinkRecord);

function toPersistenceSqlOrDecodeError(
  sqlOperation: string,
  decodeOperation: string,
  correlation?: PersistenceErrorCorrelation,
) {
  return (cause: unknown): AuthPairingLinkRepositoryError =>
    Schema.isSchemaError(cause)
      ? PersistenceDecodeError.fromSchemaError(decodeOperation, cause, correlation)
      : new PersistenceSqlError({
          operation: sqlOperation,
          ...(correlation === undefined ? {} : { correlation }),
          cause,
        });
}

export class AuthPairingLinkRepository extends Context.Service<AuthPairingLinkRepository>()(
  "t3/persistence/AuthPairingLinks/AuthPairingLinkRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const createPairingLinkRow = SqlSchema.void({
        Request: CreateAuthPairingLinkInput,
        execute: (input) =>
          sql`
            INSERT INTO auth_pairing_links (
              id,
              credential,
              method,
              scopes,
              subject,
              label,
              proof_key_thumbprint,
              created_at,
              expires_at,
              consumed_at,
              revoked_at
            )
            VALUES (
              ${input.id},
              ${input.credential},
              ${input.method},
              ${JSON.stringify(input.scopes)},
              ${input.subject},
              ${input.label},
              ${input.proofKeyThumbprint},
              ${input.createdAt},
              ${input.expiresAt},
              NULL,
              NULL
            )
          `,
      });

      const consumeAvailablePairingLinkRow = SqlSchema.findOneOption({
        Request: ConsumeAuthPairingLinkInput,
        Result: AuthPairingLinkRawDbRow,
        execute: ({ credential, proofKeyThumbprint, consumedAt, now }) =>
          sql`
            UPDATE auth_pairing_links
            SET consumed_at = ${consumedAt}
            WHERE credential = ${credential}
              AND revoked_at IS NULL
              AND consumed_at IS NULL
              AND expires_at > ${now}
              AND (
                proof_key_thumbprint IS NULL
                OR proof_key_thumbprint = ${proofKeyThumbprint}
              )
            RETURNING
              id AS "id",
              credential AS "credential",
              method AS "method",
              scopes AS "scopes",
              subject AS "subject",
              label AS "label",
              proof_key_thumbprint AS "proofKeyThumbprint",
              created_at AS "createdAt",
              expires_at AS "expiresAt",
              consumed_at AS "consumedAt",
              revoked_at AS "revokedAt"
          `,
      });

      const listActivePairingLinkRows = SqlSchema.findAll({
        Request: Schema.DateTimeUtcFromString,
        Result: AuthPairingLinkRawDbRow,
        execute: (now) =>
          sql`
            SELECT
              id AS "id",
              credential AS "credential",
              method AS "method",
              scopes AS "scopes",
              subject AS "subject",
              label AS "label",
              proof_key_thumbprint AS "proofKeyThumbprint",
              created_at AS "createdAt",
              expires_at AS "expiresAt",
              consumed_at AS "consumedAt",
              revoked_at AS "revokedAt"
            FROM auth_pairing_links
            WHERE revoked_at IS NULL
              AND consumed_at IS NULL
              AND expires_at > ${now}
            ORDER BY created_at DESC, id DESC
          `,
      });

      const revokePairingLinkRow = SqlSchema.findAll({
        Request: RevokeAuthPairingLinkRequest,
        Result: Schema.Struct({ id: Schema.String }),
        execute: ({ id, revokedAt }) =>
          sql`
            UPDATE auth_pairing_links
            SET revoked_at = ${revokedAt}
            WHERE id = ${id}
              AND revoked_at IS NULL
              AND consumed_at IS NULL
            RETURNING id AS "id"
          `,
      });

      const getPairingLinkRowByCredential = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: AuthPairingLinkRawDbRow,
        execute: (credential) =>
          sql`
            SELECT
              id AS "id",
              credential AS "credential",
              method AS "method",
              scopes AS "scopes",
              subject AS "subject",
              label AS "label",
              proof_key_thumbprint AS "proofKeyThumbprint",
              created_at AS "createdAt",
              expires_at AS "expiresAt",
              consumed_at AS "consumedAt",
              revoked_at AS "revokedAt"
            FROM auth_pairing_links
            WHERE credential = ${credential}
          `,
      });

      const create = (
        input: CreateAuthPairingLinkInput,
      ): Effect.Effect<void, AuthPairingLinkRepositoryError> =>
        createPairingLinkRow(input).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "AuthPairingLinkRepository.create:query",
              "AuthPairingLinkRepository.create:encodeRequest",
              { pairingLinkId: input.id },
            ),
          ),
        );

      const consumeAvailable = (
        input: ConsumeAuthPairingLinkInput,
      ): Effect.Effect<Option.Option<AuthPairingLinkRecord>, AuthPairingLinkRepositoryError> =>
        consumeAvailablePairingLinkRow(input).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "AuthPairingLinkRepository.consumeAvailable:query",
              "AuthPairingLinkRepository.consumeAvailable:decodeRow",
            ),
          ),
          Effect.flatMap((rowOption) =>
            Option.match(rowOption, {
              onNone: () => Effect.succeed(Option.none()),
              onSome: (row) =>
                decodeAuthPairingLinkDbRow(row).pipe(
                  Effect.mapError((cause) =>
                    PersistenceDecodeError.fromSchemaError(
                      "AuthPairingLinkRepository.consumeAvailable:decodeRow",
                      cause,
                      { pairingLinkId: row.id },
                    ),
                  ),
                  Effect.map(Option.some),
                ),
            }),
          ),
        );

      const listActive = (
        now: DateTime.Utc,
      ): Effect.Effect<ReadonlyArray<AuthPairingLinkRecord>, AuthPairingLinkRepositoryError> =>
        listActivePairingLinkRows(now).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "AuthPairingLinkRepository.listActive:query",
              "AuthPairingLinkRepository.listActive:decodeRows",
            ),
          ),
          Effect.flatMap((rows) =>
            Effect.forEach(rows, (row) =>
              decodeAuthPairingLinkDbRow(row).pipe(
                Effect.mapError((cause) =>
                  PersistenceDecodeError.fromSchemaError(
                    "AuthPairingLinkRepository.listActive:decodeRows",
                    cause,
                    { pairingLinkId: row.id },
                  ),
                ),
              ),
            ),
          ),
        );

      const revoke = (
        id: string,
        revokedAt: DateTime.Utc,
      ): Effect.Effect<boolean, AuthPairingLinkRepositoryError> =>
        revokePairingLinkRow({ id, revokedAt }).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "AuthPairingLinkRepository.revoke:query",
              "AuthPairingLinkRepository.revoke:decodeRows",
              { pairingLinkId: id },
            ),
          ),
          Effect.map((rows) => rows.length > 0),
        );

      const getByCredential = (
        credential: string,
      ): Effect.Effect<Option.Option<AuthPairingLinkRecord>, AuthPairingLinkRepositoryError> =>
        getPairingLinkRowByCredential(credential).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "AuthPairingLinkRepository.getByCredential:query",
              "AuthPairingLinkRepository.getByCredential:decodeRow",
            ),
          ),
          Effect.flatMap((rowOption) =>
            Option.match(rowOption, {
              onNone: () => Effect.succeed(Option.none()),
              onSome: (row) =>
                decodeAuthPairingLinkDbRow(row).pipe(
                  Effect.mapError((cause) =>
                    PersistenceDecodeError.fromSchemaError(
                      "AuthPairingLinkRepository.getByCredential:decodeRow",
                      cause,
                      { pairingLinkId: row.id },
                    ),
                  ),
                  Effect.map(Option.some),
                ),
            }),
          ),
        );

      return {
        create,
        consumeAvailable,
        listActive,
        revoke,
        getByCredential,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this)(this.make);
}
