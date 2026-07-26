/**
 * ProjectionTurnRepository - Projection repository interface for unified turn state.
 *
 * Owns persistence operations for pending starts, running/completed turn lifecycle,
 * and checkpoint metadata in a single projection table.
 *
 * @module ProjectionTurnRepository
 */
import {
  CheckpointRef,
  IsoDateTime,
  MessageId,
  NonNegativeInt,
  OrchestrationProposedPlanId,
  OrchestrationCheckpointFile,
  OrchestrationCheckpointStatus,
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

export const ProjectionTurnState = Schema.Literals([
  "pending",
  "running",
  "interrupted",
  "completed",
  "error",
]);
export type ProjectionTurnState = typeof ProjectionTurnState.Type;

export class ProjectionTurn extends Schema.Class<ProjectionTurn>("ProjectionTurn")({
  threadId: ThreadId,
  turnId: Schema.NullOr(TurnId),
  pendingMessageId: Schema.NullOr(MessageId),
  sourceProposedPlanThreadId: Schema.NullOr(ThreadId),
  sourceProposedPlanId: Schema.NullOr(OrchestrationProposedPlanId),
  assistantMessageId: Schema.NullOr(MessageId),
  state: ProjectionTurnState,
  requestedAt: IsoDateTime,
  startedAt: Schema.NullOr(IsoDateTime),
  completedAt: Schema.NullOr(IsoDateTime),
  checkpointTurnCount: Schema.NullOr(NonNegativeInt),
  checkpointRef: Schema.NullOr(CheckpointRef),
  checkpointStatus: Schema.NullOr(OrchestrationCheckpointStatus),
  checkpointFiles: Schema.fromJsonString(Schema.Array(OrchestrationCheckpointFile)),
}) {}

export class ProjectionTurnById extends ProjectionTurn.extend<ProjectionTurnById>(
  "ProjectionTurnById",
)({
  turnId: TurnId,
}) {}

export class ProjectionPendingTurnStart extends Schema.Class<ProjectionPendingTurnStart>(
  "ProjectionPendingTurnStart",
)({
  threadId: ThreadId,
  messageId: MessageId,
  sourceProposedPlanThreadId: Schema.NullOr(ThreadId),
  sourceProposedPlanId: Schema.NullOr(OrchestrationProposedPlanId),
  requestedAt: IsoDateTime,
}) {}

export class ClearCheckpointTurnConflictInput extends Schema.Class<ClearCheckpointTurnConflictInput>(
  "ClearCheckpointTurnConflictInput",
)({
  threadId: ThreadId,
  turnId: TurnId,
  checkpointTurnCount: NonNegativeInt,
}) {}

const GetProjectionTurnByTurnIdRequest = Schema.Struct({
  threadId: ThreadId,
  turnId: TurnId,
});

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown): ProjectionRepositoryError =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

export class ProjectionTurnRepository extends Context.Service<ProjectionTurnRepository>()(
  "t3/persistence/Services/ProjectionTurns/ProjectionTurnRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const upsertProjectionTurnById = SqlSchema.void({
        Request: ProjectionTurnById,
        execute: (row) =>
          sql`
            INSERT INTO projection_turns (
              thread_id,
              turn_id,
              pending_message_id,
              source_proposed_plan_thread_id,
              source_proposed_plan_id,
              assistant_message_id,
              state,
              requested_at,
              started_at,
              completed_at,
              checkpoint_turn_count,
              checkpoint_ref,
              checkpoint_status,
              checkpoint_files_json
            )
            VALUES (
              ${row.threadId},
              ${row.turnId},
              ${row.pendingMessageId},
              ${row.sourceProposedPlanThreadId},
              ${row.sourceProposedPlanId},
              ${row.assistantMessageId},
              ${row.state},
              ${row.requestedAt},
              ${row.startedAt},
              ${row.completedAt},
              ${row.checkpointTurnCount},
              ${row.checkpointRef},
              ${row.checkpointStatus},
              ${row.checkpointFiles}
            )
            ON CONFLICT (thread_id, turn_id)
            DO UPDATE SET
              pending_message_id = excluded.pending_message_id,
              source_proposed_plan_thread_id = excluded.source_proposed_plan_thread_id,
              source_proposed_plan_id = excluded.source_proposed_plan_id,
              assistant_message_id = excluded.assistant_message_id,
              state = excluded.state,
              requested_at = excluded.requested_at,
              started_at = excluded.started_at,
              completed_at = excluded.completed_at,
              checkpoint_turn_count = excluded.checkpoint_turn_count,
              checkpoint_ref = excluded.checkpoint_ref,
              checkpoint_status = excluded.checkpoint_status,
              checkpoint_files_json = excluded.checkpoint_files_json
          `,
      });

      const clearPendingProjectionTurnsByThread = SqlSchema.void({
        Request: ThreadId,
        execute: (threadId) =>
          sql`
            DELETE FROM projection_turns
            WHERE thread_id = ${threadId}
              AND turn_id IS NULL
              AND state = 'pending'
              AND checkpoint_turn_count IS NULL
          `,
      });

      const insertPendingProjectionTurn = SqlSchema.void({
        Request: ProjectionPendingTurnStart,
        execute: (row) =>
          sql`
            INSERT INTO projection_turns (
              thread_id,
              turn_id,
              pending_message_id,
              source_proposed_plan_thread_id,
              source_proposed_plan_id,
              assistant_message_id,
              state,
              requested_at,
              started_at,
              completed_at,
              checkpoint_turn_count,
              checkpoint_ref,
              checkpoint_status,
              checkpoint_files_json
            )
            VALUES (
              ${row.threadId},
              NULL,
              ${row.messageId},
              ${row.sourceProposedPlanThreadId},
              ${row.sourceProposedPlanId},
              NULL,
              'pending',
              ${row.requestedAt},
              NULL,
              NULL,
              NULL,
              NULL,
              NULL,
              '[]'
            )
          `,
      });

      const getPendingProjectionTurn = SqlSchema.findOneOption({
        Request: ThreadId,
        Result: ProjectionPendingTurnStart,
        execute: (threadId) =>
          sql`
            SELECT
              thread_id AS "threadId",
              pending_message_id AS "messageId",
              source_proposed_plan_thread_id AS "sourceProposedPlanThreadId",
              source_proposed_plan_id AS "sourceProposedPlanId",
              requested_at AS "requestedAt"
            FROM projection_turns
            WHERE thread_id = ${threadId}
              AND turn_id IS NULL
              AND state = 'pending'
              AND pending_message_id IS NOT NULL
              AND checkpoint_turn_count IS NULL
            ORDER BY requested_at DESC
            LIMIT 1
          `,
      });

      const listProjectionTurnsByThread = SqlSchema.findAll({
        Request: ThreadId,
        Result: ProjectionTurn,
        execute: (threadId) =>
          sql`
            SELECT
              thread_id AS "threadId",
              turn_id AS "turnId",
              pending_message_id AS "pendingMessageId",
              source_proposed_plan_thread_id AS "sourceProposedPlanThreadId",
              source_proposed_plan_id AS "sourceProposedPlanId",
              assistant_message_id AS "assistantMessageId",
              state,
              requested_at AS "requestedAt",
              started_at AS "startedAt",
              completed_at AS "completedAt",
              checkpoint_turn_count AS "checkpointTurnCount",
              checkpoint_ref AS "checkpointRef",
              checkpoint_status AS "checkpointStatus",
              checkpoint_files_json AS "checkpointFiles"
            FROM projection_turns
            WHERE thread_id = ${threadId}
            ORDER BY
              CASE
                WHEN checkpoint_turn_count IS NULL THEN 1
                ELSE 0
              END ASC,
              checkpoint_turn_count ASC,
              requested_at ASC,
              turn_id ASC
          `,
      });

      const getProjectionTurnByTurnId = SqlSchema.findOneOption({
        Request: GetProjectionTurnByTurnIdRequest,
        Result: ProjectionTurnById,
        execute: ({ threadId, turnId }) =>
          sql`
            SELECT
              thread_id AS "threadId",
              turn_id AS "turnId",
              pending_message_id AS "pendingMessageId",
              source_proposed_plan_thread_id AS "sourceProposedPlanThreadId",
              source_proposed_plan_id AS "sourceProposedPlanId",
              assistant_message_id AS "assistantMessageId",
              state,
              requested_at AS "requestedAt",
              started_at AS "startedAt",
              completed_at AS "completedAt",
              checkpoint_turn_count AS "checkpointTurnCount",
              checkpoint_ref AS "checkpointRef",
              checkpoint_status AS "checkpointStatus",
              checkpoint_files_json AS "checkpointFiles"
            FROM projection_turns
            WHERE thread_id = ${threadId}
              AND turn_id = ${turnId}
            LIMIT 1
          `,
      });

      const clearCheckpointTurnConflictRow = SqlSchema.void({
        Request: ClearCheckpointTurnConflictInput,
        execute: ({ threadId, turnId, checkpointTurnCount }) =>
          sql`
            UPDATE projection_turns
            SET
              checkpoint_turn_count = NULL,
              checkpoint_ref = NULL,
              checkpoint_status = NULL,
              checkpoint_files_json = '[]'
            WHERE thread_id = ${threadId}
              AND checkpoint_turn_count = ${checkpointTurnCount}
              AND (turn_id IS NULL OR turn_id <> ${turnId})
          `,
      });

      const deleteProjectionTurnsByThread = SqlSchema.void({
        Request: ThreadId,
        execute: (threadId) =>
          sql`
            DELETE FROM projection_turns
            WHERE thread_id = ${threadId}
          `,
      });

      /**
       * Inserts or updates the canonical row for a concrete `{threadId, turnId}` turn lifecycle
       * state.
       */
      const upsertByTurnId = (
        row: ProjectionTurnById,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        upsertProjectionTurnById(row).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionTurnRepository.upsertByTurnId:query",
              "ProjectionTurnRepository.upsertByTurnId:encodeRequest",
            ),
          ),
        );

      /**
       * Replaces any existing pending-start placeholder rows for a thread with exactly one latest
       * pending-start row.
       */
      const replacePendingTurnStart = (
        row: ProjectionPendingTurnStart,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        sql
          .withTransaction(
            clearPendingProjectionTurnsByThread(row.threadId).pipe(
              Effect.flatMap(() => insertPendingProjectionTurn(row)),
            ),
          )
          .pipe(
            Effect.mapError(
              toPersistenceSqlOrDecodeError(
                "ProjectionTurnRepository.replacePendingTurnStart:query",
                "ProjectionTurnRepository.replacePendingTurnStart:encodeRequest",
              ),
            ),
          );

      /**
       * Returns the newest pending-start placeholder for a thread; this is expected to be at most
       * one row after replacement writes.
       */
      const getPendingTurnStartByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<Option.Option<ProjectionPendingTurnStart>, ProjectionRepositoryError> =>
        getPendingProjectionTurn(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionTurnRepository.getPendingTurnStartByThreadId:query",
              "ProjectionTurnRepository.getPendingTurnStartByThreadId:decodeRow",
            ),
          ),
        );

      /**
       * Deletes only pending-start placeholder rows (`turnId = null`) for a thread and leaves
       * concrete turn rows untouched.
       */
      const deletePendingTurnStartByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        clearPendingProjectionTurnsByThread(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionTurnRepository.deletePendingTurnStartByThreadId:query",
              "ProjectionTurnRepository.deletePendingTurnStartByThreadId:encodeRequest",
            ),
          ),
        );

      /**
       * Lists all projection rows for a thread, including pending placeholders, with checkpoint
       * rows ordered before non-checkpoint rows.
       */
      const listByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<ReadonlyArray<ProjectionTurn>, ProjectionRepositoryError> =>
        listProjectionTurnsByThread(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionTurnRepository.listByThreadId:query",
              "ProjectionTurnRepository.listByThreadId:decodeRows",
            ),
          ),
        );

      /**
       * Looks up a concrete turn row by `{threadId, turnId}` and never returns pending placeholder
       * rows.
       */
      const getByTurnId = (
        threadId: ThreadId,
        turnId: TurnId,
      ): Effect.Effect<Option.Option<ProjectionTurnById>, ProjectionRepositoryError> =>
        getProjectionTurnByTurnId({ threadId, turnId }).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionTurnRepository.getByTurnId:query",
              "ProjectionTurnRepository.getByTurnId:decodeRow",
            ),
          ),
        );

      /**
       * Clears checkpoint fields on conflicting rows that reuse the same checkpoint turn count in
       * a thread, excluding the provided turn.
       */
      const clearCheckpointTurnConflict = (
        input: ClearCheckpointTurnConflictInput,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        clearCheckpointTurnConflictRow(input).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionTurnRepository.clearCheckpointTurnConflict:query",
              "ProjectionTurnRepository.clearCheckpointTurnConflict:encodeRequest",
            ),
          ),
        );

      /**
       * Hard-deletes all projection rows for a thread, including pending-start placeholders and
       * checkpoint metadata rows.
       */
      const deleteByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        deleteProjectionTurnsByThread(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionTurnRepository.deleteByThreadId:query",
              "ProjectionTurnRepository.deleteByThreadId:encodeRequest",
            ),
          ),
        );

      return {
        upsertByTurnId,
        replacePendingTurnStart,
        getPendingTurnStartByThreadId,
        deletePendingTurnStartByThreadId,
        listByThreadId,
        getByTurnId,
        clearCheckpointTurnConflict,
        deleteByThreadId,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this)(this.make);
}
