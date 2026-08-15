# MofuType 그룹 관계 그래프 Implementation Plan

> **에이전트 작업자 필수 사항:** 이 계획을 작업별로 구현할 때 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`를 반드시 사용한다. 진행 상황은 체크박스(`- [ ]`)로 추적한다.

**목표:** 일본어 그룹 생성·링크 참여·최대 30명의 실시간 동물 관계 그래프·관계별 그룹 공동 해제까지 동작하는 Next.js MVP를 완성한다.

**아키텍처:** Next.js App Router 클라이언트는 원문 생년 정보를 로컬 `AstrologyProvider`에만 전달하고 파생 프로필만 Supabase RPC에 저장한다. Supabase 익명 인증, RLS, 트랜잭션 RPC, Realtime으로 그룹 상태를 공유하며, `GroupRepository`, `RelationshipProvider`, `PaymentProvider` 경계를 통해 이후 사주 및 결제 Webhook으로 교체할 수 있게 한다.

**기술 스택:** Next.js, React, TypeScript, Tailwind CSS, Framer Motion, `@xyflow/react`, Supabase, Zod, Vitest, React Testing Library, Playwright, Supabase CLI

---

## 파일 구조

다음 책임 경계를 유지한다.

- `src/app/`: 라우트 조합과 서버·클라이언트 경계만 담당한다.
- `src/features/onboarding/`: 그룹 생성·참여 폼과 입력 검증을 담당한다.
- `src/features/group-graph/`: 그래프 노드·엣지 변환, 레이아웃, 선택 상태 UI를 담당한다.
- `src/features/relationship/`: 두 사람의 요약·잠금·상세 시트를 담당한다.
- `src/features/checkout/`: `PaymentProvider`와 모의 결제 UI를 담당한다.
- `src/lib/astrology/`: 원문 생년 입력에서 파생 프로필을 만드는 순수 로직만 담당한다.
- `src/lib/relationship/`: 두 파생 프로필로 관계 결과를 만드는 순수 로직만 담당한다.
- `src/lib/supabase/`: 브라우저 클라이언트, 생성 타입, 저장소 구현을 담당한다.
- `src/components/`: 도메인 지식이 없는 공통 UI만 담당한다.
- `supabase/migrations/`: 데이터베이스 스키마, RLS, RPC의 유일한 원본이다.
- `tests/e2e/`: 브라우저 전체 흐름을 검증한다.

## Task 1: Next.js 도구 체인과 로컬 설정 구성

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `.env.local`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: 패키지 매니페스트를 만들고 런타임 의존성을 설치한다**

Run:

```bash
npm init -y
npm install next@latest react@latest react-dom@latest @supabase/ssr@latest @supabase/supabase-js@latest @xyflow/react@latest framer-motion@latest zod@latest clsx@latest tailwind-merge@latest
npm install -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest tailwindcss@latest @tailwindcss/postcss@latest eslint@latest eslint-config-next@latest vitest@latest jsdom@latest @vitejs/plugin-react@latest @testing-library/react@latest @testing-library/jest-dom@latest @testing-library/user-event@latest @playwright/test@latest supabase@latest
```

Expected: `package.json`과 `package-lock.json`이 생성되고 설치 명령이 exit 0으로 끝난다.

- [ ] **Step 2: 실행 스크립트를 정확히 설정한다**

`package.json`의 `scripts`를 다음과 같이 만든다.

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "supabase": "supabase"
  }
}
```

- [ ] **Step 3: TypeScript, Tailwind, Vitest, Playwright 설정 파일을 만든다**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = { reactStrictMode: true };
export default nextConfig;
```

`postcss.config.mjs`:

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "coverage/**", "playwright-report/**"]),
]);
```

`vitest.config.ts`:

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"] },
});
```

`vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: { command: "npm run dev", url: "http://127.0.0.1:3000", reuseExistingServer: true },
  projects: [{ name: "mobile", use: { ...devices["iPhone 13"] } }],
});
```

Expected: `npm run typecheck`가 애플리케이션 파일이 아직 없더라도 설정 오류 없이 끝난다.

- [ ] **Step 4: Supabase 키 입력 파일을 생성하고 사용자에게 입력을 요청한다**

`.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://xshphvgyehzmwrlfmwjf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`.env.local`이 생성되는 즉시 작업을 잠시 멈추고 사용자에게 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 입력을 요청한다. 서비스 역할 키나 데이터베이스 비밀번호는 이 파일에 넣지 않는다.

- [ ] **Step 5: Supabase CLI 프로젝트를 초기화하고 연결한다**

Run:

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref xshphvgyehzmwrlfmwjf
```

Expected: `supabase/config.toml`이 생성되고 link 명령이 프로젝트 ref를 확인한다. 로그인 또는 데이터베이스 비밀번호 입력이 필요하면 사용자에게 해당 단계만 요청한다.

- [ ] **Step 6: 기본 설정을 검증하고 커밋한다**

Run:

```bash
npm run typecheck
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts .env.example .gitignore supabase/config.toml
git commit -m "chore: bootstrap Next.js and Supabase tooling"
```

Expected: typecheck PASS, `.env.local`은 staged 파일 목록에 나타나지 않는다.

## Task 2: 도메인 입력 검증과 로컬 동물 프로필 계산

**Files:**
- Create: `src/lib/astrology/types.ts`
- Create: `src/lib/astrology/animals.ts`
- Create: `src/lib/astrology/local-provider.ts`
- Create: `src/lib/astrology/local-provider.test.ts`

- [ ] **Step 1: 실패하는 동물 계산 테스트를 작성한다**

`src/lib/astrology/local-provider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { localAstrologyProvider } from "./local-provider";

describe("LocalAstrologyProvider", () => {
  it("returns the same derived profile for the same known input", async () => {
    const input = { birthDate: "2000-08-15", birthTime: "14:30", mbti: "ENFP" as const };
    expect(await localAstrologyProvider.derive(input)).toEqual(await localAstrologyProvider.derive(input));
  });

  it("uses an explicit unknown-time branch", async () => {
    const result = await localAstrologyProvider.derive({ birthDate: "2000-08-15", birthTime: null, mbti: null });
    expect(result.calculationMode).toBe("date-only");
    expect(result.mbti).toBeNull();
  });

  it("maps every valid result to one of twelve animal ids", async () => {
    const result = await localAstrologyProvider.derive({ birthDate: "1999-04-21", birthTime: "09:05", mbti: "INFJ" });
    expect(["fawn", "raccoon", "black-panther", "sheep", "wolf", "monkey", "tiger", "koala", "cheetah", "lion", "elephant", "pegasus"]).toContain(result.animalId);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/astrology/local-provider.test.ts`

Expected: FAIL with module `./local-provider` not found.

- [ ] **Step 3: 타입과 12동물 카탈로그를 구현한다**

`src/lib/astrology/types.ts`:

```ts
export type MBTIType = "INTJ" | "INTP" | "ENTJ" | "ENTP" | "INFJ" | "INFP" | "ENFJ" | "ENFP" | "ISTJ" | "ISFJ" | "ESTJ" | "ESFJ" | "ISTP" | "ISFP" | "ESTP" | "ESFP";
export type AnimalId = "fawn" | "raccoon" | "black-panther" | "sheep" | "wolf" | "monkey" | "tiger" | "koala" | "cheetah" | "lion" | "elephant" | "pegasus";
export type AnimalGroup = "MOON" | "EARTH" | "SUN";

export interface AstrologyInput {
  birthDate: string;
  birthTime: string | null;
  mbti: MBTIType | null;
}

export interface DerivedProfile {
  version: 1;
  animalId: AnimalId;
  animalGroup: AnimalGroup;
  mbti: MBTIType | null;
  calculationMode: "date-time" | "date-only";
}

export interface AstrologyProvider {
  derive(input: AstrologyInput): Promise<DerivedProfile>;
}
```

`src/lib/astrology/animals.ts`는 아래 계약을 만족하는 읽기 전용 레코드를 내보낸다.

```ts
export const ANIMALS = {
  fawn: { nameJa: "こじか", group: "MOON", asset: "/animals/fawn.svg" },
  raccoon: { nameJa: "たぬき", group: "MOON", asset: "/animals/raccoon.svg" },
  "black-panther": { nameJa: "黒ひょう", group: "MOON", asset: "/animals/black-panther.svg" },
  sheep: { nameJa: "ひつじ", group: "MOON", asset: "/animals/sheep.svg" },
  wolf: { nameJa: "狼", group: "EARTH", asset: "/animals/wolf.svg" },
  monkey: { nameJa: "猿", group: "EARTH", asset: "/animals/monkey.svg" },
  tiger: { nameJa: "虎", group: "EARTH", asset: "/animals/tiger.svg" },
  koala: { nameJa: "コアラ", group: "EARTH", asset: "/animals/koala.svg" },
  cheetah: { nameJa: "チータ", group: "SUN", asset: "/animals/cheetah.svg" },
  lion: { nameJa: "ライオン", group: "SUN", asset: "/animals/lion.svg" },
  elephant: { nameJa: "ゾウ", group: "SUN", asset: "/animals/elephant.svg" },
  pegasus: { nameJa: "ペガサス", group: "SUN", asset: "/animals/pegasus.svg" },
} as const;
```

- [ ] **Step 4: 결정론적 로컬 제공자를 최소 구현한다**

날짜의 UTC 일수와 알려진 시간의 분 값을 정수 seed로 만든 뒤 12로 나눈 나머지를 동물 순서에 매핑한다. 시간 모름 분기에는 분 값을 더하지 않는다. 이 로직이 전통 사주의 정확성을 주장하지 않도록 `version`과 `calculationMode`를 결과에 포함한다.

- [ ] **Step 5: 테스트와 타입 검사를 통과시키고 커밋한다**

Run:

```bash
npm test -- src/lib/astrology/local-provider.test.ts
npm run typecheck
git add src/lib/astrology
git commit -m "feat: add deterministic local astrology profiles"
```

Expected: 3 tests PASS and typecheck PASS.

## Task 3: 숫자 점수 없는 관계 계산 엔진

**Files:**
- Create: `src/lib/relationship/types.ts`
- Create: `src/lib/relationship/pair-key.ts`
- Create: `src/lib/relationship/local-provider.ts`
- Create: `src/lib/relationship/local-provider.test.ts`

- [ ] **Step 1: 실패하는 관계 규칙 테스트를 작성한다**

테스트는 `canonicalPairKey("b", "a") === "a:b"`, MOON이 EARTH에 우세, EARTH가 SUN에 우세, SUN이 MOON에 우세, 같은 그룹은 동등, MBTI null이면 MBTI 문구를 만들지 않음, 결과 객체에 `score`가 없음을 검증한다.

```ts
expect(canonicalPairKey("b", "a")).toBe("a:b");
expect(createRelationship(moonProfile, earthProfile).dynamic).toBe("MOON_OVER_EARTH");
expect(createRelationship(moonProfile, earthProfile)).not.toHaveProperty("score");
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/relationship/local-provider.test.ts`

Expected: FAIL because relationship modules do not exist.

- [ ] **Step 3: 관계 타입과 표준 pair key를 구현한다**

`src/lib/relationship/types.ts`:

```ts
export type GroupDynamic = "SAME_GROUP" | "MOON_OVER_EARTH" | "EARTH_OVER_SUN" | "SUN_OVER_MOON";

export interface RelationshipDetail {
  attractionJa: string;
  frictionJa: string;
  unspokenJa: string;
  communicationJa: string;
  reconciliationJa: string;
  longTermJa: string;
}

export interface RelationshipResult {
  pairKey: string;
  dynamic: GroupDynamic;
  freeTitleJa: string;
  freeSummaryJa: string;
  detail: RelationshipDetail;
}
```

`src/lib/relationship/pair-key.ts`:

```ts
export function canonicalPairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}
```

- [ ] **Step 4: 그룹 우위와 MBTI 수정 문구를 구현한다**

`createRelationship(a, b)`는 두 프로필의 동물 그룹 조합으로 동역학을 선택하고, 정렬된 동물 ID와 MBTI 유무로 결정론적 일본어 문구 템플릿을 선택한다. 두 프로필의 순서를 바꿔도 `pairKey`와 내용은 같아야 한다.

- [ ] **Step 5: 테스트를 통과시키고 커밋한다**

Run:

```bash
npm test -- src/lib/relationship/local-provider.test.ts
git add src/lib/relationship
git commit -m "feat: add categorical relationship engine"
```

Expected: pair-key, group dynamic, unknown-MBTI, no-score tests PASS.

## Task 4: Supabase 스키마, RLS, 트랜잭션 RPC

**Files:**
- Create: `supabase/migrations/202608150001_mofutype_groups.sql`
- Create: `supabase/tests/groups_rls.test.sql`
- Create: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: 실패하는 데이터베이스 테스트를 작성한다**

`supabase/tests/groups_rls.test.sql`에 pgTAP 테스트를 작성해 다음을 검증한다: 필수 테이블 3개 존재, `(group_id,user_id)` 유일 제약, 순서가 정규화된 관계 해제 유일 제약, 비멤버 조회 차단, 31번째 참여 거부, 같은 익명 사용자의 중복 참여가 기존 멤버를 반환.

- [ ] **Step 2: 로컬 Supabase에서 테스트 실패를 확인한다**

Run:

```bash
npx supabase start
npx supabase test db
```

Expected: FAIL because tables and RPCs do not exist. Docker가 없으면 이 작업을 중단하고 사용자에게 Docker Desktop 실행을 요청한다.

- [ ] **Step 3: enum, 테이블, 인덱스, 제약을 구현한다**

마이그레이션에 `animal_group`, `unlock_status` enum과 설계 문서의 `groups`, `group_members`, `relation_unlocks`를 만든다. `relation_unlocks`에는 `check (member_low_id < member_high_id)`를 추가하고 모든 외래 키는 그룹 삭제 시 cascade 처리한다.

- [ ] **Step 4: RLS와 읽기 정책을 구현한다**

세 테이블에서 RLS를 활성화한다. `group_members`에 현재 `auth.uid()`가 속한 그룹인지 확인하는 `security definer` 헬퍼를 만들고, 구성원만 자기 그룹과 멤버와 관계 해제 행을 읽을 수 있게 한다. 클라이언트 직접 insert/update 정책은 만들지 않는다.

- [ ] **Step 5: 상태 변경 RPC를 구현한다**

다음 RPC 계약을 SQL로 구현하고 `authenticated` 역할에만 execute를 부여한다.

```sql
create_group_and_join(
  p_name text,
  p_nickname text,
  p_animal_id text,
  p_animal_group animal_group,
  p_mbti text,
  p_profile_payload jsonb
) returns table(group_id uuid, member_id uuid, invite_token text);

join_group(
  p_invite_token text,
  p_nickname text,
  p_animal_id text,
  p_animal_group animal_group,
  p_mbti text,
  p_profile_payload jsonb
) returns table(group_id uuid, member_id uuid);

unlock_relation_mock(
  p_group_id uuid,
  p_member_a uuid,
  p_member_b uuid
) returns relation_unlocks;
```

`create_group_and_join`은 랜덤 초대 토큰을 반환하고 digest만 저장한다. `join_group`은 그룹 행을 `FOR UPDATE`로 잠근 뒤 정원을 검사한다. `unlock_relation_mock`은 두 ID를 정렬하고 upsert하여 멱등성을 보장한다.

- [ ] **Step 6: Realtime 대상과 DB 타입을 생성한다**

`group_members`와 `relation_unlocks`를 `supabase_realtime` publication에 추가한다.

Run:

```bash
npx supabase db reset
npx supabase test db
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

Expected: pgTAP PASS and generated types contain all three tables and three RPCs.

- [ ] **Step 7: 커밋한다**

```bash
git add supabase/migrations supabase/tests src/lib/supabase/database.types.ts
git commit -m "feat: add secure realtime group schema"
```

## Task 5: Supabase 클라이언트와 그룹 저장소

**Files:**
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/group-repository.ts`
- Create: `src/lib/supabase/group-repository.test.ts`
- Create: `src/lib/supabase/models.ts`

- [ ] **Step 1: 저장소 계약 실패 테스트를 작성한다**

모의 Supabase 클라이언트로 `ensureAnonymousSession`, `createGroup`, `joinGroup`, `loadGroup`, `subscribeToGroup`, `unlockPair`가 올바른 RPC 이름과 인자를 호출하는지 검증한다. `joinGroup`이 원문 `birthDate` 또는 `birthTime`을 전달하지 않는지도 검증한다.

- [ ] **Step 2: 테스트 실패를 확인한다**

Run: `npm test -- src/lib/supabase/group-repository.test.ts`

Expected: FAIL because repository modules do not exist.

- [ ] **Step 3: 브라우저 클라이언트와 모델 매퍼를 구현한다**

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

환경 변수가 없으면 사용자에게 일본어 설정 오류 화면을 보여줄 수 있도록 명시적인 오류를 던진다.

- [ ] **Step 4: `GroupRepository`를 구현한다**

각 공개 메서드는 먼저 익명 세션을 확보한다. 생성·참여·해제는 RPC만 호출하며 읽기는 RLS가 적용된 select를 사용한다. Realtime 구독은 `group_id=eq.<id>` 필터를 사용하고 cleanup 함수를 반환한다.

- [ ] **Step 5: 테스트를 통과시키고 커밋한다**

Run:

```bash
npm test -- src/lib/supabase/group-repository.test.ts
git add src/lib/supabase
git commit -m "feat: add Supabase group repository"
```

## Task 6: 앱 셸, 디자인 토큰, SVG 자산 검증

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/status-banner.tsx`
- Create: `src/components/animal-avatar.tsx`
- Create: `src/components/animal-avatar.test.tsx`
- Modify: `public/animals/*.svg` only if accessibility metadata is missing

- [ ] **Step 1: SVG 계약과 아바타 실패 테스트를 작성한다**

12개 파일이 존재하고 `AnimalAvatar`가 동물 카탈로그의 경로, 일본어 대체 텍스트, 닉네임을 렌더링하는지 검증한다. 프로덕션 UI 소스에 동물 이모지가 없는지도 정적 검사한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/components/animal-avatar.test.tsx`

Expected: FAIL because component and app shell do not exist.

- [ ] **Step 3: 앱 셸과 Soft Pop × Zine 디자인 토큰을 구현한다**

`globals.css`에 cream/coral/butter/mint/lilac/ink 색상, 12/18/26px radius, 굵은 headline, focus ring, reduced-motion 규칙을 CSS 변수로 정의한다. `layout.tsx`는 일본어 `lang="ja"`, 모바일 viewport, 메타데이터를 설정한다.

- [ ] **Step 4: 공통 UI와 `AnimalAvatar`를 구현한다**

`AnimalAvatar`는 `next/image` 또는 안전한 `<img>`로 `/animals/<id>.svg`를 표시하며, SVG를 HTML에 직접 주입하지 않는다. 크기는 `sm`, `md`, `lg` variant로 제한한다.

- [ ] **Step 5: 테스트와 자산 검증 후 커밋한다**

Run:

```bash
npm test -- src/components/animal-avatar.test.tsx
find public/animals -name '*.svg' -maxdepth 1 | wc -l
git add src/app src/components public/animals
git commit -m "feat: add MofuType visual system and animal assets"
```

Expected: tests PASS and SVG count is exactly 12.

## Task 7: 그룹 생성·참여 폼과 라우트

**Files:**
- Create: `src/features/onboarding/schema.ts`
- Create: `src/features/onboarding/profile-form.tsx`
- Create: `src/features/onboarding/profile-form.test.tsx`
- Create: `src/features/onboarding/create-group-form.tsx`
- Create: `src/features/onboarding/join-group-form.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/g/[inviteToken]/page.tsx`

- [ ] **Step 1: 입력 UX 실패 테스트를 작성한다**

필수 그룹명·닉네임·생년월일, `input[type=date]`, `input[type=time]`, 시간 `わからない`, MBTI `わからない`, 상호 배타 토글, 실패 후 sessionStorage 복구를 검증한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/features/onboarding/profile-form.test.tsx`

Expected: FAIL because form modules do not exist.

- [ ] **Step 3: Zod 스키마와 공통 프로필 폼을 구현한다**

`src/features/onboarding/schema.ts`는 다음 정규화 계약을 구현한다.

```ts
import { z } from "zod";

const mbti = z.enum(["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"]);

export const profileFormSchema = z.object({
  nickname: z.string().trim().min(1).max(20),
  birthDate: z.iso.date(),
  birthTimeKnown: z.boolean(),
  birthTime: z.string().nullable(),
  mbtiKnown: z.boolean(),
  mbti: mbti.nullable(),
}).superRefine((value, ctx) => {
  if (value.birthDate > new Date().toISOString().slice(0, 10)) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "未来の日付は選べません" });
  if (value.birthTimeKnown && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.birthTime ?? "")) ctx.addIssue({ code: "custom", path: ["birthTime"], message: "出生時間を入力してください" });
  if (value.mbtiKnown && value.mbti === null) ctx.addIssue({ code: "custom", path: ["mbti"], message: "MBTIを選んでください" });
});

export const createGroupSchema = profileFormSchema.and(z.object({ groupName: z.string().trim().min(1).max(30) }));
```

제출 직전 `birthTimeKnown=false`이면 `birthTime=null`, `mbtiKnown=false`이면 `mbti=null`로 정규화한다. 체크박스가 켜지면 대응 입력을 비활성화한다.

- [ ] **Step 4: 생성 및 참여 제출 흐름을 구현한다**

제출 시 `localAstrologyProvider.derive()`를 먼저 호출하고 파생 프로필만 저장소로 전달한다. 성공 시 `/g/<inviteToken>`으로 이동하고, 실패 시 일본어 오류와 재시도를 제공한다. 원문 입력은 URL이나 Supabase payload에 포함하지 않는다.

- [ ] **Step 5: 라우트와 로딩·오류 상태를 구현한다**

그룹 링크에서 현재 익명 사용자가 구성원이 아니면 참여 폼, 구성원이면 그래프 셸을 렌더링한다. 잘못된 링크와 30명 정원 초과를 별도 일본어 상태로 처리한다.

- [ ] **Step 6: 테스트를 통과시키고 커밋한다**

```bash
npm test -- src/features/onboarding
npm run typecheck
git add src/features/onboarding src/app/page.tsx 'src/app/g/[inviteToken]/page.tsx'
git commit -m "feat: add group creation and invitation onboarding"
```

## Task 8: 최대 30명 관계 그래프와 선택 상호작용

**Files:**
- Create: `src/features/group-graph/build-graph.ts`
- Create: `src/features/group-graph/build-graph.test.ts`
- Create: `src/features/group-graph/animal-node.tsx`
- Create: `src/features/group-graph/group-graph.tsx`
- Create: `src/features/group-graph/group-graph.test.tsx`
- Create: `src/features/group-graph/group-screen.tsx`

- [ ] **Step 1: 그래프 변환 실패 테스트를 작성한다**

2명은 1개, 3명은 3개, 30명은 435개의 unordered edge를 만드는지 검증한다. 노드 크기는 2~6 `lg`, 7~15 `md`, 16~30 `sm`인지 검증한다. 선택된 노드와 연결된 edge만 `highlighted=true`인지 검증한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/features/group-graph/build-graph.test.ts`

Expected: FAIL because graph builder does not exist.

- [ ] **Step 3: 순수 그래프 변환 함수를 구현한다**

멤버 ID 정렬 순서를 사용해 안정적인 노드와 엣지를 생성한다. 30명에서도 렌더마다 pair 결과를 다시 계산하지 않도록 멤버 버전을 memo key로 사용한다. 기본 엣지 opacity는 낮게 하고 선택 노드의 incident edge만 강조 상태로 변환한다.

- [ ] **Step 4: React Flow 노드와 그래프를 구현한다**

`@xyflow/react`의 pan, pinch zoom, fitView를 활성화하고 custom `AnimalNode`에 전용 SVG와 닉네임을 표시한다. 같은 닉네임이 둘 이상이면 안정적인 멤버 ID 앞 4자를 작은 구분자로 표시한다. 선택 노드는 scale과 outline 모션을 적용한다. edge 클릭은 표준 `pairKey`를 상위 화면에 전달한다.

- [ ] **Step 5: Realtime 갱신과 연결 상태를 구현한다**

`GroupScreen`은 최초 멤버와 unlock을 로드하고 `subscribeToGroup` cleanup을 관리한다. 새 멤버가 들어오면 노드와 관계선을 추가하고, 연결 끊김 배너와 수동 갱신 버튼을 표시한다.

- [ ] **Step 6: 테스트를 통과시키고 커밋한다**

```bash
npm test -- src/features/group-graph
npm run typecheck
git add src/features/group-graph
git commit -m "feat: add realtime group relationship graph"
```

Expected: 30-member count, selection highlighting, edge click tests PASS.

## Task 9: 관계 상세 시트와 그룹 공동 모의 해제

**Files:**
- Create: `src/features/relationship/relation-sheet.tsx`
- Create: `src/features/relationship/relation-sheet.test.tsx`
- Create: `src/features/checkout/types.ts`
- Create: `src/features/checkout/mock-payment-provider.ts`
- Create: `src/features/checkout/checkout-panel.tsx`
- Create: `src/features/checkout/checkout-panel.test.tsx`
- Create: `src/app/checkout/[pairKey]/page.tsx`
- Create: `src/app/g/[inviteToken]/relation/[pairKey]/page.tsx`

- [ ] **Step 1: 잠금·해제 실패 테스트를 작성한다**

잠긴 관계에는 무료 제목·요약과 흐린 상세 영역, `このふたりを300円で解放` 버튼이 보이고 실제 상세 문구는 접근성 트리에 노출되지 않아야 한다. 해제된 관계에는 여섯 상세 섹션과 `解放済み`가 보여야 한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/features/relationship src/features/checkout`

Expected: FAIL because sheet and checkout modules do not exist.

- [ ] **Step 3: 관계 상세 시트를 구현한다**

CSS blur 뒤에 실제 유료 문구를 렌더링하지 않는다. 잠긴 상태에서는 길이가 비슷한 비의미 skeleton만 표시한다. 관계선 클릭과 `/g/[inviteToken]/relation/[pairKey]` 공유 라우트가 같은 컴포넌트를 사용한다. pair key에 속한 두 멤버가 해당 그룹에 없으면 일본어 not-found 상태를 표시한다.

- [ ] **Step 4: 모의 결제 제공자와 결제 패널을 구현한다**

```ts
export interface PaymentProvider {
  unlock(input: { groupId: string; memberA: string; memberB: string }): Promise<{ status: "unlocked" }>;
}
```

`MockPaymentProvider`는 저장소의 `unlockPair` RPC를 호출하고, 300엔 합계·모의 PayPay/카드 표시·명확한 모의 결제 안내를 제공한다. 성공 후 그룹 관계 상세로 돌아간다.

- [ ] **Step 5: Realtime 공동 해제를 검증한다**

저장소 테스트 더블 두 개를 사용해 한 세션의 unlock 이벤트가 다른 세션의 `RelationSheet`를 해제 상태로 바꾸는 컴포넌트 테스트를 추가한다.

- [ ] **Step 6: 테스트를 통과시키고 커밋한다**

```bash
npm test -- src/features/relationship src/features/checkout
git add src/features/relationship src/features/checkout 'src/app/checkout/[pairKey]/page.tsx' 'src/app/g/[inviteToken]/relation/[pairKey]/page.tsx'
git commit -m "feat: add shared pair report unlock flow"
```

## Task 10: 공유, OG 이미지, 법적 고지

**Files:**
- Create: `src/lib/share/x-intent.ts`
- Create: `src/lib/share/x-intent.test.ts`
- Create: `src/app/api/og/route.tsx`
- Create: `src/app/tokushoho/page.tsx`
- Modify: `src/features/group-graph/group-screen.tsx`

- [ ] **Step 1: X 공유 URL 실패 테스트를 작성한다**

초대 공유 URL이 일본어 그룹 카피와 `/g/<inviteToken>` URL을 `URLSearchParams`로 안전하게 인코딩하고 생년 정보·MBTI·Supabase ID를 포함하지 않는지 검증한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/lib/share/x-intent.test.ts`

Expected: FAIL because share helper does not exist.

- [ ] **Step 3: 공유 헬퍼와 버튼을 구현한다**

```ts
export function createXIntent(text: string, url: string) {
  const params = new URLSearchParams({ text, url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
```

초대 버튼은 Web Share API를 우선 사용하고 미지원 시 X intent와 클립보드 복사를 제공한다.

- [ ] **Step 4: 동적 OG 이미지와 법적 고지를 구현한다**

OG 이미지는 그룹명과 참여 인원, MofuType 브랜딩만 포함하며 개인 생년 정보는 포함하지 않는다. `/tokushoho`는 명세의 일본어 템플릿을 사용하되 사업자명·주소·연락처가 아직 제공되지 않았음을 사용자에게 명확히 알리는 개발용 표시를 둔다. 실제 결제 연결 전에 실사업자 정보로 교체해야 한다.

- [ ] **Step 5: 테스트·빌드 후 커밋한다**

```bash
npm test -- src/lib/share
npm run build
git add src/lib/share src/app/api/og src/app/tokushoho src/features/group-graph/group-screen.tsx
git commit -m "feat: add safe sharing and legal pages"
```

Expected: share tests PASS and production build PASS.

## Task 11: 전체 흐름 E2E, 접근성, 최종 검증

**Files:**
- Create: `tests/e2e/group-flow.spec.ts`
- Create: `tests/e2e/mobile-graph.spec.ts`
- Create: `README.md`
- Modify: application files only for failures revealed by tests

- [ ] **Step 1: 실패하는 그룹 전체 흐름 E2E를 작성한다**

브라우저 컨텍스트 A가 그룹을 만들고 링크를 얻는다. 독립 컨텍스트 B와 C가 참여한다. A에서 3개 노드와 3개 관계선이 보이는지 확인한다. A가 A–B 관계를 모의 해제한 뒤 B와 C에서도 `解放済み`가 보이는지 확인한다.

- [ ] **Step 2: 30명 및 모바일 상호작용 E2E를 작성한다**

테스트 전용 fixture/RPC로 30명을 준비하고 435개 관계 데이터, 작은 노드 variant, 노드 선택 시 29개 연결선 강조, 핀치 대신 브라우저 API 기반 zoom 버튼, 320px viewport의 가로 overflow 부재를 검증한다.

- [ ] **Step 3: E2E 실패를 확인하고 원인별 최소 수정을 한다**

Run: `npm run test:e2e`

Expected before fixes: FAIL at the first unmet integration assertion. 각 실패는 테스트를 약화하지 말고 제품 코드에서 수정한다.

- [ ] **Step 4: README에 로컬 실행과 키 설정을 문서화한다**

README에는 `npm install`, `.env.local` 변수 두 개, `npx supabase start`, `npm run dev`, 테스트 명령, 원문 생년 정보 비저장 원칙, 실제 사주·결제가 아직 mock임을 기록한다.

- [ ] **Step 5: 모든 자동 검증을 새로 실행한다**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
git status --short
```

Expected: 모든 명령 PASS. `git status`에는 사용자가 별도 관리하는 파일 외에 구현 중 생성된 미추적 파일이 없어야 한다.

- [ ] **Step 6: 모바일 화면을 브라우저에서 시각 검증한다**

320×568, 390×844, 430×932 viewport에서 생성 폼, 참여 폼, 2명 그래프, 30명 그래프, 잠긴 시트, 해제된 시트, 오류 화면을 확인한다. 텍스트 잘림, 터치 대상 44px 미만, 관계 그래프 패널 overflow, 동물 SVG 누락, 콘솔 오류가 있으면 수정하고 해당 자동 테스트를 다시 실행한다.

- [ ] **Step 7: 최종 커밋한다**

```bash
git add README.md tests src supabase package.json package-lock.json
git commit -m "test: verify MofuType group relationship MVP"
```

## 구현 중 중단 조건

- `.env.local` 생성 후 사용자가 publishable key를 입력하기 전에는 원격 Supabase 연결 작업을 진행하지 않는다.
- `npx supabase login` 또는 `link`가 계정 로그인·데이터베이스 비밀번호를 요구하면 사용자에게 해당 입력을 요청한다.
- 원격 마이그레이션 적용 전에는 생성될 객체와 대상 project ref를 다시 확인한다.
- 다른 컨텍스트가 만든 `public/animals/*.svg` 변경을 발견하면 덮어쓰지 않고 먼저 현재 파일을 검증한다.
- 실제 결제, 실제 사주 Webhook, 운영 사업자 정보 입력은 이 계획 범위에 포함하지 않는다.
