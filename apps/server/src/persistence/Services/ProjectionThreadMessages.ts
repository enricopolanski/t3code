/**
 * ProjectionThreadMessageRepository - Projection repository interface for messages.
 *
 * Owns persistence operations for projected thread messages rendered in the
 * orchestration read model.
 *
 * @module ProjectionThreadMessageRepository
 */
import {
  ChatAttachment,
  MessageId,
  OrchestrationMessageRole,
  ThreadId,
  TurnId,
  IsoDateTime,
} from "@t3tools/contracts";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Option from "effect/Option";
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

const OptionalAttachmentsFromNull = Schema.optional(
  Schema.NullOr(Schema.fromJsonString(Schema.Array(ChatAttachment))),
).pipe(
  Schema.decodeTo(Schema.optional(Schema.toType(Schema.Array(ChatAttachment))), {
    decode: SchemaGetter.transformOptional((value) =>
      Option.flatMap(value, (attachments) =>
        attachments === null ? Option.none() : Option.some(attachments),
      ),
    ),
    encode: SchemaGetter.passthroughSubtype(),
  }),
);

const BooleanFromNumber = Schema.Number.pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform((value) => value === 1),
    encode: SchemaGetter.transform((value) => (value ? 1 : 0)),
  }),
);

export class ProjectionThreadMessage extends Schema.Class<ProjectionThreadMessage>(
  "ProjectionThreadMessage",
)({
  messageId: MessageId,
  threadId: ThreadId,
  turnId: Schema.NullOr(TurnId),
  role: OrchestrationMessageRole,
  text: Schema.String,
  attachments: OptionalAttachmentsFromNull,
  isStreaming: BooleanFromNumber,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}) {}

const ProjectionThreadMessageDbRowSchema = ProjectionThreadMessage;

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown): ProjectionRepositoryError =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

/**
 * ProjectionThreadMessageRepository - Service and SQLite-backed layer for message projection
 * persistence.
 */
export class ProjectionThreadMessageRepository extends Context.Service<ProjectionThreadMessageRepository>()(
  "t3/persistence/Services/ProjectionThreadMessages/ProjectionThreadMessageRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const upsertProjectionThreadMessageRow = SqlSchema.void({
        Request: ProjectionThreadMessage,
        execute: (row) =>
          sql`
            INSERT INTO projection_thread_messages (
              message_id,
              thread_id,
              turn_id,
              role,
              text,
              attachments_json,
              is_streaming,
              created_at,
              updated_at
            )
            VALUES (
              ${row.messageId},
              ${row.threadId},
              ${row.turnId},
              ${row.role},
              ${row.text},
              COALESCE(
                ${row.attachments ?? null},
                (
                  SELECT attachments_json
                  FROM projection_thread_messages
                  WHERE message_id = ${row.messageId}
                )
              ),
              ${row.isStreaming},
              ${row.createdAt},
              ${row.updatedAt}
            )
            ON CONFLICT (message_id)
            DO UPDATE SET
              thread_id = excluded.thread_id,
              turn_id = excluded.turn_id,
              role = excluded.role,
              text = excluded.text,
              attachments_json = COALESCE(
                excluded.attachments_json,
                projection_thread_messages.attachments_json
              ),
              is_streaming = excluded.is_streaming,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at
          `,
      });

      const getProjectionThreadMessageRow = SqlSchema.findOneOption({
        Request: MessageId,
        Result: ProjectionThreadMessageDbRowSchema,
        execute: (messageId) =>
          sql`
            SELECT
              message_id AS "messageId",
              thread_id AS "threadId",
              turn_id AS "turnId",
              role,
              text,
              attachments_json AS "attachments",
              is_streaming AS "isStreaming",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
            FROM projection_thread_messages
            WHERE message_id = ${messageId}
            LIMIT 1
          `,
      });

      const listProjectionThreadMessageRows = SqlSchema.findAll({
        Request: ThreadId,
        Result: ProjectionThreadMessageDbRowSchema,
        execute: (threadId) =>
          sql`
            SELECT
              message_id AS "messageId",
              thread_id AS "threadId",
              turn_id AS "turnId",
              role,
              text,
              attachments_json AS "attachments",
              is_streaming AS "isStreaming",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
            FROM projection_thread_messages
            WHERE thread_id = ${threadId}
            ORDER BY created_at ASC, message_id ASC
          `,
      });

      const deleteProjectionThreadMessageRows = SqlSchema.void({
        Request: ThreadId,
        execute: (threadId) =>
          sql`
            DELETE FROM projection_thread_messages
            WHERE thread_id = ${threadId}
          `,
      });

      /**
       * Insert or replace a projected thread message row.
       *
       * Upserts by `messageId`.
       */
      const upsert = (
        message: ProjectionThreadMessage,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        upsertProjectionThreadMessageRow(message).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadMessageRepository.upsert:query",
              "ProjectionThreadMessageRepository.upsert:encodeRequest",
            ),
          ),
        );

      /**
       * Read a projected thread message by id.
       */
      const getByMessageId = (
        messageId: MessageId,
      ): Effect.Effect<Option.Option<ProjectionThreadMessage>, ProjectionRepositoryError> =>
        getProjectionThreadMessageRow(messageId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadMessageRepository.getByMessageId:query",
              "ProjectionThreadMessageRepository.getByMessageId:decodeRow",
            ),
          ),
        );

      /**
       * List projected thread messages for a thread.
       *
       * Returned in ascending creation order.
       */
      const listByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<ReadonlyArray<ProjectionThreadMessage>, ProjectionRepositoryError> =>
        listProjectionThreadMessageRows(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadMessageRepository.listByThreadId:query",
              "ProjectionThreadMessageRepository.listByThreadId:decodeRows",
            ),
          ),
        );

      /**
       * Delete projected thread messages by thread.
       */
      const deleteByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        deleteProjectionThreadMessageRows(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionThreadMessageRepository.deleteByThreadId:query",
              "ProjectionThreadMessageRepository.deleteByThreadId:encodeRequest",
            ),
          ),
        );

      return {
        upsert,
        getByMessageId,
        listByThreadId,
        deleteByThreadId,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this)(this.make);
}
