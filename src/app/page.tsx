import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
          <Button size="lg">はじめる</Button>
          <Button size="lg" variant="secondary">
            グループに参加
          </Button>
        </div>
      </section>

      <section className="feature-grid" aria-label="MofuTypeでできること">
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
