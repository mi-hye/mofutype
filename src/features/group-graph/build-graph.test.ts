import { describe, expect, it } from "vitest";

import type { GroupMember, RelationUnlock } from "@/lib/supabase/models";
import { buildGraph } from "./build-graph";

function member(id: string, nickname = id): GroupMember {
  return {
    id,
    groupId: "group-1",
    userId: `user-${id}`,
    nickname,
    animalId: "fawn",
    animalGroup: "MOON",
    mbti: null,
    profile: {
      version: 1,
      animalId: "fawn",
      animalGroup: "MOON",
      mbti: null,
      calculationMode: "date-only",
    },
    joinedAt: "2026-08-15T00:00:00Z",
  };
}

function unlock(low: string, high: string): RelationUnlock {
  return {
    id: `unlock-${low}-${high}`,
    groupId: "group-1",
    memberLowId: low,
    memberHighId: high,
    status: "unlocked",
    paymentProvider: "mock",
    paymentReference: null,
    unlockedBy: low,
    unlockedAt: "2026-08-15T00:00:00Z",
  };
}

describe("buildGraph", () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 3],
    [30, 435],
  ])("creates every unordered pair for %i members", (count, edgeCount) => {
    const graph = buildGraph(
      Array.from({ length: count }, (_, index) => member(`member-${String(index).padStart(2, "0")}`)),
      null,
      [],
    );

    expect(graph.nodes).toHaveLength(count);
    expect(graph.edges).toHaveLength(edgeCount);
    expect(new Set(graph.edges.map((edge) => edge.id))).toHaveLength(edgeCount);
    expect(graph.edges.every((edge) => edge.source < edge.target)).toBe(true);
  });

  it.each([
    [2, "lg"],
    [6, "lg"],
    [7, "md"],
    [15, "md"],
    [16, "sm"],
    [30, "sm"],
  ] as const)("uses %s-member node size %s", (count, size) => {
    const graph = buildGraph(
      Array.from({ length: count }, (_, index) => member(`m-${index}`)),
      null,
      [],
    );
    expect(graph.nodes.every((node) => node.data.size === size)).toBe(true);
  });

  it("keeps node positions and pair directions stable across input reorder", () => {
    const members = [member("charlie"), member("alpha"), member("bravo")];
    const first = buildGraph(members, null, []);
    const reordered = buildGraph([...members].reverse(), null, []);

    expect(reordered.nodes).toEqual(first.nodes);
    expect(reordered.edges).toEqual(first.edges);
  });

  it("rejects duplicate member IDs and groups over 30", () => {
    expect(() => buildGraph([member("same"), member("same")], null, [])).toThrow(/duplicate/i);
    expect(() => buildGraph(Array.from({ length: 31 }, (_, index) => member(`m-${index}`)), null, [])).toThrow(/30/);
  });

  it("marks exactly n - 1 incident edges and fades unrelated edges", () => {
    const graph = buildGraph([member("a"), member("b"), member("c"), member("d")], "b", []);
    const highlighted = graph.edges.filter((edge) => edge.data?.emphasis === "incident");
    const unrelated = graph.edges.filter((edge) => edge.data?.emphasis === "faint");

    expect(highlighted).toHaveLength(3);
    expect(unrelated).toHaveLength(3);
    expect(highlighted.every((edge) => edge.style?.strokeWidth === 4 && edge.animated)).toBe(true);
    expect(graph.nodes.find((node) => node.id === "b")?.data.selected).toBe(true);
  });

  it("exposes relationship results and only completed unlocks", () => {
    const pending = { ...unlock("a", "c"), id: "pending", status: "pending" as const };
    const graph = buildGraph(
      [member("c"), member("a"), member("b")],
      null,
      [unlock("a", "b"), pending],
    );

    expect(graph.edges.find((edge) => edge.id === "a:b")?.data?.unlocked).toBe(true);
    expect(graph.edges.find((edge) => edge.id === "a:c")?.data?.unlocked).toBe(false);
    expect(graph.edges[0].data?.relationship.pairKey).toBe(graph.edges[0].id);
    expect(JSON.stringify(graph)).not.toMatch(/score|percent|percentage|%/i);
  });

  it("adds discriminators only to duplicate nicknames using minimal unique prefixes", () => {
    const graph = buildGraph(
      [
        member("abcd-one", "もふ"),
        member("abcd-two", "もふ"),
        member("solo-id", "ひとり"),
      ],
      null,
      [],
    );
    const byId = Object.fromEntries(graph.nodes.map((node) => [node.id, node.data]));

    expect(byId["abcd-one"].discriminator).toBe("abcd-o");
    expect(byId["abcd-two"].discriminator).toBe("abcd-t");
    expect(byId["solo-id"].discriminator).toBeNull();
    expect(byId["abcd-one"].accessibleLabel).toContain("もふ");
    expect(byId["abcd-one"].accessibleLabel).toContain("abcd-o");
  });
});
