import * as Schema from "effect/Schema";

import { PortSchema } from "./baseSchemas.ts";

export class DesktopBackendBootstrap extends Schema.Class<DesktopBackendBootstrap>(
  "DesktopBackendBootstrap",
)({
  mode: Schema.Literal("desktop"),
  noBrowser: Schema.Boolean,
  port: PortSchema,
  // Omitted when the desktop launches the backend inside WSL, since the
  // Windows-side baseDir maps to /mnt/c/... and the Linux side should use its
  // own home directory instead.
  t3Home: Schema.optional(Schema.String),
  host: Schema.String,
  desktopBootstrapToken: Schema.String,
  tailscaleServeEnabled: Schema.Boolean,
  tailscaleServePort: PortSchema,
  otlpTracesUrl: Schema.optional(Schema.String),
  otlpMetricsUrl: Schema.optional(Schema.String),
}) {
  /** The envelope crosses the desktop -> backend boundary as a JSON string. */
  static readonly Json = Schema.fromJsonString(this);
  static readonly decodeJson = Schema.decodeEffect(this.Json);
  static readonly encodeJson = Schema.encodeEffect(this.Json);
}
