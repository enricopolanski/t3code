import { ThreadId, TurnId } from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  ProjectionThreadProposedPlan,
  ProjectionThreadProposedPlanRepository,
} from "../Services/ProjectionThreadProposedPlans.ts";
import { SqlitePersistenceMemory } from "../Layers/Sqlite.ts";

const layer = it.layer(
  ProjectionThreadProposedPlanRepository.layer.pipe(Layer.provideMerge(SqlitePersistenceMemory)),
);

layer("ProjectionThreadProposedPlanRepository", (it) => {
  it.effect("upserts, lists, and deletes proposed plans by thread", () =>
    Effect.gen(function* () {
      const repository = yield* ProjectionThreadProposedPlanRepository;
      const threadId = ThreadId.make("thread-proposed-plans");
      const otherThreadId = ThreadId.make("thread-proposed-plans-other");
      const createdAt = "2026-07-26T12:00:00.000Z";

      yield* repository.upsert(
        new ProjectionThreadProposedPlan({
          planId: "plan-proposed",
          threadId,
          turnId: TurnId.make("turn-proposed"),
          planMarkdown: "# Initial plan",
          implementedAt: null,
          implementationThreadId: null,
          createdAt,
          updatedAt: createdAt,
        }),
      );

      const updatedPlan = new ProjectionThreadProposedPlan({
        planId: "plan-proposed",
        threadId,
        turnId: TurnId.make("turn-proposed"),
        planMarkdown: "# Updated plan",
        implementedAt: "2026-07-26T12:01:00.000Z",
        implementationThreadId: ThreadId.make("thread-implementation"),
        createdAt,
        updatedAt: "2026-07-26T12:01:00.000Z",
      });
      yield* repository.upsert(updatedPlan);

      yield* repository.upsert(
        new ProjectionThreadProposedPlan({
          planId: "plan-proposed-other",
          threadId: otherThreadId,
          turnId: null,
          planMarkdown: "# Other plan",
          implementedAt: null,
          implementationThreadId: null,
          createdAt,
          updatedAt: createdAt,
        }),
      );

      assert.deepEqual(yield* repository.listByThreadId(threadId), [updatedPlan]);

      yield* repository.deleteByThreadId(threadId);

      assert.deepEqual(yield* repository.listByThreadId(threadId), []);
      assert.equal((yield* repository.listByThreadId(otherThreadId)).length, 1);
    }),
  );
});
