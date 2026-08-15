import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEtoRelationship } from "@/lib/eto/relationship";
import type { DerivedEtoProfile, ZodiacId } from "@/lib/eto/types";
import type { GroupMember, RelationUnlock } from "@/lib/supabase/models";

type MockNode = { id: string; type: string; data: Record<string, unknown> };
type MockEdge = { id: string; data: Record<string, unknown> };

const flowProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  return {
    Background: () => null,
    Handle: () => null,
    useReactFlow: () => ({ zoomIn: vi.fn(), zoomOut: vi.fn(), fitView: vi.fn() }),
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
                tabIndex={props.nodesFocusable === false ? -1 : 0}
                onClick={(event) => (props.onNodeClick as (event: React.MouseEvent, node: MockNode) => void)(event, node)}>
                <NodeComponent data={node.data} />
              </button>
            );
          })}
          {edges.map((edge) => (
            <button key={edge.id} type="button" data-testid={`canvas-edge-${edge.id}`}
              tabIndex={props.edgesFocusable === false ? -1 : 0}
              onClick={(event) => (props.onEdgeClick as (event: React.MouseEvent, edge: MockEdge) => void)(event, edge)}>{edge.id}</button>
          ))}
          <button type="button" tabIndex={-1} data-testid="canvas-pane" onClick={(event) => (props.onPaneClick as (event: React.MouseEvent) => void)(event)}>blank</button>
          {props.children as React.ReactNode}
          <a href="https://reactflow.dev/attribution">React Flow</a>
        </div>
      );
    },
  };
});

import { GroupGraph } from "./group-graph";

function profile(zodiacId: ZodiacId = "dragon"): DerivedEtoProfile {
  return {
    version: 1,
    zodiacId,
    mbti: null,
    dayMaster: { element: "WOOD", polarity: "YANG" },
    fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 1, WATER: 1 },
    yinYang: { YIN: 3, YANG: 3 },
    calculationMode: "date-only",
    boundaryState: "exact",
    engineVersion: "mofu-eto-four-pillars-v1",
  };
}

function member(id: string, nickname = id, zodiacId: ZodiacId = "dragon"): GroupMember {
  return {
    id, groupId: "g1", userId: `u-${id}`, nickname,
    zodiacId, mbti: null, profile: profile(zodiacId),
    joinedAt: "2026-08-15T00:00:00Z",
  };
}

function unlock(low: string, high: string): RelationUnlock {
  return {
    id: `u-${low}-${high}`, groupId: "g1", memberLowId: low, memberHighId: high,
    status: "unlocked", paymentProvider: "mock", paymentReference: null,
    unlockedBy: low, unlockedAt: "2026-08-15T00:00:00Z",
  };
}

describe("GroupGraph", () => {
  beforeEach(() => { flowProps.current = null; });

  it("selects a node, highlights its relationships, and clears on blank click", async () => {
    const user = userEvent.setup();
    render(<GroupGraph members={[member("a", "あお"), member("b", "べに"), member("c", "ちゃ")]} unlocks={[]} onPairSelect={vi.fn()} />);

    await user.click(screen.getByTestId("canvas-node-b"));
    expect(within(screen.getByTestId("canvas-node-b")).getByText("SELECTED"))
      .toHaveClass("zodiac-graph-node__selected-sticker");
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
    render(<GroupGraph members={[member("a", "あお"), member("b", "べに"), member("c", "ちゃ")]} unlocks={[unlock("a", "b")]} onPairSelect={onPairSelect} />);

    expect(screen.getByRole("region", { name: "関係性グラフの操作リスト" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "あおを選択" }));
    const relationshipButton = screen.getByRole("button", { name: /あおとべにの関係を見る.*解放済み/ });
    expect(relationshipButton).toHaveTextContent("たつとたつ");
    expect(relationshipButton).not.toHaveTextContent("a:b");
    const lockedRelationshipButton = screen.getByRole("button", { name: /あおとちゃの関係を見る/ });
    expect(lockedRelationshipButton).not.toHaveTextContent("解放済み");
    expect(lockedRelationshipButton).not.toHaveTextContent("a:c");
    await user.click(relationshipButton);
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
      nodesFocusable: false,
      edgesFocusable: false,
      elementsSelectable: true,
      proOptions: { hideAttribution: false },
    }));
    const canvas = screen.getByTestId("group-graph-canvas");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(Array.from(canvas.querySelectorAll<HTMLElement>("a, button, [tabindex]"))
      .every((element) => element.tabIndex === -1)).toBe(true);
    expect(screen.queryByRole("button", { name: "aの関係性ノード" })).not.toBeInTheDocument();
    const accessibleList = screen.getByRole("region", { name: "関係性グラフの操作リスト" });
    expect(within(accessibleList).queryByText("a:b")).not.toBeInTheDocument();
  });

  it("keeps remounted canvas descendants out of the tab order after a semantic change", () => {
    const view = render(
      <GroupGraph members={[member("a")]} unlocks={[]} onPairSelect={vi.fn()} />,
    );

    view.rerender(
      <GroupGraph
        members={[member("a", "semantic-change")]}
        unlocks={[]}
        onPairSelect={vi.fn()}
      />,
    );

    const canvas = screen.getByTestId("group-graph-canvas");
    expect(Array.from(canvas.querySelectorAll<HTMLElement>("a, button, [tabindex]"))
      .every((element) => element.tabIndex === -1)).toBe(true);
  });

  it("keeps asynchronously inserted canvas descendants out of the tab order", async () => {
    render(<GroupGraph members={[member("a")]} unlocks={[]} onPairSelect={vi.fn()} />);
    const canvas = screen.getByTestId("group-graph-canvas");
    const lateButton = document.createElement("button");

    canvas.append(lateButton);

    await waitFor(() => expect(lateButton.tabIndex).toBe(-1));
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

  it("builds 30-member relationships once across presentation-only changes", async () => {
    const user = userEvent.setup();
    const members = Array.from({ length: 30 }, (_, index) => member(`m-${String(index).padStart(2, "0")}`));
    const relationshipFactory = vi.fn(createEtoRelationship);
    const onPairSelect = vi.fn();
    const view = render(
      <GroupGraph members={members} unlocks={[]} onPairSelect={onPairSelect}
        relationshipFactory={relationshipFactory} />,
    );
    expect(relationshipFactory).toHaveBeenCalledTimes(435);

    await user.click(screen.getByTestId("canvas-node-m-12"));
    await user.click(screen.getByTestId("canvas-pane"));
    expect(relationshipFactory).toHaveBeenCalledTimes(435);

    view.rerender(
      <GroupGraph members={members} unlocks={[unlock("m-00", "m-01")]}
        onPairSelect={vi.fn()} relationshipFactory={relationshipFactory} />,
    );
    expect(relationshipFactory).toHaveBeenCalledTimes(435);

    const sameSemanticMembers = members.map((item, index) => ({
      ...item,
      groupId: "irrelevant-group",
      userId: `irrelevant-user-${index}`,
      joinedAt: "2099-01-01T00:00:00Z",
      profile: { ...item.profile },
    }));
    view.rerender(
      <GroupGraph members={sameSemanticMembers} unlocks={[unlock("m-00", "m-01")]}
        onPairSelect={vi.fn()} relationshipFactory={relationshipFactory} />,
    );
    expect(relationshipFactory).toHaveBeenCalledTimes(435);

    const changedMembers = sameSemanticMembers.map((item, index) =>
      index === 0 ? { ...item, nickname: "semantic-change" } : item,
    );
    view.rerender(
      <GroupGraph members={changedMembers} unlocks={[unlock("m-00", "m-01")]}
        onPairSelect={vi.fn()} relationshipFactory={relationshipFactory} />,
    );
    expect(relationshipFactory).toHaveBeenCalledTimes(870);
  });
});
