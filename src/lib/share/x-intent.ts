import { createSafeOgPayload } from "./og-payload";

const INVITE_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

interface PublicGroupPreview {
  groupName: string;
  memberCount: number;
}

export interface GroupSharePayload {
  title: "MofuType";
  text: string;
  url: string;
}

export function createXIntent(text: string, url: string): string {
  const params = new URLSearchParams({ text, url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function createInviteUrl(
  origin: string,
  inviteToken: string,
  preview?: PublicGroupPreview,
): string {
  if (!INVITE_TOKEN_PATTERN.test(inviteToken)) {
    throw new Error("Invalid invite token");
  }
  const parsed = new URL(origin);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Invalid origin");
  }
  const inviteUrl = new URL(`/g/${inviteToken}`, parsed.origin);
  if (preview) {
    inviteUrl.searchParams.set("name", preview.groupName);
    inviteUrl.searchParams.set("count", String(preview.memberCount));
    const safePreview = createSafeOgPayload(inviteUrl);
    inviteUrl.search = "";
    inviteUrl.searchParams.set("name", safePreview.groupName);
    inviteUrl.searchParams.set("count", String(safePreview.memberCount));
  }
  return inviteUrl.toString();
}

export function createGroupSharePayload(
  groupName: string,
  inviteUrl: string,
): GroupSharePayload {
  return {
    title: "MofuType",
    text: `${groupName}の関係マップに参加しよう。`,
    url: inviteUrl,
  };
}
