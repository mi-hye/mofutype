"use client";

import { useState } from "react";

import { ANIMALS } from "@/lib/astrology/animals";
import type { AnimalId } from "@/lib/astrology/types";

type AnimalAvatarSize = "sm" | "md" | "lg";

export interface AnimalAvatarProps {
  animalId: AnimalId;
  nickname: string;
  size?: AnimalAvatarSize;
  selected?: boolean;
  src?: string;
}

// Asset-file existence is intentionally verified by the Task 11 integration suite.
// This component owns only the stable catalog URL and resilient rendering contract.
export function AnimalAvatar({
  animalId,
  nickname,
  size = "md",
  selected = false,
  src,
}: AnimalAvatarProps) {
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const animal = ANIMALS[animalId];
  const asset = src ?? animal.asset;
  const accessibleName = `${nickname}の${animal.nameJa}`;
  const imageFailed = failedAsset === asset;

  return (
    <span
      className="animal-avatar"
      data-selected={selected ? "true" : "false"}
      data-size={size}
      data-testid="animal-avatar"
    >
      {imageFailed ? (
        <span
          className="animal-avatar__fallback"
          role="img"
          aria-label={accessibleName}
        >
          <span aria-hidden="true">{animal.nameJa}</span>
        </span>
      ) : (
        // Trusted local assets use native error handling to preserve the text fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="animal-avatar__image"
          src={asset}
          alt={accessibleName}
          onError={() => setFailedAsset(asset)}
        />
      )}
      {selected ? (
        <span className="animal-avatar__selected-mark" aria-hidden="true" />
      ) : null}
    </span>
  );
}
