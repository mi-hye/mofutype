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
        <p className="hero__eyebrow">性格タイプ × 動物キャラクター</p>
        <h1>
          みんなの関係が、
          <span>ひと目でわかる。</span>
        </h1>
        <p className="hero__copy">
          誕生日と性格タイプから、グループの個性やつながりをやさしく可視化します。
        </p>
        <div className="hero__actions">
          <a
            className="ui-button hero__cta"
            data-size="lg"
            data-variant="primary"
            href="#features"
          >
            できることを見る
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
