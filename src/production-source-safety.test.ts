import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { findUnsafeProductionSource } from "./test/source-safety.test-utils";

const sourceRoot = path.resolve(import.meta.dirname);

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "test") {
        return [];
      }

      return productionSourceFiles(absolutePath);
    }

    if (!/\.tsx?$/.test(entry.name) || /\.test(?:-d)?\.tsx?$/.test(entry.name)) {
      return [];
    }

    return [absolutePath];
  });
}

describe("production source safety", () => {
  it("detects a forbidden animal symbol in supplied source", () => {
    expect(findUnsafeProductionSource("const avatar = '🐯';")).toEqual([
      "animal emoji 🐯",
    ]);
  });

  it("detects unsafe HTML injection APIs in supplied source", () => {
    expect(
      findUnsafeProductionSource(
        "node.innerHTML = html; return { dangerouslySetInnerHTML: html };",
      ),
    ).toEqual([
      "HTML injection API dangerouslySetInnerHTML",
      "HTML injection API .innerHTML",
    ]);
  });

  it("keeps production TypeScript free of animal emoji and HTML injection", () => {
    const violations = productionSourceFiles(sourceRoot).flatMap((filePath) =>
      findUnsafeProductionSource(readFileSync(filePath, "utf8")).map(
        (violation) => `${path.relative(sourceRoot, filePath)}: ${violation}`,
      ),
    );

    expect(violations).toEqual([]);
  });
});
