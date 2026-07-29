import { describe, expect, it } from "vite-plus/test";

import { TextGenerationPolicy } from "./TextGenerationPolicy.ts";
import {
  conventionalCommitsTextGenerationPolicy,
  customTextGenerationPolicy,
  defaultTextGenerationPolicy,
  repositoryConventionsTextGenerationPolicy,
} from "./TextGenerationPresets.ts";

describe("TextGenerationPresets", () => {
  it("constructs every preset as a TextGenerationPolicy", () => {
    const customPolicy = customTextGenerationPolicy({
      commitInstructions: "Use a custom commit style.",
      inferRepositoryConventions: true,
    });

    for (const policy of [
      defaultTextGenerationPolicy,
      conventionalCommitsTextGenerationPolicy,
      repositoryConventionsTextGenerationPolicy,
      customPolicy,
    ]) {
      expect(policy).toBeInstanceOf(TextGenerationPolicy);
    }

    expect(customPolicy).toEqual(
      new TextGenerationPolicy({
        kind: "custom",
        commitInstructions: "Use a custom commit style.",
        inferRepositoryConventions: true,
      }),
    );
  });
});
