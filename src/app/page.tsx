import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";
import { Capsule } from "@/components/ui/capsule";
import { LandingRelationshipPreview } from "@/features/landing/landing-relationship-preview";
import { ReportSampleGraph } from "@/features/landing/report-sample-graph";

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

        <section className="value-ledger" aria-labelledby="report-preview-title">
          <section className="report-preview" aria-labelledby="report-preview-title">
            <header className="report-preview__header">
              <span className="report-preview__sample-label">300円</span>
              <div>
                <p>ONE PAIR / ONE TIME</p>
                <h2 id="report-preview-title">1組300円で、こんな関係レポートが読めます。</h2>
              </div>
            </header>

            <div className="report-preview__paper">
              <div className="report-preview__pair" aria-label="AさんとBさんのサンプル">
                <span>Aさん</span>
                <i aria-hidden="true" />
                <span>Bさん</span>
              </div>

              <ReportSampleGraph />

              <div className="report-preview__lead">
                <span>ふたりでいるとき</span>
                <strong>違うペースが、いいリズムになる。</strong>
                <p>
                  感じ方と動き方の違いを、十二支・五行・陰陽・MBTIの4つの視点から読み解きます。
                </p>
              </div>

              <div className="report-preview__layers" aria-label="レポートに含まれる3つの分析">
                <section>
                  <span>01</span>
                  <h4>十二支の関係</h4>
                  <strong>違いが刺激になる関係</strong>
                  <p>慎重に確かめたいAさんと、まず動いてみたいBさん。違う速さが、新しい選択肢を生みます。</p>
                </section>
                <section>
                  <span>02</span>
                  <h4>五行と陰陽</h4>
                  <strong>整える力と、動かす力</strong>
                  <p>考えを形にする力と、場を前へ進める力。役割が自然に分かれると、ふたりの強みが重なります。</p>
                </section>
                <section>
                  <span>03</span>
                  <h4>MBTIの4つの軸</h4>
                  <strong>答えの見つけ方が違うふたり</strong>
                  <p>ひとりで深める時間と、話しながら広げる時間。結論までの道筋を共有すると伝わりやすくなります。</p>
                </section>
              </div>

              <dl className="report-preview__contents">
                <div>
                  <dt>すれ違うとき</dt>
                  <dd>急いで答えを出したいときほど、考える時間の差がすれ違いに見えやすくなります。</dd>
                </div>
                <div>
                  <dt>Aさんへ</dt>
                  <dd>Bさんのアイデアが広がる時間を少し待つと、あなたの整理力がもっと伝わります。</dd>
                </div>
                <div>
                  <dt>Bさんへ</dt>
                  <dd>思いつきを先に共有したら、Aさんが考えをまとめる余白も一緒に渡してみてください。</dd>
                </div>
              </dl>

              <p className="report-preview__purchase-note">
                <strong>1組 300円・買い切り</strong>
                4つの視点と、ふたりそれぞれへのヒントをまとめて読めます。追加料金や自動更新はありません。
              </p>
            </div>

            <p className="report-preview__disclaimer">
              このサンプルは表示イメージです。内容はふたりの組み合わせによって変わります。
            </p>
          </section>
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
