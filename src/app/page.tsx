import Image from "next/image";

import { Card } from "@/components/ui/card";
import { LandingRelationshipPreview } from "@/features/landing/landing-relationship-preview";
import { StartGroupForm } from "@/features/onboarding/start-group-form";

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
        </div>
        <Card variant="accent">
          <StartGroupForm />
        </Card>
      </section>

    </main>
  );
}
