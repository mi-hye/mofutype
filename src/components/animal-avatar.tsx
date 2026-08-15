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
}

// Asset-file existence is intentionally verified by the Task 11 integration suite.
// This component owns only the stable catalog URL and resilient rendering contract.
export function AnimalAvatar({
  animalId,
  nickname,
  size = "md",
  selected = false,
}: AnimalAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const animal = ANIMALS[animalId];
  const accessibleName = `${nickname}の${animal.nameJa}`;

  return (
    <span
      className="animal-avatar"
      data-selected={selected ? "true" : "false"}
      data-size={size}
      data-testid="animal-avatar"
    >
      {imageFailed ? (
        <span className="animal-avatar__fallback" aria-label={accessibleName}>
          <span aria-hidden="true">{animal.nameJa}</span>
        </span>
      ) : (
        // The catalog serves trusted local SVG paths; native error handling powers the fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="animal-avatar__image"
          src={animal.asset}
          alt={accessibleName}
          onError={() => setImageFailed(true)}
        />
      )}
    </span>
  );
}
