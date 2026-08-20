import { expect, test } from "@playwright/test";

import { createGroup } from "./helpers";
import { seedGroupMembers } from "./seed";

test("a 30-member mobile graph renders 435 relationships without horizontal overflow", async ({ page }) => {
  const inviteToken = await createGroup(page, "30人テスト", "オーナー");

  await seedGroupMembers(inviteToken, 29);

  await expect(page.getByText("メンバー 30人")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".react-flow__node")).toHaveCount(30, { timeout: 15_000 });
  await expect(page.locator(".react-flow__edge")).toHaveCount(435, { timeout: 15_000 });
  await expect(page.locator(".zodiac-graph-node__frame")).toHaveCount(30);
  await expect(page.locator(".zodiac-graph-node__frame").first()).toHaveAttribute("data-size", "sm");

  await page.getByRole("button", { name: "オーナーを選択" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".relationship-edge--incident")).toHaveCount(29);
  await expect(page.getByRole("status", { name: "選択中のメンバー" })).toContainText("関係 29本");

  await expect(page.locator(".pointer-flow-controls")).toHaveCount(0);

  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(size);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});
