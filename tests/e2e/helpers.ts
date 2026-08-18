import { expect, type Page } from "@playwright/test";

export const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
export const LOCAL_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export async function fillProfile(
  page: Page,
  nickname: string,
  birthDate: string,
  mbti: string | null,
) {
  await page.getByLabel("ニックネーム").fill(nickname);
  await page.getByLabel("生年月日").fill(birthDate);
  await page.getByLabel("出生時刻はわからない").check();
  if (mbti === null) {
    await page.getByRole("checkbox", { name: "MBTIはわからない" }).check();
  } else {
    await page.getByLabel("MBTI", { exact: true }).selectOption(mbti);
  }
}

export async function createGroup(
  page: Page,
  groupName: string,
  nickname: string,
) {
  await page.goto("/create/profile");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("グループ名").fill(groupName);
  await fillProfile(page, nickname, "1995-05-15", "ENFP");
  await page.getByRole("button", { name: "グループを作成" }).click();
  await expect(page).toHaveURL(/\/g\/[a-f0-9]{64}$/);
  await expect(page.getByRole("heading", { name: groupName })).toBeVisible();
  await expect(page.getByRole("status", { name: "接続完了" })).toBeVisible();
  return page.url().split("/").at(-1)!;
}

export async function joinGroup(
  page: Page,
  inviteUrl: string,
  nickname: string,
  birthDate: string,
  mbti: string | null,
) {
  await page.goto(inviteUrl);
  await expect(page.getByRole("heading", { name: "グループに招待されています" })).toBeVisible();
  await fillProfile(page, nickname, birthDate, mbti);
  await page.getByRole("button", { name: "グループに参加" }).click();
  await expect(page.getByText(new RegExp(`${nickname}|メンバー`))).toBeVisible();
  await expect(page.getByRole("status", { name: "接続完了" })).toBeVisible();
}
