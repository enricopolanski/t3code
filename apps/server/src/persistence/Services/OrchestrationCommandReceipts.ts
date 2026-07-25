/**
 * OrchestrationCommandReceiptRepository - Command receipt persistence service and SQLite layer.
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
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type OrchestrationCommandReceiptRepositoryError,
  toPersistenceSqlError,
} from "../Errors.ts";

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

/**
 * OrchestrationCommandReceiptRepository - Service and SQLite-backed layer for command receipts.
 */
export class OrchestrationCommandReceiptRepository extends Context.Service<OrchestrationCommandReceiptRepository>()(
  "t3/persistence/Services/OrchestrationCommandReceipts/OrchestrationCommandReceiptRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const upsertReceiptRow = SqlSchema.void({
        Request: OrchestrationCommandReceipt,
        execute: (receipt) =>
          sql`
            INSERT INTO orchestration_command_receipts (
              command_id,
              aggregate_kind,
              aggregate_id,
              accepted_at,
              result_sequence,
              status,
              error
            )
            VALUES (
              ${receipt.commandId},
              ${receipt.aggregateKind},
              ${receipt.aggregateId},
              ${receipt.acceptedAt},
              ${receipt.resultSequence},
              ${receipt.status},
              ${receipt.error}
            )
            ON CONFLICT (command_id)
            DO UPDATE SET
              aggregate_kind = excluded.aggregate_kind,
              aggregate_id = excluded.aggregate_id,
              accepted_at = excluded.accepted_at,
              result_sequence = excluded.result_sequence,
              status = excluded.status,
              error = excluded.error
          `,
      });

      const findReceiptByCommandId = SqlSchema.findOneOption({
        Request: CommandId,
        Result: OrchestrationCommandReceipt,
        execute: (commandId) =>
          sql`
            SELECT
              command_id AS "commandId",
              aggregate_kind AS "aggregateKind",
              aggregate_id AS "aggregateId",
              accepted_at AS "acceptedAt",
              result_sequence AS "resultSequence",
              status,
              error
            FROM orchestration_command_receipts
            WHERE command_id = ${commandId}
          `,
      });

      /**
       * Insert or replace a command receipt row.
       *
       * Upserts by `commandId` for idempotent command-result tracking.
       */
      const upsert = (
        receipt: OrchestrationCommandReceipt,
      ): Effect.Effect<void, OrchestrationCommandReceiptRepositoryError> =>
        upsertReceiptRow(receipt).pipe(
          Effect.mapError(
            toPersistenceSqlError("OrchestrationCommandReceiptRepository.upsert:query"),
          ),
        );

      /**
       * Read a command receipt by command id.
       */
      const getByCommandId = (
        commandId: CommandId,
      ): Effect.Effect<
        Option.Option<OrchestrationCommandReceipt>,
        OrchestrationCommandReceiptRepositoryError
      > =>
        findReceiptByCommandId(commandId).pipe(
          Effect.mapError(
            toPersistenceSqlError("OrchestrationCommandReceiptRepository.getByCommandId:query"),
          ),
        );

      return {
        upsert,
        getByCommandId,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this)(this.make);
}
