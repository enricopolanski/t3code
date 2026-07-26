import { assert, describe, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

import {
  createWorkspaceTestPlan,
  getWorkspaceTestFailures,
  runWorkspaceTestsWith,
  type WorkspaceTestInput,
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
            "--recursive",
            "--parallel",
            "--concurrency-limit=2",
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
        "--recursive",
        "--parallel",
        "--concurrency-limit=2",
        "--filter=!t3",
        "--filter=!@t3tools/mobile",
        "test",
        "--maxWorkers=2",
      ]);
    }),
  );
});

describe("runWorkspaceTestsWith", () => {
  it.effect("waits for both lanes and reports every failure", () =>
    Effect.gen(function* () {
      const started = yield* Ref.make<ReadonlyArray<string>>([]);
      const bothStarted = yield* Deferred.make<void>();

      const outcomeByLane = {
        server: { lane: "server", exitCode: 1 },
        workspace: { lane: "workspace", error: "could not spawn" },
      } as const satisfies Record<string, WorkspaceTestLaneOutcome>;

      const error = yield* runWorkspaceTestsWith(defaultInput, (lane) =>
        Effect.gen(function* () {
          const lanes = yield* Ref.updateAndGet(started, (current) => [...current, lane.name]);
          if (lanes.length === 2) {
            yield* Deferred.succeed(bothStarted, undefined);
          }
          yield* Deferred.await(bothStarted);
          return outcomeByLane[lane.name];
        }),
      ).pipe(Effect.flip);

      assert.deepStrictEqual(yield* Ref.get(started), ["server", "workspace"]);
      assert.deepStrictEqual(error.failures, [
        "server: exited with code 1",
        "workspace: could not spawn",
      ]);
    }),
  );
});

describe("getWorkspaceTestFailures", () => {
  it.effect("accepts successful lane outcomes", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(
        getWorkspaceTestFailures([
          { lane: "server", exitCode: 0 },
          { lane: "workspace", exitCode: 0 },
        ]),
        [],
      );
    }),
  );
});
