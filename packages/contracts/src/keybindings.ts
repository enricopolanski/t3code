import * as Schema from "effect/Schema";
import { TrimmedString } from "./baseSchemas.ts";

export const MAX_KEYBINDING_VALUE_LENGTH = 64;
export const MAX_KEYBINDING_WHEN_LENGTH = 256;
export const MAX_WHEN_EXPRESSION_DEPTH = 64;
export const MAX_SCRIPT_ID_LENGTH = 24;
export const MAX_KEYBINDINGS_COUNT = 256;

export const THREAD_JUMP_KEYBINDING_COMMANDS = [
  "thread.jump.1",
  "thread.jump.2",
  "thread.jump.3",
  "thread.jump.4",
  "thread.jump.5",
  "thread.jump.6",
  "thread.jump.7",
  "thread.jump.8",
  "thread.jump.9",
] as const;
export type ThreadJumpKeybindingCommand = (typeof THREAD_JUMP_KEYBINDING_COMMANDS)[number];

export const MODEL_PICKER_JUMP_KEYBINDING_COMMANDS = [
  "modelPicker.jump.1",
  "modelPicker.jump.2",
  "modelPicker.jump.3",
  "modelPicker.jump.4",
  "modelPicker.jump.5",
  "modelPicker.jump.6",
  "modelPicker.jump.7",
  "modelPicker.jump.8",
  "modelPicker.jump.9",
] as const;
export type ModelPickerJumpKeybindingCommand =
  (typeof MODEL_PICKER_JUMP_KEYBINDING_COMMANDS)[number];

export const THREAD_KEYBINDING_COMMANDS = [
  "thread.previous",
  "thread.next",
  ...THREAD_JUMP_KEYBINDING_COMMANDS,
] as const;
export type ThreadKeybindingCommand = (typeof THREAD_KEYBINDING_COMMANDS)[number];

export const MODEL_PICKER_KEYBINDING_COMMANDS = [
  "modelPicker.toggle",
  ...MODEL_PICKER_JUMP_KEYBINDING_COMMANDS,
] as const;
export type ModelPickerKeybindingCommand = (typeof MODEL_PICKER_KEYBINDING_COMMANDS)[number];

const STATIC_KEYBINDING_COMMANDS = [
  "sidebar.toggle",
  "terminal.toggle",
  "terminal.split",
  "terminal.splitVertical",
  "terminal.new",
  "terminal.close",
  "rightPanel.toggle",
  "diff.toggle",
  "preview.toggle",
  "preview.refresh",
  "preview.focusUrl",
  "preview.zoomIn",
  "preview.zoomOut",
  "preview.resetZoom",
  "commandPalette.toggle",
  "composer.stash",
  "chat.new",
  "chat.newLocal",
  "editor.openFavorite",
  ...MODEL_PICKER_KEYBINDING_COMMANDS,
  ...THREAD_KEYBINDING_COMMANDS,
] as const;

export const SCRIPT_RUN_COMMAND_PATTERN = Schema.TemplateLiteral([
  Schema.Literal("script."),
  Schema.NonEmptyString.check(
    Schema.isMaxLength(MAX_SCRIPT_ID_LENGTH),
    Schema.isPattern(/^[a-z0-9][a-z0-9-]*$/),
  ),
  Schema.Literal(".run"),
]);

export const KeybindingCommand = Schema.Union([
  Schema.Literals(STATIC_KEYBINDING_COMMANDS),
  SCRIPT_RUN_COMMAND_PATTERN,
]);
export type KeybindingCommand = typeof KeybindingCommand.Type;

export const KeybindingValue = TrimmedString.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MAX_KEYBINDING_VALUE_LENGTH),
);

export const KeybindingWhen = TrimmedString.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MAX_KEYBINDING_WHEN_LENGTH),
);
export class KeybindingRule extends Schema.Class<KeybindingRule>("KeybindingRule")({
  key: KeybindingValue,
  command: KeybindingCommand,
  when: Schema.optional(KeybindingWhen),
}) {}

export const KeybindingsConfig = Schema.Array(KeybindingRule).check(
  Schema.isMaxLength(MAX_KEYBINDINGS_COUNT),
);
export type KeybindingsConfig = typeof KeybindingsConfig.Type;

export class KeybindingShortcut extends Schema.Class<KeybindingShortcut>("KeybindingShortcut")({
  key: KeybindingValue,
  metaKey: Schema.Boolean,
  ctrlKey: Schema.Boolean,
  shiftKey: Schema.Boolean,
  altKey: Schema.Boolean,
  modKey: Schema.Boolean,
}) {}

const KeybindingWhenNodeRef = Schema.suspend(
  (): Schema.Codec<KeybindingWhenNode> => KeybindingWhenNode,
);
export class KeybindingWhenIdentifier extends Schema.Class<KeybindingWhenIdentifier>(
  "KeybindingWhenIdentifier",
)({
  type: Schema.Literal("identifier"),
  name: Schema.NonEmptyString,
}) {}

export class KeybindingWhenNot extends Schema.Class<KeybindingWhenNot>("KeybindingWhenNot")({
  type: Schema.Literal("not"),
  node: KeybindingWhenNodeRef,
}) {}

export class KeybindingWhenAnd extends Schema.Class<KeybindingWhenAnd>("KeybindingWhenAnd")({
  type: Schema.Literal("and"),
  left: KeybindingWhenNodeRef,
  right: KeybindingWhenNodeRef,
}) {}

export class KeybindingWhenOr extends Schema.Class<KeybindingWhenOr>("KeybindingWhenOr")({
  type: Schema.Literal("or"),
  left: KeybindingWhenNodeRef,
  right: KeybindingWhenNodeRef,
}) {}

export const KeybindingWhenNode = Schema.Union([
  KeybindingWhenIdentifier,
  KeybindingWhenNot,
  KeybindingWhenAnd,
  KeybindingWhenOr,
]);
export type KeybindingWhenNode =
  | KeybindingWhenIdentifier
  | KeybindingWhenNot
  | KeybindingWhenAnd
  | KeybindingWhenOr;

export class ResolvedKeybindingRule extends Schema.Class<ResolvedKeybindingRule>(
  "ResolvedKeybindingRule",
)(
  Schema.Struct({
    command: KeybindingCommand,
    shortcut: KeybindingShortcut,
    whenAst: Schema.optional(KeybindingWhenNode),
  }).annotate({ parseOptions: { onExcessProperty: "ignore" } }),
) {}

export const ResolvedKeybindingsConfig = Schema.Array(ResolvedKeybindingRule).check(
  Schema.isMaxLength(MAX_KEYBINDINGS_COUNT),
);
export type ResolvedKeybindingsConfig = typeof ResolvedKeybindingsConfig.Type;

export class KeybindingsConfigError extends Schema.TaggedErrorClass<KeybindingsConfigError>()(
  "KeybindingsConfigParseError",
  {
    configPath: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message(): string {
    return `Unable to parse keybindings config at ${this.configPath}: ${this.detail}`;
  }
}
