import Link from "next/link";

import { Card } from "@/components/ui/card";
import { CreateGroupForm } from "@/features/onboarding/create-group-form";

export default function CreateProfilePage() {
  return (
    <main className="profile-step-shell">
      <header className="landing-nav">
        <Link className="wordmark" href="/" aria-label="MofuType ホーム">MofuType</Link>
        <span className="edition-label">STEP 02 / 02</span>
      </header>
      <section className="profile-step" aria-labelledby="profile-step-title">
        <div className="profile-step__intro">
          <p className="hero__eyebrow">プロフィール</p>
          <h1 id="profile-step-title">あなたのことを教えて</h1>
          <p>この情報から動物タイプを見つけて、グループを作成します。</p>
          <Link href="/#create">グループ名を変更する</Link>
        </div>
        <Card variant="accent">
          <CreateGroupForm profileOnly />
        </Card>
      </section>
    </main>
  );
}
