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
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

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

export class GetProjectionThreadSessionInput extends Schema.Class<GetProjectionThreadSessionInput>(
  "GetProjectionThreadSessionInput",
)({
  threadId: ThreadId,
}) {}

export class DeleteProjectionThreadSessionInput extends Schema.Class<DeleteProjectionThreadSessionInput>(
  "DeleteProjectionThreadSessionInput",
)({
  threadId: ThreadId,
}) {}

/**
 * ProjectionThreadSessionRepositoryShape - Service API for projected thread sessions.
 */
export interface ProjectionThreadSessionRepositoryShape {
  /**
   * Insert or replace a projected thread-session row.
   *
   * Upserts by `threadId`.
   */
  readonly upsert: (row: ProjectionThreadSession) => Effect.Effect<void, ProjectionRepositoryError>;

  /**
   * Read projected thread-session state by thread id.
   */
  readonly getByThreadId: (
    input: GetProjectionThreadSessionInput,
  ) => Effect.Effect<Option.Option<ProjectionThreadSession>, ProjectionRepositoryError>;

  /**
   * Delete projected thread-session state by thread id.
   */
  readonly deleteByThreadId: (
    input: DeleteProjectionThreadSessionInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

/**
 * ProjectionThreadSessionRepository - Service tag for thread-session persistence.
 */
export class ProjectionThreadSessionRepository extends Context.Service<
  ProjectionThreadSessionRepository,
  ProjectionThreadSessionRepositoryShape
>()("t3/persistence/Services/ProjectionThreadSessions/ProjectionThreadSessionRepository") {}
