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
    expect(screen.queryByRole("combobox", { name: "関係を見る相手を選ぶ" }))
      .not.toBeInTheDocument();
  });

  it("shows the full personal reading without a paid relationship offer", () => {
    render(
      <PersonalReadingDetail
        member={member}
        groupName="なかよし"
        memberCount={3}
        inviteToken={"a".repeat(64)}
      />,
    );

    expect(screen.getByRole("heading", { name: "ISFJの思考と行動" })).toBeInTheDocument();
    expect(screen.queryByText("RELATION REPORT")).not.toBeInTheDocument();
    expect(screen.queryByText("1組 100円")).not.toBeInTheDocument();
    expect(screen.queryByText("買い切り・自動更新なし")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "このグループで、誰と相性がいい？" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この結果を共有する" })).toBeInTheDocument();
  });

});
