/**
 * ProjectionThreadRepository - Projection repository interface for threads.
 *
 * Owns persistence operations for projected thread records in the
 * orchestration read model.
 *
 * @module ProjectionThreadRepository
 */
import {
  IsoDateTime,
  ModelSelection,
  NonNegativeInt,
  ProjectId,
  ProviderInteractionMode,
  RuntimeMode,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type ProjectionRepositoryError,
  toPersistenceDecodeError,
  toPersistenceSqlError,
} from "../Errors.ts";

export class ProjectionThread extends Schema.Class<ProjectionThread>("ProjectionThread")({
  threadId: ThreadId,
  projectId: ProjectId,
  title: Schema.String,
  modelSelection: Schema.fromJsonString(ModelSelection),
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode,
  branch: Schema.NullOr(Schema.String),
  worktreePath: Schema.NullOr(Schema.String),
  latestTurnId: Schema.NullOr(TurnId),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  archivedAt: Schema.NullOr(IsoDateTime),
  settledOverride: Schema.NullOr(Schema.Literals(["settled", "active"])),
  settledAt: Schema.NullOr(IsoDateTime),
  snoozedUntil: Schema.NullOr(IsoDateTime),
  snoozedAt: Schema.NullOr(IsoDateTime),
  latestUserMessageAt: Schema.NullOr(IsoDateTime),
  pendingApprovalCount: NonNegativeInt,
  pendingUserInputCount: NonNegativeInt,
  hasActionableProposedPlan: NonNegativeInt,
  deletedAt: Schema.NullOr(IsoDateTime),
}) {}

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown): ProjectionRepositoryError =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

/**
 * ProjectionThreadRepository - Service and SQLite-backed layer for thread projection
 * persistence.
 */
export class ProjectionThreadRepository extends Context.Service<ProjectionThreadRepository>()(
  "t3/persistence/Services/ProjectionThreads/ProjectionThreadRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const upsertProjectionThreadRow = SqlSchema.void({
        Request: ProjectionThread,
        execute: (row) =>
          sql`
            INSERT INTO projection_threads (
              thread_id,
              project_id,
              title,
              model_selection_json,
              runtime_mode,
              interaction_mode,
              branch,
              worktree_path,
              latest_turn_id,
              created_at,
              updated_at,
              archived_at,
              settled_override,
              settled_at,
              snoozed_until,
              snoozed_at,
              latest_user_message_at,
              pending_approval_count,
              pending_user_input_count,
              has_actionable_proposed_plan,
              deleted_at
            )
            VALUES (
              ${row.threadId},
              ${row.projectId},
              ${row.title},
              ${row.modelSelection},
              ${row.runtimeMode},
              ${row.interactionMode},
              ${row.branch},
              ${row.worktreePath},
              ${row.latestTurnId},
              ${row.createdAt},
              ${row.updatedAt},
              ${row.archivedAt},
              ${row.settledOverride},
              ${row.settledAt},
              ${row.snoozedUntil},
              ${row.snoozedAt},
              ${row.latestUserMessageAt},
              ${row.pendingApprovalCount},
              ${row.pendingUserInputCount},
              ${row.hasActionableProposedPlan},
              ${row.deletedAt}
            )
            ON CONFLICT (thread_id)
            DO UPDATE SET
              project_id = excluded.project_id,
              title = excluded.title,
              model_selection_json = excluded.model_selection_json,
              runtime_mode = excluded.runtime_mode,
              interaction_mode = excluded.interaction_mode,
              branch = excluded.branch,
              worktree_path = excluded.worktree_path,
              latest_turn_id = excluded.latest_turn_id,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              archived_at = excluded.archived_at,
              settled_override = excluded.settled_override,
              settled_at = excluded.settled_at,
              snoozed_until = excluded.snoozed_until,
              snoozed_at = excluded.snoozed_at,
              latest_user_message_at = excluded.latest_user_message_at,
              pending_approval_count = excluded.pending_approval_count,
              pending_user_input_count = excluded.pending_user_input_count,
              has_actionable_proposed_plan = excluded.has_actionable_proposed_plan,
              deleted_at = excluded.deleted_at
          `,
      });

      const getProjectionThreadRow = SqlSchema.findOneOption({
        Request: ThreadId,
        Result: ProjectionThread,
        execute: (threadId) =>
          sql`
            SELECT
              thread_id AS "threadId",
              project_id AS "projectId",
              title,
              model_selection_json AS "modelSelection",
              runtime_mode AS "runtimeMode",
              interaction_mode AS "interactionMode",
              branch,
              worktree_path AS "worktreePath",
              latest_turn_id AS "latestTurnId",
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              archived_at AS "archivedAt",
              settled_override AS "settledOverride",
              settled_at AS "settledAt",
              snoozed_until AS "snoozedUntil",
              snoozed_at AS "snoozedAt",
              latest_user_message_at AS "latestUserMessageAt",
              pending_approval_count AS "pendingApprovalCount",
              pending_user_input_count AS "pendingUserInputCount",
              has_actionable_proposed_plan AS "hasActionableProposedPlan",
              deleted_at AS "deletedAt"
            FROM projection_threads
            WHERE thread_id = ${threadId}
          `,
      });

      const listProjectionThreadRows = SqlSchema.findAll({
        Request: ProjectId,
        Result: ProjectionThread,
        execute: (projectId) =>
          sql`
            SELECT
              thread_id AS "threadId",
              project_id AS "projectId",
              title,
              model_selection_json AS "modelSelection",
              runtime_mode AS "runtimeMode",
              interaction_mode AS "interactionMode",
              branch,
              worktree_path AS "worktreePath",
              latest_turn_id AS "latestTurnId",
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              archived_at AS "archivedAt",
              settled_override AS "settledOverride",
              settled_at AS "settledAt",
              snoozed_until AS "snoozedUntil",
              snoozed_at AS "snoozedAt",
              latest_user_message_at AS "latestUserMessageAt",
              pending_approval_count AS "pendingApprovalCount",
              pending_user_input_count AS "pendingUserInputCount",
              has_actionable_proposed_plan AS "hasActionableProposedPlan",
              deleted_at AS "deletedAt"
            FROM projection_threads
            WHERE project_id = ${projectId}
            ORDER BY created_at ASC, thread_id ASC
          `,
      });

      const deleteProjectionThreadRow = SqlSchema.void({
        Request: ThreadId,
        execute: (threadId) =>
          sql`
            DELETE FROM projection_threads
            WHERE thread_id = ${threadId}
          `,
      });

      /**
       * Insert or replace a projected thread row.
       *
       * Upserts by `threadId`.
       */
      const upsert = (thread: ProjectionThread): Effect.Effect<void, ProjectionRepositoryError> =>
        upsertProjectionThreadRow(thread).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadRepository.upsert:query",
              "ProjectionThreadRepository.upsert:encodeRequest",
            ),
          ),
        );

      /**
       * Read a projected thread row by id.
       */
      const getById = (
        threadId: ThreadId,
      ): Effect.Effect<Option.Option<ProjectionThread>, ProjectionRepositoryError> =>
        getProjectionThreadRow(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadRepository.getById:query",
              "ProjectionThreadRepository.getById:decodeRow",
            ),
          ),
        );

      /**
       * List projected threads for a project.
       *
       * Returned in deterministic creation order.
       */
      const listByProjectId = (
        projectId: ProjectId,
      ): Effect.Effect<ReadonlyArray<ProjectionThread>, ProjectionRepositoryError> =>
        listProjectionThreadRows(projectId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadRepository.listByProjectId:query",
              "ProjectionThreadRepository.listByProjectId:decodeRows",
            ),
          ),
        );

      /**
       * Soft-delete a projected thread row by id.
       */
      const deleteById = (threadId: ThreadId): Effect.Effect<void, ProjectionRepositoryError> =>
        deleteProjectionThreadRow(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadRepository.deleteById:query",
              "ProjectionThreadRepository.deleteById:encodeRequest",
            ),
          ),
        );

      return {
        upsert,
        getById,
        listByProjectId,
        deleteById,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this)(this.make);
}
