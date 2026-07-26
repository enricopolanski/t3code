/**
 * ProjectionPendingApprovalRepository - Repository interface for pending approvals.
 *
 * Owns persistence operations for projected approval requests awaiting user
 * decisions.
 *
 * @module ProjectionPendingApprovalRepository
 */
import {
  ApprovalRequestId,
  IsoDateTime,
  ProjectionPendingApprovalDecision,
  ProjectionPendingApprovalStatus,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export class ProjectionPendingApproval extends Schema.Class<ProjectionPendingApproval>(
  "ProjectionPendingApproval",
)({
  requestId: ApprovalRequestId,
  threadId: ThreadId,
  turnId: Schema.NullOr(TurnId),
  status: ProjectionPendingApprovalStatus,
  decision: ProjectionPendingApprovalDecision,
  createdAt: IsoDateTime,
  resolvedAt: Schema.NullOr(IsoDateTime),
}) {}

/**
 * ProjectionPendingApprovalRepositoryShape - Service API for pending approvals.
 */
export interface ProjectionPendingApprovalRepositoryShape {
  /**
   * Insert or replace a projected pending approval row.
   *
   * Upserts by `requestId`.
   */
  readonly upsert: (
    row: ProjectionPendingApproval,
  ) => Effect.Effect<void, ProjectionRepositoryError>;

  /**
   * List pending approvals for a thread.
   *
   * Returned in ascending creation order.
   */
  readonly listByThreadId: (
    threadId: ThreadId,
  ) => Effect.Effect<ReadonlyArray<ProjectionPendingApproval>, ProjectionRepositoryError>;

  /**
   * Read a pending approval row by request id.
   */
  readonly getByRequestId: (
    requestId: ApprovalRequestId,
  ) => Effect.Effect<Option.Option<ProjectionPendingApproval>, ProjectionRepositoryError>;

  /**
   * Delete a pending approval row by request id.
   */
  readonly deleteByRequestId: (
    requestId: ApprovalRequestId,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

/**
 * ProjectionPendingApprovalRepository - Service tag for pending approval persistence.
 */
export class ProjectionPendingApprovalRepository extends Context.Service<
  ProjectionPendingApprovalRepository,
  ProjectionPendingApprovalRepositoryShape
>()("t3/persistence/Services/ProjectionPendingApprovals/ProjectionPendingApprovalRepository") {}
