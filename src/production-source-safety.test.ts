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

function designStyles(): string {
  return ["design-system.css", "globals.css"]
    .map((fileName) => readFileSync(path.join(sourceRoot, "app", fileName), "utf8"))
    .join("\n");
}

describe("production source safety", () => {
  it("defines the warm Mofu design tokens and reduced-motion fallback", () => {
    const globalStyles = designStyles();
    const squiggleFilters = readFileSync(
      path.join(sourceRoot, "components/ui/squiggle-filters.tsx"),
      "utf8",
    );

    expect(globalStyles).toContain("--color-paper: #f7ecdc");
    expect(globalStyles).toContain("--color-blush: #f1d1ca");
    expect(globalStyles).toContain("--color-ink: #4f312b");
    expect(globalStyles).toContain("--action-primary:");
    expect(globalStyles).toContain("--border-subtle:");
    expect(globalStyles).toContain("--shadow-pop:");
    expect(globalStyles).toContain('background-image: none');
    expect(globalStyles).toContain("--button-border-color: #4a2e2b");
    expect(globalStyles).toContain(
      "--button-background: radial-gradient(circle, #fff5f2 0%, #f7ede2 100%)",
    );
    expect(globalStyles).toContain(
      "--button-background-hover: var(--button-background)",
    );
    expect(globalStyles).not.toContain("animation: squigglevision");
    expect(globalStyles).not.toContain("@keyframes squigglevision");
    expect(globalStyles).toMatch(/\.ui-button::before[^}]*animation:\s*none[^}]*filter:\s*none/);
    for (const filterId of ["squiggle-1", "squiggle-2", "squiggle-3", "squiggle-4"]) {
      expect(squiggleFilters).not.toContain(`id="${filterId}"`);
    }
    expect(squiggleFilters).toContain("[0, 1, 2, 3, 4].map((seed)");
    expect(squiggleFilters).toContain("id={`text-squiggly-${seed}`}");
    expect(squiggleFilters).toContain('baseFrequency="0.02"');
    expect(squiggleFilters).toContain("scale={5}");
    expect(globalStyles).toMatch(/\.hero h1[^}]*animation:\s*hero-squiggly 0\.3s infinite linear/);
    expect(globalStyles).toContain("@keyframes hero-squiggly");
    expect(globalStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.hero h1\s*\{[^}]*animation:\s*none !important[^}]*filter:\s*none/);
    expect(squiggleFilters).not.toContain('id="wrinkle-effect"');
    expect(squiggleFilters).not.toContain('id="node-wrinkle-effect"');
    expect(globalStyles).toMatch(/\.ui-button\[data-variant="secondary"\]::before[^}]*filter:\s*none/);
    expect(globalStyles).toMatch(/\.ui-button:not\(:disabled\):hover\s*\{[^}]*transform:\s*translateY\(-2px\)/);
    expect(globalStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalStyles).toContain('.animal-avatar[data-selected="true"]');
    expect(globalStyles).toMatch(
      /\.animal-avatar\[data-selected="true"\][^{]*\{[^}]*box-shadow:\s*[^;]*var\(--accent-navy\)/,
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
    const globalStyles = designStyles();

    for (const token of [
      "--paper-warm:",
      "--accent-coral:",
      "--border-subtle:",
      "--shadow-soft:",
      "--content-wide:",
    ]) {
      expect(globalStyles).toContain(token);
    }

    expect(globalStyles).toContain("@media (max-width: 23rem)");
    expect(globalStyles).toContain("@media (min-width: 64rem)");
    expect(globalStyles).toContain("@media (forced-colors: active)");
    expect(globalStyles).toContain(
      ".group-member-header:not(:has(.status-banner)) .group-member-actions",
    );
  });

  it("defines warm Mofu contracts for relationship and checkout surfaces", () => {
    const globalStyles = designStyles();

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
      ".my-result-card {",
    ]) {
      expect(globalStyles).toContain(selector);
    }
    expect(globalStyles).toContain(".group-graph__accessible:focus-within");
    expect(globalStyles).toMatch(/\.my-result-card\s*\{[^}]*margin-top:/);
  });

  it("keeps the profile step compact without replacing native controls", () => {
    const globalStyles = designStyles();

    expect(globalStyles).toContain(".profile-step .ui-card {");
    expect(globalStyles).toContain("max-width: 38rem;");
    expect(globalStyles).toContain(
      ".profile-step .unknown-toggle { min-height: 34px;",
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
    const globalStyles = designStyles();
    const cream = colorToken(globalStyles, "--cream");

    expect(contrastRatio(colorToken(globalStyles, "--edge-hot-pink"), cream))
      .toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colorToken(globalStyles, "--edge-mint"), cream))
      .toBeGreaterThanOrEqual(3);
    for (const relationshipColor of [
      "--relationship-warm",
      "--relationship-clear",
      "--relationship-calm",
    ]) {
      expect(contrastRatio(colorToken(globalStyles, relationshipColor), cream))
        .toBeGreaterThanOrEqual(3);
    }
    expect(globalStyles).toContain("stroke: var(--edge-hot-pink)");
    expect(globalStyles).toContain("stroke: var(--edge-mint)");
  });

  it("keeps a mobile-first relationship preview without hiding document overflow", () => {
    const globalStyles = designStyles();
    const pageSource = readFileSync(path.join(sourceRoot, "app/page.tsx"), "utf8");
    const previewSource = readFileSync(
      path.join(sourceRoot, "features/landing/landing-relationship-preview.tsx"),
      "utf8",
    );
    const startFormSource = readFileSync(
      path.join(sourceRoot, "features/onboarding/start-group-form.tsx"),
      "utf8",
    );

    expect(globalStyles).not.toContain("min-width: 320px");
    expect(globalStyles).not.toContain("overflow-x: hidden");
    for (const selector of [
      ".hero__tape {",
      ".hero__dots {",
      ".hero__stripe {",
    ]) expect(globalStyles).toContain(selector);
    expect(globalStyles).toMatch(/\.hero__decor\s*\{[^}]*order:\s*3/);
    expect(globalStyles).toMatch(/\.hero__decor\s*\{[^}]*background-image:\s*none/);
    expect(globalStyles).toMatch(/\.hero\s*\{[^}]*box-shadow:\s*none/);
    expect(globalStyles).toMatch(/\.landing-nav[^}]*justify-content:\s*center/);
    expect(globalStyles).toMatch(/\.start-group-form > \.ui-button[^}]*min-width:\s*5\.75rem[^}]*min-height:\s*44px[^}]*justify-self:\s*start/);
    expect(globalStyles).toMatch(/\.start-group-form > \.ui-button::before[^}]*border-width:\s*2px/);
    expect(globalStyles).toMatch(/\.start-group-form \.field-error[^}]*border:\s*0[^}]*padding:\s*0[^}]*background:\s*transparent/);
    expect(globalStyles).toMatch(/\.hero\s*\{[^}]*margin:\s*calc\(2\.75rem - 12px\) auto 0/);
    expect(startFormSource).not.toContain("start-group-form__note");
    expect(startFormSource).not.toContain("グループはプロフィール入力のあとに作成されます。");
    expect(globalStyles).toContain(".hero__connectors line");
    expect(pageSource).toContain("<LandingRelationshipPreview />");
    expect(previewSource).toContain('className="hero__connectors"');
    expect(previewSource.match(/className: "hero__connector--/g)).toHaveLength(3);
    expect(previewSource).toContain('aria-pressed={selected}');
    expect(pageSource).toContain("#12干支");
    expect(globalStyles).toMatch(/\.hero__stickers[^}]*align-items:\s*center/);
    expect(globalStyles).toMatch(/\.hero__stickers span[^}]*display:\s*flex[^}]*min-height:\s*2\.125rem[^}]*align-items:\s*center[^}]*line-height:\s*1/);
    expect(pageSource).not.toContain("#動物うらない");
    expect(pageSource).not.toContain("性格タイプ × 動物キャラクター");
    for (const animalImage of ["tiger.png", "rat.png", "rabbit.png"]) {
      expect(previewSource).toContain(`/zodiac/${animalImage}`);
    }
    for (const token of [
      "--animal-tiger-pastel",
      "--animal-rat-pastel",
      "--animal-rabbit-pastel",
      "--animal-tiger-border",
      "--animal-rat-border",
      "--animal-rabbit-border",
    ]) expect(globalStyles).toContain(token);
    expect(globalStyles).toContain("--relationship-warm: #b87716");
    expect(globalStyles).toMatch(/\.hero__node-frame::before[^}]*border:\s*2px solid var\(--surface-elevated\)[^}]*filter:\s*none/);
    expect(globalStyles).toMatch(/\.hero__node-type[^}]*top:\s*calc\(0\.68rem \+ 1px\)/);
    expect(globalStyles).toMatch(/\.hero__tape \.hero__node-frame::before[^}]*background:\s*var\(--animal-tiger-pastel\)/);
    expect(globalStyles).toContain("border-color: var(--animal-tiger-border)");
    expect(globalStyles).toContain("border-color: var(--animal-rat-border)");
    expect(globalStyles).toContain("border-color: var(--animal-rabbit-border)");
    expect(globalStyles).toMatch(/\.hero__node\[aria-pressed="true"\] \.hero__node-frame::before[^}]*box-shadow:\s*0 12px 24px/);
    expect(globalStyles).not.toMatch(/\.hero__node\[aria-pressed="true"\] \.hero__node-frame::before[^}]*0 0 0 4px/);
    expect(globalStyles).toMatch(/\.hero__connectors line[^}]*stroke-width:\s*1\.25[^}]*stroke-opacity:\s*0\.72/);
    expect(globalStyles).toMatch(/\.ui-button::before[^}]*animation:\s*none/);
    expect(globalStyles).toContain(".ui-button > span { position: relative; z-index: 1; }");
    expect(globalStyles).toContain("@keyframes float-orbit");
    expect(globalStyles).toContain("@keyframes rise-in");
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
