/**
 * ProjectionThreadActivityRepository - Projection repository interface for thread activity.
 *
 * Owns persistence operations for activity timeline entries projected from
 * orchestration events.
 *
 * @module ProjectionThreadActivityRepository
 */
import {
  EventId,
  IsoDateTime,
  NonNegativeInt,
  OrchestrationThreadActivityTone,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type ProjectionRepositoryError,
  toPersistenceDecodeError,
  toPersistenceSqlError,
} from "../Errors.ts";

const OptionalNonNegativeIntFromNull = Schema.optional(Schema.NullOr(NonNegativeInt)).pipe(
  Schema.decodeTo(Schema.optional(Schema.toType(NonNegativeInt)), {
    decode: SchemaGetter.transformOptional(Option.filter(Predicate.isNotNull)),
    encode: SchemaGetter.passthrough(),
  }),
);

export class ProjectionThreadActivity extends Schema.Class<ProjectionThreadActivity>(
  "ProjectionThreadActivity",
)({
  activityId: EventId,
  threadId: ThreadId,
  turnId: Schema.NullOr(TurnId),
  tone: OrchestrationThreadActivityTone,
  kind: Schema.String,
  summary: Schema.String,
  payload: Schema.fromJsonString(Schema.Unknown),
  sequence: OptionalNonNegativeIntFromNull,
  createdAt: IsoDateTime,
}) {}

const ProjectionThreadActivityDbRowSchema = ProjectionThreadActivity;

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown): ProjectionRepositoryError =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

/**
 * ProjectionThreadActivityRepository - Service and SQLite-backed layer for thread activity.
 */
export class ProjectionThreadActivityRepository extends Context.Service<ProjectionThreadActivityRepository>()(
  "t3/persistence/Services/ProjectionThreadActivities/ProjectionThreadActivityRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const upsertProjectionThreadActivityRow = SqlSchema.void({
        Request: ProjectionThreadActivity,
        execute: (row) =>
          sql`
            INSERT INTO projection_thread_activities (
              activity_id,
              thread_id,
              turn_id,
              tone,
              kind,
              summary,
              payload_json,
              sequence,
              created_at
            )
            VALUES (
              ${row.activityId},
              ${row.threadId},
              ${row.turnId},
              ${row.tone},
              ${row.kind},
              ${row.summary},
              ${row.payload},
              ${row.sequence ?? null},
              ${row.createdAt}
            )
            ON CONFLICT (activity_id)
            DO UPDATE SET
              thread_id = excluded.thread_id,
              turn_id = excluded.turn_id,
              tone = excluded.tone,
              kind = excluded.kind,
              summary = excluded.summary,
              payload_json = excluded.payload_json,
              sequence = excluded.sequence,
              created_at = excluded.created_at
          `,
      });

      const listProjectionThreadActivityRows = SqlSchema.findAll({
        Request: ThreadId,
        Result: ProjectionThreadActivityDbRowSchema,
        execute: (threadId) =>
          sql`
            SELECT
              activity_id AS "activityId",
              thread_id AS "threadId",
              turn_id AS "turnId",
              tone,
              kind,
              summary,
              payload_json AS "payload",
              sequence,
              created_at AS "createdAt"
            FROM projection_thread_activities
            WHERE thread_id = ${threadId}
            ORDER BY
              CASE WHEN sequence IS NULL THEN 0 ELSE 1 END ASC,
              sequence ASC,
              created_at ASC,
              activity_id ASC
          `,
      });

      const deleteProjectionThreadActivityRows = SqlSchema.void({
        Request: ThreadId,
        execute: (threadId) =>
          sql`
            DELETE FROM projection_thread_activities
            WHERE thread_id = ${threadId}
          `,
      });

      /**
       * Insert or replace a projected thread activity row.
       *
       * Upserts by `activityId` and JSON-encodes payload.
       */
      const upsert = (
        row: ProjectionThreadActivity,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        upsertProjectionThreadActivityRow(row).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadActivityRepository.upsert:query",
              "ProjectionThreadActivityRepository.upsert:encodeRequest",
            ),
          ),
        );

      /**
       * List projected thread activity rows for a thread.
       *
       * Returned in ascending runtime sequence order (or creation order when
       * sequence is unavailable).
       */
      const listByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<ReadonlyArray<ProjectionThreadActivity>, ProjectionRepositoryError> =>
        listProjectionThreadActivityRows(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadActivityRepository.listByThreadId:query",
              "ProjectionThreadActivityRepository.listByThreadId:decodeRows",
            ),
          ),
        );

      /**
       * Delete projected thread activity rows by thread.
       */
      const deleteByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        deleteProjectionThreadActivityRows(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadActivityRepository.deleteByThreadId:query",
              "ProjectionThreadActivityRepository.deleteByThreadId:encodeRequest",
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
