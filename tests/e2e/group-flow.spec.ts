import { expect, test } from "@playwright/test";

import { createGroup, joinGroup } from "./helpers";

test("three independent members share one unlocked relationship", async ({ browser, page: pageA }) => {
  const contextB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const contextC = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();

  try {
    await createGroup(pageA, "放課後チーム", "Aさん");
    const inviteUrl = pageA.url();
    await joinGroup(pageB, inviteUrl, "Bさん", "1992-08-20", "ISTJ");
    await joinGroup(pageC, inviteUrl, "Cさん", "1998-11-03", "INFP");

    for (const page of [pageA, pageB, pageC]) {
      await expect(page.getByText("メンバー 3人")).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(".react-flow__node")).toHaveCount(3);
      await expect(page.locator(".react-flow__edge")).toHaveCount(3);
    }

    await pageA.getByRole("button", { name: "Aさんを選択" }).click();
    await pageA.getByRole("button", { name: /^AさんとBさんの関係を見る/ }).click();
    await pageA.getByRole("link", { name: "このふたりを300円で解放" }).click();
    await expect(pageA.getByText("これはモック決済です。実際の請求は発生しません。")).toBeVisible();
    await pageA.getByRole("button", { name: "モック決済を完了" }).click();
    await expect(pageA.getByText("解放済み")).toBeVisible();

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
