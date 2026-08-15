import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RelationshipResult } from "@/lib/relationship/types";
import { RelationSheet } from "./relation-sheet";

const relationship: RelationshipResult = {
  pairKey: "a:b",
  dynamic: "SAME_GROUP",
  freeTitleJa: "こじか × ひつじ、似たもの同士で話が早い",
  freeSummaryJa: "テンポが自然にそろうコンビ。",
  detail: {
    attractionJa: "惹かれ合う理由の本文",
    frictionJa: "すれ違いやすい点の本文",
    unspokenJa: "言葉にしにくい本音の本文",
    communicationJa: "会話のコツの本文",
    reconciliationJa: "仲直りのヒントの本文",
    longTermJa: "長くつきあうヒントの本文",
  },
};

describe("RelationSheet", () => {
  it("shows only free copy and meaningless skeletons while locked", () => {
    render(
      <RelationSheet
        relationship={relationship}
        memberNames={["あお", "もも"]}
        unlocked={false}
        checkoutHref="/checkout/a%3Ab?invite=token"
        detailHref="/g/token/relation/a%3Ab"
      />,
    );

    expect(screen.getByRole("heading", { name: relationship.freeTitleJa })).toBeInTheDocument();
    expect(screen.getByText(relationship.freeSummaryJa)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "このふたりを300円で解放" })).toHaveAttribute(
      "href",
      "/checkout/a%3Ab?invite=token",
    );
    expect(screen.getByLabelText("ロック中の詳細")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "この関係の共有ページ" })).toHaveAttribute(
      "href",
      "/g/token/relation/a%3Ab",
    );
    for (const paidCopy of Object.values(relationship.detail)) {
      expect(screen.queryByText(paidCopy)).not.toBeInTheDocument();
    }
  });

  it("shows all six sections and no checkout action after the pair is unlocked", () => {
    render(
      <RelationSheet
        relationship={relationship}
        memberNames={["あお", "もも"]}
        unlocked
        checkoutHref="/checkout/a%3Ab?invite=token"
      />,
    );

    expect(screen.getByText("解放済み")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "このふたりを300円で解放" })).not.toBeInTheDocument();
    for (const [heading, copy] of [
      ["惹かれ合う理由", relationship.detail.attractionJa],
      ["すれ違いやすい点", relationship.detail.frictionJa],
      ["言葉にしにくい本音", relationship.detail.unspokenJa],
      ["会話のコツ", relationship.detail.communicationJa],
      ["仲直りのヒント", relationship.detail.reconciliationJa],
      ["長くつきあうヒント", relationship.detail.longTermJa],
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      expect(screen.getByText(copy)).toBeInTheDocument();
    }
  });

  it("offers an accessible close action when embedded in the graph", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <RelationSheet
        relationship={relationship}
        memberNames={["あお", "もも"]}
        unlocked={false}
        checkoutHref="/checkout/a%3Ab?invite=token"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "関係詳細を閉じる" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
