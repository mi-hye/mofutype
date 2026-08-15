import type { RelationshipResult } from "@/lib/relationship/types";

const DETAIL_SECTIONS = [
  ["惹かれ合う理由", "attractionJa"],
  ["すれ違いやすい点", "frictionJa"],
  ["言葉にしにくい本音", "unspokenJa"],
  ["会話のコツ", "communicationJa"],
  ["仲直りのヒント", "reconciliationJa"],
  ["長くつきあうヒント", "longTermJa"],
] as const;

interface RelationSheetProps {
  relationship: RelationshipResult;
  memberNames: readonly [string, string];
  unlocked: boolean;
  checkoutHref: string;
  detailHref?: string;
  onClose?: () => void;
}

export function RelationSheet({
  relationship,
  memberNames,
  unlocked,
  checkoutHref,
  detailHref,
  onClose,
}: RelationSheetProps) {
  return (
    <section className="relation-sheet" aria-labelledby="relation-sheet-title">
      <header className="relation-sheet__header">
        <p>{memberNames[0]} × {memberNames[1]}</p>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="関係詳細を閉じる">
            閉じる
          </button>
        ) : null}
      </header>
      <h2 id="relation-sheet-title">{relationship.freeTitleJa}</h2>
      <p>{relationship.freeSummaryJa}</p>
      {detailHref ? <a href={detailHref}>この関係の共有ページ</a> : null}

      {unlocked ? (
        <div className="relation-sheet__details">
          <p className="relation-sheet__status">解放済み</p>
          {DETAIL_SECTIONS.map(([heading, key]) => (
            <section key={key}>
              <h3>{heading}</h3>
              <p>{relationship.detail[key]}</p>
            </section>
          ))}
        </div>
      ) : (
        <div className="relation-sheet__locked">
          <div
            className="relation-sheet__skeletons"
            role="region"
            aria-label="ロック中の詳細"
          >
            {DETAIL_SECTIONS.map(([, key], index) => (
              <span
                aria-hidden="true"
                className="relation-sheet__skeleton"
                data-length={index % 2 === 0 ? "long" : "short"}
                key={key}
              />
            ))}
          </div>
          <a
            className="ui-button"
            data-size="lg"
            data-variant="primary"
            href={checkoutHref}
          >
            このふたりを300円で解放
          </a>
        </div>
      )}
    </section>
  );
}
