import { ButtonLink } from "@/components/ui/button";
import type { EtoRelationshipResult } from "@/lib/eto/relationship";
import type { DerivedEtoProfile } from "@/lib/eto/types";

const LOCKED_CHAPTERS = [
  ["zodiac", "十二支の関係"],
  ["elements", "五行と陰陽"],
  ["mbti", "MBTIの4つの軸"],
  ["together", "ふたりでいるとき"],
  ["directions", "それぞれへのヒント"],
] as const;
const MBTI_AXES = [
  ["E / I", "energyJa"],
  ["S / N", "informationJa"],
  ["T / F", "decisionJa"],
  ["J / P", "lifestyleJa"],
] as const;

interface RelationSheetProps {
  relationship: EtoRelationshipResult;
  memberNames: readonly [string, string];
  memberProfiles: readonly [DerivedEtoProfile, DerivedEtoProfile];
  unlocked: boolean;
  checkoutHref: string;
  detailHref?: string;
  onClose?: () => void;
}

function hasUnavailableBoundaryDistribution(
  profiles: readonly [DerivedEtoProfile, DerivedEtoProfile],
) {
  return profiles.some((profile) =>
    profile.boundaryState === "solar-term-ambiguous" &&
    profile.fiveElements === null &&
    profile.yinYang === null
  );
}

export function RelationSheet({
  relationship,
  memberNames,
  memberProfiles,
  unlocked,
  checkoutHref,
  detailHref,
  onClose,
}: RelationSheetProps) {
  const boundaryDistributionUnavailable = hasUnavailableBoundaryDistribution(memberProfiles);
  const usesDateOnlyAnalysis = memberProfiles.some(
    (profile) => profile.calculationMode === "date-only",
  );
  const mbtiInsight = relationship.mbtiInsight;

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
      <p className="relation-sheet__category">{relationship.categoryLabelJa}</p>
      <h2 id="relation-sheet-title">{relationship.headlineJa}</h2>
      {usesDateOnlyAnalysis ? (
        <p className="relation-sheet__note">出生時刻を使わない分析です</p>
      ) : null}
      {detailHref ? <a href={detailHref}>この関係の共有ページ</a> : null}

      {unlocked ? (
        <div className="relation-sheet__details">
          <p className="relation-sheet__status">解放済み</p>

          <section className="relation-sheet__layer">
            <h3>十二支の関係</h3>
            <h4>{relationship.zodiacInsight.title}</h4>
            <p>{relationship.zodiacInsight.summary}</p>
          </section>

          <section className="relation-sheet__layer">
            <h3>五行と陰陽</h3>
            <h4>{relationship.fiveElementInsight.title}</h4>
            <p>{relationship.fiveElementInsight.summary}</p>
            {boundaryDistributionUnavailable ? (
              <p className="relation-sheet__note">
                節入りの境界に近いため、五行と陰陽の分布は表示していません。
              </p>
            ) : null}
          </section>

          <section className="relation-sheet__layer">
            <h3>MBTIの4つの軸</h3>
            {mbtiInsight ? (
              <>
                <h4>{mbtiInsight.title}</h4>
                <p>{mbtiInsight.summary}</p>
                <dl className="relation-sheet__axes">
                  {MBTI_AXES.map(([label, key]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{mbtiInsight.axes[key]}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="relation-sheet__note">
                MBTIが未入力のため、この層は表示していません。十二支と五行の分析には影響しません。
              </p>
            )}
          </section>

          <section className="relation-sheet__layer">
            <h3>ふたりでいるとき</h3>
            <p>{relationship.tips.togetherJa}</p>
          </section>

          <div className="relation-sheet__directional-tips">
            <section className="relation-sheet__tip">
              <h3>{memberNames[0]}さんへのヒント</h3>
              <p>{relationship.tips.forPersonAJa}</p>
            </section>
            <section className="relation-sheet__tip">
              <h3>{memberNames[1]}さんへのヒント</h3>
              <p>{relationship.tips.forPersonBJa}</p>
            </section>
          </div>
        </div>
      ) : (
        <div className="relation-sheet__locked">
          <section className="relation-sheet__offer" aria-labelledby="relation-offer-title">
            <div>
              <p>PAIR REPORT</p>
              <h3 id="relation-offer-title">解放するとわかること</h3>
            </div>
            <ul>
              <li>十二支・五行・陰陽・MBTIの読み解き</li>
              <li>ふたりでいるときのヒント</li>
              <li>それぞれに向けた関わり方</li>
            </ul>
            <p className="relation-sheet__offer-price">1組 300円</p>
          </section>
          <div
            className="relation-sheet__skeletons"
            role="region"
            aria-label="ロック中の詳細"
          >
            {LOCKED_CHAPTERS.map(([key, title], index) => (
              <span
                aria-hidden="true"
                className="relation-sheet__skeleton"
                data-length={index % 2 === 0 ? "long" : "short"}
                key={key}
              >
                <strong>{title}</strong>
                <small>LOCKED</small>
              </span>
            ))}
          </div>
          <ButtonLink size="lg" href={checkoutHref}>
            このふたりを300円で解放
          </ButtonLink>
        </div>
      )}
      <p className="relation-sheet__disclaimer">
        この分析は自己理解とコミュニケーションを楽しむためのもので、科学的・医学的な判定ではありません。
      </p>
    </section>
  );
}
