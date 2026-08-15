import { describe, expect, it } from "vitest";

import {
  createGroupSharePayload,
  createInviteUrl,
  createXIntent,
} from "./x-intent";

describe("share helpers", () => {
  it("encodes Japanese copy and the invite URL with URLSearchParams", () => {
    const url = createXIntent(
      "なかよし組の関係マップに参加しよう。",
      "https://mofu.example/g/a?from=share&x=1",
    );
    const parsed = new URL(url);

    expect(`${parsed.origin}${parsed.pathname}`).toBe("https://twitter.com/intent/tweet");
    expect(parsed.searchParams.get("text")).toBe("なかよし組の関係マップに参加しよう。");
    expect(parsed.searchParams.get("url")).toBe("https://mofu.example/g/a?from=share&x=1");
  });

  it("builds an invite URL only for a canonical public token", () => {
    const token = "a".repeat(64);
    const inviteUrl = createInviteUrl("https://mofu.example/path", token, {
      groupName: "なかよし組",
      memberCount: 3,
    });
    const parsed = new URL(inviteUrl);

    expect(`${parsed.origin}${parsed.pathname}`).toBe(`https://mofu.example/g/${token}`);
    expect(parsed.searchParams.get("name")).toBe("なかよし組");
    expect(parsed.searchParams.get("count")).toBe("3");
    expect(() => createInviteUrl("https://mofu.example", "bad-token")).toThrow("Invalid invite token");
  });

  it("bounds public preview values without accepting private profile fields", () => {
    const token = "b".repeat(64);
    const url = new URL(createInviteUrl("https://mofu.example", token, {
      groupName: `  なか\u0000よし${"長".repeat(40)}  `,
      memberCount: 99,
    }));

    expect([...url.searchParams.get("name")!]).toHaveLength(30);
    expect(url.searchParams.get("name")).not.toContain("\u0000");
    expect(url.searchParams.get("count")).toBe("30");
    expect([...url.searchParams.keys()].sort()).toEqual(["count", "name"]);
  });

  it("creates a minimal payload without profile, birth, MBTI or database identifiers", () => {
    const payload = createGroupSharePayload(
      "なかよし組",
      "https://mofu.example/g/public-token",
    );
    const serialized = JSON.stringify(payload);

    expect(payload).toEqual({
      title: "MofuType",
      text: "なかよし組の関係マップに参加しよう。",
      url: "https://mofu.example/g/public-token",
    });
    for (const privateValue of [
      "1999-01-02",
      "12:30",
      "INFP",
      "member-uuid",
      "user-uuid",
      "group-uuid",
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });
});
