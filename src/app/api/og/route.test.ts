// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createSafeOgPayload, GET } from "./route";

describe("MofuType OG image", () => {
  it("allows only a bounded group name and member count", () => {
    const url = new URL("https://mofu.example/api/og");
    url.searchParams.set("name", `  なか\u0000よし${"長".repeat(40)}  `);
    url.searchParams.set("count", "99");
    url.searchParams.set("birthDate", "1999-01-02");
    url.searchParams.set("birthTime", "12:30");
    url.searchParams.set("mbti", "INFP");
    url.searchParams.set("memberId", "member-uuid");

    const payload = createSafeOgPayload(url);
    const serialized = JSON.stringify(payload);

    expect([...payload.groupName].length).toBeLessThanOrEqual(30);
    expect(payload.groupName).not.toContain("\u0000");
    expect(payload.memberCount).toBe(30);
    for (const privateValue of ["1999-01-02", "12:30", "INFP", "member-uuid"]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it("uses safe defaults for missing or malformed public values", () => {
    expect(createSafeOgPayload(new URL("https://mofu.example/api/og?count=nope"))).toEqual({
      groupName: "MofuTypeグループ",
      memberCount: 1,
    });
  });

  it("returns a 1200 by 630 PNG response", async () => {
    const response = await GET(
      new Request("https://mofu.example/api/og?name=%E3%81%AA%E3%81%8B%E3%82%88%E3%81%97&count=3"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toContain("public");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1_000);
  });
});
