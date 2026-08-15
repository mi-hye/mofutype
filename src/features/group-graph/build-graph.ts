import type { Edge, Node } from "@xyflow/react";

import { createRelationship } from "@/lib/relationship/local-provider";
import { canonicalPairKey } from "@/lib/relationship/pair-key";
import type { RelationshipResult } from "@/lib/relationship/types";
import type { GroupMember, RelationUnlock } from "@/lib/supabase/models";

export type GraphNodeSize = "sm" | "md" | "lg";
export type EdgeEmphasis = "default" | "incident" | "faint";

export interface AnimalNodeData extends Record<string, unknown> {
  member: GroupMember;
  size: GraphNodeSize;
  selected: boolean;
  discriminator: string | null;
  accessibleLabel: string;
}

export interface RelationshipEdgeData extends Record<string, unknown> {
  relationship: RelationshipResult;
  memberIds: readonly [string, string];
  unlocked: boolean;
  emphasis: EdgeEmphasis;
}

export type AnimalGraphNode = Node<AnimalNodeData, "animal">;
export type RelationshipGraphEdge = Edge<RelationshipEdgeData>;

export interface BuiltGraph {
  nodes: AnimalGraphNode[];
  edges: RelationshipGraphEdge[];
}

function nodeSize(count: number): GraphNodeSize {
  if (count <= 6) return "lg";
  if (count <= 15) return "md";
  return "sm";
}

function uniquePrefixes(members: readonly GroupMember[]): Map<string, string> {
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

  const outerCount = count > 15 ? count - 8 : count;
  const isInner = count > 15 && index < 8;
  const ringIndex = isInner ? index : index - (count > 15 ? 8 : 0);
  const ringCount = isInner ? 8 : outerCount;
  const radius = isInner ? 210 : Math.max(230, ringCount * 28);
  const angle = -Math.PI / 2 + (ringIndex * Math.PI * 2) / ringCount;
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}

export function buildGraph(
  members: readonly GroupMember[],
  selectedNodeId: string | null,
  unlocks: readonly RelationUnlock[],
): BuiltGraph {
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
  const nodes = sorted.map<AnimalGraphNode>((item, index) => {
    const discriminator = discriminators.get(item.id) ?? null;
    const selected = item.id === selectedNodeId;
    return {
      id: item.id,
      type: "animal",
      position: positionAt(index, sorted.length),
      draggable: false,
      selectable: true,
      data: {
        member: item,
        size,
        selected,
        discriminator,
        accessibleLabel: discriminator
          ? `${item.nickname}（識別子 ${discriminator}）の関係性ノード`
          : `${item.nickname}の関係性ノード`,
      },
    };
  });

  const unlockedPairs = new Set(
    unlocks
      .filter((item) => item.status === "unlocked")
      .map((item) => canonicalPairKey(item.memberLowId, item.memberHighId)),
  );
  const edges: RelationshipGraphEdge[] = [];
  for (let firstIndex = 0; firstIndex < sorted.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < sorted.length; secondIndex += 1) {
      const first = sorted[firstIndex];
      const second = sorted[secondIndex];
      const pairKey = canonicalPairKey(first.id, second.id);
      const incident = selectedNodeId !== null &&
        (first.id === selectedNodeId || second.id === selectedNodeId);
      const emphasis: EdgeEmphasis = selectedNodeId === null
        ? "default"
        : incident ? "incident" : "faint";
      const relationship = createRelationship({ memberA: first, memberB: second });
      edges.push({
        id: pairKey,
        source: first.id,
        target: second.id,
        animated: incident,
        interactionWidth: 24,
        style: {
          strokeWidth: incident ? 4 : 2,
          opacity: emphasis === "faint" ? 0.12 : emphasis === "incident" ? 1 : 0.55,
          strokeDasharray: incident ? "9 4" : undefined,
        },
        data: {
          relationship,
          memberIds: [first.id, second.id],
          unlocked: unlockedPairs.has(pairKey),
          emphasis,
        },
      });
    }
  }

  return { nodes, edges };
}
