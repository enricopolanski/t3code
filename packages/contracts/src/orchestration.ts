import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Struct from "effect/Struct";
import { ProviderOptionSelections } from "./model.ts";
import { RepositoryIdentity } from "./environment.ts";
import {
  ApprovalRequestId,
  CheckpointRef,
  CommandId,
  EventId,
  IsoDateTime,
  MessageId,
  NonNegativeInt,
  ProjectId,
  ProviderItemId,
  ThreadId,
  TrimmedNonEmptyString,
  TurnId,
} from "./baseSchemas.ts";
import { ProviderInstanceId } from "./providerInstance.ts";

export const ORCHESTRATION_WS_METHODS = {
  dispatchCommand: "orchestration.dispatchCommand",
  getTurnDiff: "orchestration.getTurnDiff",
  getFullThreadDiff: "orchestration.getFullThreadDiff",
  replayEvents: "orchestration.replayEvents",
  getArchivedShellSnapshot: "orchestration.getArchivedShellSnapshot",
  subscribeShell: "orchestration.subscribeShell",
  subscribeThread: "orchestration.subscribeThread",
} as const;

export const ProviderApprovalPolicy = Schema.Literals([
  "untrusted",
  "on-failure",
  "on-request",
  "never",
]);
export type ProviderApprovalPolicy = typeof ProviderApprovalPolicy.Type;
export const ProviderSandboxMode = Schema.Literals([
  "read-only",
  "workspace-write",
  "danger-full-access",
]);
export type ProviderSandboxMode = typeof ProviderSandboxMode.Type;

/**
 * `ModelSelection` — selection of a model on a configured provider instance.
 *
 * The routing key is `instanceId` (a user-defined slug identifying one
 * configured provider instance). Drivers, credentials, working-directory
 * bindings, and any other per-instance state are recovered from the
 * runtime registry via the instance id.
 *
 * Wire legacy: persisted selections produced before the driver/instance
 * split carried a `provider: <driver-id>` field instead. The schema absorbs
 * that shape via a pre-decoding transform — `{provider, model}` is promoted
 * to `{instanceId: defaultInstanceIdForDriver(provider), model}`. No
 * post-decode compatibility code lives in the runtime; the transform is the
 * only compat surface.
 *
 * Both sides of that transform stay `Schema.Struct`s: they are the source and
 * target of a `decodeTo`, not a value anyone constructs directly.
 */
const ModelSelectionWire = Schema.Struct({
  instanceId: ProviderInstanceId,
  model: TrimmedNonEmptyString,
  options: Schema.optionalKey(ProviderOptionSelections),
});

// Source shape for persisted legacy payloads. Fields are typed as
// `Schema.Unknown` so malformed drafts still make it into the transform and
// fail validation through the target schema (with proper error messages)
// rather than at the source-struct layer where the error is less actionable.
const ModelSelectionSource = Schema.Struct({
  provider: Schema.optional(Schema.Unknown),
  instanceId: Schema.optional(Schema.Unknown),
  model: Schema.Unknown,
  options: Schema.optional(Schema.Unknown),
});

export const ModelSelection = ModelSelectionSource.pipe(
  Schema.decodeTo(
    ModelSelectionWire,
    SchemaTransformation.transformOrFail({
      decode: (raw) => {
        // Resolve the routing key: prefer an explicit `instanceId`; fall
        // back to promoting the legacy `provider` slug (the canonical
        // `defaultInstanceIdForDriver` mapping) so persisted rollout-era
        // payloads decode without data loss. The target schema brands the
        // string as `ProviderInstanceId`.
        const instanceIdSource =
          raw.instanceId !== undefined
            ? raw.instanceId
            : typeof raw.provider === "string"
              ? raw.provider
              : undefined;
        const base: Record<string, unknown> = {
          instanceId: instanceIdSource,
          model: raw.model,
        };
        if (raw.options !== undefined) base.options = raw.options;
        return Effect.succeed(base as typeof ModelSelectionWire.Encoded);
      },
      encode: (value) => {
        const base: Record<string, unknown> = {
          model: value.model,
          instanceId: value.instanceId,
        };
        if (value.options !== undefined) base.options = value.options;
        return Effect.succeed(base as typeof ModelSelectionSource.Encoded);
      },
    }),
  ),
);
export type ModelSelection = typeof ModelSelection.Type;

export const RuntimeMode = Schema.Literals([
  "approval-required",
  "auto-accept-edits",
  "auto",
  "full-access",
]);
export type RuntimeMode = typeof RuntimeMode.Type;
export const DEFAULT_RUNTIME_MODE: RuntimeMode = "full-access";
export const ProviderInteractionMode = Schema.Literals(["default", "plan"]);
export type ProviderInteractionMode = typeof ProviderInteractionMode.Type;
export const DEFAULT_PROVIDER_INTERACTION_MODE: ProviderInteractionMode = "default";
export const ProviderRequestKind = Schema.Literals(["command", "file-read", "file-change"]);
export type ProviderRequestKind = typeof ProviderRequestKind.Type;
export const AssistantDeliveryMode = Schema.Literals(["buffered", "streaming"]);
export type AssistantDeliveryMode = typeof AssistantDeliveryMode.Type;
export const ProviderApprovalDecision = Schema.Literals([
  "accept",
  "acceptForSession",
  "decline",
  "cancel",
]);
export type ProviderApprovalDecision = typeof ProviderApprovalDecision.Type;
export const ProviderUserInputAnswers = Schema.Record(Schema.String, Schema.Unknown);
export type ProviderUserInputAnswers = typeof ProviderUserInputAnswers.Type;

export const PROVIDER_SEND_TURN_MAX_INPUT_CHARS = 120_000;
export const PROVIDER_SEND_TURN_MAX_ATTACHMENTS = 8;
export const PROVIDER_SEND_TURN_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const PROVIDER_SEND_TURN_MAX_IMAGE_DATA_URL_CHARS = 14_000_000;
const CHAT_ATTACHMENT_ID_MAX_CHARS = 128;
// Correlation id is command id by design in this model.
export const CorrelationId = CommandId;
export type CorrelationId = typeof CorrelationId.Type;

const ChatAttachmentId = TrimmedNonEmptyString.check(
  Schema.isMaxLength(CHAT_ATTACHMENT_ID_MAX_CHARS),
  Schema.isPattern(/^[a-z0-9_-]+$/i),
);
export type ChatAttachmentId = typeof ChatAttachmentId.Type;

export class ChatImageAttachment extends Schema.Class<ChatImageAttachment>("ChatImageAttachment")({
  type: Schema.Literal("image"),
  id: ChatAttachmentId,
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(255)),
  mimeType: TrimmedNonEmptyString.check(Schema.isMaxLength(100), Schema.isPattern(/^image\//i)),
  sizeBytes: NonNegativeInt.check(Schema.isLessThanOrEqualTo(PROVIDER_SEND_TURN_MAX_IMAGE_BYTES)),
}) {}

export class UploadChatImageAttachment extends Schema.Class<UploadChatImageAttachment>(
  "UploadChatImageAttachment",
)({
  type: Schema.Literal("image"),
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(255)),
  mimeType: TrimmedNonEmptyString.check(Schema.isMaxLength(100), Schema.isPattern(/^image\//i)),
  sizeBytes: NonNegativeInt.check(Schema.isLessThanOrEqualTo(PROVIDER_SEND_TURN_MAX_IMAGE_BYTES)),
  dataUrl: TrimmedNonEmptyString.check(
    Schema.isMaxLength(PROVIDER_SEND_TURN_MAX_IMAGE_DATA_URL_CHARS),
  ),
}) {}

export const ChatAttachment = Schema.Union([ChatImageAttachment]);
export type ChatAttachment = typeof ChatAttachment.Type;
const UploadChatAttachment = Schema.Union([UploadChatImageAttachment]);
export type UploadChatAttachment = typeof UploadChatAttachment.Type;

export const ProjectScriptIcon = Schema.Literals([
  "play",
  "test",
  "lint",
  "configure",
  "build",
  "debug",
]);
export type ProjectScriptIcon = typeof ProjectScriptIcon.Type;

export class ProjectScript extends Schema.Class<ProjectScript>("ProjectScript")({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  command: TrimmedNonEmptyString,
  icon: ProjectScriptIcon,
  runOnWorktreeCreate: Schema.Boolean,
  /**
   * URL to open in the in-app browser preview when this script runs (or
   * when the user explicitly requests a preview). Optional; only honored on
   * the desktop build.
   */
  previewUrl: Schema.optional(TrimmedNonEmptyString),
  /**
   * When true, automatically open the preview panel pointed at `previewUrl`
   * the moment this script starts. Ignored without `previewUrl` or on web.
   */
  autoOpenPreview: Schema.optional(Schema.Boolean),
}) {}

export class OrchestrationProject extends Schema.Class<OrchestrationProject>(
  "OrchestrationProject",
)({
  id: ProjectId,
  title: TrimmedNonEmptyString,
  workspaceRoot: TrimmedNonEmptyString,
  repositoryIdentity: Schema.optional(Schema.NullOr(RepositoryIdentity)),
  defaultModelSelection: Schema.NullOr(ModelSelection),
  scripts: Schema.Array(ProjectScript),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),
}) {}

export const OrchestrationMessageRole = Schema.Literals(["user", "assistant", "system"]);
export type OrchestrationMessageRole = typeof OrchestrationMessageRole.Type;

export class OrchestrationMessage extends Schema.Class<OrchestrationMessage>(
  "OrchestrationMessage",
)({
  id: MessageId,
  role: OrchestrationMessageRole,
  text: Schema.String,
  attachments: Schema.optional(Schema.Array(ChatAttachment)),
  turnId: Schema.NullOr(TurnId),
  streaming: Schema.Boolean,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}) {}

export const OrchestrationProposedPlanId = TrimmedNonEmptyString;
export type OrchestrationProposedPlanId = typeof OrchestrationProposedPlanId.Type;

export class OrchestrationProposedPlan extends Schema.Class<OrchestrationProposedPlan>(
  "OrchestrationProposedPlan",
)({
  id: OrchestrationProposedPlanId,
  turnId: Schema.NullOr(TurnId),
  planMarkdown: TrimmedNonEmptyString,
  implementedAt: Schema.NullOr(IsoDateTime).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  implementationThreadId: Schema.NullOr(ThreadId).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}) {}

export class SourceProposedPlanReference extends Schema.Class<SourceProposedPlanReference>(
  "SourceProposedPlanReference",
)({
  threadId: ThreadId,
  planId: OrchestrationProposedPlanId,
}) {}

export const OrchestrationSessionStatus = Schema.Literals([
  "idle",
  "starting",
  "running",
  "ready",
  "interrupted",
  "stopped",
  "error",
]);
export type OrchestrationSessionStatus = typeof OrchestrationSessionStatus.Type;

export class OrchestrationSession extends Schema.Class<OrchestrationSession>(
  "OrchestrationSession",
)({
  threadId: ThreadId,
  status: OrchestrationSessionStatus,
  providerName: Schema.NullOr(TrimmedNonEmptyString),
  providerInstanceId: Schema.optional(ProviderInstanceId),
  runtimeMode: RuntimeMode.pipe(Schema.withDecodingDefault(Effect.succeed(DEFAULT_RUNTIME_MODE))),
  activeTurnId: Schema.NullOr(TurnId),
  lastError: Schema.NullOr(TrimmedNonEmptyString),
  updatedAt: IsoDateTime,
}) {}

export class OrchestrationCheckpointFile extends Schema.Class<OrchestrationCheckpointFile>(
  "OrchestrationCheckpointFile",
)({
  path: TrimmedNonEmptyString,
  kind: TrimmedNonEmptyString,
  additions: NonNegativeInt,
  deletions: NonNegativeInt,
}) {}

export const OrchestrationCheckpointStatus = Schema.Literals(["ready", "missing", "error"]);
export type OrchestrationCheckpointStatus = typeof OrchestrationCheckpointStatus.Type;

export class OrchestrationCheckpointSummary extends Schema.Class<OrchestrationCheckpointSummary>(
  "OrchestrationCheckpointSummary",
)({
  turnId: TurnId,
  checkpointTurnCount: NonNegativeInt,
  checkpointRef: CheckpointRef,
  status: OrchestrationCheckpointStatus,
  files: Schema.Array(OrchestrationCheckpointFile),
  assistantMessageId: Schema.NullOr(MessageId),
  completedAt: IsoDateTime,
}) {}

export const OrchestrationThreadActivityTone = Schema.Literals([
  "info",
  "tool",
  "approval",
  "error",
]);
export type OrchestrationThreadActivityTone = typeof OrchestrationThreadActivityTone.Type;

export class OrchestrationThreadActivity extends Schema.Class<OrchestrationThreadActivity>(
  "OrchestrationThreadActivity",
)({
  id: EventId,
  tone: OrchestrationThreadActivityTone,
  kind: TrimmedNonEmptyString,
  summary: TrimmedNonEmptyString,
  payload: Schema.Unknown,
  turnId: Schema.NullOr(TurnId),
  sequence: Schema.optional(NonNegativeInt),
  createdAt: IsoDateTime,
}) {}

const OrchestrationLatestTurnState = Schema.Literals([
  "running",
  "interrupted",
  "completed",
  "error",
]);
export type OrchestrationLatestTurnState = typeof OrchestrationLatestTurnState.Type;

export class OrchestrationLatestTurn extends Schema.Class<OrchestrationLatestTurn>(
  "OrchestrationLatestTurn",
)({
  turnId: TurnId,
  state: OrchestrationLatestTurnState,
  requestedAt: IsoDateTime,
  startedAt: Schema.NullOr(IsoDateTime),
  completedAt: Schema.NullOr(IsoDateTime),
  assistantMessageId: Schema.NullOr(MessageId),
  sourceProposedPlan: Schema.optional(SourceProposedPlanReference),
}) {}

export class OrchestrationThread extends Schema.Class<OrchestrationThread>("OrchestrationThread")({
  id: ThreadId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_PROVIDER_INTERACTION_MODE)),
  ),
  branch: Schema.NullOr(TrimmedNonEmptyString),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  latestTurn: Schema.NullOr(OrchestrationLatestTurn),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  archivedAt: Schema.NullOr(IsoDateTime).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  settledOverride: Schema.NullOr(Schema.Literals(["settled", "active"])).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  settledAt: Schema.NullOr(IsoDateTime).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  // Snooze is an overlay on the active lifecycle, not a fourth destination:
  // a snoozed thread stays "active" in the model and is only suppressed from
  // the inbox until snoozedUntil passes (or the thread raises its hand).
  // Optional so payloads from pre-snooze servers still decode.
  snoozedUntil: Schema.optional(Schema.NullOr(IsoDateTime)),
  snoozedAt: Schema.optional(Schema.NullOr(IsoDateTime)),
  deletedAt: Schema.NullOr(IsoDateTime),
  messages: Schema.Array(OrchestrationMessage),
  proposedPlans: Schema.Array(OrchestrationProposedPlan).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  activities: Schema.Array(OrchestrationThreadActivity),
  checkpoints: Schema.Array(OrchestrationCheckpointSummary),
  session: Schema.NullOr(OrchestrationSession),
}) {}

export class OrchestrationReadModel extends Schema.Class<OrchestrationReadModel>(
  "OrchestrationReadModel",
)({
  snapshotSequence: NonNegativeInt,
  projects: Schema.Array(OrchestrationProject),
  threads: Schema.Array(OrchestrationThread),
  updatedAt: IsoDateTime,
}) {}

export class OrchestrationProjectShell extends Schema.Class<OrchestrationProjectShell>(
  "OrchestrationProjectShell",
)({
  id: ProjectId,
  title: TrimmedNonEmptyString,
  workspaceRoot: TrimmedNonEmptyString,
  repositoryIdentity: Schema.optional(Schema.NullOr(RepositoryIdentity)),
  defaultModelSelection: Schema.NullOr(ModelSelection),
  scripts: Schema.Array(ProjectScript),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}) {}

export class OrchestrationThreadShell extends Schema.Class<OrchestrationThreadShell>(
  "OrchestrationThreadShell",
)({
  id: ThreadId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_PROVIDER_INTERACTION_MODE)),
  ),
  branch: Schema.NullOr(TrimmedNonEmptyString),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  latestTurn: Schema.NullOr(OrchestrationLatestTurn),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  archivedAt: Schema.NullOr(IsoDateTime).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  settledOverride: Schema.NullOr(Schema.Literals(["settled", "active"])).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  settledAt: Schema.NullOr(IsoDateTime).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  snoozedUntil: Schema.optional(Schema.NullOr(IsoDateTime)),
  snoozedAt: Schema.optional(Schema.NullOr(IsoDateTime)),
  session: Schema.NullOr(OrchestrationSession),
  latestUserMessageAt: Schema.NullOr(IsoDateTime),
  hasPendingApprovals: Schema.Boolean,
  hasPendingUserInput: Schema.Boolean,
  hasActionableProposedPlan: Schema.Boolean,
}) {}

export class OrchestrationShellSnapshot extends Schema.Class<OrchestrationShellSnapshot>(
  "OrchestrationShellSnapshot",
)({
  snapshotSequence: NonNegativeInt,
  projects: Schema.Array(OrchestrationProjectShell),
  threads: Schema.Array(OrchestrationThreadShell),
  updatedAt: IsoDateTime,
}) {}

export class OrchestrationShellProjectUpsertedEvent extends Schema.Class<OrchestrationShellProjectUpsertedEvent>(
  "OrchestrationShellProjectUpsertedEvent",
)({
  kind: Schema.Literal("project-upserted"),
  sequence: NonNegativeInt,
  project: OrchestrationProjectShell,
}) {}

export class OrchestrationShellProjectRemovedEvent extends Schema.Class<OrchestrationShellProjectRemovedEvent>(
  "OrchestrationShellProjectRemovedEvent",
)({
  kind: Schema.Literal("project-removed"),
  sequence: NonNegativeInt,
  projectId: ProjectId,
}) {}

export class OrchestrationShellThreadUpsertedEvent extends Schema.Class<OrchestrationShellThreadUpsertedEvent>(
  "OrchestrationShellThreadUpsertedEvent",
)({
  kind: Schema.Literal("thread-upserted"),
  sequence: NonNegativeInt,
  thread: OrchestrationThreadShell,
}) {}

export class OrchestrationShellThreadRemovedEvent extends Schema.Class<OrchestrationShellThreadRemovedEvent>(
  "OrchestrationShellThreadRemovedEvent",
)({
  kind: Schema.Literal("thread-removed"),
  sequence: NonNegativeInt,
  threadId: ThreadId,
}) {}

export const OrchestrationShellStreamEvent = Schema.Union([
  OrchestrationShellProjectUpsertedEvent,
  OrchestrationShellProjectRemovedEvent,
  OrchestrationShellThreadUpsertedEvent,
  OrchestrationShellThreadRemovedEvent,
]);
export type OrchestrationShellStreamEvent = typeof OrchestrationShellStreamEvent.Type;

export class OrchestrationStreamSynchronizedItem extends Schema.Class<OrchestrationStreamSynchronizedItem>(
  "OrchestrationStreamSynchronizedItem",
)({
  kind: Schema.Literal("synchronized"),
}) {}

export class OrchestrationShellStreamSnapshotItem extends Schema.Class<OrchestrationShellStreamSnapshotItem>(
  "OrchestrationShellStreamSnapshotItem",
)({
  kind: Schema.Literal("snapshot"),
  snapshot: OrchestrationShellSnapshot,
}) {}

export const OrchestrationShellStreamItem = Schema.Union([
  OrchestrationStreamSynchronizedItem,
  OrchestrationShellStreamSnapshotItem,
  OrchestrationShellStreamEvent,
]);
export type OrchestrationShellStreamItem = typeof OrchestrationShellStreamItem.Type;

export class OrchestrationSubscribeShellInput extends Schema.Class<OrchestrationSubscribeShellInput>(
  "OrchestrationSubscribeShellInput",
)({
  /**
   * When provided, the server skips the initial full shell snapshot and instead
   * replays shell events after this sequence before streaming live events.
   * Clients that already hold a cached (or HTTP-loaded) shell snapshot pass its
   * sequence here so the subscription resumes without re-sending the entire
   * projects/threads list (overlapping events are deduped by sequence on the
   * client).
   */
  afterSequence: Schema.optionalKey(NonNegativeInt),
  /**
   * Requests an explicit marker after the subscription has emitted its initial
   * snapshot or catch-up replay and before it begins emitting live events.
   */
  requestCompletionMarker: Schema.optionalKey(Schema.Boolean),
}) {}

export class OrchestrationSubscribeThreadInput extends Schema.Class<OrchestrationSubscribeThreadInput>(
  "OrchestrationSubscribeThreadInput",
)({
  threadId: ThreadId,
  /**
   * When provided, the server skips the initial snapshot frame and instead
   * replays events after this sequence before streaming live events. Clients
   * that load the snapshot over HTTP pass the snapshot's sequence here so the
   * live subscription resumes without a gap (overlapping events are deduped by
   * sequence on the client).
   */
  afterSequence: Schema.optionalKey(NonNegativeInt),
  /**
   * Requests an explicit marker after the subscription has emitted its initial
   * snapshot or catch-up replay and before it begins emitting live events.
   */
  requestCompletionMarker: Schema.optionalKey(Schema.Boolean),
}) {}

export class OrchestrationThreadDetailSnapshot extends Schema.Class<OrchestrationThreadDetailSnapshot>(
  "OrchestrationThreadDetailSnapshot",
)({
  snapshotSequence: NonNegativeInt,
  thread: OrchestrationThread,
}) {}

export class ProjectCreateCommand extends Schema.Class<ProjectCreateCommand>(
  "ProjectCreateCommand",
)({
  type: Schema.Literal("project.create"),
  commandId: CommandId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  workspaceRoot: TrimmedNonEmptyString,
  createWorkspaceRootIfMissing: Schema.optional(Schema.Boolean),
  defaultModelSelection: Schema.optional(Schema.NullOr(ModelSelection)),
  createdAt: IsoDateTime,
}) {}

export class ProjectMetaUpdateCommand extends Schema.Class<ProjectMetaUpdateCommand>(
  "ProjectMetaUpdateCommand",
)({
  type: Schema.Literal("project.meta.update"),
  commandId: CommandId,
  projectId: ProjectId,
  title: Schema.optional(TrimmedNonEmptyString),
  workspaceRoot: Schema.optional(TrimmedNonEmptyString),
  defaultModelSelection: Schema.optional(Schema.NullOr(ModelSelection)),
  scripts: Schema.optional(Schema.Array(ProjectScript)),
}) {}

export class ProjectDeleteCommand extends Schema.Class<ProjectDeleteCommand>(
  "ProjectDeleteCommand",
)({
  type: Schema.Literal("project.delete"),
  commandId: CommandId,
  projectId: ProjectId,
  force: Schema.optional(Schema.Boolean),
}) {}

export class ThreadCreateCommand extends Schema.Class<ThreadCreateCommand>("ThreadCreateCommand")({
  type: Schema.Literal("thread.create"),
  commandId: CommandId,
  threadId: ThreadId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_PROVIDER_INTERACTION_MODE)),
  ),
  branch: Schema.NullOr(TrimmedNonEmptyString),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  createdAt: IsoDateTime,
}) {}

export class ThreadDeleteCommand extends Schema.Class<ThreadDeleteCommand>("ThreadDeleteCommand")({
  type: Schema.Literal("thread.delete"),
  commandId: CommandId,
  threadId: ThreadId,
}) {}

export class ThreadArchiveCommand extends Schema.Class<ThreadArchiveCommand>(
  "ThreadArchiveCommand",
)({
  type: Schema.Literal("thread.archive"),
  commandId: CommandId,
  threadId: ThreadId,
}) {}

export class ThreadUnarchiveCommand extends Schema.Class<ThreadUnarchiveCommand>(
  "ThreadUnarchiveCommand",
)({
  type: Schema.Literal("thread.unarchive"),
  commandId: CommandId,
  threadId: ThreadId,
}) {}

export class ThreadSettleCommand extends Schema.Class<ThreadSettleCommand>("ThreadSettleCommand")({
  type: Schema.Literal("thread.settle"),
  commandId: CommandId,
  threadId: ThreadId,
}) {}

export class ThreadUnsettleCommand extends Schema.Class<ThreadUnsettleCommand>(
  "ThreadUnsettleCommand",
)({
  type: Schema.Literal("thread.unsettle"),
  commandId: CommandId,
  threadId: ThreadId,
  // Commands only carry "user": activity un-settles are decided server-side
  // (the decider emits thread.unsettled(reason: "activity") events directly,
  // never through this command), so a client cannot forge the neutral reset.
  reason: Schema.Literal("user"),
}) {}

export class ThreadSnoozeCommand extends Schema.Class<ThreadSnoozeCommand>("ThreadSnoozeCommand")({
  type: Schema.Literal("thread.snooze"),
  commandId: CommandId,
  threadId: ThreadId,
  // The wake time. Event-based wake conditions (PR merged, review posted)
  // will arrive as an optional condition field alongside this; time-based
  // snooze is just the first kind of condition.
  snoozedUntil: IsoDateTime,
}) {}

export class ThreadUnsnoozeCommand extends Schema.Class<ThreadUnsnoozeCommand>(
  "ThreadUnsnoozeCommand",
)({
  type: Schema.Literal("thread.unsnooze"),
  commandId: CommandId,
  threadId: ThreadId,
  // Commands only carry "user": activity wakes are decided server-side (the
  // decider emits thread.unsnoozed(reason: "activity") directly), and timer
  // wakes need no event at all — clients derive visibility from snoozedUntil,
  // so a passed wake time simply stops classifying as snoozed.
  reason: Schema.Literal("user"),
}) {}

export class ThreadMetaUpdateCommand extends Schema.Class<ThreadMetaUpdateCommand>(
  "ThreadMetaUpdateCommand",
)({
  type: Schema.Literal("thread.meta.update"),
  commandId: CommandId,
  threadId: ThreadId,
  title: Schema.optional(TrimmedNonEmptyString),
  modelSelection: Schema.optional(ModelSelection),
  branch: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  expectedBranch: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  worktreePath: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
}) {}

export class ThreadRuntimeModeSetCommand extends Schema.Class<ThreadRuntimeModeSetCommand>(
  "ThreadRuntimeModeSetCommand",
)({
  type: Schema.Literal("thread.runtime-mode.set"),
  commandId: CommandId,
  threadId: ThreadId,
  runtimeMode: RuntimeMode,
  createdAt: IsoDateTime,
}) {}

export class ThreadInteractionModeSetCommand extends Schema.Class<ThreadInteractionModeSetCommand>(
  "ThreadInteractionModeSetCommand",
)({
  type: Schema.Literal("thread.interaction-mode.set"),
  commandId: CommandId,
  threadId: ThreadId,
  interactionMode: ProviderInteractionMode,
  createdAt: IsoDateTime,
}) {}

export class ThreadTurnStartBootstrapCreateThread extends Schema.Class<ThreadTurnStartBootstrapCreateThread>(
  "ThreadTurnStartBootstrapCreateThread",
)({
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode,
  branch: Schema.NullOr(TrimmedNonEmptyString),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  createdAt: IsoDateTime,
}) {}

export class ThreadTurnStartBootstrapPrepareWorktree extends Schema.Class<ThreadTurnStartBootstrapPrepareWorktree>(
  "ThreadTurnStartBootstrapPrepareWorktree",
)({
  projectCwd: TrimmedNonEmptyString,
  baseBranch: TrimmedNonEmptyString,
  branch: Schema.optional(TrimmedNonEmptyString),
  startFromOrigin: Schema.optional(Schema.Boolean),
}) {}

export class ThreadTurnStartBootstrap extends Schema.Class<ThreadTurnStartBootstrap>(
  "ThreadTurnStartBootstrap",
)({
  createThread: Schema.optional(ThreadTurnStartBootstrapCreateThread),
  prepareWorktree: Schema.optional(ThreadTurnStartBootstrapPrepareWorktree),
  runSetupScript: Schema.optional(Schema.Boolean),
}) {}

export class ThreadTurnStartCommand extends Schema.Class<ThreadTurnStartCommand>(
  "ThreadTurnStartCommand",
)({
  type: Schema.Literal("thread.turn.start"),
  commandId: CommandId,
  threadId: ThreadId,
  message: Schema.Struct({
    messageId: MessageId,
    role: Schema.Literal("user"),
    text: Schema.String,
    attachments: Schema.Array(ChatAttachment),
  }),
  modelSelection: Schema.optional(ModelSelection),
  titleSeed: Schema.optional(TrimmedNonEmptyString),
  runtimeMode: RuntimeMode.pipe(Schema.withDecodingDefault(Effect.succeed(DEFAULT_RUNTIME_MODE))),
  interactionMode: ProviderInteractionMode.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_PROVIDER_INTERACTION_MODE)),
  ),
  bootstrap: Schema.optional(ThreadTurnStartBootstrap),
  sourceProposedPlan: Schema.optional(SourceProposedPlanReference),
  createdAt: IsoDateTime,
}) {}

export class ClientThreadTurnStartCommand extends Schema.Class<ClientThreadTurnStartCommand>(
  "ClientThreadTurnStartCommand",
)({
  type: Schema.Literal("thread.turn.start"),
  commandId: CommandId,
  threadId: ThreadId,
  message: Schema.Struct({
    messageId: MessageId,
    role: Schema.Literal("user"),
    text: Schema.String,
    attachments: Schema.Array(UploadChatAttachment),
  }),
  modelSelection: Schema.optional(ModelSelection),
  titleSeed: Schema.optional(TrimmedNonEmptyString),
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode,
  bootstrap: Schema.optional(ThreadTurnStartBootstrap),
  sourceProposedPlan: Schema.optional(SourceProposedPlanReference),
  createdAt: IsoDateTime,
}) {}

export class ThreadTurnInterruptCommand extends Schema.Class<ThreadTurnInterruptCommand>(
  "ThreadTurnInterruptCommand",
)({
  type: Schema.Literal("thread.turn.interrupt"),
  commandId: CommandId,
  threadId: ThreadId,
  turnId: Schema.optional(TurnId),
  createdAt: IsoDateTime,
}) {}

export class ThreadApprovalRespondCommand extends Schema.Class<ThreadApprovalRespondCommand>(
  "ThreadApprovalRespondCommand",
)({
  type: Schema.Literal("thread.approval.respond"),
  commandId: CommandId,
  threadId: ThreadId,
  requestId: ApprovalRequestId,
  decision: ProviderApprovalDecision,
  createdAt: IsoDateTime,
}) {}

export class ThreadUserInputRespondCommand extends Schema.Class<ThreadUserInputRespondCommand>(
  "ThreadUserInputRespondCommand",
)({
  type: Schema.Literal("thread.user-input.respond"),
  commandId: CommandId,
  threadId: ThreadId,
  requestId: ApprovalRequestId,
  answers: ProviderUserInputAnswers,
  createdAt: IsoDateTime,
}) {}

export class ThreadCheckpointRevertCommand extends Schema.Class<ThreadCheckpointRevertCommand>(
  "ThreadCheckpointRevertCommand",
)({
  type: Schema.Literal("thread.checkpoint.revert"),
  commandId: CommandId,
  threadId: ThreadId,
  turnCount: NonNegativeInt,
  createdAt: IsoDateTime,
}) {}

export class ThreadSessionStopCommand extends Schema.Class<ThreadSessionStopCommand>(
  "ThreadSessionStopCommand",
)({
  type: Schema.Literal("thread.session.stop"),
  commandId: CommandId,
  threadId: ThreadId,
  createdAt: IsoDateTime,
}) {}

const DispatchableClientOrchestrationCommand = Schema.Union([
  ProjectCreateCommand,
  ProjectMetaUpdateCommand,
  ProjectDeleteCommand,
  ThreadCreateCommand,
  ThreadDeleteCommand,
  ThreadArchiveCommand,
  ThreadUnarchiveCommand,
  ThreadSettleCommand,
  ThreadUnsettleCommand,
  ThreadSnoozeCommand,
  ThreadUnsnoozeCommand,
  ThreadMetaUpdateCommand,
  ThreadRuntimeModeSetCommand,
  ThreadInteractionModeSetCommand,
  ThreadTurnStartCommand,
  ThreadTurnInterruptCommand,
  ThreadApprovalRespondCommand,
  ThreadUserInputRespondCommand,
  ThreadCheckpointRevertCommand,
  ThreadSessionStopCommand,
]);
export type DispatchableClientOrchestrationCommand =
  typeof DispatchableClientOrchestrationCommand.Type;

export const ClientOrchestrationCommand = Schema.Union([
  ProjectCreateCommand,
  ProjectMetaUpdateCommand,
  ProjectDeleteCommand,
  ThreadCreateCommand,
  ThreadDeleteCommand,
  ThreadArchiveCommand,
  ThreadUnarchiveCommand,
  ThreadSettleCommand,
  ThreadUnsettleCommand,
  ThreadSnoozeCommand,
  ThreadUnsnoozeCommand,
  ThreadMetaUpdateCommand,
  ThreadRuntimeModeSetCommand,
  ThreadInteractionModeSetCommand,
  ClientThreadTurnStartCommand,
  ThreadTurnInterruptCommand,
  ThreadApprovalRespondCommand,
  ThreadUserInputRespondCommand,
  ThreadCheckpointRevertCommand,
  ThreadSessionStopCommand,
]);
export type ClientOrchestrationCommand = typeof ClientOrchestrationCommand.Type;

export class ThreadSessionSetCommand extends Schema.Class<ThreadSessionSetCommand>(
  "ThreadSessionSetCommand",
)({
  type: Schema.Literal("thread.session.set"),
  commandId: CommandId,
  threadId: ThreadId,
  session: OrchestrationSession,
  createdAt: IsoDateTime,
}) {}

export class ThreadMessageAssistantDeltaCommand extends Schema.Class<ThreadMessageAssistantDeltaCommand>(
  "ThreadMessageAssistantDeltaCommand",
)({
  type: Schema.Literal("thread.message.assistant.delta"),
  commandId: CommandId,
  threadId: ThreadId,
  messageId: MessageId,
  delta: Schema.String,
  turnId: Schema.optional(TurnId),
  createdAt: IsoDateTime,
}) {}

export class ThreadMessageAssistantCompleteCommand extends Schema.Class<ThreadMessageAssistantCompleteCommand>(
  "ThreadMessageAssistantCompleteCommand",
)({
  type: Schema.Literal("thread.message.assistant.complete"),
  commandId: CommandId,
  threadId: ThreadId,
  messageId: MessageId,
  turnId: Schema.optional(TurnId),
  createdAt: IsoDateTime,
}) {}

export class ThreadProposedPlanUpsertCommand extends Schema.Class<ThreadProposedPlanUpsertCommand>(
  "ThreadProposedPlanUpsertCommand",
)({
  type: Schema.Literal("thread.proposed-plan.upsert"),
  commandId: CommandId,
  threadId: ThreadId,
  proposedPlan: OrchestrationProposedPlan,
  createdAt: IsoDateTime,
}) {}

export class ThreadTurnDiffCompleteCommand extends Schema.Class<ThreadTurnDiffCompleteCommand>(
  "ThreadTurnDiffCompleteCommand",
)({
  type: Schema.Literal("thread.turn.diff.complete"),
  commandId: CommandId,
  threadId: ThreadId,
  turnId: TurnId,
  completedAt: IsoDateTime,
  checkpointRef: CheckpointRef,
  status: OrchestrationCheckpointStatus,
  files: Schema.Array(OrchestrationCheckpointFile),
  assistantMessageId: Schema.optional(MessageId),
  checkpointTurnCount: NonNegativeInt,
  createdAt: IsoDateTime,
}) {}

export class ThreadActivityAppendCommand extends Schema.Class<ThreadActivityAppendCommand>(
  "ThreadActivityAppendCommand",
)({
  type: Schema.Literal("thread.activity.append"),
  commandId: CommandId,
  threadId: ThreadId,
  activity: OrchestrationThreadActivity,
  createdAt: IsoDateTime,
}) {}

export class ThreadRevertCompleteCommand extends Schema.Class<ThreadRevertCompleteCommand>(
  "ThreadRevertCompleteCommand",
)({
  type: Schema.Literal("thread.revert.complete"),
  commandId: CommandId,
  threadId: ThreadId,
  turnCount: NonNegativeInt,
  createdAt: IsoDateTime,
}) {}

const InternalOrchestrationCommand = Schema.Union([
  ThreadSessionSetCommand,
  ThreadMessageAssistantDeltaCommand,
  ThreadMessageAssistantCompleteCommand,
  ThreadProposedPlanUpsertCommand,
  ThreadTurnDiffCompleteCommand,
  ThreadActivityAppendCommand,
  ThreadRevertCompleteCommand,
]);
export type InternalOrchestrationCommand = typeof InternalOrchestrationCommand.Type;

export const OrchestrationCommand = Schema.Union([
  DispatchableClientOrchestrationCommand,
  InternalOrchestrationCommand,
]);
export type OrchestrationCommand = typeof OrchestrationCommand.Type;

export const OrchestrationEventType = Schema.Literals([
  "project.created",
  "project.meta-updated",
  "project.deleted",
  "thread.created",
  "thread.deleted",
  "thread.archived",
  "thread.unarchived",
  "thread.settled",
  "thread.unsettled",
  "thread.snoozed",
  "thread.unsnoozed",
  "thread.meta-updated",
  "thread.runtime-mode-set",
  "thread.interaction-mode-set",
  "thread.message-sent",
  "thread.turn-start-requested",
  "thread.turn-interrupt-requested",
  "thread.approval-response-requested",
  "thread.user-input-response-requested",
  "thread.checkpoint-revert-requested",
  "thread.reverted",
  "thread.session-stop-requested",
  "thread.session-set",
  "thread.proposed-plan-upserted",
  "thread.turn-diff-completed",
  "thread.activity-appended",
]);
export type OrchestrationEventType = typeof OrchestrationEventType.Type;

export const OrchestrationAggregateKind = Schema.Literals(["project", "thread"]);
export type OrchestrationAggregateKind = typeof OrchestrationAggregateKind.Type;
export const OrchestrationActorKind = Schema.Literals(["client", "server", "provider"]);

export class ProjectCreatedPayload extends Schema.Class<ProjectCreatedPayload>(
  "ProjectCreatedPayload",
)({
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  workspaceRoot: TrimmedNonEmptyString,
  repositoryIdentity: Schema.optional(Schema.NullOr(RepositoryIdentity)),
  defaultModelSelection: Schema.NullOr(ModelSelection),
  scripts: Schema.Array(ProjectScript),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}) {}

export class ProjectMetaUpdatedPayload extends Schema.Class<ProjectMetaUpdatedPayload>(
  "ProjectMetaUpdatedPayload",
)({
  projectId: ProjectId,
  title: Schema.optional(TrimmedNonEmptyString),
  workspaceRoot: Schema.optional(TrimmedNonEmptyString),
  repositoryIdentity: Schema.optional(Schema.NullOr(RepositoryIdentity)),
  defaultModelSelection: Schema.optional(Schema.NullOr(ModelSelection)),
  scripts: Schema.optional(Schema.Array(ProjectScript)),
  updatedAt: IsoDateTime,
}) {}

export class ProjectDeletedPayload extends Schema.Class<ProjectDeletedPayload>(
  "ProjectDeletedPayload",
)({
  projectId: ProjectId,
  deletedAt: IsoDateTime,
}) {}

export class ThreadCreatedPayload extends Schema.Class<ThreadCreatedPayload>(
  "ThreadCreatedPayload",
)({
  threadId: ThreadId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode.pipe(Schema.withDecodingDefault(Effect.succeed(DEFAULT_RUNTIME_MODE))),
  interactionMode: ProviderInteractionMode.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_PROVIDER_INTERACTION_MODE)),
  ),
  branch: Schema.NullOr(TrimmedNonEmptyString),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}) {}

export class ThreadDeletedPayload extends Schema.Class<ThreadDeletedPayload>(
  "ThreadDeletedPayload",
)({
  threadId: ThreadId,
  deletedAt: IsoDateTime,
}) {}

export class ThreadArchivedPayload extends Schema.Class<ThreadArchivedPayload>(
  "ThreadArchivedPayload",
)({
  threadId: ThreadId,
  archivedAt: IsoDateTime,
  updatedAt: IsoDateTime,
}) {}

export class ThreadUnarchivedPayload extends Schema.Class<ThreadUnarchivedPayload>(
  "ThreadUnarchivedPayload",
)({
  threadId: ThreadId,
  updatedAt: IsoDateTime,
}) {}

export class ThreadSettledPayload extends Schema.Class<ThreadSettledPayload>(
  "ThreadSettledPayload",
)({
  threadId: ThreadId,
  settledAt: IsoDateTime,
  updatedAt: IsoDateTime,
}) {}

export class ThreadUnsettledPayload extends Schema.Class<ThreadUnsettledPayload>(
  "ThreadUnsettledPayload",
)({
  threadId: ThreadId,
  reason: Schema.Literals(["user", "activity"]),
  updatedAt: IsoDateTime,
}) {}

export class ThreadSnoozedPayload extends Schema.Class<ThreadSnoozedPayload>(
  "ThreadSnoozedPayload",
)({
  threadId: ThreadId,
  snoozedUntil: IsoDateTime,
  snoozedAt: IsoDateTime,
  updatedAt: IsoDateTime,
}) {}

export class ThreadUnsnoozedPayload extends Schema.Class<ThreadUnsnoozedPayload>(
  "ThreadUnsnoozedPayload",
)({
  threadId: ThreadId,
  // user: explicit "wake now". activity: real work arrived (user message /
  // session coming alive) and the decider cleared the snooze — mirrors
  // thread.unsettled's activity resets. Timer wakes emit no event: clients
  // derive them from snoozedUntil passing.
  reason: Schema.Literals(["user", "activity"]),
  updatedAt: IsoDateTime,
}) {}

export class ThreadMetaUpdatedPayload extends Schema.Class<ThreadMetaUpdatedPayload>(
  "ThreadMetaUpdatedPayload",
)({
  threadId: ThreadId,
  title: Schema.optional(TrimmedNonEmptyString),
  modelSelection: Schema.optional(ModelSelection),
  branch: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  worktreePath: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  updatedAt: IsoDateTime,
}) {}

export class ThreadRuntimeModeSetPayload extends Schema.Class<ThreadRuntimeModeSetPayload>(
  "ThreadRuntimeModeSetPayload",
)({
  threadId: ThreadId,
  runtimeMode: RuntimeMode,
  updatedAt: IsoDateTime,
}) {}

export class ThreadInteractionModeSetPayload extends Schema.Class<ThreadInteractionModeSetPayload>(
  "ThreadInteractionModeSetPayload",
)({
  threadId: ThreadId,
  interactionMode: ProviderInteractionMode.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_PROVIDER_INTERACTION_MODE)),
  ),
  updatedAt: IsoDateTime,
}) {}

export class ThreadMessageSentPayload extends Schema.Class<ThreadMessageSentPayload>(
  "ThreadMessageSentPayload",
)({
  threadId: ThreadId,
  messageId: MessageId,
  role: OrchestrationMessageRole,
  text: Schema.String,
  attachments: Schema.optional(Schema.Array(ChatAttachment)),
  turnId: Schema.NullOr(TurnId),
  streaming: Schema.Boolean,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}) {}

export class ThreadTurnStartRequestedPayload extends Schema.Class<ThreadTurnStartRequestedPayload>(
  "ThreadTurnStartRequestedPayload",
)({
  threadId: ThreadId,
  messageId: MessageId,
  modelSelection: Schema.optional(ModelSelection),
  titleSeed: Schema.optional(TrimmedNonEmptyString),
  runtimeMode: RuntimeMode.pipe(Schema.withDecodingDefault(Effect.succeed(DEFAULT_RUNTIME_MODE))),
  interactionMode: ProviderInteractionMode.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_PROVIDER_INTERACTION_MODE)),
  ),
  sourceProposedPlan: Schema.optional(SourceProposedPlanReference),
  createdAt: IsoDateTime,
}) {}

export class ThreadTurnInterruptRequestedPayload extends Schema.Class<ThreadTurnInterruptRequestedPayload>(
  "ThreadTurnInterruptRequestedPayload",
)({
  threadId: ThreadId,
  turnId: Schema.optional(TurnId),
  createdAt: IsoDateTime,
}) {}

export class ThreadApprovalResponseRequestedPayload extends Schema.Class<ThreadApprovalResponseRequestedPayload>(
  "ThreadApprovalResponseRequestedPayload",
)({
  threadId: ThreadId,
  requestId: ApprovalRequestId,
  decision: ProviderApprovalDecision,
  createdAt: IsoDateTime,
}) {}

export class ThreadUserInputResponseRequestedPayload extends Schema.Class<ThreadUserInputResponseRequestedPayload>(
  "ThreadUserInputResponseRequestedPayload",
)({
  threadId: ThreadId,
  requestId: ApprovalRequestId,
  answers: ProviderUserInputAnswers,
  createdAt: IsoDateTime,
}) {}

export class ThreadCheckpointRevertRequestedPayload extends Schema.Class<ThreadCheckpointRevertRequestedPayload>(
  "ThreadCheckpointRevertRequestedPayload",
)({
  threadId: ThreadId,
  turnCount: NonNegativeInt,
  createdAt: IsoDateTime,
}) {}

export class ThreadRevertedPayload extends Schema.Class<ThreadRevertedPayload>(
  "ThreadRevertedPayload",
)({
  threadId: ThreadId,
  turnCount: NonNegativeInt,
}) {}

export class ThreadSessionStopRequestedPayload extends Schema.Class<ThreadSessionStopRequestedPayload>(
  "ThreadSessionStopRequestedPayload",
)({
  threadId: ThreadId,
  createdAt: IsoDateTime,
}) {}

export class ThreadSessionSetPayload extends Schema.Class<ThreadSessionSetPayload>(
  "ThreadSessionSetPayload",
)({
  threadId: ThreadId,
  session: OrchestrationSession,
}) {}

export class ThreadProposedPlanUpsertedPayload extends Schema.Class<ThreadProposedPlanUpsertedPayload>(
  "ThreadProposedPlanUpsertedPayload",
)({
  threadId: ThreadId,
  proposedPlan: OrchestrationProposedPlan,
}) {}

export class ThreadTurnDiffCompletedPayload extends Schema.Class<ThreadTurnDiffCompletedPayload>(
  "ThreadTurnDiffCompletedPayload",
)({
  threadId: ThreadId,
  turnId: TurnId,
  checkpointTurnCount: NonNegativeInt,
  checkpointRef: CheckpointRef,
  status: OrchestrationCheckpointStatus,
  files: Schema.Array(OrchestrationCheckpointFile),
  assistantMessageId: Schema.NullOr(MessageId),
  completedAt: IsoDateTime,
}) {}

export class ThreadActivityAppendedPayload extends Schema.Class<ThreadActivityAppendedPayload>(
  "ThreadActivityAppendedPayload",
)({
  threadId: ThreadId,
  activity: OrchestrationThreadActivity,
}) {}

export class OrchestrationEventMetadata extends Schema.Class<OrchestrationEventMetadata>(
  "OrchestrationEventMetadata",
)({
  providerTurnId: Schema.optional(TrimmedNonEmptyString),
  providerItemId: Schema.optional(ProviderItemId),
  adapterKey: Schema.optional(TrimmedNonEmptyString),
  requestId: Schema.optional(ApprovalRequestId),
  ingestedAt: Schema.optional(IsoDateTime),
}) {}

const EventBaseFields = {
  sequence: NonNegativeInt,
  eventId: EventId,
  aggregateKind: OrchestrationAggregateKind,
  aggregateId: Schema.Union([ProjectId, ThreadId]),
  occurredAt: IsoDateTime,
  commandId: Schema.NullOr(CommandId),
  causationEventId: Schema.NullOr(EventId),
  correlationId: Schema.NullOr(CommandId),
  metadata: OrchestrationEventMetadata,
} as const;

export class ProjectCreatedEvent extends Schema.Class<ProjectCreatedEvent>("ProjectCreatedEvent")({
  ...EventBaseFields,
  type: Schema.Literal("project.created"),
  payload: ProjectCreatedPayload,
}) {}

export class ProjectMetaUpdatedEvent extends Schema.Class<ProjectMetaUpdatedEvent>(
  "ProjectMetaUpdatedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("project.meta-updated"),
  payload: ProjectMetaUpdatedPayload,
}) {}

export class ProjectDeletedEvent extends Schema.Class<ProjectDeletedEvent>("ProjectDeletedEvent")({
  ...EventBaseFields,
  type: Schema.Literal("project.deleted"),
  payload: ProjectDeletedPayload,
}) {}

export class ThreadCreatedEvent extends Schema.Class<ThreadCreatedEvent>("ThreadCreatedEvent")({
  ...EventBaseFields,
  type: Schema.Literal("thread.created"),
  payload: ThreadCreatedPayload,
}) {}

export class ThreadDeletedEvent extends Schema.Class<ThreadDeletedEvent>("ThreadDeletedEvent")({
  ...EventBaseFields,
  type: Schema.Literal("thread.deleted"),
  payload: ThreadDeletedPayload,
}) {}

export class ThreadArchivedEvent extends Schema.Class<ThreadArchivedEvent>("ThreadArchivedEvent")({
  ...EventBaseFields,
  type: Schema.Literal("thread.archived"),
  payload: ThreadArchivedPayload,
}) {}

export class ThreadUnarchivedEvent extends Schema.Class<ThreadUnarchivedEvent>(
  "ThreadUnarchivedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.unarchived"),
  payload: ThreadUnarchivedPayload,
}) {}

export class ThreadSettledEvent extends Schema.Class<ThreadSettledEvent>("ThreadSettledEvent")({
  ...EventBaseFields,
  type: Schema.Literal("thread.settled"),
  payload: ThreadSettledPayload,
}) {}

export class ThreadUnsettledEvent extends Schema.Class<ThreadUnsettledEvent>(
  "ThreadUnsettledEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.unsettled"),
  payload: ThreadUnsettledPayload,
}) {}

export class ThreadSnoozedEvent extends Schema.Class<ThreadSnoozedEvent>("ThreadSnoozedEvent")({
  ...EventBaseFields,
  type: Schema.Literal("thread.snoozed"),
  payload: ThreadSnoozedPayload,
}) {}

export class ThreadUnsnoozedEvent extends Schema.Class<ThreadUnsnoozedEvent>(
  "ThreadUnsnoozedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.unsnoozed"),
  payload: ThreadUnsnoozedPayload,
}) {}

export class ThreadMetaUpdatedEvent extends Schema.Class<ThreadMetaUpdatedEvent>(
  "ThreadMetaUpdatedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.meta-updated"),
  payload: ThreadMetaUpdatedPayload,
}) {}

export class ThreadRuntimeModeSetEvent extends Schema.Class<ThreadRuntimeModeSetEvent>(
  "ThreadRuntimeModeSetEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.runtime-mode-set"),
  payload: ThreadRuntimeModeSetPayload,
}) {}

export class ThreadInteractionModeSetEvent extends Schema.Class<ThreadInteractionModeSetEvent>(
  "ThreadInteractionModeSetEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.interaction-mode-set"),
  payload: ThreadInteractionModeSetPayload,
}) {}

export class ThreadMessageSentEvent extends Schema.Class<ThreadMessageSentEvent>(
  "ThreadMessageSentEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.message-sent"),
  payload: ThreadMessageSentPayload,
}) {}

export class ThreadTurnStartRequestedEvent extends Schema.Class<ThreadTurnStartRequestedEvent>(
  "ThreadTurnStartRequestedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.turn-start-requested"),
  payload: ThreadTurnStartRequestedPayload,
}) {}

export class ThreadTurnInterruptRequestedEvent extends Schema.Class<ThreadTurnInterruptRequestedEvent>(
  "ThreadTurnInterruptRequestedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.turn-interrupt-requested"),
  payload: ThreadTurnInterruptRequestedPayload,
}) {}

export class ThreadApprovalResponseRequestedEvent extends Schema.Class<ThreadApprovalResponseRequestedEvent>(
  "ThreadApprovalResponseRequestedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.approval-response-requested"),
  payload: ThreadApprovalResponseRequestedPayload,
}) {}

export class ThreadUserInputResponseRequestedEvent extends Schema.Class<ThreadUserInputResponseRequestedEvent>(
  "ThreadUserInputResponseRequestedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.user-input-response-requested"),
  payload: ThreadUserInputResponseRequestedPayload,
}) {}

export class ThreadCheckpointRevertRequestedEvent extends Schema.Class<ThreadCheckpointRevertRequestedEvent>(
  "ThreadCheckpointRevertRequestedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.checkpoint-revert-requested"),
  payload: ThreadCheckpointRevertRequestedPayload,
}) {}

export class ThreadRevertedEvent extends Schema.Class<ThreadRevertedEvent>("ThreadRevertedEvent")({
  ...EventBaseFields,
  type: Schema.Literal("thread.reverted"),
  payload: ThreadRevertedPayload,
}) {}

export class ThreadSessionStopRequestedEvent extends Schema.Class<ThreadSessionStopRequestedEvent>(
  "ThreadSessionStopRequestedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.session-stop-requested"),
  payload: ThreadSessionStopRequestedPayload,
}) {}

export class ThreadSessionSetEvent extends Schema.Class<ThreadSessionSetEvent>(
  "ThreadSessionSetEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.session-set"),
  payload: ThreadSessionSetPayload,
}) {}

export class ThreadProposedPlanUpsertedEvent extends Schema.Class<ThreadProposedPlanUpsertedEvent>(
  "ThreadProposedPlanUpsertedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.proposed-plan-upserted"),
  payload: ThreadProposedPlanUpsertedPayload,
}) {}

export class ThreadTurnDiffCompletedEvent extends Schema.Class<ThreadTurnDiffCompletedEvent>(
  "ThreadTurnDiffCompletedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.turn-diff-completed"),
  payload: ThreadTurnDiffCompletedPayload,
}) {}

export class ThreadActivityAppendedEvent extends Schema.Class<ThreadActivityAppendedEvent>(
  "ThreadActivityAppendedEvent",
)({
  ...EventBaseFields,
  type: Schema.Literal("thread.activity-appended"),
  payload: ThreadActivityAppendedPayload,
}) {}

export const OrchestrationEvent = Schema.Union([
  ProjectCreatedEvent,
  ProjectMetaUpdatedEvent,
  ProjectDeletedEvent,
  ThreadCreatedEvent,
  ThreadDeletedEvent,
  ThreadArchivedEvent,
  ThreadUnarchivedEvent,
  ThreadSettledEvent,
  ThreadUnsettledEvent,
  ThreadSnoozedEvent,
  ThreadUnsnoozedEvent,
  ThreadMetaUpdatedEvent,
  ThreadRuntimeModeSetEvent,
  ThreadInteractionModeSetEvent,
  ThreadMessageSentEvent,
  ThreadTurnStartRequestedEvent,
  ThreadTurnInterruptRequestedEvent,
  ThreadApprovalResponseRequestedEvent,
  ThreadUserInputResponseRequestedEvent,
  ThreadCheckpointRevertRequestedEvent,
  ThreadRevertedEvent,
  ThreadSessionStopRequestedEvent,
  ThreadSessionSetEvent,
  ThreadProposedPlanUpsertedEvent,
  ThreadTurnDiffCompletedEvent,
  ThreadActivityAppendedEvent,
]);
export type OrchestrationEvent = typeof OrchestrationEvent.Type;

export class OrchestrationThreadStreamSnapshotItem extends Schema.Class<OrchestrationThreadStreamSnapshotItem>(
  "OrchestrationThreadStreamSnapshotItem",
)({
  kind: Schema.Literal("snapshot"),
  snapshot: OrchestrationThreadDetailSnapshot,
}) {}

export class OrchestrationThreadStreamEventItem extends Schema.Class<OrchestrationThreadStreamEventItem>(
  "OrchestrationThreadStreamEventItem",
)({
  kind: Schema.Literal("event"),
  event: OrchestrationEvent,
}) {}

export const OrchestrationThreadStreamItem = Schema.Union([
  OrchestrationStreamSynchronizedItem,
  OrchestrationThreadStreamSnapshotItem,
  OrchestrationThreadStreamEventItem,
]);
export type OrchestrationThreadStreamItem = typeof OrchestrationThreadStreamItem.Type;

export const OrchestrationCommandReceiptStatus = Schema.Literals(["accepted", "rejected"]);
export type OrchestrationCommandReceiptStatus = typeof OrchestrationCommandReceiptStatus.Type;

/**
 * Stays a `Schema.Struct`: the range check applies to the struct itself, and
 * `ThreadTurnDiff`/`OrchestrationGetTurnDiffInput` extend it via `mapFields`,
 * which `Schema.Class` does not expose.
 */
export const TurnCountRange = Schema.Struct({
  fromTurnCount: NonNegativeInt,
  toTurnCount: NonNegativeInt,
}).check(
  Schema.makeFilter(
    (input) =>
      input.fromTurnCount <= input.toTurnCount ||
      new SchemaIssue.InvalidValue(Option.some(input.fromTurnCount), {
        message: "fromTurnCount must be less than or equal to toTurnCount",
      }),
    { identifier: "OrchestrationTurnDiffRange" },
  ),
);

export const ThreadTurnDiff = TurnCountRange.mapFields(
  Struct.assign({
    threadId: ThreadId,
    diff: Schema.String,
  }),
  { unsafePreserveChecks: true },
);

export const ProviderSessionRuntimeStatus = Schema.Literals([
  "starting",
  "running",
  "stopped",
  "error",
]);
export type ProviderSessionRuntimeStatus = typeof ProviderSessionRuntimeStatus.Type;

const ProjectionThreadTurnStatus = Schema.Literals([
  "running",
  "completed",
  "interrupted",
  "error",
]);
export type ProjectionThreadTurnStatus = typeof ProjectionThreadTurnStatus.Type;

export class ProjectionCheckpointRow extends Schema.Class<ProjectionCheckpointRow>(
  "ProjectionCheckpointRow",
)({
  threadId: ThreadId,
  turnId: TurnId,
  checkpointTurnCount: NonNegativeInt,
  checkpointRef: CheckpointRef,
  status: OrchestrationCheckpointStatus,
  files: Schema.Array(OrchestrationCheckpointFile),
  assistantMessageId: Schema.NullOr(MessageId),
  completedAt: IsoDateTime,
}) {}

export const ProjectionPendingApprovalStatus = Schema.Literals(["pending", "resolved"]);
export type ProjectionPendingApprovalStatus = typeof ProjectionPendingApprovalStatus.Type;

export const ProjectionPendingApprovalDecision = Schema.NullOr(ProviderApprovalDecision);
export type ProjectionPendingApprovalDecision = typeof ProjectionPendingApprovalDecision.Type;

export class DispatchResult extends Schema.Class<DispatchResult>("DispatchResult")({
  sequence: NonNegativeInt,
}) {}

export const OrchestrationGetTurnDiffInput = TurnCountRange.mapFields(
  Struct.assign({
    threadId: ThreadId,
    ignoreWhitespace: Schema.optionalKey(Schema.Boolean),
  }),
  { unsafePreserveChecks: true },
);
export type OrchestrationGetTurnDiffInput = typeof OrchestrationGetTurnDiffInput.Type;

export const OrchestrationGetTurnDiffResult = ThreadTurnDiff;
export type OrchestrationGetTurnDiffResult = typeof OrchestrationGetTurnDiffResult.Type;

export class OrchestrationGetFullThreadDiffInput extends Schema.Class<OrchestrationGetFullThreadDiffInput>(
  "OrchestrationGetFullThreadDiffInput",
)({
  threadId: ThreadId,
  toTurnCount: NonNegativeInt,
  ignoreWhitespace: Schema.optionalKey(Schema.Boolean),
}) {}

export const OrchestrationGetFullThreadDiffResult = ThreadTurnDiff;
export type OrchestrationGetFullThreadDiffResult = typeof OrchestrationGetFullThreadDiffResult.Type;

export class OrchestrationReplayEventsInput extends Schema.Class<OrchestrationReplayEventsInput>(
  "OrchestrationReplayEventsInput",
)({
  fromSequenceExclusive: NonNegativeInt,
}) {}

const OrchestrationReplayEventsResult = Schema.Array(OrchestrationEvent);
export type OrchestrationReplayEventsResult = typeof OrchestrationReplayEventsResult.Type;

export const OrchestrationRpcSchemas = {
  dispatchCommand: {
    input: ClientOrchestrationCommand,
    output: DispatchResult,
  },
  getTurnDiff: {
    input: OrchestrationGetTurnDiffInput,
    output: OrchestrationGetTurnDiffResult,
  },
  getFullThreadDiff: {
    input: OrchestrationGetFullThreadDiffInput,
    output: OrchestrationGetFullThreadDiffResult,
  },
  replayEvents: {
    input: OrchestrationReplayEventsInput,
    output: OrchestrationReplayEventsResult,
  },
  getArchivedShellSnapshot: {
    input: Schema.Struct({}),
    output: OrchestrationShellSnapshot,
  },
  subscribeThread: {
    input: OrchestrationSubscribeThreadInput,
    output: OrchestrationThreadStreamItem,
  },
  subscribeShell: {
    input: OrchestrationSubscribeShellInput,
    output: OrchestrationShellStreamItem,
  },
} as const;

export class OrchestrationGetSnapshotError extends Schema.TaggedErrorClass<OrchestrationGetSnapshotError>()(
  "OrchestrationGetSnapshotError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

export class OrchestrationDispatchCommandError extends Schema.TaggedErrorClass<OrchestrationDispatchCommandError>()(
  "OrchestrationDispatchCommandError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

export class OrchestrationGetTurnDiffError extends Schema.TaggedErrorClass<OrchestrationGetTurnDiffError>()(
  "OrchestrationGetTurnDiffError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

export class OrchestrationGetFullThreadDiffError extends Schema.TaggedErrorClass<OrchestrationGetFullThreadDiffError>()(
  "OrchestrationGetFullThreadDiffError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

export class OrchestrationReplayEventsError extends Schema.TaggedErrorClass<OrchestrationReplayEventsError>()(
  "OrchestrationReplayEventsError",
  {
    message: TrimmedNonEmptyString,
    cause: Schema.optional(Schema.Defect()),
  },
) {}
