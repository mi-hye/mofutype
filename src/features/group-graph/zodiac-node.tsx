"use client";

import { Handle, Position } from "@xyflow/react";

import { ZodiacAvatar } from "@/components/zodiac-avatar";
import type { ZodiacNodeData } from "./build-graph";

export function ZodiacNode({ data }: { data: ZodiacNodeData }) {
  return (
    <div
      className="animal-graph-node zodiac-graph-node"
      data-selected={data.selected ? "true" : "false"}
      aria-label={data.accessibleLabel}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="animal-graph-node__handle zodiac-graph-node__handle"
      />
      <ZodiacAvatar
        zodiacId={data.member.zodiacId}
        nickname={data.member.nickname}
        size={data.size}
        selected={data.selected}
      />
      {data.selected ? (
        <span
          className="animal-graph-node__selected-sticker zodiac-graph-node__selected-sticker"
          aria-hidden="true"
        >
          SELECTED
        </span>
      ) : null}
      <span className="animal-graph-node__nickname zodiac-graph-node__nickname">
        {data.member.nickname}
      </span>
      {data.discriminator ? (
        <span className="animal-graph-node__discriminator zodiac-graph-node__discriminator">
          {data.discriminator}
        </span>
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="animal-graph-node__handle zodiac-graph-node__handle"
      />
    </div>
  );
}
