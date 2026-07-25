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
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

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

export class ListProjectionThreadActivitiesInput extends Schema.Class<ListProjectionThreadActivitiesInput>(
  "ListProjectionThreadActivitiesInput",
)({
  threadId: ThreadId,
}) {}

export class DeleteProjectionThreadActivitiesInput extends Schema.Class<DeleteProjectionThreadActivitiesInput>(
  "DeleteProjectionThreadActivitiesInput",
)({
  threadId: ThreadId,
}) {}

/**
 * ProjectionThreadActivityRepositoryShape - Service API for projected thread activity.
 */
export interface ProjectionThreadActivityRepositoryShape {
  /**
   * Insert or replace a projected thread activity row.
   *
   * Upserts by `activityId` and JSON-encodes payload.
   */
  readonly upsert: (
    row: ProjectionThreadActivity,
  ) => Effect.Effect<void, ProjectionRepositoryError>;

  /**
   * List projected thread activity rows for a thread.
   *
   * Returned in ascending runtime sequence order (or creation order when
   * sequence is unavailable).
   */
  readonly listByThreadId: (
    input: ListProjectionThreadActivitiesInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionThreadActivity>, ProjectionRepositoryError>;

  /**
   * Delete projected thread activity rows by thread.
   */
  readonly deleteByThreadId: (
    input: DeleteProjectionThreadActivitiesInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

/**
 * ProjectionThreadActivityRepository - Service tag for thread activity persistence.
 */
export class ProjectionThreadActivityRepository extends Context.Service<
  ProjectionThreadActivityRepository,
  ProjectionThreadActivityRepositoryShape
>()("t3/persistence/Services/ProjectionThreadActivities/ProjectionThreadActivityRepository") {}
