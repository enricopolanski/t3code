import { assert, describe, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

import {
  createWorkspaceTestPlan,
  runWorkspaceTestsWith,
  type WorkspaceTestInput,
  WorkspaceTestLaneProcessError,
  type WorkspaceTestLaneOutcome,
} from "./test-workspace.ts";

const defaultInput: WorkspaceTestInput = {
  excludeMobile: false,
  packageConcurrency: 2,
  packageMaxWorkers: 2,
};

describe("createWorkspaceTestPlan", () => {
  it.effect("starts a dedicated server lane and a bounded parallel workspace lane", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(createWorkspaceTestPlan(defaultInput), [
        {
          name: "server",
          args: ["run", "--filter=t3", "test"],
        },
        {
          name: "workspace",
          args: [
            "run",
            "--parallel",
            "--concurrency-limit=2",
            "--filter=./apps/*",
            "--filter=./infra/*",
            "--filter=./packages/*",
            "--filter=./oxlint-plugin-t3code",
            "--filter=./scripts",
            "--filter=!t3",
            "test",
            "--maxWorkers=2",
          ],
        },
      ]);
    }),
  );

  it.effect("can preserve gate.sh's mobile exclusion", () =>
    Effect.sync(() => {
      const [, workspaceLane] = createWorkspaceTestPlan({
        ...defaultInput,
        excludeMobile: true,
      });

      assert.deepStrictEqual(workspaceLane?.args, [
        "run",
        "--parallel",
        "--concurrency-limit=2",
        "--filter=./apps/*",
        "--filter=./infra/*",
        "--filter=./packages/*",
        "--filter=./oxlint-plugin-t3code",
        "--filter=./scripts",
        "--filter=!t3",
        "--filter=!@t3tools/mobile",
        "test",
        "--maxWorkers=2",
      ]);
    }),
  );
});

describe("runWorkspaceTestsWith", () => {
  it.effect("starts both lanes and fails as soon as one lane fails", () =>
    Effect.gen(function* () {
      const started = yield* Ref.make<ReadonlyArray<string>>([]);
      const bothStarted = yield* Deferred.make<void>();

      const outcomeByLane = {
        server: new WorkspaceTestLaneProcessError({
          lane: "server",
          operation: "spawn",
          command: ["vp", "run", "--filter=t3", "test"],
          exitCode: -1,
          cause: new Error("could not spawn"),
        }),
        workspace: { lane: "workspace", exitCode: 0 },
      } as const satisfies Record<string, WorkspaceTestLaneOutcome>;

      const error = yield* runWorkspaceTestsWith(defaultInput, (lane) =>
        Effect.gen(function* () {
          const lanes = yield* Ref.updateAndGet(started, (current) => [...current, lane.name]);
          if (lanes.length === 2) {
            yield* Deferred.succeed(bothStarted, undefined);
          }
          yield* Deferred.await(bothStarted);
          return lane.name === "server" ? yield* outcomeByLane.server : outcomeByLane.workspace;
        }),
      ).pipe(Effect.flip);

      assert.deepStrictEqual(yield* Ref.get(started), ["server", "workspace"]);
      assert.equal(error.lane, "server");
      assert.equal(error.operation, "spawn");
      assert.match(error.message, /could not spawn/);
    }),
  );
});
