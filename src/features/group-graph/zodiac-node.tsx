"use client";

import { Handle, Position } from "@xyflow/react";

import { ZodiacAvatar } from "@/components/zodiac-avatar";
import type { ZodiacNodeData } from "./build-graph";

export function ZodiacNode({ data }: { data: ZodiacNodeData }) {
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
      />
      <ZodiacAvatar
        zodiacId={data.member.zodiacId}
        nickname={data.member.nickname}
        size={data.size}
        selected={data.selected}
      />
      {data.selected ? (
        <span
          className="zodiac-graph-node__selected-sticker"
          aria-hidden="true"
        >
          SELECTED
        </span>
      ) : null}
      <span className="zodiac-graph-node__nickname">
        {data.member.nickname}
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
      />
    </div>
  );
}
