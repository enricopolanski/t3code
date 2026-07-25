/**
 * ProjectionCheckpointRepository - Projection repository interface for checkpoints.
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
import * as Option from "effect/Option";
import * as Context from "effect/Context";
import * as Schema from "effect/Schema";
import type * as Effect from "effect/Effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

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

export class ListByThreadIdInput extends Schema.Class<ListByThreadIdInput>("ListByThreadIdInput")({
  threadId: ThreadId,
}) {}

export class GetByThreadAndTurnCountInput extends Schema.Class<GetByThreadAndTurnCountInput>(
  "GetByThreadAndTurnCountInput",
)({
  threadId: ThreadId,
  checkpointTurnCount: NonNegativeInt,
}) {}

export class DeleteByThreadIdInput extends Schema.Class<DeleteByThreadIdInput>(
  "DeleteByThreadIdInput",
)({
  threadId: ThreadId,
}) {}

/**
 * ProjectionCheckpointRepositoryShape - Service API for projected checkpoints.
 */
export interface ProjectionCheckpointRepositoryShape {
  /**
   * Insert or replace a projected checkpoint row.
   *
   * Upserts by composite key `(threadId, checkpointTurnCount)`.
   */
  readonly upsert: (row: ProjectionCheckpoint) => Effect.Effect<void, ProjectionRepositoryError>;

  /**
   * List projected checkpoints for a thread.
   *
   * Returned in ascending checkpoint turn-count order.
   */
  readonly listByThreadId: (
    input: ListByThreadIdInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionCheckpoint>, ProjectionRepositoryError>;

  /**
   * Read a projected checkpoint by thread and turn-count key.
   */
  readonly getByThreadAndTurnCount: (
    input: GetByThreadAndTurnCountInput,
  ) => Effect.Effect<Option.Option<ProjectionCheckpoint>, ProjectionRepositoryError>;

  /**
   * Delete projected checkpoint rows by thread.
   */
  readonly deleteByThreadId: (
    input: DeleteByThreadIdInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

/**
 * ProjectionCheckpointRepository - Service tag for checkpoint projection persistence.
 */
export class ProjectionCheckpointRepository extends Context.Service<
  ProjectionCheckpointRepository,
  ProjectionCheckpointRepositoryShape
>()("t3/persistence/Services/ProjectionCheckpoints/ProjectionCheckpointRepository") {}
