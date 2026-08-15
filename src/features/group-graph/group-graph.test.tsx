import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupMember } from "@/lib/supabase/models";

type MockNode = { id: string; type: string; data: Record<string, unknown> };
type MockEdge = { id: string; data: Record<string, unknown> };

const flowProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  return {
    Background: () => null,
    Controls: (props: Record<string, unknown>) => <div data-testid="flow-controls" {...props} />,
    Handle: () => null,
    Position: { Top: "top", Bottom: "bottom" },
    ReactFlow: (props: Record<string, unknown>) => {
      flowProps.current = props;
      const nodes = props.nodes as MockNode[];
      const edges = props.edges as MockEdge[];
      const nodeTypes = props.nodeTypes as Record<string, React.ComponentType<Record<string, unknown>>>;
      return (
        <div data-testid="react-flow-adapter">
          {nodes.map((node) => {
            const NodeComponent = nodeTypes[node.type];
            return (
              <button key={node.id} type="button" data-testid={`canvas-node-${node.id}`}
                onClick={(event) => (props.onNodeClick as (event: React.MouseEvent, node: MockNode) => void)(event, node)}>
                <NodeComponent data={node.data} />
              </button>
            );
          })}
          {edges.map((edge) => (
            <button key={edge.id} type="button" data-testid={`canvas-edge-${edge.id}`}
              onClick={(event) => (props.onEdgeClick as (event: React.MouseEvent, edge: MockEdge) => void)(event, edge)}>{edge.id}</button>
          ))}
          <button type="button" data-testid="canvas-pane" onClick={(event) => (props.onPaneClick as (event: React.MouseEvent) => void)(event)}>blank</button>
          {props.children as React.ReactNode}
        </div>
      );
    },
  };
});

import { GroupGraph } from "./group-graph";

function member(id: string, nickname = id): GroupMember {
  return {
    id, groupId: "g1", userId: `u-${id}`, nickname,
    animalId: "fawn", animalGroup: "MOON", mbti: null,
    profile: { version: 1, animalId: "fawn", animalGroup: "MOON", mbti: null, calculationMode: "date-only" },
    joinedAt: "2026-08-15T00:00:00Z",
  };
}

describe("GroupGraph", () => {
  beforeEach(() => { flowProps.current = null; });

  it("selects a node, highlights its relationships, and clears on blank click", async () => {
    const user = userEvent.setup();
    render(<GroupGraph members={[member("a", "あお"), member("b", "べに"), member("c", "ちゃ")]} unlocks={[]} onPairSelect={vi.fn()} />);

    await user.click(screen.getByTestId("canvas-node-b"));
    expect(screen.getByRole("status", { name: "選択中のメンバー" })).toHaveTextContent("べに");
    expect(screen.getByRole("status", { name: "選択中のメンバー" })).toHaveTextContent("2本");
    await user.click(screen.getByTestId("canvas-pane"));
    expect(screen.queryByRole("status", { name: "選択中のメンバー" })).not.toBeInTheDocument();
  });

  it("sends a stable complete payload when an edge is clicked", async () => {
    const user = userEvent.setup();
    const onPairSelect = vi.fn();
    render(<GroupGraph members={[member("b"), member("a")]} unlocks={[]} onPairSelect={onPairSelect} />);

    await user.click(screen.getByTestId("canvas-edge-a:b"));
    expect(onPairSelect).toHaveBeenCalledOnce();
    expect(onPairSelect).toHaveBeenCalledWith(expect.objectContaining({
      pairKey: "a:b",
      memberIds: ["a", "b"],
      unlocked: false,
      relationship: expect.objectContaining({ pairKey: "a:b" }),
    }));
  });

  it("provides a keyboard-accessible member and relationship alternative", async () => {
    const user = userEvent.setup();
    const onPairSelect = vi.fn();
    render(<GroupGraph members={[member("a", "あお"), member("b", "べに")]} unlocks={[]} onPairSelect={onPairSelect} />);

    expect(screen.getByRole("region", { name: "関係性グラフの操作リスト" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "あおを選択" }));
    expect(screen.getByRole("button", { name: /あおとべにの関係を見る/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /あおとべにの関係を見る/ }));
    expect(onPairSelect).toHaveBeenCalledWith(expect.objectContaining({ pairKey: "a:b" }));
  });

  it("configures viewport navigation and locks graph editing", () => {
    render(<GroupGraph members={[member("a")]} unlocks={[]} onPairSelect={vi.fn()} />);
    expect(flowProps.current).toEqual(expect.objectContaining({
      fitView: true,
      minZoom: 0.35,
      maxZoom: 1.8,
      panOnDrag: true,
      zoomOnScroll: true,
      zoomOnPinch: true,
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: true,
      proOptions: { hideAttribution: false },
    }));
    expect(screen.getByTestId("flow-controls")).toHaveAttribute("data-touch-friendly", "true");
  });

  it("does not rebuild when a parent rerenders with identical graph inputs", () => {
    const members = [member("a"), member("b")];
    const unlocks: [] = [];
    const onPairSelect = vi.fn();
    const view = render(<GroupGraph members={members} unlocks={unlocks} onPairSelect={onPairSelect} />);
    const firstNodes = flowProps.current?.nodes;
    const firstEdges = flowProps.current?.edges;

    view.rerender(<GroupGraph members={members} unlocks={unlocks} onPairSelect={onPairSelect} />);
    expect(flowProps.current?.nodes).toBe(firstNodes);
    expect(flowProps.current?.edges).toBe(firstEdges);
  });
});
