import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GroupPage, { generateMetadata } from "./page";

describe("GroupPage", () => {
  it("awaits Next dynamic params and passes the token into the gate", async () => {
    const view = await GroupPage({ params: Promise.resolve({ inviteToken: "bad-token" }) });
    render(view);
    expect(screen.getByRole("heading", { name: "招待リンクが無効です" })).toBeInTheDocument();
  });

  it("creates safe group metadata from public preview fields only", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ inviteToken: "a".repeat(64) }),
      searchParams: Promise.resolve({
        name: "なかよし組",
        count: "3",
        birthDate: "1999-01-02",
        birthTime: "12:30",
        mbti: "INFP",
        memberId: "member-uuid",
      }),
    });
    const serialized = JSON.stringify(metadata);

    expect(metadata.title).toBe("なかよし組 | MofuType");
    expect(metadata.description).toContain("3人");
    expect(metadata.openGraph?.images).toEqual([
      `/api/og?name=${encodeURIComponent("なかよし組")}&count=3`,
    ]);
    for (const privateValue of ["1999-01-02", "12:30", "INFP", "member-uuid"]) {
      expect(serialized).not.toContain(privateValue);
    }
  });
});
