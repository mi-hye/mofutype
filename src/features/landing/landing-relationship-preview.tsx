"use client";

import Image from "next/image";
import { useState } from "react";

type PreviewNodeId = "entj" | "infp" | "isfj";

const previewNodes = [
  {
    id: "entj" as const,
    type: "ENTJ",
    animal: "とら",
    image: "/zodiac/tiger.png",
    className: "hero__tape",
  },
  {
    id: "infp" as const,
    type: "INFP",
    animal: "ねずみ",
    image: "/zodiac/rat.png",
    className: "hero__dots",
  },
  {
    id: "isfj" as const,
    type: "ISFJ",
    animal: "うさぎ",
    image: "/zodiac/rabbit.png",
    className: "hero__stripe",
  },
] as const;

const previewRelationships = [
  { source: "entj" as const, target: "infp" as const, className: "hero__connector--warm" },
  { source: "entj" as const, target: "isfj" as const, className: "hero__connector--clear" },
  { source: "infp" as const, target: "isfj" as const, className: "hero__connector--calm" },
] as const;

export function LandingRelationshipPreview() {
  const [selectedNode, setSelectedNode] = useState<PreviewNodeId | null>(null);

  return (
    <div className="hero__decor" role="group" aria-label="関係プレビュー">
      <svg
        className="hero__connectors"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {previewRelationships.map((relationship, index) => {
          const active = selectedNode === relationship.source || selectedNode === relationship.target;
          const coordinates = [
            { x1: 50, y1: 24, x2: 19, y2: 75 },
            { x1: 50, y1: 24, x2: 81, y2: 75 },
            { x1: 19, y1: 75, x2: 81, y2: 75 },
          ][index]!;

          return (
            <line
              key={`${relationship.source}-${relationship.target}`}
              {...coordinates}
              className={relationship.className}
              data-active={active || undefined}
            />
          );
        })}
      </svg>

      {previewNodes.map((node) => {
        const selected = selectedNode === node.id;

        return (
          <button
            key={node.id}
            type="button"
            className={`hero__node ${node.className}`}
            aria-label={`${node.type} ${node.animal}を選択`}
            aria-pressed={selected}
            onClick={() => setSelectedNode(selected ? null : node.id)}
          >
            <span className="hero__node-frame" aria-hidden="true">
              <span className="hero__node-type">{node.type}</span>
              <Image src={node.image} alt="" width={512} height={512} />
            </span>
          </button>
        );
      })}

      <p className="sr-only" role="status">
        {selectedNode
          ? `${previewNodes.find((node) => node.id === selectedNode)?.type}につながる関係線を強調しました。`
          : "すべての関係線を表示しています。"}
      </p>
    </div>
  );
}
