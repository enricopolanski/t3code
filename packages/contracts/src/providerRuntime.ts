import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  EventId,
  IsoDateTime,
  NonNegativeInt,
  ProviderItemId,
  PositiveInt,
  RuntimeItemId,
  RuntimeRequestId,
  RuntimeTaskId,
  ThreadId,
  TrimmedNonEmptyString,
  TurnId,
} from "./baseSchemas.ts";
import { ProviderInstanceId, ProviderDriverKind } from "./providerInstance.ts";

const TrimmedNonEmptyStringSchema = TrimmedNonEmptyString;
const UnknownRecordSchema = Schema.Record(Schema.String, Schema.Unknown);

const RuntimeEventRawSource = Schema.Union([
  Schema.Literal("codex.app-server.notification"),
  Schema.Literal("codex.app-server.request"),
  Schema.Literal("codex.eventmsg"),
  Schema.Literal("claude.sdk.message"),
  Schema.Literal("claude.sdk.permission"),
  Schema.Literal("codex.sdk.thread-event"),
  Schema.Literal("opencode.sdk.event"),
  Schema.Literal("acp.jsonrpc"),
  Schema.TemplateLiteral(["acp.", Schema.String, ".extension"]),
]);
export type RuntimeEventRawSource = typeof RuntimeEventRawSource.Type;

export class RuntimeEventRaw extends Schema.Class<RuntimeEventRaw>("RuntimeEventRaw")({
  source: RuntimeEventRawSource,
  method: Schema.optional(TrimmedNonEmptyStringSchema),
  messageType: Schema.optional(TrimmedNonEmptyStringSchema),
  payload: Schema.Unknown,
}) {}

const ProviderRequestId = TrimmedNonEmptyStringSchema;
export type ProviderRequestId = typeof ProviderRequestId.Type;

export class ProviderRefs extends Schema.Class<ProviderRefs>("ProviderRefs")({
  providerTurnId: Schema.optional(TrimmedNonEmptyStringSchema),
  providerItemId: Schema.optional(ProviderItemId),
  providerRequestId: Schema.optional(ProviderRequestId),
}) {}

const RuntimeSessionState = Schema.Literals([
  "starting",
  "ready",
  "running",
  "waiting",
  "stopped",
  "error",
]);
export type RuntimeSessionState = typeof RuntimeSessionState.Type;

const RuntimeThreadState = Schema.Literals([
  "active",
  "idle",
  "archived",
  "closed",
  "compacted",
  "error",
]);
export type RuntimeThreadState = typeof RuntimeThreadState.Type;

const RuntimeTurnState = Schema.Literals(["completed", "failed", "interrupted", "cancelled"]);
export type RuntimeTurnState = typeof RuntimeTurnState.Type;

const RuntimePlanStepStatus = Schema.Literals(["pending", "inProgress", "completed"]);
export type RuntimePlanStepStatus = typeof RuntimePlanStepStatus.Type;

const RuntimeItemStatus = Schema.Literals(["inProgress", "completed", "failed", "declined"]);
export type RuntimeItemStatus = typeof RuntimeItemStatus.Type;

const RuntimeContentStreamKind = Schema.Literals([
  "assistant_text",
  "reasoning_text",
  "reasoning_summary_text",
  "plan_text",
  "command_output",
  "file_change_output",
  "unknown",
]);
export type RuntimeContentStreamKind = typeof RuntimeContentStreamKind.Type;

const RuntimeSessionExitKind = Schema.Literals(["graceful", "error"]);
export type RuntimeSessionExitKind = typeof RuntimeSessionExitKind.Type;

const RuntimeErrorClass = Schema.Literals([
  "provider_error",
  "transport_error",
  "permission_error",
  "validation_error",
  "unknown",
]);
export type RuntimeErrorClass = typeof RuntimeErrorClass.Type;

export const TOOL_LIFECYCLE_ITEM_TYPES = [
  "command_execution",
  "file_change",
  "mcp_tool_call",
  "dynamic_tool_call",
  "collab_agent_tool_call",
  "web_search",
  "image_view",
] as const;

export const ToolLifecycleItemType = Schema.Literals(TOOL_LIFECYCLE_ITEM_TYPES);
export type ToolLifecycleItemType = typeof ToolLifecycleItemType.Type;

export function isToolLifecycleItemType(value: string): value is ToolLifecycleItemType {
  return TOOL_LIFECYCLE_ITEM_TYPES.includes(value as ToolLifecycleItemType);
}

export const CanonicalItemType = Schema.Literals([
  "user_message",
  "assistant_message",
  "reasoning",
  "plan",
  ...TOOL_LIFECYCLE_ITEM_TYPES,
  "review_entered",
  "review_exited",
  "context_compaction",
  "error",
  "unknown",
]);
export type CanonicalItemType = typeof CanonicalItemType.Type;

export const CanonicalRequestType = Schema.Literals([
  "command_execution_approval",
  "file_read_approval",
  "file_change_approval",
  "apply_patch_approval",
  "exec_command_approval",
  "tool_user_input",
  "dynamic_tool_call",
  "auth_tokens_refresh",
  "unknown",
]);
export type CanonicalRequestType = typeof CanonicalRequestType.Type;

const ProviderRuntimeEventType = Schema.Literals([
  "session.started",
  "session.configured",
  "session.state.changed",
  "session.exited",
  "thread.started",
  "thread.state.changed",
  "thread.metadata.updated",
  "thread.token-usage.updated",
  "thread.realtime.started",
  "thread.realtime.item-added",
  "thread.realtime.audio.delta",
  "thread.realtime.error",
  "thread.realtime.closed",
  "turn.started",
  "turn.completed",
  "turn.aborted",
  "turn.plan.updated",
  "turn.proposed.delta",
  "turn.proposed.completed",
  "turn.diff.updated",
  "item.started",
  "item.updated",
  "item.completed",
  "content.delta",
  "request.opened",
  "request.resolved",
  "user-input.requested",
  "user-input.resolved",
  "task.started",
  "task.progress",
  "task.completed",
  "hook.started",
  "hook.progress",
  "hook.completed",
  "tool.progress",
  "tool.summary",
  "auth.status",
  "account.updated",
  "account.rate-limits.updated",
  "mcp.status.updated",
  "mcp.oauth.completed",
  "model.rerouted",
  "config.warning",
  "deprecation.notice",
  "files.persisted",
  "runtime.warning",
  "runtime.error",
]);
export type ProviderRuntimeEventType = typeof ProviderRuntimeEventType.Type;

const SessionStartedType = Schema.Literal("session.started");
const SessionConfiguredType = Schema.Literal("session.configured");
const SessionStateChangedType = Schema.Literal("session.state.changed");
const SessionExitedType = Schema.Literal("session.exited");
const ThreadStartedType = Schema.Literal("thread.started");
const ThreadStateChangedType = Schema.Literal("thread.state.changed");
const ThreadMetadataUpdatedType = Schema.Literal("thread.metadata.updated");
const ThreadTokenUsageUpdatedType = Schema.Literal("thread.token-usage.updated");
const ThreadRealtimeStartedType = Schema.Literal("thread.realtime.started");
const ThreadRealtimeItemAddedType = Schema.Literal("thread.realtime.item-added");
const ThreadRealtimeAudioDeltaType = Schema.Literal("thread.realtime.audio.delta");
const ThreadRealtimeErrorType = Schema.Literal("thread.realtime.error");
const ThreadRealtimeClosedType = Schema.Literal("thread.realtime.closed");
const TurnStartedType = Schema.Literal("turn.started");
const TurnCompletedType = Schema.Literal("turn.completed");
const TurnAbortedType = Schema.Literal("turn.aborted");
const TurnPlanUpdatedType = Schema.Literal("turn.plan.updated");
const TurnProposedDeltaType = Schema.Literal("turn.proposed.delta");
const TurnProposedCompletedType = Schema.Literal("turn.proposed.completed");
const TurnDiffUpdatedType = Schema.Literal("turn.diff.updated");
const ItemStartedType = Schema.Literal("item.started");
const ItemUpdatedType = Schema.Literal("item.updated");
const ItemCompletedType = Schema.Literal("item.completed");
const ContentDeltaType = Schema.Literal("content.delta");
const RequestOpenedType = Schema.Literal("request.opened");
const RequestResolvedType = Schema.Literal("request.resolved");
const UserInputRequestedType = Schema.Literal("user-input.requested");
const UserInputResolvedType = Schema.Literal("user-input.resolved");
const TaskStartedType = Schema.Literal("task.started");
const TaskProgressType = Schema.Literal("task.progress");
const TaskCompletedType = Schema.Literal("task.completed");
const HookStartedType = Schema.Literal("hook.started");
const HookProgressType = Schema.Literal("hook.progress");
const HookCompletedType = Schema.Literal("hook.completed");
const ToolProgressType = Schema.Literal("tool.progress");
const ToolSummaryType = Schema.Literal("tool.summary");
const AuthStatusType = Schema.Literal("auth.status");
const AccountUpdatedType = Schema.Literal("account.updated");
const AccountRateLimitsUpdatedType = Schema.Literal("account.rate-limits.updated");
const McpStatusUpdatedType = Schema.Literal("mcp.status.updated");
const McpOauthCompletedType = Schema.Literal("mcp.oauth.completed");
const ModelReroutedType = Schema.Literal("model.rerouted");
const ConfigWarningType = Schema.Literal("config.warning");
const DeprecationNoticeType = Schema.Literal("deprecation.notice");
const FilesPersistedType = Schema.Literal("files.persisted");
const ToolDeniedType = Schema.Literal("tool.denied");
const RuntimeWarningType = Schema.Literal("runtime.warning");
const RuntimeErrorType = Schema.Literal("runtime.error");

export class ProviderRuntimeEventBase extends Schema.Class<ProviderRuntimeEventBase>(
  "ProviderRuntimeEventBase",
)({
  eventId: EventId,
  provider: ProviderDriverKind,
  // Optional during the driver/instance migration. See providerInstance.ts
  // for the routing-key-vs-driver-id distinction. Once every emitter
  // populates it (post-slice-4), routing flips to instance-id-only.
  providerInstanceId: Schema.optional(ProviderInstanceId),
  threadId: ThreadId,
  createdAt: IsoDateTime,
  turnId: Schema.optional(TurnId),
  itemId: Schema.optional(RuntimeItemId),
  requestId: Schema.optional(RuntimeRequestId),
  providerRefs: Schema.optional(ProviderRefs),
  raw: Schema.optional(RuntimeEventRaw),
}) {}

export class SessionStartedPayload extends Schema.Class<SessionStartedPayload>(
  "SessionStartedPayload",
)({
  message: Schema.optional(TrimmedNonEmptyStringSchema),
  resume: Schema.optional(Schema.Unknown),
}) {}

export class SessionConfiguredPayload extends Schema.Class<SessionConfiguredPayload>(
  "SessionConfiguredPayload",
)({
  config: UnknownRecordSchema,
}) {}

export class SessionStateChangedPayload extends Schema.Class<SessionStateChangedPayload>(
  "SessionStateChangedPayload",
)({
  state: RuntimeSessionState,
  reason: Schema.optional(TrimmedNonEmptyStringSchema),
  detail: Schema.optional(Schema.Unknown),
}) {}

export class SessionExitedPayload extends Schema.Class<SessionExitedPayload>(
  "SessionExitedPayload",
)({
  reason: Schema.optional(TrimmedNonEmptyStringSchema),
  recoverable: Schema.optional(Schema.Boolean),
  exitKind: Schema.optional(RuntimeSessionExitKind),
}) {}

export class ThreadStartedPayload extends Schema.Class<ThreadStartedPayload>(
  "ThreadStartedPayload",
)({
  providerThreadId: Schema.optional(TrimmedNonEmptyStringSchema),
}) {}

export class ThreadStateChangedPayload extends Schema.Class<ThreadStateChangedPayload>(
  "ThreadStateChangedPayload",
)({
  state: RuntimeThreadState,
  detail: Schema.optional(Schema.Unknown),
}) {}

export class ThreadMetadataUpdatedPayload extends Schema.Class<ThreadMetadataUpdatedPayload>(
  "ThreadMetadataUpdatedPayload",
)({
  name: Schema.optional(TrimmedNonEmptyStringSchema),
  metadata: Schema.optional(UnknownRecordSchema),
}) {}

export class ThreadTokenUsageSnapshot extends Schema.Class<ThreadTokenUsageSnapshot>(
  "ThreadTokenUsageSnapshot",
)({
  usedTokens: NonNegativeInt,
  totalProcessedTokens: Schema.optional(NonNegativeInt),
  maxTokens: Schema.optional(PositiveInt),
  inputTokens: Schema.optional(NonNegativeInt),
  cachedInputTokens: Schema.optional(NonNegativeInt),
  outputTokens: Schema.optional(NonNegativeInt),
  reasoningOutputTokens: Schema.optional(NonNegativeInt),
  lastUsedTokens: Schema.optional(NonNegativeInt),
  lastInputTokens: Schema.optional(NonNegativeInt),
  lastCachedInputTokens: Schema.optional(NonNegativeInt),
  lastOutputTokens: Schema.optional(NonNegativeInt),
  lastReasoningOutputTokens: Schema.optional(NonNegativeInt),
  toolUses: Schema.optional(NonNegativeInt),
  durationMs: Schema.optional(NonNegativeInt),
  compactsAutomatically: Schema.optional(Schema.Boolean),
}) {}

export class ThreadTokenUsageUpdatedPayload extends Schema.Class<ThreadTokenUsageUpdatedPayload>(
  "ThreadTokenUsageUpdatedPayload",
)({
  usage: ThreadTokenUsageSnapshot,
}) {}

export class ThreadRealtimeStartedPayload extends Schema.Class<ThreadRealtimeStartedPayload>(
  "ThreadRealtimeStartedPayload",
)({
  realtimeSessionId: Schema.optional(TrimmedNonEmptyStringSchema),
}) {}

export class ThreadRealtimeItemAddedPayload extends Schema.Class<ThreadRealtimeItemAddedPayload>(
  "ThreadRealtimeItemAddedPayload",
)({
  item: Schema.Unknown,
}) {}

export class ThreadRealtimeAudioDeltaPayload extends Schema.Class<ThreadRealtimeAudioDeltaPayload>(
  "ThreadRealtimeAudioDeltaPayload",
)({
  audio: Schema.Unknown,
}) {}

export class ThreadRealtimeErrorPayload extends Schema.Class<ThreadRealtimeErrorPayload>(
  "ThreadRealtimeErrorPayload",
)({
  message: TrimmedNonEmptyStringSchema,
}) {}

export class ThreadRealtimeClosedPayload extends Schema.Class<ThreadRealtimeClosedPayload>(
  "ThreadRealtimeClosedPayload",
)({
  reason: Schema.optional(TrimmedNonEmptyStringSchema),
}) {}

export class TurnStartedPayload extends Schema.Class<TurnStartedPayload>("TurnStartedPayload")({
  model: Schema.optional(TrimmedNonEmptyStringSchema),
  effort: Schema.optional(TrimmedNonEmptyStringSchema),
}) {}

export class TurnCompletedPayload extends Schema.Class<TurnCompletedPayload>(
  "TurnCompletedPayload",
)({
  state: RuntimeTurnState,
  stopReason: Schema.optional(Schema.NullOr(TrimmedNonEmptyStringSchema)),
  usage: Schema.optional(Schema.Unknown),
  modelUsage: Schema.optional(UnknownRecordSchema),
  totalCostUsd: Schema.optional(Schema.Number),
  errorMessage: Schema.optional(TrimmedNonEmptyStringSchema),
}) {}

export class TurnAbortedPayload extends Schema.Class<TurnAbortedPayload>("TurnAbortedPayload")({
  reason: TrimmedNonEmptyStringSchema,
}) {}

export class RuntimePlanStep extends Schema.Class<RuntimePlanStep>("RuntimePlanStep")({
  step: TrimmedNonEmptyStringSchema,
  status: RuntimePlanStepStatus,
}) {}

export class TurnPlanUpdatedPayload extends Schema.Class<TurnPlanUpdatedPayload>(
  "TurnPlanUpdatedPayload",
)({
  explanation: Schema.optional(Schema.NullOr(TrimmedNonEmptyStringSchema)),
  plan: Schema.Array(RuntimePlanStep),
}) {}

export class TurnProposedDeltaPayload extends Schema.Class<TurnProposedDeltaPayload>(
  "TurnProposedDeltaPayload",
)({
  delta: Schema.String,
}) {}

export class TurnProposedCompletedPayload extends Schema.Class<TurnProposedCompletedPayload>(
  "TurnProposedCompletedPayload",
)({
  planMarkdown: TrimmedNonEmptyStringSchema,
}) {}

export class TurnDiffUpdatedPayload extends Schema.Class<TurnDiffUpdatedPayload>(
  "TurnDiffUpdatedPayload",
)({
  unifiedDiff: Schema.String,
}) {}

export class ItemLifecyclePayload extends Schema.Class<ItemLifecyclePayload>(
  "ItemLifecyclePayload",
)({
  itemType: CanonicalItemType,
  status: Schema.optional(RuntimeItemStatus),
  title: Schema.optional(TrimmedNonEmptyStringSchema),
  detail: Schema.optional(TrimmedNonEmptyStringSchema),
  data: Schema.optional(Schema.Unknown),
}) {}

export class ContentDeltaPayload extends Schema.Class<ContentDeltaPayload>("ContentDeltaPayload")({
  streamKind: RuntimeContentStreamKind,
  delta: Schema.String,
  contentIndex: Schema.optional(Schema.Int),
  summaryIndex: Schema.optional(Schema.Int),
}) {}

export class RequestOpenedPayload extends Schema.Class<RequestOpenedPayload>(
  "RequestOpenedPayload",
)({
  requestType: CanonicalRequestType,
  detail: Schema.optional(TrimmedNonEmptyStringSchema),
  args: Schema.optional(Schema.Unknown),
}) {}

export class RequestResolvedPayload extends Schema.Class<RequestResolvedPayload>(
  "RequestResolvedPayload",
)({
  requestType: CanonicalRequestType,
  decision: Schema.optional(TrimmedNonEmptyStringSchema),
  resolution: Schema.optional(Schema.Unknown),
}) {}

export class UserInputQuestionOption extends Schema.Class<UserInputQuestionOption>(
  "UserInputQuestionOption",
)({
  label: TrimmedNonEmptyStringSchema,
  description: TrimmedNonEmptyStringSchema,
}) {}

export class UserInputQuestion extends Schema.Class<UserInputQuestion>("UserInputQuestion")({
  id: TrimmedNonEmptyStringSchema,
  header: TrimmedNonEmptyStringSchema,
  question: TrimmedNonEmptyStringSchema,
  options: Schema.Array(UserInputQuestionOption),
  multiSelect: Schema.optional(Schema.Boolean).pipe(
    Schema.withConstructorDefault(Effect.succeed(false)),
  ),
}) {}

export class UserInputRequestedPayload extends Schema.Class<UserInputRequestedPayload>(
  "UserInputRequestedPayload",
)({
  questions: Schema.Array(UserInputQuestion),
}) {}

export class UserInputResolvedPayload extends Schema.Class<UserInputResolvedPayload>(
  "UserInputResolvedPayload",
)({
  answers: UnknownRecordSchema,
}) {}

export class TaskStartedPayload extends Schema.Class<TaskStartedPayload>("TaskStartedPayload")({
  taskId: RuntimeTaskId,
  description: Schema.optional(TrimmedNonEmptyStringSchema),
  taskType: Schema.optional(TrimmedNonEmptyStringSchema),
}) {}

export class TaskProgressPayload extends Schema.Class<TaskProgressPayload>("TaskProgressPayload")({
  taskId: RuntimeTaskId,
  description: TrimmedNonEmptyStringSchema,
  summary: Schema.optional(TrimmedNonEmptyStringSchema),
  usage: Schema.optional(Schema.Unknown),
  lastToolName: Schema.optional(TrimmedNonEmptyStringSchema),
}) {}

export class TaskCompletedPayload extends Schema.Class<TaskCompletedPayload>(
  "TaskCompletedPayload",
)({
  taskId: RuntimeTaskId,
  status: Schema.Literals(["completed", "failed", "stopped"]),
  summary: Schema.optional(TrimmedNonEmptyStringSchema),
  usage: Schema.optional(Schema.Unknown),
}) {}

export class HookStartedPayload extends Schema.Class<HookStartedPayload>("HookStartedPayload")({
  hookId: TrimmedNonEmptyStringSchema,
  hookName: TrimmedNonEmptyStringSchema,
  hookEvent: TrimmedNonEmptyStringSchema,
}) {}

export class HookProgressPayload extends Schema.Class<HookProgressPayload>("HookProgressPayload")({
  hookId: TrimmedNonEmptyStringSchema,
  output: Schema.optional(Schema.String),
  stdout: Schema.optional(Schema.String),
  stderr: Schema.optional(Schema.String),
}) {}

export class HookCompletedPayload extends Schema.Class<HookCompletedPayload>(
  "HookCompletedPayload",
)({
  hookId: TrimmedNonEmptyStringSchema,
  outcome: Schema.Literals(["success", "error", "cancelled"]),
  output: Schema.optional(Schema.String),
  stdout: Schema.optional(Schema.String),
  stderr: Schema.optional(Schema.String),
  exitCode: Schema.optional(Schema.Int),
}) {}

export class ToolProgressPayload extends Schema.Class<ToolProgressPayload>("ToolProgressPayload")({
  toolUseId: Schema.optional(TrimmedNonEmptyStringSchema),
  toolName: Schema.optional(TrimmedNonEmptyStringSchema),
  summary: Schema.optional(TrimmedNonEmptyStringSchema),
  elapsedSeconds: Schema.optional(Schema.Number),
}) {}

export class ToolSummaryPayload extends Schema.Class<ToolSummaryPayload>("ToolSummaryPayload")({
  summary: TrimmedNonEmptyStringSchema,
  precedingToolUseIds: Schema.optional(Schema.Array(TrimmedNonEmptyStringSchema)),
}) {}

export class AuthStatusPayload extends Schema.Class<AuthStatusPayload>("AuthStatusPayload")({
  isAuthenticating: Schema.optional(Schema.Boolean),
  output: Schema.optional(Schema.Array(Schema.String)),
  error: Schema.optional(TrimmedNonEmptyStringSchema),
}) {}

export class AccountUpdatedPayload extends Schema.Class<AccountUpdatedPayload>(
  "AccountUpdatedPayload",
)({
  account: Schema.Unknown,
}) {}

export class AccountRateLimitsUpdatedPayload extends Schema.Class<AccountRateLimitsUpdatedPayload>(
  "AccountRateLimitsUpdatedPayload",
)({
  rateLimits: Schema.Unknown,
}) {}

export class McpStatusUpdatedPayload extends Schema.Class<McpStatusUpdatedPayload>(
  "McpStatusUpdatedPayload",
)({
  status: Schema.Unknown,
}) {}

export class McpOauthCompletedPayload extends Schema.Class<McpOauthCompletedPayload>(
  "McpOauthCompletedPayload",
)({
  success: Schema.Boolean,
  name: Schema.optional(TrimmedNonEmptyStringSchema),
  error: Schema.optional(TrimmedNonEmptyStringSchema),
}) {}

export class ModelReroutedPayload extends Schema.Class<ModelReroutedPayload>(
  "ModelReroutedPayload",
)({
  fromModel: TrimmedNonEmptyStringSchema,
  toModel: TrimmedNonEmptyStringSchema,
  reason: TrimmedNonEmptyStringSchema,
}) {}

export class ConfigWarningPayload extends Schema.Class<ConfigWarningPayload>(
  "ConfigWarningPayload",
)({
  summary: TrimmedNonEmptyStringSchema,
  details: Schema.optional(TrimmedNonEmptyStringSchema),
  path: Schema.optional(TrimmedNonEmptyStringSchema),
  range: Schema.optional(Schema.Unknown),
}) {}

export class DeprecationNoticePayload extends Schema.Class<DeprecationNoticePayload>(
  "DeprecationNoticePayload",
)({
  summary: TrimmedNonEmptyStringSchema,
  details: Schema.optional(TrimmedNonEmptyStringSchema),
}) {}

export class FilesPersistedPayload extends Schema.Class<FilesPersistedPayload>(
  "FilesPersistedPayload",
)({
  files: Schema.Array(
    Schema.Struct({
      filename: TrimmedNonEmptyStringSchema,
      fileId: TrimmedNonEmptyStringSchema,
    }),
  ),
  failed: Schema.optional(
    Schema.Array(
      Schema.Struct({
        filename: TrimmedNonEmptyStringSchema,
        error: TrimmedNonEmptyStringSchema,
      }),
    ),
  ),
}) {}

export class ToolDeniedPayload extends Schema.Class<ToolDeniedPayload>("ToolDeniedPayload")({
  toolName: TrimmedNonEmptyStringSchema,
  toolUseId: Schema.optional(TrimmedNonEmptyStringSchema),
  reason: Schema.optional(TrimmedNonEmptyStringSchema),
  agentId: Schema.optional(TrimmedNonEmptyStringSchema),
}) {}

export class RuntimeWarningPayload extends Schema.Class<RuntimeWarningPayload>(
  "RuntimeWarningPayload",
)({
  message: TrimmedNonEmptyStringSchema,
  detail: Schema.optional(Schema.Unknown),
}) {}

export class RuntimeErrorPayload extends Schema.Class<RuntimeErrorPayload>("RuntimeErrorPayload")({
  message: TrimmedNonEmptyStringSchema,
  class: Schema.optional(RuntimeErrorClass),
  detail: Schema.optional(Schema.Unknown),
}) {}

export class ProviderRuntimeSessionStartedEvent extends Schema.Class<ProviderRuntimeSessionStartedEvent>(
  "ProviderRuntimeSessionStartedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: SessionStartedType,
  payload: SessionStartedPayload,
}) {}

export class ProviderRuntimeSessionConfiguredEvent extends Schema.Class<ProviderRuntimeSessionConfiguredEvent>(
  "ProviderRuntimeSessionConfiguredEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: SessionConfiguredType,
  payload: SessionConfiguredPayload,
}) {}

export class ProviderRuntimeSessionStateChangedEvent extends Schema.Class<ProviderRuntimeSessionStateChangedEvent>(
  "ProviderRuntimeSessionStateChangedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: SessionStateChangedType,
  payload: SessionStateChangedPayload,
}) {}

export class ProviderRuntimeSessionExitedEvent extends Schema.Class<ProviderRuntimeSessionExitedEvent>(
  "ProviderRuntimeSessionExitedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: SessionExitedType,
  payload: SessionExitedPayload,
}) {}

export class ProviderRuntimeThreadStartedEvent extends Schema.Class<ProviderRuntimeThreadStartedEvent>(
  "ProviderRuntimeThreadStartedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadStartedType,
  payload: ThreadStartedPayload,
}) {}

export class ProviderRuntimeThreadStateChangedEvent extends Schema.Class<ProviderRuntimeThreadStateChangedEvent>(
  "ProviderRuntimeThreadStateChangedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadStateChangedType,
  payload: ThreadStateChangedPayload,
}) {}

export class ProviderRuntimeThreadMetadataUpdatedEvent extends Schema.Class<ProviderRuntimeThreadMetadataUpdatedEvent>(
  "ProviderRuntimeThreadMetadataUpdatedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadMetadataUpdatedType,
  payload: ThreadMetadataUpdatedPayload,
}) {}

export class ProviderRuntimeThreadTokenUsageUpdatedEvent extends Schema.Class<ProviderRuntimeThreadTokenUsageUpdatedEvent>(
  "ProviderRuntimeThreadTokenUsageUpdatedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadTokenUsageUpdatedType,
  payload: ThreadTokenUsageUpdatedPayload,
}) {}

export class ProviderRuntimeThreadRealtimeStartedEvent extends Schema.Class<ProviderRuntimeThreadRealtimeStartedEvent>(
  "ProviderRuntimeThreadRealtimeStartedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadRealtimeStartedType,
  payload: ThreadRealtimeStartedPayload,
}) {}

export class ProviderRuntimeThreadRealtimeItemAddedEvent extends Schema.Class<ProviderRuntimeThreadRealtimeItemAddedEvent>(
  "ProviderRuntimeThreadRealtimeItemAddedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadRealtimeItemAddedType,
  payload: ThreadRealtimeItemAddedPayload,
}) {}

export class ProviderRuntimeThreadRealtimeAudioDeltaEvent extends Schema.Class<ProviderRuntimeThreadRealtimeAudioDeltaEvent>(
  "ProviderRuntimeThreadRealtimeAudioDeltaEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadRealtimeAudioDeltaType,
  payload: ThreadRealtimeAudioDeltaPayload,
}) {}

export class ProviderRuntimeThreadRealtimeErrorEvent extends Schema.Class<ProviderRuntimeThreadRealtimeErrorEvent>(
  "ProviderRuntimeThreadRealtimeErrorEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadRealtimeErrorType,
  payload: ThreadRealtimeErrorPayload,
}) {}

export class ProviderRuntimeThreadRealtimeClosedEvent extends Schema.Class<ProviderRuntimeThreadRealtimeClosedEvent>(
  "ProviderRuntimeThreadRealtimeClosedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadRealtimeClosedType,
  payload: ThreadRealtimeClosedPayload,
}) {}

export class ProviderRuntimeTurnStartedEvent extends Schema.Class<ProviderRuntimeTurnStartedEvent>(
  "ProviderRuntimeTurnStartedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: TurnStartedType,
  payload: TurnStartedPayload,
}) {}

export class ProviderRuntimeTurnCompletedEvent extends Schema.Class<ProviderRuntimeTurnCompletedEvent>(
  "ProviderRuntimeTurnCompletedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: TurnCompletedType,
  payload: TurnCompletedPayload,
}) {}

export class ProviderRuntimeTurnAbortedEvent extends Schema.Class<ProviderRuntimeTurnAbortedEvent>(
  "ProviderRuntimeTurnAbortedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: TurnAbortedType,
  payload: TurnAbortedPayload,
}) {}

export class ProviderRuntimeTurnPlanUpdatedEvent extends Schema.Class<ProviderRuntimeTurnPlanUpdatedEvent>(
  "ProviderRuntimeTurnPlanUpdatedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: TurnPlanUpdatedType,
  payload: TurnPlanUpdatedPayload,
}) {}

export class ProviderRuntimeTurnProposedDeltaEvent extends Schema.Class<ProviderRuntimeTurnProposedDeltaEvent>(
  "ProviderRuntimeTurnProposedDeltaEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: TurnProposedDeltaType,
  payload: TurnProposedDeltaPayload,
}) {}

export class ProviderRuntimeTurnProposedCompletedEvent extends Schema.Class<ProviderRuntimeTurnProposedCompletedEvent>(
  "ProviderRuntimeTurnProposedCompletedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: TurnProposedCompletedType,
  payload: TurnProposedCompletedPayload,
}) {}

export class ProviderRuntimeTurnDiffUpdatedEvent extends Schema.Class<ProviderRuntimeTurnDiffUpdatedEvent>(
  "ProviderRuntimeTurnDiffUpdatedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: TurnDiffUpdatedType,
  payload: TurnDiffUpdatedPayload,
}) {}

export class ProviderRuntimeItemStartedEvent extends Schema.Class<ProviderRuntimeItemStartedEvent>(
  "ProviderRuntimeItemStartedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ItemStartedType,
  payload: ItemLifecyclePayload,
}) {}

export class ProviderRuntimeItemUpdatedEvent extends Schema.Class<ProviderRuntimeItemUpdatedEvent>(
  "ProviderRuntimeItemUpdatedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ItemUpdatedType,
  payload: ItemLifecyclePayload,
}) {}

export class ProviderRuntimeItemCompletedEvent extends Schema.Class<ProviderRuntimeItemCompletedEvent>(
  "ProviderRuntimeItemCompletedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ItemCompletedType,
  payload: ItemLifecyclePayload,
}) {}

export class ProviderRuntimeContentDeltaEvent extends Schema.Class<ProviderRuntimeContentDeltaEvent>(
  "ProviderRuntimeContentDeltaEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ContentDeltaType,
  payload: ContentDeltaPayload,
}) {}

export class ProviderRuntimeRequestOpenedEvent extends Schema.Class<ProviderRuntimeRequestOpenedEvent>(
  "ProviderRuntimeRequestOpenedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: RequestOpenedType,
  payload: RequestOpenedPayload,
}) {}

export class ProviderRuntimeRequestResolvedEvent extends Schema.Class<ProviderRuntimeRequestResolvedEvent>(
  "ProviderRuntimeRequestResolvedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: RequestResolvedType,
  payload: RequestResolvedPayload,
}) {}

export class ProviderRuntimeUserInputRequestedEvent extends Schema.Class<ProviderRuntimeUserInputRequestedEvent>(
  "ProviderRuntimeUserInputRequestedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: UserInputRequestedType,
  payload: UserInputRequestedPayload,
}) {}

export class ProviderRuntimeUserInputResolvedEvent extends Schema.Class<ProviderRuntimeUserInputResolvedEvent>(
  "ProviderRuntimeUserInputResolvedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: UserInputResolvedType,
  payload: UserInputResolvedPayload,
}) {}

export class ProviderRuntimeTaskStartedEvent extends Schema.Class<ProviderRuntimeTaskStartedEvent>(
  "ProviderRuntimeTaskStartedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: TaskStartedType,
  payload: TaskStartedPayload,
}) {}

export class ProviderRuntimeTaskProgressEvent extends Schema.Class<ProviderRuntimeTaskProgressEvent>(
  "ProviderRuntimeTaskProgressEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: TaskProgressType,
  payload: TaskProgressPayload,
}) {}

export class ProviderRuntimeTaskCompletedEvent extends Schema.Class<ProviderRuntimeTaskCompletedEvent>(
  "ProviderRuntimeTaskCompletedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: TaskCompletedType,
  payload: TaskCompletedPayload,
}) {}

export class ProviderRuntimeHookStartedEvent extends Schema.Class<ProviderRuntimeHookStartedEvent>(
  "ProviderRuntimeHookStartedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: HookStartedType,
  payload: HookStartedPayload,
}) {}

export class ProviderRuntimeHookProgressEvent extends Schema.Class<ProviderRuntimeHookProgressEvent>(
  "ProviderRuntimeHookProgressEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: HookProgressType,
  payload: HookProgressPayload,
}) {}

export class ProviderRuntimeHookCompletedEvent extends Schema.Class<ProviderRuntimeHookCompletedEvent>(
  "ProviderRuntimeHookCompletedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: HookCompletedType,
  payload: HookCompletedPayload,
}) {}

export class ProviderRuntimeToolProgressEvent extends Schema.Class<ProviderRuntimeToolProgressEvent>(
  "ProviderRuntimeToolProgressEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ToolProgressType,
  payload: ToolProgressPayload,
}) {}

export class ProviderRuntimeToolSummaryEvent extends Schema.Class<ProviderRuntimeToolSummaryEvent>(
  "ProviderRuntimeToolSummaryEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ToolSummaryType,
  payload: ToolSummaryPayload,
}) {}

export class ProviderRuntimeAuthStatusEvent extends Schema.Class<ProviderRuntimeAuthStatusEvent>(
  "ProviderRuntimeAuthStatusEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: AuthStatusType,
  payload: AuthStatusPayload,
}) {}

export class ProviderRuntimeAccountUpdatedEvent extends Schema.Class<ProviderRuntimeAccountUpdatedEvent>(
  "ProviderRuntimeAccountUpdatedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: AccountUpdatedType,
  payload: AccountUpdatedPayload,
}) {}

export class ProviderRuntimeAccountRateLimitsUpdatedEvent extends Schema.Class<ProviderRuntimeAccountRateLimitsUpdatedEvent>(
  "ProviderRuntimeAccountRateLimitsUpdatedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: AccountRateLimitsUpdatedType,
  payload: AccountRateLimitsUpdatedPayload,
}) {}

export class ProviderRuntimeMcpStatusUpdatedEvent extends Schema.Class<ProviderRuntimeMcpStatusUpdatedEvent>(
  "ProviderRuntimeMcpStatusUpdatedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: McpStatusUpdatedType,
  payload: McpStatusUpdatedPayload,
}) {}

export class ProviderRuntimeMcpOauthCompletedEvent extends Schema.Class<ProviderRuntimeMcpOauthCompletedEvent>(
  "ProviderRuntimeMcpOauthCompletedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: McpOauthCompletedType,
  payload: McpOauthCompletedPayload,
}) {}

export class ProviderRuntimeModelReroutedEvent extends Schema.Class<ProviderRuntimeModelReroutedEvent>(
  "ProviderRuntimeModelReroutedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ModelReroutedType,
  payload: ModelReroutedPayload,
}) {}

export class ProviderRuntimeConfigWarningEvent extends Schema.Class<ProviderRuntimeConfigWarningEvent>(
  "ProviderRuntimeConfigWarningEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ConfigWarningType,
  payload: ConfigWarningPayload,
}) {}

export class ProviderRuntimeDeprecationNoticeEvent extends Schema.Class<ProviderRuntimeDeprecationNoticeEvent>(
  "ProviderRuntimeDeprecationNoticeEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: DeprecationNoticeType,
  payload: DeprecationNoticePayload,
}) {}

export class ProviderRuntimeFilesPersistedEvent extends Schema.Class<ProviderRuntimeFilesPersistedEvent>(
  "ProviderRuntimeFilesPersistedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: FilesPersistedType,
  payload: FilesPersistedPayload,
}) {}

export class ProviderRuntimeToolDeniedEvent extends Schema.Class<ProviderRuntimeToolDeniedEvent>(
  "ProviderRuntimeToolDeniedEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: ToolDeniedType,
  payload: ToolDeniedPayload,
}) {}

export class ProviderRuntimeWarningEvent extends Schema.Class<ProviderRuntimeWarningEvent>(
  "ProviderRuntimeWarningEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: RuntimeWarningType,
  payload: RuntimeWarningPayload,
}) {}

export class ProviderRuntimeErrorEvent extends Schema.Class<ProviderRuntimeErrorEvent>(
  "ProviderRuntimeErrorEvent",
)({
  ...ProviderRuntimeEventBase.fields,
  type: RuntimeErrorType,
  payload: RuntimeErrorPayload,
}) {}

export const ProviderRuntimeEventV2 = Schema.Union([
  ProviderRuntimeSessionStartedEvent,
  ProviderRuntimeSessionConfiguredEvent,
  ProviderRuntimeSessionStateChangedEvent,
  ProviderRuntimeSessionExitedEvent,
  ProviderRuntimeThreadStartedEvent,
  ProviderRuntimeThreadStateChangedEvent,
  ProviderRuntimeThreadMetadataUpdatedEvent,
  ProviderRuntimeThreadTokenUsageUpdatedEvent,
  ProviderRuntimeThreadRealtimeStartedEvent,
  ProviderRuntimeThreadRealtimeItemAddedEvent,
  ProviderRuntimeThreadRealtimeAudioDeltaEvent,
  ProviderRuntimeThreadRealtimeErrorEvent,
  ProviderRuntimeThreadRealtimeClosedEvent,
  ProviderRuntimeTurnStartedEvent,
  ProviderRuntimeTurnCompletedEvent,
  ProviderRuntimeTurnAbortedEvent,
  ProviderRuntimeTurnPlanUpdatedEvent,
  ProviderRuntimeTurnProposedDeltaEvent,
  ProviderRuntimeTurnProposedCompletedEvent,
  ProviderRuntimeTurnDiffUpdatedEvent,
  ProviderRuntimeItemStartedEvent,
  ProviderRuntimeItemUpdatedEvent,
  ProviderRuntimeItemCompletedEvent,
  ProviderRuntimeContentDeltaEvent,
  ProviderRuntimeRequestOpenedEvent,
  ProviderRuntimeRequestResolvedEvent,
  ProviderRuntimeUserInputRequestedEvent,
  ProviderRuntimeUserInputResolvedEvent,
  ProviderRuntimeTaskStartedEvent,
  ProviderRuntimeTaskProgressEvent,
  ProviderRuntimeTaskCompletedEvent,
  ProviderRuntimeHookStartedEvent,
  ProviderRuntimeHookProgressEvent,
  ProviderRuntimeHookCompletedEvent,
  ProviderRuntimeToolProgressEvent,
  ProviderRuntimeToolSummaryEvent,
  ProviderRuntimeAuthStatusEvent,
  ProviderRuntimeAccountUpdatedEvent,
  ProviderRuntimeAccountRateLimitsUpdatedEvent,
  ProviderRuntimeMcpStatusUpdatedEvent,
  ProviderRuntimeMcpOauthCompletedEvent,
  ProviderRuntimeModelReroutedEvent,
  ProviderRuntimeConfigWarningEvent,
  ProviderRuntimeDeprecationNoticeEvent,
  ProviderRuntimeFilesPersistedEvent,
  ProviderRuntimeToolDeniedEvent,
  ProviderRuntimeWarningEvent,
  ProviderRuntimeErrorEvent,
]);
export type ProviderRuntimeEventV2 = typeof ProviderRuntimeEventV2.Type;

export const ProviderRuntimeEvent = ProviderRuntimeEventV2;
export type ProviderRuntimeEvent = ProviderRuntimeEventV2;

// Compatibility aliases for call sites still importing legacy names.
const ProviderRuntimeMessageDeltaEvent = ProviderRuntimeContentDeltaEvent;
export type ProviderRuntimeMessageDeltaEvent = ProviderRuntimeContentDeltaEvent;
const ProviderRuntimeMessageCompletedEvent = ProviderRuntimeItemCompletedEvent;
export type ProviderRuntimeMessageCompletedEvent = ProviderRuntimeItemCompletedEvent;
const ProviderRuntimeToolStartedEvent = ProviderRuntimeItemStartedEvent;
export type ProviderRuntimeToolStartedEvent = ProviderRuntimeItemStartedEvent;
const ProviderRuntimeToolCompletedEvent = ProviderRuntimeItemCompletedEvent;
export type ProviderRuntimeToolCompletedEvent = ProviderRuntimeItemCompletedEvent;
const ProviderRuntimeApprovalRequestedEvent = ProviderRuntimeRequestOpenedEvent;
export type ProviderRuntimeApprovalRequestedEvent = ProviderRuntimeRequestOpenedEvent;
const ProviderRuntimeApprovalResolvedEvent = ProviderRuntimeRequestResolvedEvent;
export type ProviderRuntimeApprovalResolvedEvent = ProviderRuntimeRequestResolvedEvent;

// Legacy helper aliases retained for adapters/tests.
const ProviderRuntimeToolKind = Schema.Literals(["command", "file-read", "file-change", "other"]);
export type ProviderRuntimeToolKind = typeof ProviderRuntimeToolKind.Type;

export const ProviderRuntimeTurnStatus = RuntimeTurnState;
export type ProviderRuntimeTurnStatus = RuntimeTurnState;
