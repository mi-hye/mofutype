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
    expect(graphProps.current?.variant).toBe("minimal");

    const relationshipFactory = graphProps.current?.relationshipFactory as (input: {
      memberA: { id: string; profile: typeof members[number]["profile"] };
      memberB: { id: string; profile: typeof members[number]["profile"] };
    }) => { category: string };
    const byZodiac = new Map(members.map((member) => [member.zodiacId, member]));
    const categoryFor = (first: string, second: string) => relationshipFactory({
      memberA: {
        id: `member-${first}`,
        profile: byZodiac.get(first)!.profile,
      },
      memberB: {
        id: `member-${second}`,
        profile: byZodiac.get(second)!.profile,
      },
    }).category;

    expect(categoryFor("tiger", "rat")).toBe("NATURAL_INTERLOCK");
    expect(categoryFor("rat", "rabbit")).toBe("EXPANDING_POSSIBILITIES");
    expect(categoryFor("rabbit", "tiger")).toBe("CAREFUL_COORDINATION");
  });
});
