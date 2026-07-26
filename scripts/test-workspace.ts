#!/usr/bin/env node

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { HostProcessEnvironment } from "@t3tools/shared/hostProcess";
import { resolveSpawnCommand } from "@t3tools/shared/shell";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Schema from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { ChildProcess } from "effect/unstable/process";

const DEFAULT_PACKAGE_CONCURRENCY = 2;
const DEFAULT_PACKAGE_MAX_WORKERS = 2;

export type WorkspaceTestLaneName = "server" | "workspace";

export interface WorkspaceTestInput {
  readonly excludeMobile: boolean;
  readonly packageConcurrency: number;
  readonly packageMaxWorkers: number;
}

export interface WorkspaceTestLane {
  readonly name: WorkspaceTestLaneName;
  readonly args: ReadonlyArray<string>;
}

export type WorkspaceTestLaneOutcome =
  | {
      readonly lane: WorkspaceTestLaneName;
      readonly exitCode: number;
    }
  | {
      readonly lane: WorkspaceTestLaneName;
      readonly error: string;
    };

export type WorkspaceTestLaneRunner<R = never> = (
  lane: WorkspaceTestLane,
) => Effect.Effect<WorkspaceTestLaneOutcome, never, R>;

export class WorkspaceTestLaneProcessError extends Schema.TaggedErrorClass<WorkspaceTestLaneProcessError>()(
  "WorkspaceTestLaneProcessError",
  {
    lane: Schema.Literals(["server", "workspace"]),
    operation: Schema.Literals(["resolve-command", "spawn", "wait-for-exit"]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Workspace test ${this.lane} lane failed to ${this.operation}.`;
  }
}

export class WorkspaceTestRunError extends Schema.TaggedErrorClass<WorkspaceTestRunError>()(
  "WorkspaceTestRunError",
  {
    failures: Schema.Array(Schema.String),
  },
) {
  override get message(): string {
    return `Workspace tests failed:\n${this.failures.map((failure) => `- ${failure}`).join("\n")}`;
  }
}

export function createWorkspaceTestPlan(
  input: WorkspaceTestInput,
): ReadonlyArray<WorkspaceTestLane> {
  const workspaceFilters = input.excludeMobile
    ? ["--filter=!t3", "--filter=!@t3tools/mobile"]
    : ["--filter=!t3"];

  return [
    {
      name: "server",
      args: ["run", "--filter=t3", "test"],
    },
    {
      name: "workspace",
      args: [
        "run",
        "--recursive",
        "--parallel",
        `--concurrency-limit=${input.packageConcurrency}`,
        ...workspaceFilters,
        "test",
        `--maxWorkers=${input.packageMaxWorkers}`,
      ],
    },
  ];
}

export function getWorkspaceTestFailures(
  outcomes: ReadonlyArray<WorkspaceTestLaneOutcome>,
): ReadonlyArray<string> {
  return outcomes.flatMap((outcome) => {
    if ("error" in outcome) {
      return [`${outcome.lane}: ${outcome.error}`];
    }
    return outcome.exitCode === 0 ? [] : [`${outcome.lane}: exited with code ${outcome.exitCode}`];
  });
}

const runWorkspaceTestLane = Effect.fn("test-workspace.runLane")(function* (
  lane: WorkspaceTestLane,
  env: NodeJS.ProcessEnv,
) {
  yield* Effect.logInfo(`[workspace-tests] starting ${lane.name} lane`);

  const spawnCommand = yield* resolveSpawnCommand("vp", lane.args, { env }).pipe(
    Effect.mapError(
      (cause) =>
        new WorkspaceTestLaneProcessError({
          lane: lane.name,
          operation: "resolve-command",
          cause,
        }),
    ),
  );

  const child = yield* ChildProcess.make(spawnCommand.command, spawnCommand.args, {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env,
    extendEnv: false,
    shell: spawnCommand.shell,
    detached: false,
    forceKillAfter: "1500 millis",
  }).pipe(
    Effect.mapError(
      (cause) =>
        new WorkspaceTestLaneProcessError({
          lane: lane.name,
          operation: "spawn",
          cause,
        }),
    ),
  );

  const exitCode = yield* child.exitCode.pipe(
    Effect.mapError(
      (cause) =>
        new WorkspaceTestLaneProcessError({
          lane: lane.name,
          operation: "wait-for-exit",
          cause,
        }),
    ),
  );

  return {
    lane: lane.name,
    exitCode: Number(exitCode),
  } satisfies WorkspaceTestLaneOutcome;
});

function runWorkspaceTestLaneSafely(lane: WorkspaceTestLane, env: NodeJS.ProcessEnv) {
  return runWorkspaceTestLane(lane, env).pipe(
    Effect.catch((error) =>
      Effect.succeed({
        lane: lane.name,
        error: error.message,
      } satisfies WorkspaceTestLaneOutcome),
    ),
  );
}

export const runWorkspaceTestsWith = Effect.fn("test-workspace.run")(function* <R>(
  input: WorkspaceTestInput,
  runLane: WorkspaceTestLaneRunner<R>,
) {
  const outcomes = yield* Effect.forEach(createWorkspaceTestPlan(input), runLane, {
    concurrency: "unbounded",
  });
  const failures = getWorkspaceTestFailures(outcomes);

  if (failures.length > 0) {
    return yield* new WorkspaceTestRunError({ failures: [...failures] });
  }

  yield* Effect.logInfo("[workspace-tests] all lanes passed");
});

export const runWorkspaceTests = Effect.fn("test-workspace.runFromCli")(function* (
  input: WorkspaceTestInput,
) {
  const env = yield* HostProcessEnvironment;
  return yield* runWorkspaceTestsWith(input, (lane) => runWorkspaceTestLaneSafely(lane, env));
});

const positiveInteger = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

const workspaceTestCli = Command.make("test-workspace", {
  excludeMobile: Flag.boolean("exclude-mobile").pipe(
    Flag.withDescription("Exclude @t3tools/mobile from the non-server test lane."),
    Flag.withDefault(false),
  ),
  packageConcurrency: Flag.integer("package-concurrency").pipe(
    Flag.withSchema(positiveInteger),
    Flag.withDescription("Maximum number of non-server package test tasks to run concurrently."),
    Flag.withDefault(DEFAULT_PACKAGE_CONCURRENCY),
  ),
  packageMaxWorkers: Flag.integer("package-max-workers").pipe(
    Flag.withSchema(positiveInteger),
    Flag.withDescription("Maximum Vitest workers passed to each non-server package test task."),
    Flag.withDefault(DEFAULT_PACKAGE_MAX_WORKERS),
  ),
}).pipe(
  Command.withDescription(
    "Run server and resource-bounded non-server workspace test lanes concurrently.",
  ),
  Command.withHandler(runWorkspaceTests),
);

const cliRuntimeLayer = Layer.mergeAll(Logger.layer([Logger.consolePretty()]), NodeServices.layer);

if (import.meta.main) {
  Command.run(workspaceTestCli, { version: "0.0.0" }).pipe(
    Effect.scoped,
    Effect.provide(cliRuntimeLayer),
    NodeRuntime.runMain,
  );
}
