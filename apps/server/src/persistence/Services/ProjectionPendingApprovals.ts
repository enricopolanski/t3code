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
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { toPersistenceSqlError, type ProjectionRepositoryError } from "../Errors.ts";

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
 * ProjectionPendingApprovalRepository - Service and SQLite-backed layer for pending approvals.
 */
export class ProjectionPendingApprovalRepository extends Context.Service<ProjectionPendingApprovalRepository>()(
  "t3/persistence/Services/ProjectionPendingApprovals/ProjectionPendingApprovalRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const upsertProjectionPendingApprovalRow = SqlSchema.void({
        Request: ProjectionPendingApproval,
        execute: (row) =>
          sql`
            INSERT INTO projection_pending_approvals (
              request_id,
              thread_id,
              turn_id,
              status,
              decision,
              created_at,
              resolved_at
            )
            VALUES (
              ${row.requestId},
              ${row.threadId},
              ${row.turnId},
              ${row.status},
              ${row.decision},
              ${row.createdAt},
              ${row.resolvedAt}
            )
            ON CONFLICT (request_id)
            DO UPDATE SET
              thread_id = excluded.thread_id,
              turn_id = excluded.turn_id,
              status = excluded.status,
              decision = excluded.decision,
              created_at = excluded.created_at,
              resolved_at = excluded.resolved_at
          `,
      });

      const listProjectionPendingApprovalRows = SqlSchema.findAll({
        Request: ThreadId,
        Result: ProjectionPendingApproval,
        execute: (threadId) =>
          sql`
            SELECT
              request_id AS "requestId",
              thread_id AS "threadId",
              turn_id AS "turnId",
              status,
              decision,
              created_at AS "createdAt",
              resolved_at AS "resolvedAt"
            FROM projection_pending_approvals
            WHERE thread_id = ${threadId}
            ORDER BY created_at ASC, request_id ASC
          `,
      });

      const getProjectionPendingApprovalRow = SqlSchema.findOneOption({
        Request: ApprovalRequestId,
        Result: ProjectionPendingApproval,
        execute: (requestId) =>
          sql`
            SELECT
              request_id AS "requestId",
              thread_id AS "threadId",
              turn_id AS "turnId",
              status,
              decision,
              created_at AS "createdAt",
              resolved_at AS "resolvedAt"
            FROM projection_pending_approvals
            WHERE request_id = ${requestId}
          `,
      });

      const deleteProjectionPendingApprovalRow = SqlSchema.void({
        Request: ApprovalRequestId,
        execute: (requestId) =>
          sql`
            DELETE FROM projection_pending_approvals
            WHERE request_id = ${requestId}
          `,
      });

      /**
       * Insert or replace a projected pending approval row.
       *
       * Upserts by `requestId`.
       */
      const upsert = (
        row: ProjectionPendingApproval,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        upsertProjectionPendingApprovalRow(row).pipe(
          Effect.mapError(
            toPersistenceSqlError("ProjectionPendingApprovalRepository.upsert:query"),
          ),
        );

      /**
       * List pending approvals for a thread.
       *
       * Returned in ascending creation order.
       */
      const listByThreadId = (
        threadId: ThreadId,
      ): Effect.Effect<ReadonlyArray<ProjectionPendingApproval>, ProjectionRepositoryError> =>
        listProjectionPendingApprovalRows(threadId).pipe(
          Effect.mapError(
            toPersistenceSqlError("ProjectionPendingApprovalRepository.listByThreadId:query"),
          ),
        );

      /**
       * Read a pending approval row by request id.
       */
      const getByRequestId = (
        requestId: ApprovalRequestId,
      ): Effect.Effect<Option.Option<ProjectionPendingApproval>, ProjectionRepositoryError> =>
        getProjectionPendingApprovalRow(requestId).pipe(
          Effect.mapError(
            toPersistenceSqlError("ProjectionPendingApprovalRepository.getByRequestId:query"),
          ),
        );

      /**
       * Delete a pending approval row by request id.
       */
      const deleteByRequestId = (
        requestId: ApprovalRequestId,
      ): Effect.Effect<void, ProjectionRepositoryError> =>
        deleteProjectionPendingApprovalRow(requestId).pipe(
          Effect.mapError(
            toPersistenceSqlError("ProjectionPendingApprovalRepository.deleteByRequestId:query"),
          ),
        );

      return {
        upsert,
        listByThreadId,
        getByRequestId,
        deleteByRequestId,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this)(this.make);
}
