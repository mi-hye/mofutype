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

        <section className="value-ledger" aria-labelledby="value-ledger-title">
          <header className="value-ledger__header">
            <p>FREE → PAIR REPORT</p>
            <h2 id="value-ledger-title" aria-label="まずは無料で、みんなの輪郭まで。">
              まずは無料で、<br />みんなの輪郭まで。
            </h2>
          </header>

          <div className="value-ledger__tiers">
            <article className="value-ledger__tier" data-tier="free">
              <div className="value-ledger__tier-heading">
                <span>0円</span>
                <h3>グループで楽しめること</h3>
              </div>
              <ul>
                <li>自分の十二支タイプ</li>
                <li>みんなの関係マップ</li>
                <li>関係のひとことラベル</li>
              </ul>
            </article>

            <article className="value-ledger__tier" data-tier="paid">
              <div className="value-ledger__tier-heading">
                <span>1組 300円</span>
                <h3>気になるふたりを、もう少し深く</h3>
              </div>
              <ul>
                <li>十二支・五行・陰陽・MBTIの読み解き</li>
                <li>ふたりでいるときのヒント</li>
                <li>それぞれに向けた関わり方</li>
              </ul>
            </article>
          </div>

          <p className="value-ledger__note">
            自分の結果とグループ参加は無料。必要な関係だけ、あとから解放できます。
          </p>
          <ButtonLink className="value-ledger__cta" size="lg" href="/create/profile">
            無料でグループを作る
          </ButtonLink>
        </section>

        <section className="trust-notes" aria-labelledby="trust-notes-title">
          <header>
            <p>BEFORE YOU START</p>
            <h2 id="trust-notes-title">始める前に、気になること。</h2>
          </header>
          <div className="trust-notes__list">
            <details>
              <summary>何人まで使える？</summary>
              <p>1グループ30人まで。友だち同士でも、サークルやチームでも使えます。</p>
            </details>
            <details>
              <summary>出生時刻やMBTIがわからなくても大丈夫？</summary>
              <p>どちらも「わからない」を選べます。入力できる情報だけで結果を表示します。</p>
            </details>
            <details>
              <summary>結果はどんなもの？</summary>
              <p>自己理解と会話を楽しむための読みものです。科学的・医学的な判定ではありません。</p>
            </details>
          </div>
        </section>
      </section>

      <footer className="landing-footer">
        <a href="#top">MofuType</a>
        <a href="/tokushoho">特定商取引法に基づく表記</a>
        <small>© MofuType</small>
      </footer>
    </main>
  );
}
