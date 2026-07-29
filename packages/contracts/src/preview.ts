/**
 * Preview - Schemas for the in-app browser preview surface.
 *
 * The preview is desktop-only (Chromium <webview>); the server tracks per-thread
 * tab metadata so it survives client reconnects and multi-window. The desktop
 * renderer mediates: it owns the actual <webview> and reports navigation back to
 * the server via these RPCs, the server fans events to all subscribers.
 *
 * @module Preview
 */
import { Schema } from "effect";
import { NonNegativeInt, PositiveInt, ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

const Url = TrimmedNonEmptyString.check(Schema.isMaxLength(2048));
const Title = Schema.String.check(Schema.isMaxLength(512));

export const PreviewTabId = TrimmedNonEmptyString.check(Schema.isMaxLength(128));
export type PreviewTabId = typeof PreviewTabId.Type;

export const PREVIEW_VIEWPORT_MIN_DIMENSION = 240;
export const PREVIEW_VIEWPORT_MAX_DIMENSION = 3840;
export const PREVIEW_VIEWPORT_MAX_AREA = 3840 * 2160;

const PreviewViewportDimension = Schema.Int.check(
  Schema.isBetween({
    minimum: PREVIEW_VIEWPORT_MIN_DIMENSION,
    maximum: PREVIEW_VIEWPORT_MAX_DIMENSION,
  }),
);

const viewportAreaFilter = Schema.makeFilter(
  ({ width, height }: { readonly width: number; readonly height: number }) =>
    width * height <= PREVIEW_VIEWPORT_MAX_AREA ||
    `Viewport area must not exceed ${PREVIEW_VIEWPORT_MAX_AREA} pixels.`,
);

export class PreviewViewportSize extends Schema.Class<PreviewViewportSize>("PreviewViewportSize")(
  Schema.Struct({
    width: PreviewViewportDimension,
    height: PreviewViewportDimension,
  }).check(viewportAreaFilter),
) {}

/**
 * The page's measured viewport can be smaller than the minimum selectable
 * fixed size while fill mode follows a narrow panel. Keep measurement
 * validation separate from the stricter user-selectable size constraints.
 */
export class PreviewRenderedViewportSize extends Schema.Class<PreviewRenderedViewportSize>(
  "PreviewRenderedViewportSize",
)({
  width: Schema.Int.check(Schema.isGreaterThan(0)),
  height: Schema.Int.check(Schema.isGreaterThan(0)),
}) {}

export const PREVIEW_VIEWPORT_PRESET_IDS = [
  "iphone-se",
  "iphone-xr",
  "iphone-12-pro",
  "iphone-14-pro-max",
  "pixel-7",
  "samsung-galaxy-s8-plus",
  "samsung-galaxy-s20-ultra",
  "ipad-mini",
  "ipad-air",
  "ipad-pro",
  "surface-pro-7",
  "surface-duo",
  "galaxy-z-fold-5",
  "asus-zenbook-fold",
  "samsung-galaxy-a51-71",
  "nest-hub",
  "nest-hub-max",
] as const;

export const PreviewViewportPresetId = Schema.Literals(PREVIEW_VIEWPORT_PRESET_IDS);
export type PreviewViewportPresetId = typeof PreviewViewportPresetId.Type;

/**
 * Preset IDs shipped before the Chrome-compatible catalog. Existing sessions
 * can still reconnect with these values, but new resize requests only expose
 * PREVIEW_VIEWPORT_PRESET_IDS.
 */
const LEGACY_PREVIEW_VIEWPORT_PRESET_IDS = [
  "desktop-1920x1080",
  "desktop-1440x900",
  "laptop-1366x768",
  "laptop-1280x800",
  "ipad-pro-11",
  "iphone-15-pro",
  "pixel-8",
  "galaxy-s24",
] as const;

const StoredPreviewViewportPresetId = Schema.Literals([
  ...PREVIEW_VIEWPORT_PRESET_IDS,
  ...LEGACY_PREVIEW_VIEWPORT_PRESET_IDS,
]);

export const PreviewViewportSetting = Schema.Union([
  Schema.TaggedStruct("fill", {}),
  Schema.TaggedStruct("freeform", {
    ...PreviewViewportSize.fields,
  }).check(viewportAreaFilter),
  Schema.TaggedStruct("preset", {
    ...PreviewViewportSize.fields,
    presetId: StoredPreviewViewportPresetId,
  }).check(viewportAreaFilter),
]);
export type PreviewViewportSetting = typeof PreviewViewportSetting.Type;

export const FILL_PREVIEW_VIEWPORT = {
  _tag: "fill",
} as const satisfies PreviewViewportSetting;

export const PreviewNavStatus = Schema.Union([
  Schema.TaggedStruct("Idle", {}),
  Schema.TaggedStruct("Loading", {
    url: Url,
    title: Title,
  }),
  Schema.TaggedStruct("Success", {
    url: Url,
    title: Title,
  }),
  Schema.TaggedStruct("LoadFailed", {
    url: Url,
    title: Title,
    code: Schema.Int,
    description: Schema.String,
  }),
]);
export type PreviewNavStatus = typeof PreviewNavStatus.Type;

export class PreviewSessionSnapshot extends Schema.Class<PreviewSessionSnapshot>(
  "PreviewSessionSnapshot",
)({
  threadId: TrimmedNonEmptyString,
  tabId: PreviewTabId,
  navStatus: PreviewNavStatus,
  canGoBack: Schema.Boolean,
  canGoForward: Schema.Boolean,
  /** Missing snapshots from older servers are treated as fill-panel mode. */
  viewport: Schema.optional(PreviewViewportSetting),
  updatedAt: Schema.String,
}) {}

export class PreviewOpenInput extends Schema.Class<PreviewOpenInput>("PreviewOpenInput")({
  threadId: ThreadId,
  /** Omit to create an empty (Idle) tab the user can type into. */
  url: Schema.optional(Url),
}) {}

export class PreviewNavigateInput extends Schema.Class<PreviewNavigateInput>(
  "PreviewNavigateInput",
)({
  threadId: ThreadId,
  tabId: PreviewTabId,
  url: Url,
  resolvedTitle: Schema.optional(Title),
}) {}

export class PreviewReportStatusInput extends Schema.Class<PreviewReportStatusInput>(
  "PreviewReportStatusInput",
)({
  threadId: ThreadId,
  tabId: PreviewTabId,
  navStatus: PreviewNavStatus,
  canGoBack: Schema.Boolean,
  canGoForward: Schema.Boolean,
}) {}

export class PreviewRefreshInput extends Schema.Class<PreviewRefreshInput>("PreviewRefreshInput")({
  threadId: ThreadId,
  tabId: PreviewTabId,
}) {}

export class PreviewResizeInput extends Schema.Class<PreviewResizeInput>("PreviewResizeInput")({
  threadId: ThreadId,
  tabId: PreviewTabId,
  viewport: PreviewViewportSetting,
}) {}

export class PreviewCloseInput extends Schema.Class<PreviewCloseInput>("PreviewCloseInput")({
  threadId: ThreadId,
  tabId: Schema.optional(PreviewTabId),
}) {}

export class PreviewListInput extends Schema.Class<PreviewListInput>("PreviewListInput")({
  threadId: ThreadId,
}) {}

export class PreviewListResult extends Schema.Class<PreviewListResult>("PreviewListResult")({
  sessions: Schema.Array(PreviewSessionSnapshot),
  /** Identifies the current server process so revision resets are safe. */
  serverEpoch: TrimmedNonEmptyString,
  /** Monotonic server state revision used to reject stale list responses. */
  revision: NonNegativeInt,
}) {}

const PreviewEventBaseSchema = Schema.Struct({
  threadId: TrimmedNonEmptyString,
  tabId: PreviewTabId,
  createdAt: Schema.String,
  /** Identifies the server process that emitted this event. */
  serverEpoch: TrimmedNonEmptyString,
  /** Monotonic server state revision shared with PreviewListResult. */
  revision: PositiveInt,
});

export class PreviewOpenedEvent extends Schema.Class<PreviewOpenedEvent>("PreviewOpenedEvent")({
  ...PreviewEventBaseSchema.fields,
  type: Schema.Literal("opened"),
  snapshot: PreviewSessionSnapshot,
}) {}

export class PreviewNavigatedEvent extends Schema.Class<PreviewNavigatedEvent>(
  "PreviewNavigatedEvent",
)({
  ...PreviewEventBaseSchema.fields,
  type: Schema.Literal("navigated"),
  snapshot: PreviewSessionSnapshot,
}) {}

export class PreviewResizedEvent extends Schema.Class<PreviewResizedEvent>("PreviewResizedEvent")({
  ...PreviewEventBaseSchema.fields,
  type: Schema.Literal("resized"),
  snapshot: PreviewSessionSnapshot,
}) {}

export class PreviewFailedEvent extends Schema.Class<PreviewFailedEvent>("PreviewFailedEvent")({
  ...PreviewEventBaseSchema.fields,
  type: Schema.Literal("failed"),
  url: Url,
  title: Title,
  code: Schema.Int,
  description: Schema.String,
}) {}

export class PreviewClosedEvent extends Schema.Class<PreviewClosedEvent>("PreviewClosedEvent")({
  ...PreviewEventBaseSchema.fields,
  type: Schema.Literal("closed"),
}) {}

export const PreviewEvent = Schema.Union([
  PreviewOpenedEvent,
  PreviewNavigatedEvent,
  PreviewResizedEvent,
  PreviewFailedEvent,
  PreviewClosedEvent,
]);
export type PreviewEvent = typeof PreviewEvent.Type;

export class DiscoveredLocalServerTerminal extends Schema.Class<DiscoveredLocalServerTerminal>(
  "DiscoveredLocalServerTerminal",
)({
  threadId: ThreadId,
  terminalId: TrimmedNonEmptyString,
}) {}

/**
 * A localhost server detected by the port scanner. Used to populate the
 * "Local" recommendations in the empty-state of the preview panel.
 */
export class DiscoveredLocalServer extends Schema.Class<DiscoveredLocalServer>(
  "DiscoveredLocalServer",
)({
  host: TrimmedNonEmptyString,
  port: Schema.Int.check(Schema.isGreaterThan(0)).check(Schema.isLessThan(65536)),
  url: Url,
  processName: Schema.NullOr(TrimmedNonEmptyString),
  pid: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
  terminal: Schema.NullOr(DiscoveredLocalServerTerminal),
}) {}

export class DiscoveredLocalServerList extends Schema.Class<DiscoveredLocalServerList>(
  "DiscoveredLocalServerList",
)({
  servers: Schema.Array(DiscoveredLocalServer),
  scannedAt: Schema.String,
}) {}

export class PreviewSessionLookupError extends Schema.TaggedErrorClass<PreviewSessionLookupError>()(
  "PreviewSessionLookupError",
  {
    threadId: Schema.String,
    tabId: Schema.String,
  },
) {
  override get message() {
    return `Unknown preview session: thread=${this.threadId}, tab=${this.tabId}`;
  }
}

export class PreviewInvalidUrlError extends Schema.TaggedErrorClass<PreviewInvalidUrlError>()(
  "PreviewInvalidUrlError",
  {
    inputLength: Schema.Number,
    reason: Schema.Literals(["empty", "parse", "unsupported-protocol", "unexpected"]),
    protocol: Schema.optional(Schema.String),
    cause: Schema.Defect(),
  },
) {
  override get message() {
    const protocol = this.protocol === undefined ? "" : `: ${this.protocol}`;
    return `Invalid preview URL (${this.reason}${protocol}; input length ${this.inputLength}).`;
  }
}

export const PreviewError = Schema.Union([PreviewSessionLookupError, PreviewInvalidUrlError]);
export type PreviewError = typeof PreviewError.Type;
