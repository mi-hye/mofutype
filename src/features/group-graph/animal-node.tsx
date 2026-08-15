"use client";

import { Handle, Position } from "@xyflow/react";

import { AnimalAvatar } from "@/components/animal-avatar";
import type { AnimalNodeData } from "./build-graph";

export function AnimalNode({ data }: { data: AnimalNodeData }) {
  return (
    <div className="animal-graph-node" data-selected={data.selected ? "true" : "false"}
      aria-label={data.accessibleLabel}>
      <Handle type="target" position={Position.Top} className="animal-graph-node__handle" />
      <AnimalAvatar animalId={data.member.animalId} nickname={data.member.nickname}
        size={data.size} selected={data.selected} />
      {data.selected ? (
        <span className="animal-graph-node__selected-sticker" aria-hidden="true">
          SELECTED
        </span>
      ) : null}
      <span className="animal-graph-node__nickname">{data.member.nickname}</span>
      {data.discriminator ? (
        <span className="animal-graph-node__discriminator">{data.discriminator}</span>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="animal-graph-node__handle" />
    </div>
  );
}
