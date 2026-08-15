"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type EdgeMouseHandler,
  type NodeMouseHandler,
} from "@xyflow/react";

import { createRelationship } from "@/lib/relationship/local-provider";
import type { RelationshipResult } from "@/lib/relationship/types";
import type { GroupMember, RelationUnlock } from "@/lib/supabase/models";
import { AnimalNode } from "./animal-node";
import {
  buildGraphTopology,
  decorateGraph,
  graphMembersVersion,
  type AnimalGraphNode,
  type RelationshipFactory,
  type RelationshipGraphEdge,
} from "./build-graph";

export interface PairSelection {
  pairKey: string;
  memberIds: readonly [string, string];
  relationship: RelationshipResult;
  unlocked: boolean;
}

interface GroupGraphProps {
  members: readonly GroupMember[];
  unlocks: readonly RelationUnlock[];
  onPairSelect: (selection: PairSelection) => void;
  relationshipFactory?: RelationshipFactory;
}

const nodeTypes = { animal: AnimalNode };

function selectionFromEdge(edge: RelationshipGraphEdge): PairSelection | null {
  if (!edge.data) return null;
  return {
    pairKey: edge.id,
    memberIds: edge.data.memberIds,
    relationship: edge.data.relationship,
    unlocked: edge.data.unlocked,
  };
}

function GroupGraphComponent({
  members,
  unlocks,
  onPairSelect,
  relationshipFactory = createRelationship,
}: GroupGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const membersVersion = graphMembersVersion(members);
  const topologyMembers = useMemo(
    () => JSON.parse(membersVersion) as GroupMember[],
    [membersVersion],
  );
  const topology = useMemo(
    () => buildGraphTopology(topologyMembers, relationshipFactory),
    [relationshipFactory, topologyMembers],
  );
  const graph = useMemo(
    () => decorateGraph(topology, selectedNodeId, unlocks),
    [topology, selectedNodeId, unlocks],
  );
  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedNodeId) ?? null,
    [members, selectedNodeId],
  );
  const incidentEdges = useMemo(
    () => graph.edges.filter((edge) => edge.data?.emphasis === "incident"),
    [graph.edges],
  );

  const handleNodeClick = useCallback<NodeMouseHandler<AnimalGraphNode>>(
    (_event, node) => setSelectedNodeId(node.id),
    [],
  );
  const handleEdgeClick = useCallback<EdgeMouseHandler<RelationshipGraphEdge>>(
    (_event, edge) => {
      const selection = selectionFromEdge(edge);
      if (selection) onPairSelect(selection);
    },
    [onPairSelect],
  );

  return (
    <section className="group-graph" aria-label="メンバー関係性グラフ">
      <div className="group-graph__canvas">
        <ReactFlow<AnimalGraphNode, RelationshipGraphEdge>
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          minZoom={0.35}
          maxZoom={1.8}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={28} size={1.5} />
          <Controls showInteractive={false} data-touch-friendly="true" />
        </ReactFlow>
      </div>

      {selectedMember ? (
        <p className="group-graph__selection" role="status" aria-label="選択中のメンバー">
          {selectedMember.nickname}を選択中：関係 {incidentEdges.length}本
        </p>
      ) : null}

      <div className="group-graph__accessible" role="region" aria-label="関係性グラフの操作リスト">
        <h2>リストで操作</h2>
        <p>キャンバスを操作しにくい場合は、メンバーを選んで関係を確認できます。</p>
        <ul className="group-graph__member-list">
          {graph.nodes.map((node) => (
            <li key={node.id}>
              <button type="button" aria-pressed={node.data.selected}
                onClick={() => setSelectedNodeId(node.id)}>
                {node.data.member.nickname}を選択
                {node.data.discriminator ? `（${node.data.discriminator}）` : ""}
              </button>
            </li>
          ))}
        </ul>
        {selectedMember ? (
          <ul className="group-graph__relationship-list">
            {incidentEdges.map((edge) => {
              const selection = selectionFromEdge(edge);
              if (!selection) return null;
              const otherId = selection.memberIds.find((id) => id !== selectedMember.id);
              const other = members.find((member) => member.id === otherId);
              if (!other) return null;
              return (
                <li key={edge.id}>
                  <button type="button" onClick={() => onPairSelect(selection)}>
                    {selectedMember.nickname}と{other.nickname}の関係を見る
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export const GroupGraph = memo(GroupGraphComponent);
