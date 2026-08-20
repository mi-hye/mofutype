import { expect, test } from "@playwright/test";

import { createGroup, joinGroup } from "./helpers";

test("three independent members share one unlocked relationship", async ({ browser, page: pageA }, testInfo) => {
  const contextB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const contextC = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();

  try {
    await createGroup(pageA, "放課後チーム", "Aさん");
    const inviteUrl = pageA.url();
    await joinGroup(pageB, inviteUrl, "Bさん", "1992-08-20", null);
    await joinGroup(pageC, inviteUrl, "Cさん", "1998-11-03", "INFP");

    for (const page of [pageA, pageB, pageC]) {
      await expect(page.getByText("メンバー 3人")).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(".react-flow__node")).toHaveCount(3, { timeout: 15_000 });
      await expect(page.locator(".react-flow__edge")).toHaveCount(3, { timeout: 15_000 });
      await expect(page.getByRole("group", { name: "関係線を色で絞り込む" })).toBeVisible();
      await expect(page.locator(".zodiac-graph-node__frame")).toHaveCount(3, { timeout: 15_000 });
    }
    await expect(pageA.locator(".zodiac-graph-node__character-title", {
      hasText: "好奇心のまま駆け出すいのしし",
    })).toHaveCount(1);
    await expect(pageA.locator(".zodiac-graph-node__character-title", {
      hasText: "さるタイプ",
    })).toHaveCount(1);
    await pageA.screenshot({
      path: testInfo.outputPath("group-graph.png"),
      fullPage: true,
    });

    await pageA.locator(".react-flow__node", { hasText: "Aさん" }).click();
    await expect(pageA.locator('.zodiac-graph-node[data-selected="true"]')).toHaveCount(1);
    await pageA.locator(".group-graph__canvas").screenshot({
      path: testInfo.outputPath("selected-node.png"),
    });
    await pageA.getByRole("button", { name: /^AさんとBさんの関係を見る/ }).focus();
    await pageA.keyboard.press("Enter");
    await expect(pageA.locator(".relation-sheet").getByText("FREE PREVIEW", { exact: true })).toBeVisible();
    await expect(pageA.getByRole("heading", { name: /関係です$/ })).toBeVisible();
    await pageA.screenshot({
      path: testInfo.outputPath("locked-relation.png"),
      fullPage: true,
    });
    await pageA.getByRole("link", { name: "この関係を詳しく見る 100円" }).click();
    await expect(pageA.getByText("これはモック決済です。実際の請求は発生しません。")).toBeVisible();
    await expect(pageA.getByText("合計 100円", { exact: true })).toBeVisible();
    await expect(pageA.getByText("定期課金や自動更新はありません", { exact: true })).toBeVisible();
    await expect(pageA.getByText(
      "決済完了後、このふたりの関係レポートをすぐに表示します",
      { exact: true },
    )).toBeVisible();
    await expect(pageA.getByRole("link", { name: "関係ページに戻る" })).toBeVisible();
    await pageA.screenshot({
      path: testInfo.outputPath("checkout.png"),
      fullPage: true,
    });
    await pageA.getByRole("button", { name: "モック決済を完了" }).click();
    await expect(pageA.getByText("解放済み")).toBeVisible();
    await expect(pageA.locator(".relation-sheet").getByText("UNLOCKED REPORT", { exact: true })).toBeVisible();
    await expect(pageA.locator(".relation-sheet").getByText("FREE PREVIEW", { exact: true })).toHaveCount(0);
    for (const heading of [
      "十二支の関係",
      "五行と陰陽",
      "MBTIの4つの軸",
      "ふたりでいるとき",
    ]) {
      await expect(pageA.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(pageA.getByText(
      "MBTIが未入力のため、この層は表示していません。十二支と五行の分析には影響しません。",
    )).toBeVisible();
    const mobileReportLayout = await pageA.locator(".relation-sheet").evaluate((sheet) => {
      const bounds = sheet.getBoundingClientRect();
      const textBlocks = [...sheet.querySelectorAll(".relation-sheet__details p, .relation-sheet__details dd")];
      return {
        fitsViewport: bounds.left >= 0 && bounds.right <= window.innerWidth,
        textFitsCards: textBlocks.every((block) => block.scrollWidth <= block.clientWidth),
      };
    });
    expect(mobileReportLayout).toEqual({ fitsViewport: true, textFitsCards: true });
    await pageA.screenshot({
      path: testInfo.outputPath("unlocked-relation.png"),
      fullPage: true,
    });

    for (const page of [pageB, pageC]) {
      await page.getByRole("button", { name: "Aさんを選択" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("button", {
        name: /^AさんとBさんの関係を見る.*解放済み/,
      })).toBeVisible();
    }
  } finally {
    await Promise.all([contextB.close(), contextC.close()]);
  }
});
