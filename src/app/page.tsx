import { Card } from "@/components/ui/card";
import { CreateGroupForm } from "@/features/onboarding/create-group-form";

export default function Home() {
  return (
    <main className="landing-shell">
      <header className="landing-nav">
        <a className="wordmark" href="#top" aria-label="MofuType ホーム">
          MofuType
        </a>
        <span className="edition-label">GROUP EDITION</span>
      </header>

      <section className="hero" id="top">
        <div className="hero__decor" aria-hidden="true">
          <span className="hero__tape" />
          <span className="hero__dots" />
          <span className="hero__stripe" />
        </div>
        <p className="hero__eyebrow">性格タイプ × 十二支キャラクター</p>
        <h1 aria-label="わたしたち、こんな感じ。">
          わたしたち、<span>こんな感じ。</span>
        </h1>
        <div className="hero__stickers" aria-label="ムード">
          <span>#MBTI</span>
          <span>#十二支</span>
        </div>
        <p className="hero__copy">
          誕生日と性格タイプで、友だちとの空気感を一枚の関係マップに。
        </p>
        <div className="hero__actions">
          <a
            className="ui-button hero__cta"
            data-size="lg"
            data-variant="primary"
            href="#create"
          >
            グループを作る
          </a>
        </div>
      </section>

      <section className="create-section" id="create" aria-labelledby="create-title">
        <div className="create-section__intro">
          <p className="hero__eyebrow">はじめる</p>
          <h2 id="create-title">グループを作る</h2>
          <p>あなたのプロフィールを入力して、みんなを招待するグループを作りましょう。</p>
        </div>
        <Card variant="accent">
          <CreateGroupForm />
        </Card>
      </section>

      <section
        className="feature-grid"
        id="features"
        aria-label="MofuTypeでできること"
      >
        <Card variant="accent">
          <span className="feature-card__number">01</span>
          <h2>わたしを知る</h2>
          <p>生年月日とMBTIから、あなたらしい十二支タイプを見つけます。</p>
        </Card>
        <Card>
          <span className="feature-card__number">02</span>
          <h2>みんなをつなぐ</h2>
          <p>友だちやチームを招待して、関係性を一枚のマップに。</p>
        </Card>
        <Card variant="subtle">
          <span className="feature-card__number">03</span>
          <h2>違いを楽しむ</h2>
          <p>それぞれの個性を知って、もっと心地よい関係へ。</p>
        </Card>
      </section>
    </main>
  );
}
