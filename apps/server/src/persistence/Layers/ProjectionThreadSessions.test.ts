import { ProviderInstanceId, ThreadId, TurnId } from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import {
  ProjectionThreadSession,
  ProjectionThreadSessionRepository,
} from "../Services/ProjectionThreadSessions.ts";
import { SqlitePersistenceMemory } from "./Sqlite.ts";

const layer = it.layer(
  ProjectionThreadSessionRepository.layer.pipe(Layer.provideMerge(SqlitePersistenceMemory)),
);

layer("ProjectionThreadSessionRepository", (it) => {
  it.effect("upserts, reads, and deletes a thread session", () =>
    Effect.gen(function* () {
      const repository = yield* ProjectionThreadSessionRepository;
      const threadId = ThreadId.make("thread-session");

      yield* repository.upsert(
        new ProjectionThreadSession({
          threadId,
          status: "starting",
          providerName: "codex",
          providerInstanceId: ProviderInstanceId.make("codex"),
          runtimeMode: "full-access",
          activeTurnId: null,
          lastError: null,
          updatedAt: "2026-07-27T10:00:00.000Z",
        }),
      );

      const updated = new ProjectionThreadSession({
        threadId,
        status: "running",
        providerName: "codex",
        providerInstanceId: ProviderInstanceId.make("codex"),
        runtimeMode: "full-access",
        activeTurnId: TurnId.make("turn-session"),
        lastError: null,
        updatedAt: "2026-07-27T10:01:00.000Z",
      });
      yield* repository.upsert(updated);

      assert.deepEqual(Option.getOrThrow(yield* repository.getByThreadId(threadId)), updated);

      yield* repository.deleteByThreadId(threadId);

      assert.isTrue(Option.isNone(yield* repository.getByThreadId(threadId)));
    }),
  );
});
