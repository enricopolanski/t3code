/**
 * ProjectionProjectRepository - Projection repository interface for projects.
 *
 * Owns persistence operations for project rows in the orchestration projection
 * read model.
 *
 * @module ProjectionProjectRepository
 */
import { IsoDateTime, ModelSelection, ProjectId, ProjectScript } from "@t3tools/contracts";
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

export class ProjectionProject extends Schema.Class<ProjectionProject>("ProjectionProject")({
  projectId: ProjectId,
  title: Schema.String,
  workspaceRoot: Schema.String,
  defaultModelSelection: Schema.NullOr(Schema.fromJsonString(ModelSelection)),
  scripts: Schema.fromJsonString(Schema.Array(ProjectScript)),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),
}) {}

// Rows carry JSON columns, so a failure here is either the query or the
// decode of those columns; keep the two distinguishable in the error.
function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown): ProjectionRepositoryError =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

/**
 * ProjectionProjectRepository - Service and SQLite-backed layer for projects.
 */
export class ProjectionProjectRepository extends Context.Service<ProjectionProjectRepository>()(
  "t3/persistence/Services/ProjectionProjects/ProjectionProjectRepository",
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const upsertProjectionProjectRow = SqlSchema.void({
        Request: ProjectionProject,
        execute: (row) =>
          sql`
            INSERT INTO projection_projects (
              project_id,
              title,
              workspace_root,
              default_model_selection_json,
              scripts_json,
              created_at,
              updated_at,
              deleted_at
            )
            VALUES (
              ${row.projectId},
              ${row.title},
              ${row.workspaceRoot},
              ${row.defaultModelSelection},
              ${row.scripts},
              ${row.createdAt},
              ${row.updatedAt},
              ${row.deletedAt}
            )
            ON CONFLICT (project_id)
            DO UPDATE SET
              title = excluded.title,
              workspace_root = excluded.workspace_root,
              default_model_selection_json = excluded.default_model_selection_json,
              scripts_json = excluded.scripts_json,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at
          `,
      });

      const getProjectionProjectRow = SqlSchema.findOneOption({
        Request: ProjectId,
        Result: ProjectionProject,
        execute: (projectId) =>
          sql`
            SELECT
              project_id AS "projectId",
              title,
              workspace_root AS "workspaceRoot",
              default_model_selection_json AS "defaultModelSelection",
              scripts_json AS "scripts",
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              deleted_at AS "deletedAt"
            FROM projection_projects
            WHERE project_id = ${projectId}
          `,
      });

      const listProjectionProjectRows = SqlSchema.findAll({
        Request: Schema.Void,
        Result: ProjectionProject,
        execute: () =>
          sql`
            SELECT
              project_id AS "projectId",
              title,
              workspace_root AS "workspaceRoot",
              default_model_selection_json AS "defaultModelSelection",
              scripts_json AS "scripts",
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              deleted_at AS "deletedAt"
            FROM projection_projects
            ORDER BY created_at ASC, project_id ASC
          `,
      });

      const deleteProjectionProjectRow = SqlSchema.void({
        Request: ProjectId,
        execute: (projectId) =>
          sql`
            DELETE FROM projection_projects
            WHERE project_id = ${projectId}
          `,
      });

      /**
       * Insert or replace a projected project row.
       *
       * Upserts by `projectId` and persists scripts through JSON encoding.
       */
      const upsert = (row: ProjectionProject): Effect.Effect<void, ProjectionRepositoryError> =>
        upsertProjectionProjectRow(row).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionProjectRepository.upsert:query",
              "ProjectionProjectRepository.upsert:encodeRequest",
            ),
          ),
        );

      /**
       * Read a projected project row by id.
       */
      const getById = (
        projectId: ProjectId,
      ): Effect.Effect<Option.Option<ProjectionProject>, ProjectionRepositoryError> =>
        getProjectionProjectRow(projectId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionProjectRepository.getById:query",
              "ProjectionProjectRepository.getById:decodeRow",
            ),
          ),
        );

      /**
       * List all projected project rows.
       *
       * Returned in deterministic creation order.
       */
      const listAll = (): Effect.Effect<
        ReadonlyArray<ProjectionProject>,
        ProjectionRepositoryError
      > =>
        listProjectionProjectRows().pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionProjectRepository.listAll:query",
              "ProjectionProjectRepository.listAll:decodeRows",
            ),
          ),
        );

      /**
       * Soft-delete a projected project row by id.
       */
      const deleteById = (projectId: ProjectId): Effect.Effect<void, ProjectionRepositoryError> =>
        deleteProjectionProjectRow(projectId).pipe(
          Effect.mapError(
            toPersistenceSqlOrDecodeError(
              "ProjectionProjectRepository.deleteById:query",
              "ProjectionProjectRepository.deleteById:encodeRequest",
            ),
          ),
        );

      return {
        upsert,
        getById,
        listAll,
        deleteById,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this)(this.make);
}
