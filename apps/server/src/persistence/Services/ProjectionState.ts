/**
 * ProjectionStateRepository - Projection repository interface for projector cursors.
 *
 * Owns persistence operations for projection cursor state used to resume
 * incremental event projection.
 *
 * @module ProjectionStateRepository
 */
import { IsoDateTime, NonNegativeInt } from "@t3tools/contracts";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  toPersistenceDecodeError,
  toPersistenceSqlError,
  type ProjectionRepositoryError,
} from "../Errors.ts";

export class ProjectionState extends Schema.Class<ProjectionState>("ProjectionState")({
  projector: Schema.String,
  lastAppliedSequence: NonNegativeInt,
  updatedAt: IsoDateTime,
}) {}

const MinLastAppliedSequenceRowSchema = Schema.Struct({
  minLastAppliedSequence: Schema.NullOr(NonNegativeInt),
});

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown): ProjectionRepositoryError =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

/**
 * ProjectionStateRepository - Service and SQLite-backed layer for projector cursors.
 */
export class ProjectionStateRepository extends Context.Service<ProjectionStateRepository>()(
  "t3/persistence/Services/ProjectionState/ProjectionStateRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const upsertProjectionStateRow = SqlSchema.void({
        Request: ProjectionState,
        execute: (row) =>
          sql`
            INSERT INTO projection_state (
              projector,
              last_applied_sequence,
              updated_at
            )
            VALUES (
              ${row.projector},
              ${row.lastAppliedSequence},
              ${row.updatedAt}
            )
            ON CONFLICT (projector)
            DO UPDATE SET
              last_applied_sequence = excluded.last_applied_sequence,
              updated_at = excluded.updated_at
          `,
      });

      const getProjectionStateRow = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: ProjectionState,
        execute: (projector) =>
          sql`
            SELECT
              projector,
              last_applied_sequence AS "lastAppliedSequence",
              updated_at AS "updatedAt"
            FROM projection_state
            WHERE projector = ${projector}
          `,
      });

      const listProjectionStateRows = SqlSchema.findAll({
        Request: Schema.Void,
        Result: ProjectionState,
        execute: () =>
          sql`
            SELECT
              projector,
              last_applied_sequence AS "lastAppliedSequence",
              updated_at AS "updatedAt"
            FROM projection_state
            ORDER BY projector ASC
          `,
      });

      const readMinLastAppliedSequence = SqlSchema.findOne({
        Request: Schema.Void,
        Result: MinLastAppliedSequenceRowSchema,
        execute: () =>
          sql`
            SELECT
              MIN(last_applied_sequence) AS "minLastAppliedSequence"
            FROM projection_state
          `,
      });

      /**
       * Insert or replace a projection cursor row.
       *
       * Upserts by projector name.
       */
      const upsert = (row: ProjectionState): Effect.Effect<void, ProjectionRepositoryError> =>
        upsertProjectionStateRow(row).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionStateRepository.upsert:query",
              "ProjectionStateRepository.upsert:encodeRequest",
            ),
          ),
        );

      /**
       * Read projection cursor state for a projector key.
       */
      const getByProjector = (
        projector: string,
      ): Effect.Effect<Option.Option<ProjectionState>, ProjectionRepositoryError> =>
        getProjectionStateRow(projector).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionStateRepository.getByProjector:query",
              "ProjectionStateRepository.getByProjector:decodeRow",
            ),
          ),
        );

      /**
       * List all projector cursor rows.
       */
      const listAll = (): Effect.Effect<
        ReadonlyArray<ProjectionState>,
        ProjectionRepositoryError
      > =>
        listProjectionStateRows(undefined).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionStateRepository.listAll:query",
              "ProjectionStateRepository.listAll:decodeRows",
            ),
          ),
        );

      /**
       * Read the minimum applied sequence across all projectors.
       *
       * Returns `null` when no projector state rows exist.
       */
      const minLastAppliedSequence = (): Effect.Effect<number | null, ProjectionRepositoryError> =>
        readMinLastAppliedSequence(undefined).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionStateRepository.minLastAppliedSequence:query",
              "ProjectionStateRepository.minLastAppliedSequence:decodeRow",
            ),
          ),
          Effect.map((row) => row.minLastAppliedSequence),
        );

      return {
        upsert,
        getByProjector,
        listAll,
        minLastAppliedSequence,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this)(this.make);
}
