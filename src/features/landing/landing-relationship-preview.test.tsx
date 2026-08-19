import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const graphProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("@/features/group-graph/group-graph", () => ({
  GroupGraph: (props: Record<string, unknown>) => {
    graphProps.current = props;
    return <section aria-label="メンバー関係性グラフ" />;
  },
}));

import { LandingRelationshipPreview } from "./landing-relationship-preview";

describe("LandingRelationshipPreview", () => {
  it("uses the production graph component with the landing sample members", () => {
    render(<LandingRelationshipPreview />);

    expect(screen.getByRole("region", { name: "メンバー関係性グラフ" }))
      .toBeInTheDocument();
    const members = graphProps.current?.members as Array<{
      nickname: string;
      zodiacId: string;
      mbti: string;
      profile: { zodiacId: string; mbti: string };
    }>;
    expect(members.map(({ nickname, zodiacId, mbti }) => ({ nickname, zodiacId, mbti })))
      .toEqual([
        { nickname: "とら", zodiacId: "tiger", mbti: "ENTJ" },
        { nickname: "ねずみ", zodiacId: "rat", mbti: "INFP" },
        { nickname: "うさぎ", zodiacId: "rabbit", mbti: "ISFJ" },
      ]);
    expect(members.every((member) =>
      member.zodiacId === member.profile.zodiacId && member.mbti === member.profile.mbti
    )).toBe(true);
    expect(graphProps.current?.unlocks).toEqual([]);
  });
});
