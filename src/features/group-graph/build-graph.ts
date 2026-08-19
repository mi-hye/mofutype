import type { Edge, Node } from "@xyflow/react";

import { createCharacterCopy } from "@/lib/eto/character";
import {
  createEtoRelationship,
  type CreateEtoRelationshipInput,
  type EtoRelationshipResult,
  type RelationshipCategory,
} from "@/lib/eto/relationship";
import { canonicalPairKey } from "@/lib/relationship/pair-key";
import type { GroupMember, RelationUnlock } from "@/lib/supabase/models";

export type GraphNodeSize = "sm" | "md" | "lg";
export type EdgeEmphasis = "default" | "incident" | "faint";
export type RelationshipLineColor = "calm" | "clear" | "neutral" | "warm" | "careful";
export type RelationshipFactory = (
  input: CreateEtoRelationshipInput,
) => EtoRelationshipResult;
export type RelationshipGraphMember = Pick<
  GroupMember,
  "id" | "nickname" | "zodiacId" | "mbti" | "profile"
>;

export interface TopologyNodeData extends Record<string, unknown> {
  member: RelationshipGraphMember;
  size: GraphNodeSize;
  discriminator: string | null;
  characterTitleJa: string;
  accessibleLabel: string;
}

export interface ZodiacNodeData extends TopologyNodeData {
  selected: boolean;
}

export interface TopologyEdgeData extends Record<string, unknown> {
  relationship: EtoRelationshipResult;
  memberIds: readonly [RelationshipGraphMember["id"], RelationshipGraphMember["id"]];
}

export interface RelationshipEdgeData extends TopologyEdgeData {
  unlocked: boolean;
  emphasis: EdgeEmphasis;
  lineColor: RelationshipLineColor;
}

export type TopologyNode = Node<TopologyNodeData, "zodiac">;
export type TopologyEdge = Edge<TopologyEdgeData> & { data: TopologyEdgeData };
export type ZodiacGraphNode = Node<ZodiacNodeData, "zodiac">;
export type RelationshipGraphEdge = Edge<RelationshipEdgeData> & {
  data: RelationshipEdgeData;
};

export interface GraphTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface BuiltGraph {
  nodes: ZodiacGraphNode[];
  edges: RelationshipGraphEdge[];
}

const RELATIONSHIP_LINE_COLORS: Readonly<Record<RelationshipCategory, string>> = {
  NATURAL_INTERLOCK: "var(--relationship-calm)",
  EXPANDING_POSSIBILITIES: "var(--relationship-clear)",
  POSITIVE_STIMULATION: "var(--relationship-warm)",
  LEARNING_EACH_OTHERS_PACE: "var(--relationship-neutral)",
  CAREFUL_COORDINATION: "var(--relationship-careful)",
};

const RELATIONSHIP_LINE_COLOR_GROUPS: Readonly<
  Record<RelationshipCategory, RelationshipLineColor>
> = {
  NATURAL_INTERLOCK: "calm",
  EXPANDING_POSSIBILITIES: "clear",
  POSITIVE_STIMULATION: "warm",
  LEARNING_EACH_OTHERS_PACE: "neutral",
  CAREFUL_COORDINATION: "careful",
};

function nodeSize(count: number): GraphNodeSize {
  if (count <= 6) return "lg";
  if (count <= 15) return "md";
  return "sm";
}

function uniquePrefixes(members: readonly RelationshipGraphMember[]): Map<string, string> {
  const duplicatedNames = new Set<string>();
  const nameCounts = new Map<string, number>();
  for (const item of members) {
    const next = (nameCounts.get(item.nickname) ?? 0) + 1;
    nameCounts.set(item.nickname, next);
    if (next > 1) duplicatedNames.add(item.nickname);
  }

  const prefixes = new Map<string, string>();
  for (const nickname of duplicatedNames) {
    const ids = members
      .filter((item) => item.nickname === nickname)
      .map((item) => item.id);
    for (const id of ids) {
      let length = Math.min(4, id.length);
      while (
        length < id.length &&
        ids.some((other) => other !== id && other.slice(0, length) === id.slice(0, length))
      ) {
        length += 1;
      }
      prefixes.set(id, id.slice(0, length));
    }
  }
  return prefixes;
}

function positionAt(index: number, count: number): { x: number; y: number } {
  if (count === 1) return { x: 0, y: 0 };

  if (count <= 15) {
    const radius = count <= 6 ? 160 : Math.max(230, count * 28);
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
    return {
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
    };
  }

  const minimumChord = 124;
  const radiusForChord = (capacity: number) =>
    minimumChord / (2 * Math.sin(Math.PI / capacity));
  const innerCount = Math.min(10, Math.ceil(count / 2.5));
  const outerCount = count - innerCount;
  const innerRadius = Math.max(190, radiusForChord(innerCount));
  const outerRadius = Math.max(innerRadius + 150, radiusForChord(outerCount));
  const isInner = index < innerCount;
  const ringIndex = isInner ? index : index - innerCount;
  const ringCount = isInner ? innerCount : outerCount;
  const radius = isInner ? innerRadius : outerRadius;
  const stagger = isInner ? 0 : Math.PI / outerCount;
  const angle = -Math.PI / 2 + stagger + (ringIndex * Math.PI * 2) / ringCount;
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}

export function graphMemberSnapshot(
  members: readonly RelationshipGraphMember[],
): RelationshipGraphMember[] {
  return [...members]
    .sort((first, second) => first.id < second.id ? -1 : first.id > second.id ? 1 : 0)
    .map((member) => ({
      id: member.id,
      nickname: member.nickname,
      zodiacId: member.zodiacId,
      mbti: member.mbti,
      profile: {
        version: member.profile.version,
        zodiacId: member.profile.zodiacId,
        mbti: member.profile.mbti,
        dayMaster: { ...member.profile.dayMaster },
        fiveElements: member.profile.fiveElements === null
          ? null
          : { ...member.profile.fiveElements },
        yinYang: member.profile.yinYang === null
          ? null
          : { ...member.profile.yinYang },
        calculationMode: member.profile.calculationMode,
        boundaryState: member.profile.boundaryState,
        engineVersion: member.profile.engineVersion,
      },
    }));
}

export function graphMembersVersion(
  members: readonly RelationshipGraphMember[],
): string {
  return JSON.stringify(graphMemberSnapshot(members));
}

export function buildGraphTopology(
  members: readonly RelationshipGraphMember[],
  relationshipFactory: RelationshipFactory = createEtoRelationship,
): GraphTopology {
  if (members.length > 30) {
    throw new Error("A group graph supports at most 30 members");
  }
  const sorted = [...members].sort((first, second) =>
    first.id < second.id ? -1 : first.id > second.id ? 1 : 0,
  );
  const ids = new Set(sorted.map((item) => item.id));
  if (ids.size !== sorted.length) {
    throw new Error("Duplicate member IDs are not allowed");
  }

  const size = nodeSize(sorted.length);
  const discriminators = uniquePrefixes(sorted);
  const nodes = sorted.map<TopologyNode>((item, index) => {
    const discriminator = discriminators.get(item.id) ?? null;
    const characterTitleJa = createCharacterCopy(item.zodiacId, item.mbti).titleJa;
    return {
      id: item.id,
      type: "zodiac",
      position: positionAt(index, sorted.length),
      draggable: false,
      selectable: true,
      data: {
        member: item,
        size,
        discriminator,
        characterTitleJa,
        accessibleLabel: discriminator
          ? `${item.nickname}（識別子 ${discriminator}）の関係性ノード`
          : `${item.nickname}の関係性ノード`,
      },
    };
  });

  const edges: TopologyEdge[] = [];
  for (let firstIndex = 0; firstIndex < sorted.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < sorted.length; secondIndex += 1) {
      const first = sorted[firstIndex];
      const second = sorted[secondIndex];
      const pairKey = canonicalPairKey(first.id, second.id);
      const relationship = relationshipFactory({
        memberA: { id: first.id, profile: first.profile },
        memberB: { id: second.id, profile: second.profile },
      });
      edges.push({
        id: pairKey,
        type: "straight",
        source: first.id,
        target: second.id,
        interactionWidth: 24,
        data: {
          relationship,
          memberIds: [first.id, second.id],
        },
      });
    }
  }

  return { nodes, edges };
}

export function decorateGraph(
  topology: GraphTopology,
  selectedNodeId: string | null,
  unlocks: readonly RelationUnlock[],
  selectedLineColor: RelationshipLineColor | null = null,
): BuiltGraph {
  const perimeterPairs = new Set<string>();
  if (topology.nodes.length === 2) {
    perimeterPairs.add(canonicalPairKey(topology.nodes[0].id, topology.nodes[1].id));
  } else if (topology.nodes.length > 2) {
    for (let index = 0; index < topology.nodes.length; index += 1) {
      const current = topology.nodes[index];
      const next = topology.nodes[(index + 1) % topology.nodes.length];
      perimeterPairs.add(canonicalPairKey(current.id, next.id));
    }
  }
  const unlockedPairs = new Set(
    unlocks
      .filter((item) => item.status === "unlocked")
      .map((item) => canonicalPairKey(item.memberLowId, item.memberHighId)),
  );
  const nodes = topology.nodes.map<ZodiacGraphNode>((node) => ({
    ...node,
    data: {
      ...node.data,
      selected: node.id === selectedNodeId,
    },
  }));
  const edges = topology.edges.map<RelationshipGraphEdge>((edge) => {
    const incident = selectedNodeId !== null &&
      (edge.source === selectedNodeId || edge.target === selectedNodeId);
    const perimeter = perimeterPairs.has(edge.id);
    const lineColor = RELATIONSHIP_LINE_COLOR_GROUPS[edge.data.relationship.category];
    const matchesColor = selectedLineColor === null || lineColor === selectedLineColor;
    const visible = perimeter || incident;
    const emphasis: EdgeEmphasis = selectedNodeId === null
      ? visible ? "default" : "faint"
      : incident ? "incident" : "faint";
    const unlocked = unlockedPairs.has(edge.id);
    const category = edge.data.relationship.category;
    const strokeWidth = incident ? (unlocked ? 5 : 4) : unlocked ? 4 : 3;
    const emphasized = selectedLineColor !== null ? matchesColor : incident;
    const opacity = !visible
      ? 0
      : selectedNodeId !== null
        ? incident && emphasized ? 1 : 0.22
        : selectedLineColor !== null
          ? matchesColor ? 1 : 0.22
          : 0.72;
    return {
      ...edge,
      animated: false,
      className: [
        "relationship-edge",
        `relationship-edge--${unlocked ? "unlocked" : "locked"}`,
        `relationship-edge--${emphasis}`,
        `relationship-edge--${perimeter ? "perimeter" : "chord"}`,
      ].join(" "),
      label: undefined,
      labelShowBg: false,
      style: {
        stroke: RELATIONSHIP_LINE_COLORS[category],
        strokeWidth,
        opacity,
        pointerEvents: visible ? "auto" : "none",
      },
      data: {
        ...edge.data,
        unlocked,
        emphasis,
        lineColor,
      },
    };
  });
  return { nodes, edges };
}

export function buildGraph(
  members: readonly RelationshipGraphMember[],
  selectedNodeId: string | null,
  unlocks: readonly RelationUnlock[],
  selectedLineColor: RelationshipLineColor | null = null,
): BuiltGraph {
  return decorateGraph(
    buildGraphTopology(members),
    selectedNodeId,
    unlocks,
    selectedLineColor,
  );
}
