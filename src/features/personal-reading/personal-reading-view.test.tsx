import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GroupMember } from "@/lib/supabase/models";
import { PersonalReadingDetail, PersonalReadingSummary } from "./personal-reading-view";

const member: GroupMember = {
  id: "member-a",
  groupId: "group-a",
  userId: "user-a",
  nickname: "あお",
  zodiacId: "rabbit",
  mbti: "ISFJ",
  profile: {
    version: 1,
    zodiacId: "rabbit",
    mbti: "ISFJ",
    dayMaster: { element: "WATER", polarity: "YANG" },
    fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 2, WATER: 2 },
    yinYang: { YIN: 4, YANG: 4 },
    calculationMode: "date-time",
    boundaryState: "exact",
    engineVersion: "mofu-eto-four-pillars-v1",
  },
  joinedAt: "2026-08-19T00:00:00Z",
};

describe("personal reading conversion flow", () => {
  it("keeps the group result concise and links to the dedicated detail page", () => {
    render(
      <PersonalReadingSummary
        member={member}
        groupName="なかよし"
        memberCount={3}
        inviteToken={"a".repeat(64)}
      />,
    );

    expect(screen.getByText("FREE PREVIEW")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "うさぎの気質" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ISFJの思考と行動" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "わたしの詳細を見る" })).toHaveAttribute(
      "href",
      `/g/${"a".repeat(64)}/profile`,
    );
    expect(screen.getByRole("link", { name: "このグループで、誰と相性がいい？" })).toHaveAttribute(
      "href",
      "#relationship-map",
    );
  });

  it("shows the full reading and leads into the existing paid relation report", () => {
    render(
      <PersonalReadingDetail
        member={member}
        groupName="なかよし"
        memberCount={3}
        inviteToken={"a".repeat(64)}
      />,
    );

    expect(screen.getByRole("heading", { name: "ISFJの思考と行動" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "この性格が、あの人との間でどう表れる？" })).toBeInTheDocument();
    expect(screen.getByText("1組 300円")).toBeInTheDocument();
    expect(screen.getByText("買い切り・自動更新なし")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "このグループで、誰と相性がいい？" })).toHaveAttribute(
      "href",
      `/g/${"a".repeat(64)}#relationship-map`,
    );
  });
});
