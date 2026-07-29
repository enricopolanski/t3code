import * as Schema from "effect/Schema";

export class RelayClientAvailableStatus extends Schema.Class<RelayClientAvailableStatus>(
  "RelayClientAvailableStatus",
)({
  status: Schema.Literal("available"),
  executablePath: Schema.String,
  source: Schema.Literals(["override", "managed", "path"]),
  version: Schema.String,
}) {}

export class RelayClientMissingStatus extends Schema.Class<RelayClientMissingStatus>(
  "RelayClientMissingStatus",
)({
  status: Schema.Literal("missing"),
  version: Schema.String,
}) {}

export class RelayClientUnsupportedStatus extends Schema.Class<RelayClientUnsupportedStatus>(
  "RelayClientUnsupportedStatus",
)({
  status: Schema.Literal("unsupported"),
  platform: Schema.String,
  arch: Schema.String,
  version: Schema.String,
}) {}

export const RelayClientStatusSchema = Schema.Union([
  RelayClientAvailableStatus,
  RelayClientMissingStatus,
  RelayClientUnsupportedStatus,
]);
export type RelayClientStatus = typeof RelayClientStatusSchema.Type;

export const RelayClientInstallProgressStageSchema = Schema.Literals([
  "checking",
  "waiting_for_lock",
  "downloading",
  "verifying",
  "installing",
  "validating",
  "activating",
]);
export type RelayClientInstallProgressStage = typeof RelayClientInstallProgressStageSchema.Type;

export class RelayClientInstallProgressUpdate extends Schema.Class<RelayClientInstallProgressUpdate>(
  "RelayClientInstallProgressUpdate",
)({
  type: Schema.Literal("progress"),
  stage: RelayClientInstallProgressStageSchema,
}) {}

export class RelayClientInstallCompleted extends Schema.Class<RelayClientInstallCompleted>(
  "RelayClientInstallCompleted",
)({
  type: Schema.Literal("complete"),
  status: RelayClientStatusSchema,
}) {}

export const RelayClientInstallProgressEventSchema = Schema.Union([
  RelayClientInstallProgressUpdate,
  RelayClientInstallCompleted,
]);
export type RelayClientInstallProgressEvent = typeof RelayClientInstallProgressEventSchema.Type;

export const RelayClientInstallFailureReasonSchema = Schema.Literals([
  "download_failed",
  "invalid_checksum",
  "install_locked",
  "override_missing",
  "unsupported_platform",
  "validation_failed",
  "write_failed",
]);
export type RelayClientInstallFailureReason = typeof RelayClientInstallFailureReasonSchema.Type;

export class RelayClientInstallFailedError extends Schema.TaggedErrorClass<RelayClientInstallFailedError>()(
  "RelayClientInstallFailedError",
  {
    reason: RelayClientInstallFailureReasonSchema,
    message: Schema.String,
  },
) {}
