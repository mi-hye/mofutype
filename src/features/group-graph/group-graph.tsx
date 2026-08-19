"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  type EdgeMouseHandler,
  type NodeMouseHandler,
} from "@xyflow/react";

import {
  createEtoRelationship,
  type EtoRelationshipResult,
} from "@/lib/eto/relationship";
import type { RelationUnlock } from "@/lib/supabase/models";
import { ZodiacNode } from "./zodiac-node";
import {
  buildGraphTopology,
  decorateGraph,
  graphMemberSnapshot,
  graphMembersVersion,
  type RelationshipFactory,
  type RelationshipGraphMember,
  type RelationshipGraphEdge,
  type ZodiacGraphNode,
} from "./build-graph";

export interface PairSelection {
  pairKey: string;
  memberIds: readonly [RelationshipGraphMember["id"], RelationshipGraphMember["id"]];
  relationship: EtoRelationshipResult;
  unlocked: boolean;
}

interface GroupGraphProps {
  members: readonly RelationshipGraphMember[];
  unlocks: readonly RelationUnlock[];
  onPairSelect: (selection: PairSelection) => void;
  relationshipFactory?: RelationshipFactory;
}

const nodeTypes = { zodiac: ZodiacNode };

function removeFromTabOrder(canvas: HTMLDivElement) {
  for (const element of canvas.querySelectorAll<HTMLElement>("a, button, [tabindex]")) {
    element.tabIndex = -1;
  }
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
  relationshipFactory = createEtoRelationship,
}: GroupGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
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
  const fitViewPadding = members.length <= 6 ? 0.34 : 0.22;

  const handleNodeClick = useCallback<NodeMouseHandler<ZodiacGraphNode>>(
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
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    removeFromTabOrder(canvas);
    const observer = new MutationObserver(() => removeFromTabOrder(canvas));
    observer.observe(canvas, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [membersVersion]);

  return (
    <section className="group-graph" aria-label="メンバー関係性グラフ">
      <div ref={canvasRef} className="group-graph__canvas"
        data-testid="group-graph-canvas" data-member-count={members.length} aria-hidden="true">
        <ReactFlow<ZodiacGraphNode, RelationshipGraphEdge>
          key={membersVersion}
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          fitViewOptions={{ padding: fitViewPadding }}
          maxZoom={1}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        />
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
              <span className="group-graph__member-character">
                {node.data.characterTitleJa}
              </span>
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
                    {selection.relationship.headlineJa}
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
