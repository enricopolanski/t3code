/**
 * ProjectionCheckpointRepository - Checkpoint projection persistence service and SQLite layer.
 *
 * Owns persistence operations for projected checkpoint summaries in thread
 * timelines.
 *
 * @module ProjectionCheckpointRepository
 */
import {
  CheckpointRef,
  IsoDateTime,
  MessageId,
  NonNegativeInt,
  OrchestrationCheckpointFile,
  OrchestrationCheckpointStatus,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Option from "effect/Option";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import {
  type ProjectionRepositoryError,
  toPersistenceDecodeError,
  toPersistenceSqlError,
} from "../Errors.ts";

export class ProjectionCheckpoint extends Schema.Class<ProjectionCheckpoint>(
  "ProjectionCheckpoint",
)({
  threadId: ThreadId,
  turnId: TurnId,
  checkpointTurnCount: NonNegativeInt,
  checkpointRef: CheckpointRef,
  status: OrchestrationCheckpointStatus,
  files: Schema.fromJsonString(Schema.Array(OrchestrationCheckpointFile)),
  assistantMessageId: Schema.NullOr(MessageId),
  completedAt: IsoDateTime,
}) {}

export class GetByThreadAndTurnCountInput extends Schema.Class<GetByThreadAndTurnCountInput>(
  "GetByThreadAndTurnCountInput",
)({
  threadId: ThreadId,
  checkpointTurnCount: NonNegativeInt,
}) {}

const ProjectionCheckpointDbRowSchema = ProjectionCheckpoint;

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown): ProjectionRepositoryError =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

/**
 * ProjectionCheckpointRepository - Service and SQLite-backed layer for checkpoint projections.
 */
export class ProjectionCheckpointRepository extends Context.Service<ProjectionCheckpointRepository>()(
  "t3/persistence/Services/ProjectionCheckpoints/ProjectionCheckpointRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const clearCheckpointConflict = SqlSchema.void({
        Request: GetByThreadAndTurnCountInput,
        execute: ({ threadId, checkpointTurnCount }) =>
          sql`
            UPDATE projection_turns
            SET
              checkpoint_turn_count = NULL,
              checkpoint_ref = NULL,
              checkpoint_status = NULL,
              checkpoint_files_json = '[]'
            WHERE thread_id = ${threadId}
              AND checkpoint_turn_count = ${checkpointTurnCount}
          `,
      });

      const upsertProjectionCheckpointRow = SqlSchema.void({
        Request: ProjectionCheckpointDbRowSchema,
        execute: (row) =>
          sql`
            INSERT INTO projection_turns (
              thread_id,
              turn_id,
              pending_message_id,
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
              NULL,
              ${row.assistantMessageId},
              ${row.status === "error" ? "error" : "completed"},
              ${row.completedAt},
              ${row.completedAt},
              ${row.completedAt},
              ${row.checkpointTurnCount},
              ${row.checkpointRef},
              ${row.status},
              ${row.files}
            )
            ON CONFLICT (thread_id, turn_id)
            DO UPDATE SET
              assistant_message_id = excluded.assistant_message_id,
              state = excluded.state,
              completed_at = excluded.completed_at,
              checkpoint_turn_count = excluded.checkpoint_turn_count,
              checkpoint_ref = excluded.checkpoint_ref,
              checkpoint_status = excluded.checkpoint_status,
              checkpoint_files_json = excluded.checkpoint_files_json
          `,
      });

      const listProjectionCheckpointRows = SqlSchema.findAll({
        Request: ThreadId,
        Result: ProjectionCheckpointDbRowSchema,
        execute: (threadId) =>
          sql`
            SELECT
              thread_id AS "threadId",
              turn_id AS "turnId",
              checkpoint_turn_count AS "checkpointTurnCount",
              checkpoint_ref AS "checkpointRef",
              checkpoint_status AS "status",
              checkpoint_files_json AS "files",
              assistant_message_id AS "assistantMessageId",
              completed_at AS "completedAt"
            FROM projection_turns
            WHERE thread_id = ${threadId}
              AND checkpoint_turn_count IS NOT NULL
            ORDER BY checkpoint_turn_count ASC
          `,
      });

      const getProjectionCheckpointRow = SqlSchema.findOneOption({
        Request: GetByThreadAndTurnCountInput,
        Result: ProjectionCheckpointDbRowSchema,
        execute: ({ threadId, checkpointTurnCount }) =>
          sql`
            SELECT
              thread_id AS "threadId",
              turn_id AS "turnId",
              checkpoint_turn_count AS "checkpointTurnCount",
              checkpoint_ref AS "checkpointRef",
              checkpoint_status AS "status",
              checkpoint_files_json AS "files",
              assistant_message_id AS "assistantMessageId",
              completed_at AS "completedAt"
            FROM projection_turns
            WHERE thread_id = ${threadId}
              AND checkpoint_turn_count = ${checkpointTurnCount}
          `,
      });

      const deleteProjectionCheckpointRows = SqlSchema.void({
        Request: ThreadId,
        execute: (threadId) =>
          sql`
            UPDATE projection_turns
            SET
              checkpoint_turn_count = NULL,
              checkpoint_ref = NULL,
              checkpoint_status = NULL,
              checkpoint_files_json = '[]'
            WHERE thread_id = ${threadId}
              AND checkpoint_turn_count IS NOT NULL
          `,
      });

      const upsertCheckpointRow = (row: ProjectionCheckpoint) =>
        sql.withTransaction(
          clearCheckpointConflict(
            new GetByThreadAndTurnCountInput({
              threadId: row.threadId,
              checkpointTurnCount: row.checkpointTurnCount,
            }),
          ).pipe(Effect.flatMap(() => upsertProjectionCheckpointRow(row))),
        );

      /**
       * Insert or replace a projected checkpoint row.
       *
       * Upserts by composite key `(threadId, checkpointTurnCount)`.
       */
      const upsert = (row: ProjectionCheckpoint): Effect.Effect<void, ProjectionRepositoryError> =>
        upsertCheckpointRow(row).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionCheckpointRepository.upsert:query",
              "ProjectionCheckpointRepository.upsert:encodeRequest",
            ),
          ),
        );

      /**
       * List projected checkpoints for a thread in ascending turn-count order.
       */
      const listByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<ReadonlyArray<ProjectionCheckpoint>, ProjectionRepositoryError> =>
        listProjectionCheckpointRows(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionCheckpointRepository.listByThreadId:query",
              "ProjectionCheckpointRepository.listByThreadId:decodeRows",
            ),
          ),
        );

      /**
       * Read a projected checkpoint by thread and turn-count key.
       */
      const getByThreadAndTurnCount = (
        input: GetByThreadAndTurnCountInput,
      ): Effect.Effect<Option.Option<ProjectionCheckpoint>, ProjectionRepositoryError> =>
        getProjectionCheckpointRow(input).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionCheckpointRepository.getByThreadAndTurnCount:query",
              "ProjectionCheckpointRepository.getByThreadAndTurnCount:decodeRow",
            ),
          ),
        );

      /**
       * Delete projected checkpoint rows by thread.
       */
      const deleteByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        deleteProjectionCheckpointRows(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlError("ProjectionCheckpointRepository.deleteByThreadId:query"),
          ),
        );

      return {
        upsert,
        listByThreadId,
        getByThreadAndTurnCount,
        deleteByThreadId,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this)(this.make);
}
