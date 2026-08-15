"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  Background,
  ReactFlow,
  useReactFlow,
  type EdgeMouseHandler,
  type NodeMouseHandler,
} from "@xyflow/react";

import { createRelationship } from "@/lib/relationship/local-provider";
import type { RelationshipResult } from "@/lib/relationship/types";
import type { RelationUnlock } from "@/lib/supabase/models";
import { AnimalNode } from "./animal-node";
import {
  buildGraphTopology,
  decorateGraph,
  graphMemberSnapshot,
  graphMembersVersion,
  type AnimalGraphNode,
  type RelationshipFactory,
  type RelationshipGraphMember,
  type RelationshipGraphEdge,
} from "./build-graph";

export interface PairSelection {
  pairKey: string;
  memberIds: readonly [RelationshipGraphMember["id"], RelationshipGraphMember["id"]];
  relationship: RelationshipResult;
  unlocked: boolean;
}

interface GroupGraphProps {
  members: readonly RelationshipGraphMember[];
  unlocks: readonly RelationUnlock[];
  onPairSelect: (selection: PairSelection) => void;
  relationshipFactory?: RelationshipFactory;
}

const nodeTypes = { animal: AnimalNode };

function PointerControls() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  return (
    <div className="pointer-flow-controls" data-touch-friendly="true" aria-hidden="true">
      <button type="button" tabIndex={-1} onClick={() => void zoomIn()}>＋</button>
      <button type="button" tabIndex={-1} onClick={() => void zoomOut()}>−</button>
      <button type="button" tabIndex={-1} onClick={() => void fitView({ padding: 0.22 })}>全体</button>
    </div>
  );
}

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
  const topology = useMemo(
    () => buildGraphTopology(graphMemberSnapshot(members), relationshipFactory),
    // Raw array identity is intentionally replaced by the complete semantic version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [membersVersion, relationshipFactory],
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
  const hideCanvasFromKeyboard = useCallback((canvas: HTMLDivElement | null) => {
    if (!canvas) return;
    for (const element of canvas.querySelectorAll<HTMLElement>("a, button, [tabindex]")) {
      element.tabIndex = -1;
    }
  }, []);

  return (
    <section className="group-graph" aria-label="メンバー関係性グラフ">
      <div ref={hideCanvasFromKeyboard} className="group-graph__canvas"
        data-testid="group-graph-canvas" aria-hidden="true">
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
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={28} size={1.5} />
          <PointerControls />
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
                    {selectedMember.nickname}と{other.nickname}の関係を見る：
                    {selection.relationship.freeTitleJa}
                    {selection.unlocked ? "（解放済み）" : ""}
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
