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

    if (!/\.(?:tsx?|css)$/.test(entry.name) || /\.test(?:-d)?\.tsx?$/.test(entry.name)) {
      return [];
    }

    return [absolutePath];
  });
}

describe("production source safety", () => {
  it("defines the Kawaii Zine tokens and reduced-motion fallback", () => {
    const globalStyles = readFileSync(path.join(sourceRoot, "app/globals.css"), "utf8");

    expect(globalStyles).toContain("--hot-pink:");
    expect(globalStyles).toContain("--mint-pop:");
    expect(globalStyles).toContain("--shadow-zine:");
    expect(globalStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("detects a forbidden animal symbol in supplied source", () => {
    expect(findUnsafeProductionSource("const avatar = '🐯';")).toEqual([
      "animal emoji 🐯",
    ]);
  });

  it("detects a forbidden animal symbol in supplied CSS", () => {
    expect(findUnsafeProductionSource('.avatar::after { content: "🦁"; }')).toEqual([
      "animal emoji 🦁",
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
