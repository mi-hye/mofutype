import Image from "next/image";

import { LandingRelationshipPreview } from "@/features/landing/landing-relationship-preview";

export default function Home() {
  return (
    <main className="landing-shell">
      <header className="landing-nav">
        <a className="wordmark" href="#top" aria-label="MofuType ホーム">
          <Image
            className="wordmark__image"
            src="/brand/mofutype-wordmark.png"
            alt=""
            width={960}
            height={240}
            priority
          />
        </a>
      </header>

      <section className="hero" id="top">
        <LandingRelationshipPreview />
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
            href="/create/profile"
          >
            グループを作る
          </a>
        </div>
      </section>

    </main>
  );
}
