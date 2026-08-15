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

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi);
  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
  const [red, green, blue] = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function colorToken(styles: string, name: string): string {
  const match = styles.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!match) throw new Error(`Missing color token: ${name}`);
  return match[1];
}

describe("production source safety", () => {
  it("defines the Kawaii Zine tokens and reduced-motion fallback", () => {
    const globalStyles = readFileSync(path.join(sourceRoot, "app/globals.css"), "utf8");

    expect(globalStyles).toContain("--hot-pink:");
    expect(globalStyles).toContain("--mint-pop:");
    expect(globalStyles).toContain("--shadow-zine:");
    expect(globalStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalStyles).toContain('.animal-avatar[data-selected="true"]');
    expect(globalStyles).toMatch(
      /\.animal-avatar\[data-selected="true"\][^{]*\{[^}]*box-shadow:\s*[^;]*var\(--hot-pink\)/,
    );
    for (const variant of ["cream", "pink", "mint", "violet"]) {
      expect(globalStyles).toContain(`.ui-card[data-variant="${variant}"]`);
    }
    expect(globalStyles).toContain(
      ".relationship-edge--incident.relationship-edge--locked",
    );
    expect(globalStyles).toContain(
      ".relationship-edge--incident.relationship-edge--unlocked",
    );
  });

  it("defines role-based editorial tokens and explicit responsive contracts", () => {
    const globalStyles = readFileSync(path.join(sourceRoot, "app/globals.css"), "utf8");

    for (const token of [
      "--paper-cream:",
      "--accent-hot-pink:",
      "--ink-border:",
      "--shadow-offset:",
      "--content-wide:",
    ]) {
      expect(globalStyles).toContain(token);
    }

    expect(globalStyles).toContain("@media (max-width: 23rem)");
    expect(globalStyles).toContain("@media (min-width: 64rem)");
    expect(globalStyles).toContain("@media (forced-colors: active)");
  });

  it("defines Kawaii Zine contracts for relationship and checkout surfaces", () => {
    const globalStyles = readFileSync(path.join(sourceRoot, "app/globals.css"), "utf8");

    for (const selector of [
      ".relation-sheet {",
      ".relation-sheet__locked {",
      ".relation-sheet__details {",
      ".relation-sheet__skeleton {",
      ".checkout-panel {",
      ".checkout-panel__notice {",
      ".checkout-panel__price {",
      ".checkout-panel fieldset {",
      ".checkout-panel input[type=\"radio\"]",
    ]) {
      expect(globalStyles).toContain(selector);
    }
  });

  it("keeps the profile step compact without replacing native controls", () => {
    const globalStyles = readFileSync(path.join(sourceRoot, "app/globals.css"), "utf8");

    expect(globalStyles).toContain(".profile-step .ui-card {");
    expect(globalStyles).toContain("max-width: 38rem;");
    expect(globalStyles).toContain(
      ".profile-step .unknown-toggle { min-height: 36px;",
    );
    expect(globalStyles).toContain(
      ".profile-step .unknown-toggle input { width: 1rem; height: 1rem; }",
    );
    expect(globalStyles).toContain(
      ".profile-step .field-error { max-width: 100%; font-size: 0.75rem;",
    );
    expect(globalStyles).toContain("@media (min-width: 36rem)");
  });

  it("keeps semantic selected-edge colors visible against cream", () => {
    const globalStyles = readFileSync(path.join(sourceRoot, "app/globals.css"), "utf8");
    const cream = colorToken(globalStyles, "--cream");

    expect(contrastRatio(colorToken(globalStyles, "--edge-hot-pink"), cream))
      .toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colorToken(globalStyles, "--edge-mint"), cream))
      .toBeGreaterThanOrEqual(3);
    expect(globalStyles).toContain("stroke: var(--edge-hot-pink)");
    expect(globalStyles).toContain("stroke: var(--edge-mint)");
  });

  it("clips landing decorations locally without hiding document overflow", () => {
    const globalStyles = readFileSync(path.join(sourceRoot, "app/globals.css"), "utf8");

    expect(globalStyles).not.toContain("min-width: 320px");
    expect(globalStyles).not.toContain("overflow-x: hidden");
    expect(globalStyles).toMatch(/\.hero__decor\s*\{[^}]*overflow:\s*clip/);
    expect(globalStyles).toMatch(/\.hero__stripe\s*\{[^}]*right:\s*0;/);
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
