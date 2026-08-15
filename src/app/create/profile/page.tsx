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
          <h1 id="profile-step-title">プロフィールを入力</h1>
          <p>あと少しでグループ完成です。</p>
          <Link href="/#create">グループ名を変更</Link>
        </div>
        <Card variant="accent">
          <CreateGroupForm profileOnly />
        </Card>
      </section>
    </main>
  );
}
