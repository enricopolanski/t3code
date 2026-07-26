import {
  IsoDateTime,
  OrchestrationProposedPlanId,
  ThreadId,
  TrimmedNonEmptyString,
  TurnId,
} from "@t3tools/contracts";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type ProjectionRepositoryError,
  toPersistenceDecodeError,
  toPersistenceSqlError,
} from "../Errors.ts";

export class ProjectionThreadProposedPlan extends Schema.Class<ProjectionThreadProposedPlan>(
  "ProjectionThreadProposedPlan",
)({
  planId: OrchestrationProposedPlanId,
  threadId: ThreadId,
  turnId: Schema.NullOr(TurnId),
  planMarkdown: TrimmedNonEmptyString,
  implementedAt: Schema.NullOr(IsoDateTime),
  implementationThreadId: Schema.NullOr(ThreadId),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}) {}

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown): ProjectionRepositoryError =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

export class ProjectionThreadProposedPlanRepository extends Context.Service<ProjectionThreadProposedPlanRepository>()(
  "t3/persistence/Services/ProjectionThreadProposedPlans/ProjectionThreadProposedPlanRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const upsertProjectionThreadProposedPlanRow = SqlSchema.void({
        Request: ProjectionThreadProposedPlan,
        execute: (row) => sql`
          INSERT INTO projection_thread_proposed_plans (
            plan_id,
            thread_id,
            turn_id,
            plan_markdown,
            implemented_at,
            implementation_thread_id,
            created_at,
            updated_at
          )
          VALUES (
            ${row.planId},
            ${row.threadId},
            ${row.turnId},
            ${row.planMarkdown},
            ${row.implementedAt},
            ${row.implementationThreadId},
            ${row.createdAt},
            ${row.updatedAt}
          )
          ON CONFLICT (plan_id)
          DO UPDATE SET
            thread_id = excluded.thread_id,
            turn_id = excluded.turn_id,
            plan_markdown = excluded.plan_markdown,
            implemented_at = excluded.implemented_at,
            implementation_thread_id = excluded.implementation_thread_id,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
        `,
      });

      const listProjectionThreadProposedPlanRows = SqlSchema.findAll({
        Request: ThreadId,
        Result: ProjectionThreadProposedPlan,
        execute: (threadId) => sql`
          SELECT
            plan_id AS "planId",
            thread_id AS "threadId",
            turn_id AS "turnId",
            plan_markdown AS "planMarkdown",
            implemented_at AS "implementedAt",
            implementation_thread_id AS "implementationThreadId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM projection_thread_proposed_plans
          WHERE thread_id = ${threadId}
          ORDER BY created_at ASC, plan_id ASC
        `,
      });

      const deleteProjectionThreadProposedPlanRows = SqlSchema.void({
        Request: ThreadId,
        execute: (threadId) => sql`
          DELETE FROM projection_thread_proposed_plans
          WHERE thread_id = ${threadId}
        `,
      });

      const upsert = (
        proposedPlan: ProjectionThreadProposedPlan,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        upsertProjectionThreadProposedPlanRow(proposedPlan).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadProposedPlanRepository.upsert:query",
              "ProjectionThreadProposedPlanRepository.upsert:encodeRequest",
            ),
          ),
        );

      const listByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<ReadonlyArray<ProjectionThreadProposedPlan>, ProjectionRepositoryError> =>
        listProjectionThreadProposedPlanRows(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadProposedPlanRepository.listByThreadId:query",
              "ProjectionThreadProposedPlanRepository.listByThreadId:decodeRows",
            ),
          ),
        );

      const deleteByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        deleteProjectionThreadProposedPlanRows(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadProposedPlanRepository.deleteByThreadId:query",
              "ProjectionThreadProposedPlanRepository.deleteByThreadId:encodeRequest",
            ),
          ),
        );

      return {
        upsert,
        listByThreadId,
        deleteByThreadId,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this)(this.make);
}
