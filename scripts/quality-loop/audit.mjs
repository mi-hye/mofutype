import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const baseUrl = process.env.QUALITY_BASE_URL ?? "http://127.0.0.1:3110";
const outputDirectory = path.resolve(
  process.env.QUALITY_OUTPUT_DIR ?? ".quality-loop/current",
);

const viewports = [
  { name: "mobile-320", width: 320, height: 720 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1280", width: 1280, height: 900 },
];

const requiredCopy = [
  "わたしたち、こんな感じ。",
  "グループを作る",
  "まずは無料で、みんなの輪郭まで。",
  "0円",
  "1組 300円",
  "関係レポートの表示イメージ",
  "このサンプルは表示イメージです。内容はふたりの組み合わせによって変わります。",
  "無料でグループを作る",
  "始める前に、気になること。",
];

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});
const results = [];
let fatalError = null;

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const responseErrors = [];

    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().startsWith("Failed to load resource:")
      ) {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        !new URL(response.url()).pathname.endsWith("/favicon.ico")
      ) {
        responseErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });

      const copyChecks = Object.fromEntries(
        await Promise.all(requiredCopy.map(async (copy) => [
          copy,
          await page.getByText(copy, { exact: true }).first().isVisible(),
        ])),
      );

      const primaryCta = page.getByRole("link", { name: "グループを作る", exact: true });
      const secondaryCta = page.getByRole("link", {
        name: "無料でグループを作る",
        exact: true,
      });
      const faqSummary = page.getByText("何人まで使える？", { exact: true });

      await faqSummary.click();
      const faqAnswerVisible = await page.getByText(
        "1グループ30人まで。友だち同士でも、サークルやチームでも使えます。",
        { exact: true },
      ).isVisible();

      const layout = await page.evaluate(() => {
        const root = document.documentElement;
        const cta = document.querySelector(".hero__cta");
        const secondaryCta = document.querySelector(".value-ledger__cta");
        const ledger = document.querySelector(".value-ledger");
        const reportPreview = document.querySelector(".report-preview__paper");
        const rect = (element) => element?.getBoundingClientRect() ?? null;
        const rectData = (element) => {
          const bounds = rect(element);
          return bounds ? {
            left: bounds.left,
            right: bounds.right,
            width: bounds.width,
            height: bounds.height,
          } : null;
        };

        return {
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
          primaryCta: rectData(cta),
          secondaryCta: rectData(secondaryCta),
          ledger: rectData(ledger),
          reportPreview: rectData(reportPreview),
        };
      });

      const withinViewport = (bounds) => Boolean(
        bounds &&
        bounds.left >= -0.5 &&
        bounds.right <= layout.clientWidth + 0.5,
      );

      const checks = {
        allRequiredCopyVisible: Object.values(copyChecks).every(Boolean),
        noHorizontalOverflow: layout.scrollWidth <= layout.clientWidth,
        primaryCtaTarget: await primaryCta.getAttribute("href") === "/create/profile",
        secondaryCtaTarget: await secondaryCta.getAttribute("href") === "/create/profile",
        primaryCtaTouchTarget: (layout.primaryCta?.height ?? 0) >= 44,
        secondaryCtaTouchTarget: (layout.secondaryCta?.height ?? 0) >= 44,
        primaryCtaWithinViewport: withinViewport(layout.primaryCta),
        secondaryCtaWithinViewport: withinViewport(layout.secondaryCta),
        pricingWithinViewport: withinViewport(layout.ledger),
        reportPreviewWithinViewport: withinViewport(layout.reportPreview),
        faqAnswerVisible,
        noConsoleErrors: consoleErrors.length === 0,
        noPageErrors: pageErrors.length === 0,
        noResponseErrors: responseErrors.length === 0,
      };

      await page.screenshot({
        path: path.join(outputDirectory, `${viewport.name}.png`),
        fullPage: true,
      });

      await page.goto(new URL("/create/profile", baseUrl).toString(), {
        waitUntil: "networkidle",
      });
      const profileLayout = await page.evaluate(() => {
        const root = document.documentElement;
        const controlBounds = [...document.querySelectorAll(
          'input[type="text"], input[type="date"], input[type="time"], select',
        )].map((control) => {
          const bounds = control.getBoundingClientRect();
          return {
            type: control.getAttribute("type") ?? control.tagName.toLowerCase(),
            left: bounds.left,
            right: bounds.right,
            width: bounds.width,
          };
        });
        return {
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
          controlBounds,
        };
      });
      const controlsWithinViewport = profileLayout.controlBounds.length >= 5 &&
        profileLayout.controlBounds.every((bounds) =>
          bounds.left >= -0.5 && bounds.right <= profileLayout.clientWidth + 0.5
        );
      const profileChecks = {
        noHorizontalOverflow: profileLayout.scrollWidth <= profileLayout.clientWidth,
        controlsWithinViewport,
        nativeDatePresent: await page.locator('input[type="date"]').count() === 1,
        nativeTimePresent: await page.locator('input[type="time"]').count() === 1,
        realUnknownCheckboxesPresent: await page.locator('input[type="checkbox"]').count() === 2,
      };
      await page.screenshot({
        path: path.join(outputDirectory, `${viewport.name}-profile.png`),
        fullPage: true,
      });

      await page.goto(new URL("/tokushoho", baseUrl).toString(), {
        waitUntil: "networkidle",
      });
      const legalLayout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      const legalChecks = {
        noHorizontalOverflow: legalLayout.scrollWidth <= legalLayout.clientWidth,
        developmentDisclosureVisible: await page.getByText(
          "このページは開発用の仮表示です。実際の決済を開始する前に、正式な事業者情報へ必ず更新してください。",
          { exact: true },
        ).isVisible(),
        paymentDisclosureVisible: await page.getByText(
          /現在はモック決済のみで、実際の請求は発生しません/,
        ).isVisible(),
      };
      await page.screenshot({
        path: path.join(outputDirectory, `${viewport.name}-legal.png`),
        fullPage: true,
      });

      checks.profilePagePassed = Object.values(profileChecks).every(Boolean);
      checks.legalPagePassed = Object.values(legalChecks).every(Boolean);
      checks.noConsoleErrors = consoleErrors.length === 0;
      checks.noPageErrors = pageErrors.length === 0;
      checks.noResponseErrors = responseErrors.length === 0;

      results.push({
        viewport,
        passed: Object.values(checks).every(Boolean),
        checks,
        copyChecks,
        layout,
        profileLayout,
        profileChecks,
        legalLayout,
        legalChecks,
        consoleErrors,
        pageErrors,
        responseErrors,
      });
    } finally {
      await context.close();
    }
  }
} catch (error) {
  fatalError = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  passed: fatalError === null && results.length === viewports.length &&
    results.every((result) => result.passed),
  fatalError,
  results,
};

await writeFile(
  path.join(outputDirectory, "audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

process.stdout.write(`${JSON.stringify(report)}\n`);
process.exitCode = report.passed ? 0 : 1;
