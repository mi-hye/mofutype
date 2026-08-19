import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const graphProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("@/features/group-graph/group-graph", () => ({
  GroupGraph: (props: Record<string, unknown>) => {
    graphProps.current = props;
    return <section aria-label="メンバー関係性グラフ" />;
  },
}));

import { ReportSampleGraph } from "./report-sample-graph";

describe("ReportSampleGraph", () => {
  it("reuses the production group graph with valid sample members", () => {
    render(<ReportSampleGraph />);

    expect(screen.getByRole("region", { name: "メンバー関係性グラフ" })).toBeInTheDocument();
    expect(screen.getByText(/実際のグループ画面と同じ関係グラフです/)).toBeInTheDocument();

    const members = graphProps.current?.members as Array<{
      id: string;
      nickname: string;
      zodiacId: string;
      profile: { zodiacId: string; mbti: string };
    }>;
    expect(members).toHaveLength(4);
    expect(members.map(({ nickname }) => nickname)).toEqual(["Aさん", "Bさん", "Cさん", "Dさん"]);
    expect(members.every((member) => member.zodiacId === member.profile.zodiacId)).toBe(true);
    expect(graphProps.current?.unlocks).toEqual([]);
  });
});
