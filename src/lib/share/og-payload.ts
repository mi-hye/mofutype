export interface SafeOgPayload {
  groupName: string;
  memberCount: number;
}

export function createSafeOgPayload(url: URL): SafeOgPayload {
  const rawName = url.searchParams.get("name") ?? "";
  const normalizedName = rawName
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim();
  const groupName = [...normalizedName].slice(0, 30).join("") || "MofuTypeグループ";
  const rawCount = Number.parseInt(url.searchParams.get("count") ?? "", 10);
  const memberCount = Number.isFinite(rawCount)
    ? Math.min(30, Math.max(1, rawCount))
    : 1;

  return { groupName, memberCount };
}
