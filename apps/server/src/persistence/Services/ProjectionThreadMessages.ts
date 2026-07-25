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
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

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

export class ListProjectionThreadMessagesInput extends Schema.Class<ListProjectionThreadMessagesInput>(
  "ListProjectionThreadMessagesInput",
)({
  threadId: ThreadId,
}) {}

export class GetProjectionThreadMessageInput extends Schema.Class<GetProjectionThreadMessageInput>(
  "GetProjectionThreadMessageInput",
)({
  messageId: MessageId,
}) {}

export class DeleteProjectionThreadMessagesInput extends Schema.Class<DeleteProjectionThreadMessagesInput>(
  "DeleteProjectionThreadMessagesInput",
)({
  threadId: ThreadId,
}) {}

/**
 * ProjectionThreadMessageRepositoryShape - Service API for projected thread messages.
 */
export interface ProjectionThreadMessageRepositoryShape {
  /**
   * Insert or replace a projected thread message row.
   *
   * Upserts by `messageId`.
   */
  readonly upsert: (
    message: ProjectionThreadMessage,
  ) => Effect.Effect<void, ProjectionRepositoryError>;

  /**
   * Read a projected thread message by id.
   */
  readonly getByMessageId: (
    input: GetProjectionThreadMessageInput,
  ) => Effect.Effect<Option.Option<ProjectionThreadMessage>, ProjectionRepositoryError>;

  /**
   * List projected thread messages for a thread.
   *
   * Returned in ascending creation order.
   */
  readonly listByThreadId: (
    input: ListProjectionThreadMessagesInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionThreadMessage>, ProjectionRepositoryError>;

  /**
   * Delete projected thread messages by thread.
   */
  readonly deleteByThreadId: (
    input: DeleteProjectionThreadMessagesInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

/**
 * ProjectionThreadMessageRepository - Service tag for message projection persistence.
 */
export class ProjectionThreadMessageRepository extends Context.Service<
  ProjectionThreadMessageRepository,
  ProjectionThreadMessageRepositoryShape
>()("t3/persistence/Services/ProjectionThreadMessages/ProjectionThreadMessageRepository") {}
