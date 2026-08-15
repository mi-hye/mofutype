"use client";

import { useState } from "react";

import { ZODIACS } from "@/lib/eto/zodiac";
import type { ZodiacId } from "@/lib/eto/types";

type ZodiacAvatarSize = "sm" | "md" | "lg";

export interface ZodiacAvatarProps {
  zodiacId: ZodiacId;
  nickname: string;
  size?: ZodiacAvatarSize;
  selected?: boolean;
}

export function ZodiacAvatar({
  zodiacId,
  nickname,
  size = "md",
  selected = false,
}: ZodiacAvatarProps) {
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const zodiac = ZODIACS[zodiacId];
  const accessibleName = `${nickname}の${zodiac.nameJa}`;
  const imageFailed = failedAsset === zodiac.assetPath;

  return (
    <span
      className="animal-avatar zodiac-avatar"
      data-selected={selected ? "true" : "false"}
      data-size={size}
      data-testid="zodiac-avatar"
    >
      {imageFailed ? (
        <span
          className="animal-avatar__fallback zodiac-avatar__fallback"
          role="img"
          aria-label={accessibleName}
        >
          <span aria-hidden="true">{zodiac.nameJa}</span>
        </span>
      ) : (
        // The catalog serves trusted local PNG paths; native error handling powers the fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="animal-avatar__image zodiac-avatar__image"
          src={zodiac.assetPath}
          alt={accessibleName}
          onError={() => setFailedAsset(zodiac.assetPath)}
        />
      )}
      {selected ? (
        <span
          className="animal-avatar__selected-mark zodiac-avatar__selected-mark"
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}
