import { ZodiacAvatar } from "@/components/zodiac-avatar";
import { ButtonLink } from "@/components/ui/button";
import { Capsule } from "@/components/ui/capsule";
import { GroupShareControls } from "@/features/share/group-share-controls";
import { createCharacterCopy } from "@/lib/eto/character";
import { createPersonalReading } from "@/lib/eto/personal-reading";
import type { GroupMember } from "@/lib/supabase/models";
import type { RelationshipDetailLink } from "./relationship-detail-links";

const ELEMENT_LABELS = { WOOD: "木", FIRE: "火", EARTH: "土", METAL: "金", WATER: "水" } as const;
const POLARITY_LABELS = { YIN: "陰", YANG: "陽" } as const;

interface PersonalReadingProps {
  member: GroupMember;
  groupName: string;
  memberCount: number;
  inviteToken: string;
  relationshipLinks?: readonly RelationshipDetailLink[];
}

interface PersonalReadingSummaryProps extends Omit<PersonalReadingProps, "inviteToken"> {
  inviteToken?: string;
}

function RelationshipDetailCta({
  links = [],
}: {
  links?: readonly RelationshipDetailLink[];
}) {
  if (links.length === 0) return null;
  if (links.length === 1) {
    return (
      <ButtonLink href={links[0].href} variant="secondary">
        このグループで、誰と相性がいい？
      </ButtonLink>
    );
  }

  return (
    <details className="relationship-detail-picker">
      <summary className="ui-button" data-size="md" data-variant="secondary">
        <span>このグループで、誰と相性がいい？</span>
      </summary>
      <ul aria-label="関係を詳しく見る相手を選ぶ">
        {links.map((link) => (
          <li key={link.memberId}>
            <ButtonLink href={link.href} size="sm" variant="secondary">
              {link.nickname}さんとの関係を見る
            </ButtonLink>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Identity({ member }: { member: GroupMember }) {
  const character = createCharacterCopy(member.zodiacId, member.mbti);
  const element = ELEMENT_LABELS[member.profile.dayMaster.element];
  const polarity = POLARITY_LABELS[member.profile.dayMaster.polarity];

  return (
    <div className="my-result-card__summary">
      <ZodiacAvatar zodiacId={member.zodiacId} nickname={member.nickname} size="md" />
      <div className="my-result-card__identity">
        <span>わたしの四柱推命</span>
        <strong>{character.titleJa}</strong>
        <ul aria-label="診断結果の詳細">
          <li><Capsule>{member.mbti ?? "MBTI未設定"}</Capsule></li>
          <li><Capsule>{element}・{polarity}</Capsule></li>
          <li>
            <Capsule>
              {member.profile.calculationMode === "date-time" ? "出生時刻を反映" : "生年月日で診断"}
            </Capsule>
          </li>
        </ul>
      </div>
    </div>
  );
}

export function PersonalReadingSummary({
  member,
  groupName,
  memberCount,
  inviteToken,
  relationshipLinks,
}: PersonalReadingSummaryProps) {
  const reading = createPersonalReading(member.profile);
  const detailHref = inviteToken ? `/g/${encodeURIComponent(inviteToken)}/profile` : null;

  return (
    <section className="my-result-card my-result-card--summary" aria-labelledby="my-result-preview-title">
      <Identity member={member} />
      <div className="my-result-card__preview">
        <p>FREE PREVIEW</p>
        <h2 id="my-result-preview-title">{reading.zodiac.titleJa}</h2>
        <p>{reading.zodiac.summaryJa}</p>
      </div>
      <div className="my-result-card__actions">
        {detailHref ? <ButtonLink href={detailHref}>わたしの詳細を見る</ButtonLink> : null}
        <RelationshipDetailCta links={relationshipLinks} />
        {inviteToken ? (
          <GroupShareControls
            groupName={groupName}
            inviteToken={inviteToken}
            memberCount={memberCount}
            triggerLabel="共有する"
          />
        ) : null}
      </div>
    </section>
  );
}

export function PersonalReadingDetail({
  member,
  groupName,
  memberCount,
  inviteToken,
}: PersonalReadingProps) {
  const reading = createPersonalReading(member.profile);
  const groupHref = `/g/${encodeURIComponent(inviteToken)}`;

  return (
    <main className="personal-detail-shell">
      <a className="personal-detail__back" href={groupHref}>関係マップに戻る</a>
      <article className="my-result-card personal-detail-card">
        <Identity member={member} />
        <div className="my-result-card__reading-grid">
          <section className="my-result-card__reading">
            <h2>十二支の気質</h2>
            <h3>{reading.zodiac.titleJa}</h3>
            <p>{reading.zodiac.summaryJa}</p>
          </section>
          {reading.mbti ? (
            <section className="my-result-card__reading my-result-card__reading--mbti">
              <h2>{reading.mbti.titleJa}</h2>
              <p>{reading.mbti.leadJa}</p>
              <ul className="my-result-card__axes" aria-label="MBTIの4つの視点">
                {reading.mbti.axes.map((axis) => (
                  <li key={axis.code}>
                    <strong>{axis.code} · {axis.labelJa}</strong>
                    <span>{axis.summaryJa}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="my-result-card__reading">
            <h2>{reading.fourPillars.titleJa}</h2>
            <p>{reading.fourPillars.summaryJa}</p>
          </section>
          <section className="my-result-card__reading my-result-card__reading--combined">
            <h2>{reading.combined.titleJa}</h2>
            <p>{reading.combined.summaryJa}</p>
          </section>
          <small className="my-result-card__note">
            十二支・MBTI・五行と陰陽を重ねた、自己理解のための読み解きです。
          </small>
        </div>
      </article>

      <GroupShareControls
        groupName={groupName}
        inviteToken={inviteToken}
        memberCount={memberCount}
        triggerLabel="この結果を共有する"
      />
    </main>
  );
}
