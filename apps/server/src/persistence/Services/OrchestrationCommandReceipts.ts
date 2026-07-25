/**
 * OrchestrationCommandReceiptRepository - Repository interface for command receipts.
 *
 * Owns persistence operations for deduplication and status tracking of
 * orchestration command handling.
 *
 * @module OrchestrationCommandReceiptRepository
 */
import {
  CommandId,
  IsoDateTime,
  NonNegativeInt,
  OrchestrationAggregateKind,
  OrchestrationCommandReceiptStatus,
  ProjectId,
  ThreadId,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { OrchestrationCommandReceiptRepositoryError } from "../Errors.ts";

export class OrchestrationCommandReceipt extends Schema.Class<OrchestrationCommandReceipt>(
  "OrchestrationCommandReceipt",
)({
  commandId: CommandId,
  aggregateKind: OrchestrationAggregateKind,
  aggregateId: Schema.Union([ProjectId, ThreadId]),
  acceptedAt: IsoDateTime,
  resultSequence: NonNegativeInt,
  status: OrchestrationCommandReceiptStatus,
  error: Schema.NullOr(Schema.String),
}) {}

export class GetByCommandIdInput extends Schema.Class<GetByCommandIdInput>("GetByCommandIdInput")({
  commandId: CommandId,
}) {}

/**
 * OrchestrationCommandReceiptRepositoryShape - Service API for command receipts.
 */
export interface OrchestrationCommandReceiptRepositoryShape {
  /**
   * Insert or replace a command receipt row.
   *
   * Upserts by `commandId` for idempotent command-result tracking.
   */
  readonly upsert: (
    receipt: OrchestrationCommandReceipt,
  ) => Effect.Effect<void, OrchestrationCommandReceiptRepositoryError>;

  /**
   * Read a command receipt by command id.
   */
  readonly getByCommandId: (
    input: GetByCommandIdInput,
  ) => Effect.Effect<
    Option.Option<OrchestrationCommandReceipt>,
    OrchestrationCommandReceiptRepositoryError
  >;
}

/**
 * OrchestrationCommandReceiptRepository - Service tag for command receipt persistence.
 */
export class OrchestrationCommandReceiptRepository extends Context.Service<
  OrchestrationCommandReceiptRepository,
  OrchestrationCommandReceiptRepositoryShape
>()("t3/persistence/Services/OrchestrationCommandReceipts/OrchestrationCommandReceiptRepository") {}
