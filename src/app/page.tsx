import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { Capsule } from "@/components/ui/capsule";
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
          <Capsule>#MBTI</Capsule>
          <Capsule>#12干支</Capsule>
        </div>
        <span className="hero__issue-note" aria-hidden="true">
          FRIENDS FILE<br />ISSUE 01
        </span>
        <div className="hero__actions">
          <ButtonLink
            className="hero__cta"
            size="lg"
            href="/create/profile"
          >
            グループを作る
          </ButtonLink>
        </div>

        <section className="service-flow" aria-labelledby="service-flow-title">
          <header className="service-flow__header">
            <h2 id="service-flow-title">MofuTypeって？</h2>
            <span aria-hidden="true" />
          </header>

          <div className="service-flow__steps">
            <span className="service-flow__line" aria-hidden="true" />

            <article className="service-flow__item" data-accent="butter">
              <span className="service-flow__number" aria-hidden="true">01</span>
              <div>
                <h3>わたしを知る</h3>
                <p>生年月日からわかる十二支に、出生時刻とMBTIを重ねて、自分らしいタイプへ。</p>
              </div>
              <Image
                className="service-flow__animal"
                src="/zodiac/tiger.png"
                alt=""
                width={256}
                height={256}
              />
            </article>

            <article className="service-flow__item" data-accent="blue">
              <span className="service-flow__number" aria-hidden="true">02</span>
              <div>
                <h3>みんなをつなぐ</h3>
                <p>友だちを招待すると、関係が一枚のマップに。</p>
              </div>
              <Image
                className="service-flow__animal"
                src="/zodiac/rat.png"
                alt=""
                width={256}
                height={256}
              />
            </article>

            <article className="service-flow__item" data-accent="pink">
              <span className="service-flow__number" aria-hidden="true">03</span>
              <div>
                <h3>違いを楽しむ</h3>
                <p>それぞれの個性を知って、もっと心地よい関係へ。</p>
              </div>
              <Image
                className="service-flow__animal"
                src="/zodiac/rabbit.png"
                alt=""
                width={256}
                height={256}
              />
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
