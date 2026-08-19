import { describe, expect, it, vi } from "vitest";

import { createEtoRelationship } from "@/lib/eto/relationship";
import type { DerivedEtoProfile, ZodiacId } from "@/lib/eto/types";
import type { GroupMember, RelationUnlock } from "@/lib/supabase/models";
import {
  buildGraph,
  buildGraphTopology,
  decorateGraph,
  graphMemberSnapshot,
  type RelationshipGraphMember,
} from "./build-graph";

function profile(
  zodiacId: ZodiacId = "dragon",
  mbti: DerivedEtoProfile["mbti"] = null,
): DerivedEtoProfile {
  return {
    version: 1,
    zodiacId,
    mbti,
    dayMaster: { element: "WOOD", polarity: "YANG" },
    fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 1, WATER: 1 },
    yinYang: { YIN: 3, YANG: 3 },
    calculationMode: "date-only",
    boundaryState: "exact",
    engineVersion: "mofu-eto-four-pillars-v1",
  };
}

function member(id: string, nickname = id, zodiacId: ZodiacId = "dragon"): GroupMember {
  const derivedProfile = profile(zodiacId);
  return {
    id,
    groupId: "group-1",
    userId: `user-${id}`,
    nickname,
    zodiacId,
    mbti: null,
    profile: derivedProfile,
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
  it("accepts the honest minimal relationship graph member shape", () => {
    const minimalMember = {
      id: "minimal",
      nickname: "みにまる",
      zodiacId: "dragon",
      mbti: null,
      profile: profile(),
    } satisfies RelationshipGraphMember;

    expect(buildGraphTopology([minimalMember]).nodes[0].data.member).toEqual(minimalMember);
  });

  it("uses the zodiac React Flow node contract", () => {
    expect(buildGraphTopology([member("one")]).nodes[0].type).toBe("zodiac");
  });

  it.each([false, true])(
    "deep-clones profile count records when counts are null=%s",
    (countsAreNull) => {
      const source = member("snapshot");
      if (countsAreNull) {
        source.profile = { ...source.profile, fiveElements: null, yinYang: null };
      }

      const snapshot = graphMemberSnapshot([source])[0];

      expect(snapshot).toEqual({
        id: source.id,
        nickname: source.nickname,
        zodiacId: source.zodiacId,
        mbti: source.mbti,
        profile: source.profile,
      });
      expect(snapshot.profile).not.toBe(source.profile);
      expect(snapshot.profile.dayMaster).not.toBe(source.profile.dayMaster);
      if (!countsAreNull) {
        expect(snapshot.profile.fiveElements).not.toBe(source.profile.fiveElements);
        expect(snapshot.profile.yinYang).not.toBe(source.profile.yinYang);
      }
    },
  );
  it.each(Array.from({ length: 30 }, (_, index) => {
    const count = index + 1;
    return [count, count * (count - 1) / 2] as const;
  }))("creates every unordered pair for %i members", (count, edgeCount) => {
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

  it.each(Array.from({ length: 29 }, (_, index) => index + 2))(
    "keeps node centers safely separated for %i members",
    (count) => {
      const graph = buildGraph(
        Array.from({ length: count }, (_, index) => member(`m-${String(index).padStart(2, "0")}`)),
        null,
        [],
      );
      const footprint = { lg: 140, md: 120, sm: 112 }[graph.nodes[0].data.size];
      let minimumDistance = Number.POSITIVE_INFINITY;
      for (let first = 0; first < graph.nodes.length; first += 1) {
        for (let second = first + 1; second < graph.nodes.length; second += 1) {
          const dx = graph.nodes[first].position.x - graph.nodes[second].position.x;
          const dy = graph.nodes[first].position.y - graph.nodes[second].position.y;
          minimumDistance = Math.min(minimumDistance, Math.hypot(dx, dy));
        }
      }
      expect(minimumDistance).toBeGreaterThanOrEqual(footprint - 1);
    },
  );

  it("keeps node positions and pair directions stable across input reorder", () => {
    const members = [member("charlie"), member("alpha"), member("bravo")];
    const first = buildGraph(members, null, []);
    const reordered = buildGraph([...members].reverse(), null, []);

    expect(reordered.nodes).toEqual(first.nodes);
    expect(reordered.edges).toEqual(first.edges);
  });

  it("uses a tighter radius for small social groups", () => {
    const graph = buildGraph([member("a"), member("b"), member("c")], null, []);

    expect(graph.nodes.every((node) => Math.hypot(node.position.x, node.position.y) <= 161))
      .toBe(true);
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
    expect(highlighted.every((edge) => edge.style?.strokeWidth === 4 && !edge.animated)).toBe(true);
    expect(highlighted.every((edge) => edge.className?.includes("relationship-edge--incident"))).toBe(true);
    expect(unrelated.every((edge) => edge.className?.includes("relationship-edge--faint"))).toBe(true);
    expect(graph.edges.every((edge) => edge.style?.strokeDasharray === undefined)).toBe(true);
    expect(graph.edges.every((edge) => String(edge.style?.stroke).startsWith("var(--relationship-"))).toBe(true);
    expect(graph.edges.every((edge) => edge.type === "straight")).toBe(true);
    expect(graph.nodes.find((node) => node.id === "b")?.data.selected).toBe(true);
  });

  it("renders the idle graph with quiet relationship lines and no labels", () => {
    const graph = buildGraph([member("a"), member("b"), member("c")], null, []);

    expect(graph.edges.every((edge) => !edge.animated)).toBe(true);
    expect(graph.edges.every((edge) => edge.style?.strokeWidth === 3)).toBe(true);
    expect(graph.edges.every((edge) => edge.style?.opacity === 0.4)).toBe(true);
    expect(graph.edges.every((edge) => edge.label === undefined)).toBe(true);
    expect(graph.edges.every((edge) => edge.style?.strokeDasharray === undefined)).toBe(true);
  });

  it.each([4, 5, 6])(
    "shows a %i-sided perimeter while preserving every calculated relationship",
    (count) => {
      const ids = Array.from({ length: count }, (_, index) => String.fromCharCode(97 + index));
      const graph = buildGraph(
        ids.map((id) => member(id)),
        null,
        [],
      );
      const visibleEdges = graph.edges.filter((edge) => Number(edge.style?.opacity) > 0);
      const expectedPerimeter = ids.map((id, index) =>
        [id, ids[(index + 1) % ids.length]].sort().join(":"),
      ).sort();

      expect(graph.edges).toHaveLength(count * (count - 1) / 2);
      expect(visibleEdges).toHaveLength(count);
      expect(visibleEdges.map((edge) => edge.id).sort()).toEqual(expectedPerimeter);
      expect(graph.edges.filter((edge) => Number(edge.style?.opacity) === 0)
        .every((edge) => edge.label === undefined && edge.style?.pointerEvents === "none"))
        .toBe(true);
    },
  );

  it("emphasizes a selected perimeter color without adding hidden chord colors", () => {
    const topology = buildGraphTopology([member("a"), member("b"), member("c"), member("d")]);
    const categories = [
      "NATURAL_INTERLOCK",
      "EXPANDING_POSSIBILITIES",
      "POSITIVE_STIMULATION",
      "LEARNING_EACH_OTHERS_PACE",
    ] as const;
    const categorized = {
      ...topology,
      edges: topology.edges.map((edge, index) => ({
        ...edge,
        data: {
          ...edge.data,
          relationship: {
            ...edge.data.relationship,
            category: categories[index % categories.length],
          },
        },
      })),
    };

    const filtered = decorateGraph(categorized, null, [], "clear");
    const visibleEdges = filtered.edges.filter((edge) => Number(edge.style?.opacity) > 0);
    const selectedEdges = visibleEdges.filter((edge) => edge.data.lineColor === "clear");
    const unselectedEdges = visibleEdges.filter((edge) => edge.data.lineColor !== "clear");

    expect(visibleEdges).toHaveLength(4);
    expect(selectedEdges.every((edge) => edge.style?.opacity === 1)).toBe(true);
    expect(unselectedEdges.every((edge) => edge.style?.opacity === 0.4)).toBe(true);
    expect(visibleEdges.every((edge) => edge.labelBgStyle?.fill === edge.style?.stroke))
      .toBe(true);
    expect(filtered.edges.filter((edge) => Number(edge.style?.opacity) === 0)
      .every((edge) => edge.style?.pointerEvents === "none"))
      .toBe(true);
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
    expect(graph.edges.find((edge) => edge.id === "a:b")?.className).toContain("unlocked");
    expect(graph.edges.find((edge) => edge.id === "a:c")?.className).toContain("locked");
    expect(graph.edges.find((edge) => edge.id === "a:c")?.style?.opacity).toBe(0.4);
    expect(Number(graph.edges.find((edge) => edge.id === "a:b")?.style?.strokeWidth))
      .toBeGreaterThan(Number(graph.edges.find((edge) => edge.id === "a:c")?.style?.strokeWidth));
    expect(graph.edges[0].data?.relationship.pairKey).toBe(graph.edges[0].id);
    expect(JSON.stringify(graph)).not.toMatch(/score|percent|percentage|%/i);
  });

  it("preserves visible unlock distinction while incident edges are highlighted", () => {
    const graph = buildGraph(
      [member("a"), member("b"), member("c")],
      "a",
      [unlock("a", "b")],
    );
    const unlockedEdge = graph.edges.find((edge) => edge.id === "a:b");
    const lockedEdge = graph.edges.find((edge) => edge.id === "a:c");

    expect(unlockedEdge?.data.emphasis).toBe("incident");
    expect(lockedEdge?.data.emphasis).toBe("incident");
    expect(unlockedEdge?.className).toContain("unlocked");
    expect(lockedEdge?.className).toContain("locked");
    expect(Number(unlockedEdge?.style?.strokeWidth)).toBeGreaterThan(Number(lockedEdge?.style?.strokeWidth));
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

  it("creates relationships only in topology and never during decoration", () => {
    const members = Array.from({ length: 30 }, (_, index) => member(`m-${String(index).padStart(2, "0")}`));
    const relationshipFactory = vi.fn(createEtoRelationship);
    const topology = buildGraphTopology(members, relationshipFactory);

    expect(relationshipFactory).toHaveBeenCalledTimes(435);
    decorateGraph(topology, "m-12", []);
    decorateGraph(topology, null, [unlock("m-00", "m-01")]);
    expect(relationshipFactory).toHaveBeenCalledTimes(435);
  });

  it("decorates immutably without mutating topology nodes, edges, or data", () => {
    const topology = buildGraphTopology([member("a"), member("b"), member("c")]);
    const snapshot = structuredClone(topology);
    for (const node of topology.nodes) {
      Object.freeze(node.data);
      Object.freeze(node);
    }
    for (const edge of topology.edges) {
      Object.freeze(edge.data);
      Object.freeze(edge);
    }
    Object.freeze(topology.nodes);
    Object.freeze(topology.edges);
    Object.freeze(topology);

    const decorated = decorateGraph(topology, "b", [unlock("a", "b")]);

    expect(topology).toEqual(snapshot);
    expect(decorated.nodes[0]).not.toBe(topology.nodes[0]);
    expect(decorated.nodes[0].data).not.toBe(topology.nodes[0].data);
    expect(decorated.edges[0]).not.toBe(topology.edges[0]);
    expect(decorated.edges[0].data).not.toBe(topology.edges[0].data);
    expect(decorated.edges.find((edge) => edge.id === "a:b")?.data?.unlocked).toBe(true);
  });
});
