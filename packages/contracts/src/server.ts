import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ExecutionEnvironmentDescriptor, ServerSelfUpdateMethod } from "./environment.ts";
import { ServerAuthDescriptor } from "./auth.ts";
import {
  IsoDateTime,
  NonNegativeInt,
  PositiveInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";
import {
  KeybindingCommand,
  KeybindingValue,
  KeybindingWhen,
  ResolvedKeybindingsConfig,
} from "./keybindings.ts";
import { EditorId } from "./editor.ts";
import { ModelCapabilities } from "./model.ts";
import { ProviderDriverKind, ProviderInstanceId } from "./providerInstance.ts";
import { ServerSettings } from "./settings.ts";

export class KeybindingsMalformedConfigIssue extends Schema.Class<KeybindingsMalformedConfigIssue>(
  "KeybindingsMalformedConfigIssue",
)({
  kind: Schema.Literal("keybindings.malformed-config"),
  message: TrimmedNonEmptyString,
}) {}

export class KeybindingsInvalidEntryIssue extends Schema.Class<KeybindingsInvalidEntryIssue>(
  "KeybindingsInvalidEntryIssue",
)({
  kind: Schema.Literal("keybindings.invalid-entry"),
  message: TrimmedNonEmptyString,
  index: Schema.Number,
}) {}

export const ServerConfigIssue = Schema.Union([
  KeybindingsMalformedConfigIssue,
  KeybindingsInvalidEntryIssue,
]);
export type ServerConfigIssue = typeof ServerConfigIssue.Type;

const ServerConfigIssues = Schema.Array(ServerConfigIssue);

export const ServerProviderState = Schema.Literals(["ready", "warning", "error", "disabled"]);
export type ServerProviderState = typeof ServerProviderState.Type;

export const ServerProviderAuthStatus = Schema.Literals([
  "authenticated",
  "unauthenticated",
  "unknown",
]);
export type ServerProviderAuthStatus = typeof ServerProviderAuthStatus.Type;

export class ServerProviderAuth extends Schema.Class<ServerProviderAuth>("ServerProviderAuth")({
  status: ServerProviderAuthStatus,
  type: Schema.optional(TrimmedNonEmptyString),
  label: Schema.optional(TrimmedNonEmptyString),
  email: Schema.optional(TrimmedNonEmptyString),
}) {}

export class ServerProviderModel extends Schema.Class<ServerProviderModel>("ServerProviderModel")({
  slug: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  shortName: Schema.optional(TrimmedNonEmptyString),
  subProvider: Schema.optional(TrimmedNonEmptyString),
  isCustom: Schema.Boolean,
  isDefault: Schema.optional(Schema.Boolean),
  capabilities: Schema.NullOr(ModelCapabilities),
}) {}

export class ServerProviderSlashCommandInput extends Schema.Class<ServerProviderSlashCommandInput>(
  "ServerProviderSlashCommandInput",
)({
  hint: TrimmedNonEmptyString,
}) {}

export class ServerProviderSlashCommand extends Schema.Class<ServerProviderSlashCommand>(
  "ServerProviderSlashCommand",
)({
  name: TrimmedNonEmptyString,
  description: Schema.optional(TrimmedNonEmptyString),
  input: Schema.optional(ServerProviderSlashCommandInput),
}) {}

export class ServerProviderSkill extends Schema.Class<ServerProviderSkill>("ServerProviderSkill")({
  name: TrimmedNonEmptyString,
  description: Schema.optional(TrimmedNonEmptyString),
  path: TrimmedNonEmptyString,
  scope: Schema.optional(TrimmedNonEmptyString),
  enabled: Schema.Boolean,
  displayName: Schema.optional(TrimmedNonEmptyString),
  shortDescription: Schema.optional(TrimmedNonEmptyString),
}) {}

/**
 * Availability of a configured provider instance from the runtime's POV.
 *
 *  - `available` — the build ships this driver and an instance is wired
 *    up. Default for legacy snapshots produced from the closed
 *    `ServerSettings.providers` map.
 *  - `unavailable` — the user's `ServerSettings.providerInstances` (or a
 *    persisted thread / session binding) references a driver this build
 *    doesn't ship. Common after rolling back from a fork or PR branch
 *    that introduced a new driver. The snapshot is preserved so the UI
 *    can render "missing driver" affordances and so the data round-trips
 *    when the user moves back to the fork.
 *
 * Snapshots with `availability: "unavailable"` MUST set
 * `installed: false` and `enabled: false`; the runtime refuses turn
 * starts against them with a structured error.
 */
export const ServerProviderAvailability = Schema.Literals(["available", "unavailable"]);
export type ServerProviderAvailability = typeof ServerProviderAvailability.Type;

export class ServerProviderContinuation extends Schema.Class<ServerProviderContinuation>(
  "ServerProviderContinuation",
)({
  groupKey: TrimmedNonEmptyString,
}) {}

export const ServerProviderVersionAdvisoryStatus = Schema.Literals([
  "unknown",
  "current",
  "behind_latest",
]);
export type ServerProviderVersionAdvisoryStatus = typeof ServerProviderVersionAdvisoryStatus.Type;

export class ServerProviderVersionAdvisory extends Schema.Class<ServerProviderVersionAdvisory>(
  "ServerProviderVersionAdvisory",
)({
  status: ServerProviderVersionAdvisoryStatus,
  currentVersion: Schema.NullOr(TrimmedNonEmptyString),
  latestVersion: Schema.NullOr(TrimmedNonEmptyString),
  updateCommand: Schema.NullOr(TrimmedNonEmptyString),
  canUpdate: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  checkedAt: Schema.NullOr(IsoDateTime),
  message: Schema.NullOr(TrimmedNonEmptyString),
}) {}

export const ServerProviderUpdateStatus = Schema.Literals([
  "idle",
  "queued",
  "running",
  "succeeded",
  "failed",
  "unchanged",
]);
export type ServerProviderUpdateStatus = typeof ServerProviderUpdateStatus.Type;

export class ServerProviderUpdateState extends Schema.Class<ServerProviderUpdateState>(
  "ServerProviderUpdateState",
)({
  status: ServerProviderUpdateStatus,
  startedAt: Schema.NullOr(IsoDateTime),
  finishedAt: Schema.NullOr(IsoDateTime),
  message: Schema.NullOr(TrimmedNonEmptyString),
  output: Schema.NullOr(Schema.String.check(Schema.isMaxLength(10_000))),
}) {}

export class ServerProvider extends Schema.Class<ServerProvider>("ServerProvider")({
  // Routing key for the configured instance this snapshot represents. This
  // is the only stable identity consumers may use for provider routing.
  instanceId: ProviderInstanceId,
  // Open driver kind slug that selects the implementation handling this
  // instance. It is metadata/capability context, not a routing key.
  driver: ProviderDriverKind,
  displayName: Schema.optional(TrimmedNonEmptyString),
  accentColor: Schema.optional(TrimmedNonEmptyString),
  badgeLabel: Schema.optional(TrimmedNonEmptyString),
  continuation: Schema.optional(ServerProviderContinuation),
  showInteractionModeToggle: Schema.optional(Schema.Boolean),
  requiresNewThreadForModelChange: Schema.optional(Schema.Boolean),
  enabled: Schema.Boolean,
  installed: Schema.Boolean,
  version: Schema.NullOr(TrimmedNonEmptyString),
  status: ServerProviderState,
  auth: ServerProviderAuth,
  checkedAt: IsoDateTime,
  message: Schema.optional(TrimmedNonEmptyString),
  // Optional for back-compat: every legacy producer omits this field and
  // an absent value is interpreted as `"available"` by consumers (see
  // `isProviderAvailable`). New `ProviderInstanceRegistry` outputs set it
  // explicitly so the UI can render unavailable shadows from
  // `ServerSettings.providerInstances`.
  availability: Schema.optional(ServerProviderAvailability),
  // Human-readable reason populated when `availability === "unavailable"`.
  // Surfaces in the UI alongside the missing-driver affordance.
  unavailableReason: Schema.optional(TrimmedNonEmptyString),
  models: Schema.Array(ServerProviderModel),
  slashCommands: Schema.Array(ServerProviderSlashCommand).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  skills: Schema.Array(ServerProviderSkill).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  versionAdvisory: Schema.optionalKey(ServerProviderVersionAdvisory),
  updateState: Schema.optionalKey(ServerProviderUpdateState),
}) {}

export const ServerProviders = Schema.Array(ServerProvider);
export type ServerProviders = typeof ServerProviders.Type;

/**
 * Treat the optional `availability` as "available" when absent. This is
 * the rule legacy producers (which omit the field) and new producers
 * (which set it explicitly) agree on so consumers never have to thread
 * `?? "available"` defaults through their code paths.
 */
export const isProviderAvailable = (snapshot: ServerProvider): boolean =>
  snapshot.availability !== "unavailable";

export class ServerObservability extends Schema.Class<ServerObservability>("ServerObservability")({
  logsDirectoryPath: TrimmedNonEmptyString,
  localTracingEnabled: Schema.Boolean,
  otlpTracesUrl: Schema.optional(TrimmedNonEmptyString),
  otlpTracesEnabled: Schema.Boolean,
  otlpMetricsUrl: Schema.optional(TrimmedNonEmptyString),
  otlpMetricsEnabled: Schema.Boolean,
}) {}

export const ServerTraceDiagnosticsErrorKind = Schema.Literals([
  "trace-file-not-found",
  "trace-file-read-failed",
]);
export type ServerTraceDiagnosticsErrorKind = typeof ServerTraceDiagnosticsErrorKind.Type;

export class ServerTraceDiagnosticsSpanSummary extends Schema.Class<ServerTraceDiagnosticsSpanSummary>(
  "ServerTraceDiagnosticsSpanSummary",
)({
  name: TrimmedNonEmptyString,
  count: NonNegativeInt,
  failureCount: NonNegativeInt,
  totalDurationMs: Schema.Number,
  averageDurationMs: Schema.Number,
  maxDurationMs: Schema.Number,
}) {}

export class ServerTraceDiagnosticsFailureSummary extends Schema.Class<ServerTraceDiagnosticsFailureSummary>(
  "ServerTraceDiagnosticsFailureSummary",
)({
  name: TrimmedNonEmptyString,
  cause: TrimmedNonEmptyString,
  count: NonNegativeInt,
  lastSeenAt: Schema.DateTimeUtc,
  traceId: TrimmedNonEmptyString,
  spanId: TrimmedNonEmptyString,
}) {}

export class ServerTraceDiagnosticsRecentFailure extends Schema.Class<ServerTraceDiagnosticsRecentFailure>(
  "ServerTraceDiagnosticsRecentFailure",
)({
  name: TrimmedNonEmptyString,
  cause: TrimmedNonEmptyString,
  durationMs: Schema.Number,
  endedAt: Schema.DateTimeUtc,
  traceId: TrimmedNonEmptyString,
  spanId: TrimmedNonEmptyString,
}) {}

export class ServerTraceDiagnosticsSpanOccurrence extends Schema.Class<ServerTraceDiagnosticsSpanOccurrence>(
  "ServerTraceDiagnosticsSpanOccurrence",
)({
  name: TrimmedNonEmptyString,
  durationMs: Schema.Number,
  endedAt: Schema.DateTimeUtc,
  traceId: TrimmedNonEmptyString,
  spanId: TrimmedNonEmptyString,
}) {}

export class ServerTraceDiagnosticsLogEvent extends Schema.Class<ServerTraceDiagnosticsLogEvent>(
  "ServerTraceDiagnosticsLogEvent",
)({
  spanName: TrimmedNonEmptyString,
  level: TrimmedNonEmptyString,
  message: TrimmedNonEmptyString,
  seenAt: Schema.DateTimeUtc,
  traceId: TrimmedNonEmptyString,
  spanId: TrimmedNonEmptyString,
}) {}

export class ServerTraceDiagnosticsResult extends Schema.Class<ServerTraceDiagnosticsResult>(
  "ServerTraceDiagnosticsResult",
)({
  traceFilePath: TrimmedNonEmptyString,
  scannedFilePaths: Schema.Array(TrimmedNonEmptyString),
  readAt: Schema.DateTimeUtc,
  recordCount: NonNegativeInt,
  parseErrorCount: NonNegativeInt,
  firstSpanAt: Schema.Option(Schema.DateTimeUtc),
  lastSpanAt: Schema.Option(Schema.DateTimeUtc),
  failureCount: NonNegativeInt,
  interruptionCount: NonNegativeInt,
  slowSpanThresholdMs: NonNegativeInt,
  slowSpanCount: NonNegativeInt,
  logLevelCounts: Schema.Record(TrimmedNonEmptyString, NonNegativeInt),
  topSpansByCount: Schema.Array(ServerTraceDiagnosticsSpanSummary),
  slowestSpans: Schema.Array(ServerTraceDiagnosticsSpanOccurrence),
  commonFailures: Schema.Array(ServerTraceDiagnosticsFailureSummary),
  latestFailures: Schema.Array(ServerTraceDiagnosticsRecentFailure),
  latestWarningAndErrorLogs: Schema.Array(ServerTraceDiagnosticsLogEvent),
  partialFailure: Schema.Option(Schema.Boolean),
  error: Schema.Option(
    Schema.Struct({
      kind: ServerTraceDiagnosticsErrorKind,
      message: TrimmedNonEmptyString,
    }),
  ),
}) {}

export const ServerProcessSignal = Schema.Literals(["SIGINT", "SIGKILL"]);
export type ServerProcessSignal = typeof ServerProcessSignal.Type;

export class ServerProcessDiagnosticsEntry extends Schema.Class<ServerProcessDiagnosticsEntry>(
  "ServerProcessDiagnosticsEntry",
)({
  pid: PositiveInt,
  ppid: NonNegativeInt,
  pgid: Schema.Option(Schema.Int),
  status: TrimmedNonEmptyString,
  cpuPercent: Schema.Number,
  rssBytes: NonNegativeInt,
  elapsed: TrimmedNonEmptyString,
  command: TrimmedNonEmptyString,
  depth: NonNegativeInt,
  childPids: Schema.Array(PositiveInt),
}) {}

export class ServerProcessDiagnosticsResult extends Schema.Class<ServerProcessDiagnosticsResult>(
  "ServerProcessDiagnosticsResult",
)({
  serverPid: PositiveInt,
  readAt: Schema.DateTimeUtc,
  processCount: NonNegativeInt,
  totalRssBytes: NonNegativeInt,
  totalCpuPercent: Schema.Number,
  processes: Schema.Array(ServerProcessDiagnosticsEntry),
  error: Schema.Option(
    Schema.Struct({
      message: TrimmedNonEmptyString,
    }),
  ),
}) {}

export class ServerProcessResourceHistoryInput extends Schema.Class<ServerProcessResourceHistoryInput>(
  "ServerProcessResourceHistoryInput",
)({
  windowMs: NonNegativeInt,
  bucketMs: NonNegativeInt,
}) {}

export class ServerProcessResourceHistoryBucket extends Schema.Class<ServerProcessResourceHistoryBucket>(
  "ServerProcessResourceHistoryBucket",
)({
  startedAt: Schema.DateTimeUtc,
  endedAt: Schema.DateTimeUtc,
  avgCpuPercent: Schema.Number,
  maxCpuPercent: Schema.Number,
  maxRssBytes: NonNegativeInt,
  maxProcessCount: NonNegativeInt,
}) {}

export class ServerProcessResourceHistorySummary extends Schema.Class<ServerProcessResourceHistorySummary>(
  "ServerProcessResourceHistorySummary",
)({
  processKey: TrimmedNonEmptyString,
  pid: PositiveInt,
  ppid: NonNegativeInt,
  command: TrimmedNonEmptyString,
  depth: NonNegativeInt,
  isServerRoot: Schema.Boolean,
  firstSeenAt: Schema.DateTimeUtc,
  lastSeenAt: Schema.DateTimeUtc,
  currentCpuPercent: Schema.Number,
  avgCpuPercent: Schema.Number,
  maxCpuPercent: Schema.Number,
  cpuSecondsApprox: Schema.Number,
  currentRssBytes: NonNegativeInt,
  maxRssBytes: NonNegativeInt,
  sampleCount: NonNegativeInt,
}) {}

export const ServerProcessResourceHistoryFailureTag = Schema.Literals([
  "ProcessDiagnosticsQueryTimeoutError",
  "ProcessDiagnosticsQueryFailedError",
  "ProcessDiagnosticsServerProcessSignalError",
  "ProcessDiagnosticsNotDescendantError",
  "ProcessDiagnosticsSignalFailedError",
]);
export type ServerProcessResourceHistoryFailureTag =
  typeof ServerProcessResourceHistoryFailureTag.Type;

export class ServerProcessResourceHistoryResult extends Schema.Class<ServerProcessResourceHistoryResult>(
  "ServerProcessResourceHistoryResult",
)({
  readAt: Schema.DateTimeUtc,
  windowMs: NonNegativeInt,
  bucketMs: NonNegativeInt,
  sampleIntervalMs: NonNegativeInt,
  retainedSampleCount: NonNegativeInt,
  totalCpuSecondsApprox: Schema.Number,
  buckets: Schema.Array(ServerProcessResourceHistoryBucket),
  topProcesses: Schema.Array(ServerProcessResourceHistorySummary),
  error: Schema.Option(
    Schema.Struct({
      failureTag: ServerProcessResourceHistoryFailureTag,
      message: TrimmedNonEmptyString,
    }),
  ),
}) {}

export class ServerSignalProcessInput extends Schema.Class<ServerSignalProcessInput>(
  "ServerSignalProcessInput",
)({
  pid: PositiveInt,
  signal: ServerProcessSignal,
}) {}

export class ServerSignalProcessResult extends Schema.Class<ServerSignalProcessResult>(
  "ServerSignalProcessResult",
)({
  pid: PositiveInt,
  signal: ServerProcessSignal,
  signaled: Schema.Boolean,
  message: Schema.Option(TrimmedNonEmptyString),
}) {}

export class ServerConfig extends Schema.Class<ServerConfig>("ServerConfig")({
  environment: ExecutionEnvironmentDescriptor,
  auth: ServerAuthDescriptor,
  cwd: TrimmedNonEmptyString,
  keybindingsConfigPath: TrimmedNonEmptyString,
  keybindings: ResolvedKeybindingsConfig,
  issues: ServerConfigIssues,
  providers: ServerProviders,
  availableEditors: Schema.Array(EditorId),
  observability: ServerObservability,
  settings: ServerSettings,
  /** Whether shell subscriptions can emit an opt-in catch-up completion marker. */
  shellResumeCompletionMarker: Schema.optionalKey(Schema.Boolean),
  /** Whether thread subscriptions can emit an opt-in catch-up completion marker. */
  threadResumeCompletionMarker: Schema.optionalKey(Schema.Boolean),
}) {}

export class ServerUpsertKeybindingReplaceTarget extends Schema.Class<ServerUpsertKeybindingReplaceTarget>(
  "ServerUpsertKeybindingReplaceTarget",
)({
  key: KeybindingValue,
  command: KeybindingCommand,
  when: Schema.optional(KeybindingWhen),
}) {}

export class ServerUpsertKeybindingInput extends Schema.Class<ServerUpsertKeybindingInput>(
  "ServerUpsertKeybindingInput",
)({
  key: KeybindingValue,
  command: KeybindingCommand,
  when: Schema.optional(KeybindingWhen),
  replace: Schema.optional(ServerUpsertKeybindingReplaceTarget),
}) {}

export const ServerRemoveKeybindingInput = ServerUpsertKeybindingReplaceTarget;
export type ServerRemoveKeybindingInput = typeof ServerRemoveKeybindingInput.Type;

export class ServerUpsertKeybindingResult extends Schema.Class<ServerUpsertKeybindingResult>(
  "ServerUpsertKeybindingResult",
)({
  keybindings: ResolvedKeybindingsConfig,
  issues: ServerConfigIssues,
}) {}

export const ServerRemoveKeybindingResult = ServerUpsertKeybindingResult;
export type ServerRemoveKeybindingResult = typeof ServerRemoveKeybindingResult.Type;

export class ServerConfigUpdatedPayload extends Schema.Class<ServerConfigUpdatedPayload>(
  "ServerConfigUpdatedPayload",
)({
  issues: ServerConfigIssues,
  providers: ServerProviders,
  settings: Schema.optional(ServerSettings),
}) {}

export class ServerConfigKeybindingsUpdatedPayload extends Schema.Class<ServerConfigKeybindingsUpdatedPayload>(
  "ServerConfigKeybindingsUpdatedPayload",
)({
  keybindings: ResolvedKeybindingsConfig,
  issues: ServerConfigIssues,
}) {}

export class ServerConfigProviderStatusesPayload extends Schema.Class<ServerConfigProviderStatusesPayload>(
  "ServerConfigProviderStatusesPayload",
)({
  providers: ServerProviders,
}) {}

export class ServerConfigSettingsUpdatedPayload extends Schema.Class<ServerConfigSettingsUpdatedPayload>(
  "ServerConfigSettingsUpdatedPayload",
)({
  settings: ServerSettings,
}) {}

export class ServerConfigStreamSnapshotEvent extends Schema.Class<ServerConfigStreamSnapshotEvent>(
  "ServerConfigStreamSnapshotEvent",
)({
  version: Schema.Literal(1),
  type: Schema.Literal("snapshot"),
  config: ServerConfig,
}) {}

export class ServerConfigStreamKeybindingsUpdatedEvent extends Schema.Class<ServerConfigStreamKeybindingsUpdatedEvent>(
  "ServerConfigStreamKeybindingsUpdatedEvent",
)({
  version: Schema.Literal(1),
  type: Schema.Literal("keybindingsUpdated"),
  payload: ServerConfigKeybindingsUpdatedPayload,
}) {}

export class ServerConfigStreamProviderStatusesEvent extends Schema.Class<ServerConfigStreamProviderStatusesEvent>(
  "ServerConfigStreamProviderStatusesEvent",
)({
  version: Schema.Literal(1),
  type: Schema.Literal("providerStatuses"),
  payload: ServerConfigProviderStatusesPayload,
}) {}

export class ServerConfigStreamSettingsUpdatedEvent extends Schema.Class<ServerConfigStreamSettingsUpdatedEvent>(
  "ServerConfigStreamSettingsUpdatedEvent",
)({
  version: Schema.Literal(1),
  type: Schema.Literal("settingsUpdated"),
  payload: ServerConfigSettingsUpdatedPayload,
}) {}

export const ServerConfigStreamEvent = Schema.Union([
  ServerConfigStreamSnapshotEvent,
  ServerConfigStreamKeybindingsUpdatedEvent,
  ServerConfigStreamProviderStatusesEvent,
  ServerConfigStreamSettingsUpdatedEvent,
]);
export type ServerConfigStreamEvent = typeof ServerConfigStreamEvent.Type;

export class ServerLifecycleReadyPayload extends Schema.Class<ServerLifecycleReadyPayload>(
  "ServerLifecycleReadyPayload",
)({
  at: IsoDateTime,
  environment: ExecutionEnvironmentDescriptor,
}) {}

export class ServerLifecycleWelcomePayload extends Schema.Class<ServerLifecycleWelcomePayload>(
  "ServerLifecycleWelcomePayload",
)({
  environment: ExecutionEnvironmentDescriptor,
  cwd: TrimmedNonEmptyString,
  projectName: TrimmedNonEmptyString,
  bootstrapProjectId: Schema.optional(ProjectId),
  bootstrapThreadId: Schema.optional(ThreadId),
}) {}

export class ServerLifecycleStreamWelcomeEvent extends Schema.Class<ServerLifecycleStreamWelcomeEvent>(
  "ServerLifecycleStreamWelcomeEvent",
)({
  version: Schema.Literal(1),
  sequence: NonNegativeInt,
  type: Schema.Literal("welcome"),
  payload: ServerLifecycleWelcomePayload,
}) {}

export class ServerLifecycleStreamReadyEvent extends Schema.Class<ServerLifecycleStreamReadyEvent>(
  "ServerLifecycleStreamReadyEvent",
)({
  version: Schema.Literal(1),
  sequence: NonNegativeInt,
  type: Schema.Literal("ready"),
  payload: ServerLifecycleReadyPayload,
}) {}

export const ServerLifecycleStreamEvent = Schema.Union([
  ServerLifecycleStreamWelcomeEvent,
  ServerLifecycleStreamReadyEvent,
]);
export type ServerLifecycleStreamEvent = typeof ServerLifecycleStreamEvent.Type;

export class ServerProviderUpdatedPayload extends Schema.Class<ServerProviderUpdatedPayload>(
  "ServerProviderUpdatedPayload",
)({
  providers: ServerProviders,
}) {}

export class ServerProviderUpdateInput extends Schema.Class<ServerProviderUpdateInput>(
  "ServerProviderUpdateInput",
)({
  provider: ProviderDriverKind,
  instanceId: Schema.optionalKey(ProviderInstanceId),
}) {}

export class ServerProviderUpdateError extends Schema.TaggedErrorClass<ServerProviderUpdateError>()(
  "ServerProviderUpdateError",
  {
    provider: ProviderDriverKind,
    reason: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message(): string {
    return `Provider update failed for ${this.provider}: ${this.reason}`;
  }
}

export class ServerSelfUpdateInput extends Schema.Class<ServerSelfUpdateInput>(
  "ServerSelfUpdateInput",
)({
  /** Exact npm version of the `t3` package to install (never a dist-tag, so
      the server and the acknowledging client agree on what was requested). */
  targetVersion: TrimmedNonEmptyString,
}) {}

/** Acknowledgement that the update artifact is installed and the server is
    about to restart into it — the connection will drop moments later. */
export class ServerSelfUpdateResult extends Schema.Class<ServerSelfUpdateResult>(
  "ServerSelfUpdateResult",
)({
  targetVersion: TrimmedNonEmptyString,
  method: ServerSelfUpdateMethod,
}) {}

export class ServerSelfUpdateError extends Schema.TaggedErrorClass<ServerSelfUpdateError>()(
  "ServerSelfUpdateError",
  {
    reason: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message(): string {
    return `Server update failed: ${this.reason}`;
  }
}
