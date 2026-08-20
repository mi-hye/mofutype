"use client";

import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import type { RelationshipDetailLink } from "./relationship-detail-links";

export function RelationshipDetailPicker({
  links = [],
}: {
  links?: readonly RelationshipDetailLink[];
}) {
  const [selectedHref, setSelectedHref] = useState("");
  const selectedLink = links.find((link) => link.href === selectedHref) ?? null;

  if (links.length === 0) return null;
  if (links.length === 1) {
    return (
      <ButtonLink href={links[0].href} variant="secondary">
        このグループで、誰と相性がいい？
      </ButtonLink>
    );
  }

  return (
    <div className="relationship-detail-picker">
      <label>
        <span>このグループで、誰との関係を見る？</span>
        <select
          aria-label="関係を見る相手を選ぶ"
          value={selectedLink?.href ?? ""}
          onChange={(event) => setSelectedHref(event.target.value)}
        >
          <option value="">相手を選ぶ</option>
          {links.map((link) => (
            <option key={link.memberId} value={link.href}>
              {link.nickname}
            </option>
          ))}
        </select>
      </label>
      {selectedLink ? (
        <ButtonLink href={selectedLink.href} variant="secondary">
          {selectedLink.nickname}さんとの関係を見る
        </ButtonLink>
      ) : (
        <Button type="button" variant="secondary" disabled>
          この関係を見る
        </Button>
      )}
    </div>
  );
}
