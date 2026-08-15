import { Card } from "@/components/ui/card";
import { StartGroupForm } from "@/features/onboarding/start-group-form";

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
          <svg
            className="hero__connectors"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            focusable="false"
          >
            <line x1="50" y1="24" x2="19" y2="75" />
            <line x1="50" y1="24" x2="81" y2="75" />
            <line x1="19" y1="75" x2="81" y2="75" />
          </svg>
          <span className="hero__tape" />
          <span className="hero__dots" />
          <span className="hero__stripe" />
        </div>
        <span className="hero__cutout" aria-hidden="true">MOFU / 01</span>
        <h1 aria-label="わたしたち、こんな感じ。">
          わたしたち、<span>こんな感じ。</span>
        </h1>
        <div className="hero__stickers" aria-label="ムード">
          <span>#MBTI</span>
          <span>#12干支</span>
        </div>
        <span className="hero__issue-note" aria-hidden="true">
          FRIENDS FILE<br />ISSUE 01
        </span>
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
          <span className="create-section__tape" aria-hidden="true" />
          <p className="hero__eyebrow">はじめる</p>
          <h2 id="create-title">グループを作る</h2>
          <p>まずはグループ名から。次のページであなたのプロフィールを入力します。</p>
        </div>
        <Card variant="accent">
          <StartGroupForm />
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
          <p>生年月日とMBTIから、あなたらしい動物タイプを見つけます。</p>
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
