"use client";

import { Handle, Position } from "@xyflow/react";

import { ZODIACS } from "@/lib/eto/zodiac";
import type { ZodiacNodeData } from "./build-graph";

export function ZodiacNode({ data }: { data: ZodiacNodeData }) {
  const zodiac = ZODIACS[data.member.zodiacId];
  const frameCenter = { sm: "2rem", md: "2.375rem", lg: "3.125rem" }[data.size];

  return (
    <div
      className="zodiac-graph-node"
      data-selected={data.selected ? "true" : "false"}
      aria-label={data.accessibleLabel}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="zodiac-graph-node__handle"
        style={{ left: "50%", top: frameCenter, transform: "translate(-50%, -50%)" }}
      />
      <span
        className="zodiac-graph-node__frame"
        data-size={data.size}
        data-zodiac={data.member.zodiacId}
        aria-hidden="true"
      >
        <span className="zodiac-graph-node__type">{data.member.mbti ?? "—"}</span>
        {/* The catalog owns trusted local PNG paths. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={zodiac.assetPath} alt="" />
        <span className="zodiac-graph-node__nickname">
          {data.member.nickname}
        </span>
      </span>
      <span className="zodiac-graph-node__character-title">
        {data.characterTitleJa}
      </span>
      {data.discriminator ? (
        <span className="zodiac-graph-node__discriminator">
          {data.discriminator}
        </span>
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="zodiac-graph-node__handle"
        style={{ left: "50%", top: frameCenter, transform: "translate(-50%, -50%)" }}
      />
    </div>
  );
}
