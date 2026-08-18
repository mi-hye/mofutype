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
      await expect(page.locator(".react-flow__node")).toHaveCount(3);
      await expect(page.locator(".react-flow__edge")).toHaveCount(3);
      await expect(page.locator(".react-flow__edge-text")).toHaveCount(3);
      await expect(page.getByTestId("zodiac-avatar")).toHaveCount(3);
    }
    await expect(pageA.locator(".zodiac-graph-node__character-title", {
      hasText: "好奇心のまま駆け出すいのしし",
    })).toBeVisible();
    await expect(pageA.locator(".zodiac-graph-node__character-title", {
      hasText: "さるタイプ",
    })).toBeVisible();

    await pageA.getByRole("button", { name: "Aさんを選択" }).click();
    await pageA.getByRole("button", { name: /^AさんとBさんの関係を見る/ }).click();
    await expect(pageA.getByRole("heading", { name: "解放するとわかること" })).toBeVisible();
    for (const chapter of [
      "十二支の関係",
      "五行と陰陽",
      "MBTIの4つの軸",
      "ふたりでいるとき",
      "それぞれへのヒント",
    ]) {
      await expect(pageA.getByText(chapter, { exact: true })).toBeVisible();
    }
    await pageA.screenshot({
      path: testInfo.outputPath("locked-relation.png"),
      fullPage: true,
    });
    await pageA.getByRole("link", { name: "このふたりを300円で解放" }).click();
    await expect(pageA.getByText("これはモック決済です。実際の請求は発生しません。")).toBeVisible();
    await expect(pageA.getByText("合計 300円", { exact: true })).toBeVisible();
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

    for (const page of [pageB, pageC]) {
      await page.getByRole("button", { name: "Aさんを選択" }).click();
      await expect(page.getByRole("button", {
        name: /^AさんとBさんの関係を見る.*解放済み/,
      })).toBeVisible();
    }
  } finally {
    await Promise.all([contextB.close(), contextC.close()]);
  }
});
