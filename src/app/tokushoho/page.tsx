import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | MofuType",
  robots: { index: false, follow: false },
};

const DISCLOSURES = [
  ["販売事業者", "未設定（実運用前に正式な法人名または氏名を掲載）"],
  ["運営責任者", "未設定（実運用前に責任者名を掲載）"],
  ["所在地", "未設定（実運用前に請求に応じて遅滞なく開示できる正式情報を掲載）"],
  ["電話番号", "未設定（実運用前に正式な連絡先を掲載）"],
  ["メールアドレス", "未設定（実運用前にサポート窓口を掲載）"],
  ["販売価格", "関係レポート1件 100円（税込・予定）"],
  ["商品代金以外に必要な料金", "インターネット接続に必要な通信料金は利用者の負担となります。"],
  ["支払方法・支払時期", "現在はモック決済のみで、実際の請求は発生しません。実運用時に利用可能な決済方法と時期を掲載します。"],
  ["サービスの提供時期", "決済完了後、対象グループの関係レポートを直ちに解放する予定です。"],
  ["返品・キャンセル", "デジタルサービスの性質上、提供後の返品は受け付けない予定です。決済障害や重複請求時の対応条件は実運用前に掲載します。"],
] as const;

export default function TokushohoPage() {
  return (
    <main className="legal-page">
      <Link href="/">MofuTypeに戻る</Link>
      <h1>特定商取引法に基づく表記</h1>
      <p role="alert">
        このページは開発用の仮表示です。実際の決済を開始する前に、正式な事業者情報へ必ず更新してください。
      </p>
      <dl>
        {DISCLOSURES.map(([term, description]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
      <p>最終更新日：2026年8月15日</p>
    </main>
  );
}
