import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  findLegacyProductionSource,
  findUnsafeProductionSource,
} from "./test/source-safety.test-utils";

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
    expect(globalStyles).toContain('.zodiac-avatar[data-selected="true"]');
    expect(globalStyles).toMatch(
      /\.zodiac-avatar\[data-selected="true"\][^{]*\{[^}]*box-shadow:\s*[^;]*var\(--hot-pink\)/,
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

  it("detects legacy animal-model vocabulary without rejecting Five Element EARTH", () => {
    expect(findLegacyProductionSource(
      "type Old = AnimalId; const group = 'MOON'; const element = 'EARTH';",
    )).toEqual([
      "legacy type AnimalId",
      "legacy group MOON",
    ]);
  });

  it("detects every legacy dominance dynamic", () => {
    expect(findLegacyProductionSource(
      "MOON_OVER_EARTH EARTH_OVER_SUN SUN_OVER_MOON",
    )).toEqual([
      "legacy group MOON",
      "legacy group SUN",
      "legacy group EARTH_OVER",
    ]);
  });

  it("detects legacy animals that are not part of the zodiac catalog", () => {
    expect(findLegacyProductionSource(
      "wolf koala cheetah lion elephant",
    )).toEqual([
      "legacy animal wolf",
      "legacy animal koala",
      "legacy animal cheetah",
      "legacy animal lion",
      "legacy animal elephant",
    ]);
  });

  it("detects legacy animal CSS hooks", () => {
    expect(findLegacyProductionSource(
      ".animal-graph-node__nickname .animal-avatar",
    )).toEqual([
      "legacy CSS hook animal-graph-node",
      "legacy CSS hook animal-avatar",
    ]);
  });

  it("detects legacy Japanese animal presentation copy", () => {
    expect(findLegacyProductionSource(
      "動物占い 動物うらない 動物キャラクター",
    )).toEqual([
      "legacy copy 動物占い",
      "legacy copy 動物うらない",
      "legacy copy 動物キャラクター",
    ]);
  });

  it("keeps production source free of the legacy animal relationship model", () => {
    const violations = productionSourceFiles(sourceRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const sourceWithoutGeneratedComments = filePath.endsWith("database.types.ts")
        ? source
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "")
        : source;

      return findLegacyProductionSource(sourceWithoutGeneratedComments).map(
        (violation) => `${path.relative(sourceRoot, filePath)}: ${violation}`,
      );
    });

    expect(violations).toEqual([]);
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
