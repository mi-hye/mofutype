import Link from "next/link";
import Image from "next/image";

import { Card } from "@/components/ui/card";
import { CreateGroupForm } from "@/features/onboarding/create-group-form";

export default function CreateProfilePage() {
  return (
    <main className="profile-step-shell">
      <header className="landing-nav">
        <Link className="wordmark" href="/" aria-label="MofuType ホーム">
          <Image
            className="wordmark__image"
            src="/brand/mofutype-wordmark.png"
            alt=""
            width={960}
            height={240}
            priority
          />
        </Link>
      </header>
      <section className="profile-step" aria-labelledby="profile-step-title">
        <div className="profile-step__intro">
          <p className="hero__eyebrow">グループ作成</p>
          <h1 id="profile-step-title">グループを作る</h1>
        </div>
        <Card variant="accent">
          <CreateGroupForm />
        </Card>
      </section>
    </main>
  );
}
