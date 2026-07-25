/**
 * ProjectionProjectRepository - Projection repository interface for projects.
 *
 * Owns persistence operations for project rows in the orchestration projection
 * read model.
 *
 * @module ProjectionProjectRepository
 */
import { IsoDateTime, ModelSelection, ProjectId, ProjectScript } from "@t3tools/contracts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

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

export class GetProjectionProjectInput extends Schema.Class<GetProjectionProjectInput>(
  "GetProjectionProjectInput",
)({
  projectId: ProjectId,
}) {}

export class DeleteProjectionProjectInput extends Schema.Class<DeleteProjectionProjectInput>(
  "DeleteProjectionProjectInput",
)({
  projectId: ProjectId,
}) {}

/**
 * ProjectionProjectRepositoryShape - Service API for projected project records.
 */
export interface ProjectionProjectRepositoryShape {
  /**
   * Insert or replace a projected project row.
   *
   * Upserts by `projectId` and persists scripts through JSON encoding.
   */
  readonly upsert: (row: ProjectionProject) => Effect.Effect<void, ProjectionRepositoryError>;

  /**
   * Read a projected project row by id.
   */
  readonly getById: (
    input: GetProjectionProjectInput,
  ) => Effect.Effect<Option.Option<ProjectionProject>, ProjectionRepositoryError>;

  /**
   * List all projected project rows.
   *
   * Returned in deterministic creation order.
   */
  readonly listAll: () => Effect.Effect<
    ReadonlyArray<ProjectionProject>,
    ProjectionRepositoryError
  >;

  /**
   * Soft-delete a projected project row by id.
   */
  readonly deleteById: (
    input: DeleteProjectionProjectInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

/**
 * ProjectionProjectRepository - Service tag for project projection persistence.
 */
export class ProjectionProjectRepository extends Context.Service<
  ProjectionProjectRepository,
  ProjectionProjectRepositoryShape
>()("t3/persistence/Services/ProjectionProjects/ProjectionProjectRepository") {}
