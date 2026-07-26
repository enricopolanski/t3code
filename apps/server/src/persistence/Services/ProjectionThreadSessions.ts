/**
 * ProjectionThreadSessionRepository - Repository interface for thread sessions.
 *
 * Owns persistence operations for projected provider-session linkage and
 * runtime status for each thread.
 *
 * @module ProjectionThreadSessionRepository
 */
import {
  RuntimeMode,
  IsoDateTime,
  OrchestrationSessionStatus,
  ProviderInstanceId,
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

export class ProjectionThreadSession extends Schema.Class<ProjectionThreadSession>(
  "ProjectionThreadSession",
)({
  threadId: ThreadId,
  status: OrchestrationSessionStatus,
  providerName: Schema.NullOr(Schema.String),
  providerInstanceId: Schema.NullOr(ProviderInstanceId),
  runtimeMode: RuntimeMode,
  activeTurnId: Schema.NullOr(TurnId),
  lastError: Schema.NullOr(Schema.String),
  updatedAt: IsoDateTime,
}) {}

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown): ProjectionRepositoryError =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

/**
 * ProjectionThreadSessionRepository - Service and SQLite-backed layer for thread-session
 * persistence.
 */
export class ProjectionThreadSessionRepository extends Context.Service<ProjectionThreadSessionRepository>()(
  "t3/persistence/Services/ProjectionThreadSessions/ProjectionThreadSessionRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const upsertProjectionThreadSessionRow = SqlSchema.void({
        Request: ProjectionThreadSession,
        execute: (row) =>
          sql`
            INSERT INTO projection_thread_sessions (
              thread_id,
              status,
              provider_name,
              provider_instance_id,
              runtime_mode,
              active_turn_id,
              last_error,
              updated_at
            )
            VALUES (
              ${row.threadId},
              ${row.status},
              ${row.providerName},
              ${row.providerInstanceId},
              ${row.runtimeMode},
              ${row.activeTurnId},
              ${row.lastError},
              ${row.updatedAt}
            )
            ON CONFLICT (thread_id)
            DO UPDATE SET
              status = excluded.status,
              provider_name = excluded.provider_name,
              provider_instance_id = excluded.provider_instance_id,
              runtime_mode = excluded.runtime_mode,
              active_turn_id = excluded.active_turn_id,
              last_error = excluded.last_error,
              updated_at = excluded.updated_at
          `,
      });

      const getProjectionThreadSessionRow = SqlSchema.findOneOption({
        Request: ThreadId,
        Result: ProjectionThreadSession,
        execute: (threadId) =>
          sql`
            SELECT
              thread_id AS "threadId",
              status,
              provider_name AS "providerName",
              provider_instance_id AS "providerInstanceId",
              runtime_mode AS "runtimeMode",
              active_turn_id AS "activeTurnId",
              last_error AS "lastError",
              updated_at AS "updatedAt"
            FROM projection_thread_sessions
            WHERE thread_id = ${threadId}
          `,
      });

      const deleteProjectionThreadSessionRow = SqlSchema.void({
        Request: ThreadId,
        execute: (threadId) =>
          sql`
            DELETE FROM projection_thread_sessions
            WHERE thread_id = ${threadId}
          `,
      });

      /**
       * Insert or replace a projected thread-session row.
       *
       * Upserts by `threadId`.
       */
      const upsert = (
        row: ProjectionThreadSession,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        upsertProjectionThreadSessionRow(row).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadSessionRepository.upsert:query",
              "ProjectionThreadSessionRepository.upsert:encodeRequest",
            ),
          ),
        );

      /**
       * Read projected thread-session state by thread id.
       */
      const getByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<Option.Option<ProjectionThreadSession>, ProjectionRepositoryError> =>
        getProjectionThreadSessionRow(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadSessionRepository.getByThreadId:query",
              "ProjectionThreadSessionRepository.getByThreadId:decodeRow",
            ),
          ),
        );

      /**
       * Delete projected thread-session state by thread id.
       */
      const deleteByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        deleteProjectionThreadSessionRow(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadSessionRepository.deleteByThreadId:query",
              "ProjectionThreadSessionRepository.deleteByThreadId:encodeRequest",
            ),
          ),
        );

      return {
        upsert,
        getByThreadId,
        deleteByThreadId,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this)(this.make);
}
