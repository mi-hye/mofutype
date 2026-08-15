# [폐기됨] MofuType Free Astrology and MBTI Engine Implementation Plan

> **폐기 안내 (2026-08-15):** 이 계획은 기존 12동물과
> MOON/EARTH/SUN 데이터 모델을 전제로 하므로 실행하지 않는다. 새 설계는
> `../specs/2026-08-15-mofutype-eto-five-elements-mbti-design.md`를 따른다.
> 새 구현 계획은 사용자의 새 설계 문서 검토가 끝난 뒤 별도로 작성한다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary animal seed with a free, browser-only Four Pillars calculation and add versioned Five Element, polarity, and MBTI relationship layers without storing raw birth data.

**Architecture:** Keep `lunar-typescript` behind a lazy-loaded adapter that returns a small internal `AstrologyFacts` model, then derive a versioned MofuType profile with a fixed 12-animal formula. Preserve v1 profiles as a deterministic fallback and evolve Supabase validation to accept exact v1 or v2 payloads. Compose relationship copy from independent animal-group, element, polarity, and MBTI-axis rules while preserving symmetric pair results and the existing memoized graph topology.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Vitest, Testing Library, Playwright, Supabase/PostgreSQL/pgTAP, `lunar-typescript@1.8.6`

---

## File map

New domain files:

- `src/lib/astrology/validation.ts`: shared strict input parser.
- `src/lib/astrology/lunar-engine.ts`: the only `lunar-typescript` import and `AstrologyFacts` adapter.
- `src/lib/astrology/derive-profile.ts`: fixed `mofu-animal-v1` formula.
- `src/lib/astrology/browser-provider.ts`: lazy loading, preload, and v1 fallback.
- `src/lib/relationship/layers.ts`: Five Element, polarity, and 12 MBTI-axis rules.
- `src/lib/relationship/unlock.ts`: one group-wide unlock predicate shared by graph and routes.
- `src/features/group-graph/profile-summary.tsx`: selected member's free result.
- `supabase/migrations/202608150003_versioned_astrology_profiles.sql`: exact v1/v2 DB validation.
- `tests/e2e/astrology-privacy-performance.spec.ts`: privacy, lazy loading, and performance gates.
- `THIRD_PARTY_NOTICES.md`: MIT dependency notice.

Each new TypeScript module receives a colocated `.test.ts` or `.test.tsx`. Existing onboarding, Supabase repository/model, graph snapshot, relationship result/sheet, production safety, pgTAP, README, package, and lock files change only where named below.

## Task 1: Add versioned types and shared validation

**Files:**
- Modify: `src/lib/astrology/types.ts`
- Create: `src/lib/astrology/validation.ts`
- Modify: `src/lib/astrology/local-provider.ts`
- Modify: `src/lib/astrology/local-provider.test.ts`

- [ ] **Step 1: Write failing type and parser tests**

Add this representative v2 contract and stable-error table to `local-provider.test.ts`:

```ts
const profileV2: DerivedProfileV2 = {
  version: 2,
  animalId: "tiger",
  animalGroup: "EARTH",
  mbti: null,
  calculationMode: "date-only",
  primaryElement: "EARTH",
  polarity: "YANG",
  elementBalance: { WOOD: 1, FIRE: 2, EARTH: 2, METAL: 0, WATER: 1 },
  hourKnown: false,
  engineVersion: "mofu-four-pillars-v1",
  animalVersion: "mofu-animal-v1",
};
expect(Object.keys(profileV2)).not.toContain("birthDate");
expect(Object.keys(profileV2)).not.toContain("birthTime");

expect(() => parseAstrologyInput({ birthDate: "2000-02-30", birthTime: null, mbti: null }))
  .toThrowError(expect.objectContaining({ code: "INVALID_BIRTH_DATE" }));
expect(() => parseAstrologyInput({ birthDate: "2000-01-01", birthTime: "24:00", mbti: null }))
  .toThrowError(expect.objectContaining({ code: "INVALID_BIRTH_TIME" }));
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/astrology/local-provider.test.ts`

Expected: FAIL because `DerivedProfileV2` and `parseAstrologyInput` do not exist.

- [ ] **Step 3: Add exact domain types**

Replace the single profile interface with:

```ts
export type FiveElement = "WOOD" | "FIRE" | "EARTH" | "METAL" | "WATER";
export type Polarity = "YIN" | "YANG";
export type ElementBalance = Readonly<Record<FiveElement, number>>;

export interface AstrologyFacts {
  dayPillarIndex: number;
  monthPillarIndex: number;
  dayStem: string;
  dayBranch: string;
  primaryElement: FiveElement;
  polarity: Polarity;
  elementBalance: ElementBalance;
  hourKnown: boolean;
}

export interface DerivedProfileV1 {
  version: 1;
  animalId: AnimalId;
  animalGroup: AnimalGroup;
  mbti: MBTIType | null;
  calculationMode: "date-time" | "date-only";
}

export interface DerivedProfileV2 {
  version: 2;
  animalId: AnimalId;
  animalGroup: AnimalGroup;
  mbti: MBTIType | null;
  calculationMode: "date-time" | "date-only";
  primaryElement: FiveElement;
  polarity: Polarity;
  elementBalance: ElementBalance;
  hourKnown: boolean;
  engineVersion: "mofu-four-pillars-v1";
  animalVersion: "mofu-animal-v1";
}

export type DerivedProfile = DerivedProfileV1 | DerivedProfileV2;
```

Keep `AstrologyProvider.derive(input): Promise<DerivedProfile>`.

- [ ] **Step 4: Extract strict parsing without changing v1 output**

Create `validation.ts` with the existing date/time regexes, calendar round-trip check, all-16 MBTI set, `AstrologyValidationError`, and:

```ts
export interface ParsedAstrologyInput {
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number | null;
  mbti: MBTIType | null;
}

export function parseAstrologyInput(input: AstrologyInput): ParsedAstrologyInput {
  const date = parseDateParts(input.birthDate);
  const time = input.birthTime === null
    ? { hour: null, minute: null }
    : parseTimeParts(input.birthTime);
  validateMbti(input.mbti);
  return { ...date, ...time, mbti: input.mbti };
}
```

Make `local-provider.ts` consume this parser, reconstruct its existing UTC-day/minutes seed, and re-export the validation error types so current imports remain valid.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/lib/astrology/local-provider.test.ts && npm run typecheck`

Expected: PASS with every existing v1 fixture unchanged.

```bash
git add src/lib/astrology/types.ts src/lib/astrology/validation.ts src/lib/astrology/local-provider.ts src/lib/astrology/local-provider.test.ts
git commit -m "refactor: version astrology profiles and validation"
```

## Task 2: Calculate Four Pillars facts locally

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/astrology/lunar-engine.ts`
- Create: `src/lib/astrology/lunar-engine.test.ts`

- [ ] **Step 1: Install the exact dependency**

Run: `npm install --save-exact lunar-typescript@1.8.6`

Expected: package and lock resolve exactly `1.8.6`, license is MIT, and `npm audit --audit-level=high` exits 0.

- [ ] **Step 2: Write golden RED tests**

Define the test input helper first:

```ts
const input = (birthDate: string, birthTime: string | null): AstrologyInput => ({
  birthDate,
  birthTime,
  mbti: null,
});
```

```ts
expect(calculateAstrologyFacts(input("2000-01-01", "23:00"))).toMatchObject({
  dayStem: "戊", dayBranch: "午", dayPillarIndex: 54,
});
expect(calculateAstrologyFacts(input("2000-01-02", "00:00"))).toMatchObject({
  dayStem: "己", dayBranch: "未", dayPillarIndex: 55,
});
expect(calculateAstrologyFacts(input("2000-01-01", null))).toEqual({
  dayPillarIndex: 54,
  monthPillarIndex: 12,
  dayStem: "戊",
  dayBranch: "午",
  primaryElement: "EARTH",
  polarity: "YANG",
  elementBalance: { WOOD: 1, FIRE: 2, EARTH: 2, METAL: 0, WATER: 1 },
  hourKnown: false,
});
```

- [ ] **Step 3: Run RED**

Run: `npm test -- src/lib/astrology/lunar-engine.test.ts`

Expected: FAIL because the engine module is missing.

- [ ] **Step 4: Implement the isolated adapter**

```ts
import { Solar } from "lunar-typescript";

const ELEMENT_BY_CHARACTER = {
  木: "WOOD", 火: "FIRE", 土: "EARTH", 金: "METAL", 水: "WATER",
} as const satisfies Readonly<Record<string, FiveElement>>;

function sexagenaryIndex(stemIndex: number, branchIndex: number): number {
  const index = Array.from({ length: 60 }, (_, value) => value)
    .find((value) => value % 10 === stemIndex && value % 12 === branchIndex);
  if (index === undefined) throw new Error("Invalid sexagenary pair");
  return index;
}

export function calculateAstrologyFacts(input: AstrologyInput): AstrologyFacts {
  const parsed = parseAstrologyInput(input);
  const solar = parsed.hour === null
    ? Solar.fromYmd(parsed.year, parsed.month, parsed.day)
    : Solar.fromYmdHms(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute ?? 0, 0);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  eightChar.setSect(2);
  const pairs = [eightChar.getYearWuXing(), eightChar.getMonthWuXing(), eightChar.getDayWuXing()];
  if (parsed.hour !== null) pairs.push(eightChar.getTimeWuXing());
  const balance: Record<FiveElement, number> = { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 };
  for (const character of pairs.join("")) {
    const element = ELEMENT_BY_CHARACTER[character];
    if (!element) throw new Error("Unsupported Five Element character");
    balance[element] += 1;
  }
  const dayStemIndex = eightChar.getDayGanIndex();
  const stems = ["WOOD", "WOOD", "FIRE", "FIRE", "EARTH", "EARTH", "METAL", "METAL", "WATER", "WATER"] as const;
  return {
    dayPillarIndex: sexagenaryIndex(dayStemIndex, eightChar.getDayZhiIndex()),
    monthPillarIndex: sexagenaryIndex(lunar.getMonthGanIndexExact(), lunar.getMonthZhiIndexExact()),
    dayStem: eightChar.getDayGan(),
    dayBranch: eightChar.getDayZhi(),
    primaryElement: stems[dayStemIndex],
    polarity: dayStemIndex % 2 === 0 ? "YANG" : "YIN",
    elementBalance: balance,
    hourKnown: parsed.hour !== null,
  };
}
```

- [ ] **Step 5: Cover boundaries and verify**

Add `2000-02-29`, invalid `2000-02-30`, `22:59/23:00/23:59/00:00`, known-time balance sum 8, and unknown-time sum 6. Pin the library's 2024 입춘 boundary: `2024-02-04 16:27` has month pillar index `1` (`乙丑`) and `16:28` has index `2` (`丙寅`). Assert no output key contains raw date/time.

Run: `npm test -- src/lib/astrology/lunar-engine.test.ts && npm audit --audit-level=high && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/astrology/lunar-engine.ts src/lib/astrology/lunar-engine.test.ts
git commit -m "feat: calculate Four Pillars facts in browser"
```

## Task 3: Derive the original 12-animal v2 profile

**Files:**
- Create: `src/lib/astrology/derive-profile.ts`
- Create: `src/lib/astrology/derive-profile.test.ts`

- [ ] **Step 1: Write formula RED tests**

Define a complete valid fixture before overrides:

```ts
const facts = (overrides: Partial<AstrologyFacts> = {}): AstrologyFacts => ({
  dayPillarIndex: 54,
  monthPillarIndex: 12,
  dayStem: "戊",
  dayBranch: "午",
  primaryElement: "EARTH",
  polarity: "YANG",
  elementBalance: { WOOD: 1, FIRE: 2, EARTH: 2, METAL: 0, WATER: 1 },
  hourKnown: false,
  ...overrides,
});
```

```ts
expect(deriveProfileV2(facts({ dayPillarIndex: 54, monthPillarIndex: 12 }), null))
  .toMatchObject({ version: 2, animalId: "tiger", animalGroup: "EARTH" });

const reached = new Set(Array.from({ length: 60 }, (_, dayPillarIndex) =>
  deriveProfileV2(facts({ dayPillarIndex, monthPillarIndex: 0 }), null).animalId,
));
expect(reached).toEqual(new Set(ANIMAL_ORDER));
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/astrology/derive-profile.test.ts`

Expected: FAIL because the derivation module is missing.

- [ ] **Step 3: Implement the fixed formula**

```ts
export function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function deriveProfileV2(facts: AstrologyFacts, mbti: MBTIType | null): DerivedProfileV2 {
  validateFacts(facts);
  const animalId = ANIMAL_ORDER[
    positiveModulo(facts.dayPillarIndex + facts.monthPillarIndex, ANIMAL_ORDER.length)
  ];
  return {
    version: 2,
    animalId,
    animalGroup: ANIMALS[animalId].group,
    mbti,
    calculationMode: facts.hourKnown ? "date-time" : "date-only",
    primaryElement: facts.primaryElement,
    polarity: facts.polarity,
    elementBalance: { ...facts.elementBalance },
    hourKnown: facts.hourKnown,
    engineVersion: "mofu-four-pillars-v1",
    animalVersion: "mofu-animal-v1",
  };
}
```

Implement validation exactly as:

```ts
function validateFacts(facts: AstrologyFacts): void {
  if (!Number.isInteger(facts.dayPillarIndex) || facts.dayPillarIndex < 0 || facts.dayPillarIndex > 59
    || !Number.isInteger(facts.monthPillarIndex) || facts.monthPillarIndex < 0 || facts.monthPillarIndex > 59) {
    throw new RangeError("Pillar indices must be integers from 0 through 59");
  }
  const counts = Object.values(facts.elementBalance);
  if (counts.length !== 5 || counts.some((count) => !Number.isInteger(count) || count < 0)) {
    throw new RangeError("Element balance must contain nonnegative integers");
  }
  const expected = facts.hourKnown ? 8 : 6;
  if (counts.reduce((sum, count) => sum + count, 0) !== expected) {
    throw new RangeError(`Element balance must total ${expected}`);
  }
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/lib/astrology/derive-profile.test.ts src/lib/astrology/lunar-engine.test.ts && npm run typecheck`

Expected: PASS for determinism, all 12 animals, validation, and frozen input.

```bash
git add src/lib/astrology/derive-profile.ts src/lib/astrology/derive-profile.test.ts
git commit -m "feat: derive original versioned animal profiles"
```

## Task 4: Lazy-load calculation and remove raw onboarding drafts

**Files:**
- Create: `src/lib/astrology/browser-provider.ts`
- Create: `src/lib/astrology/browser-provider.test.ts`
- Modify: `src/features/onboarding/profile-form.tsx`
- Modify: `src/features/onboarding/profile-form.test.tsx`
- Modify: `src/features/onboarding/create-group-form.tsx`
- Modify: `src/features/onboarding/create-group-form.test.tsx`
- Modify: `src/features/onboarding/join-group-form.tsx`
- Modify: `src/features/onboarding/join-group-form.test.tsx`

- [ ] **Step 1: Write lazy/fallback RED tests**

```ts
const calculate = vi.fn().mockReturnValue(validFacts);
const load = vi.fn().mockResolvedValue({ calculateAstrologyFacts: calculate });
const provider = createBrowserAstrologyProvider(load, localAstrologyProvider);
await provider.preload();
await provider.derive(validInput);
await provider.derive({ ...validInput });
expect(load).toHaveBeenCalledTimes(1);
expect(calculate).toHaveBeenCalledTimes(1);

const broken = createBrowserAstrologyProvider(
  async () => { throw new TypeError("chunk failed"); },
  localAstrologyProvider,
);
await expect(broken.derive(validInput)).resolves.toMatchObject({ version: 1 });
await expect(broken.derive({ ...validInput, birthDate: "bad" }))
  .rejects.toMatchObject({ code: "INVALID_BIRTH_DATE" });
```

- [ ] **Step 2: Write onboarding privacy RED tests**

On repository failure, create must store only:

```ts
expect(JSON.parse(storage.getItem(CREATE_DRAFT_KEY)!)).toEqual({
  groupName: "Weekend Club",
  nickname: "Mii",
});
```

Join must store only `{ nickname: "Mii" }`. Seed a legacy draft containing `birthDate`, `birthTime`, and `mbti`; assert those controls start empty and the legacy storage entry is removed.

- [ ] **Step 3: Run RED**

Run: `npm test -- src/lib/astrology/browser-provider.test.ts src/features/onboarding/profile-form.test.tsx src/features/onboarding/create-group-form.test.tsx src/features/onboarding/join-group-form.test.tsx`

Expected: FAIL because the browser provider is absent and full raw drafts are currently persisted.

- [ ] **Step 4: Implement one cached lazy loader**

```ts
type EngineModule = typeof import("./lunar-engine");
type EngineLoader = () => Promise<EngineModule>;

export function createBrowserAstrologyProvider(
  load: EngineLoader = () => import("./lunar-engine"),
  fallback: AstrologyProvider = localAstrologyProvider,
) {
  let modulePromise: Promise<EngineModule> | null = null;
  const resultCache = new Map<string, Promise<DerivedProfile>>();
  const engine = () => modulePromise ??= load();
  const fingerprint = async (input: AstrologyInput) => {
    const bytes = new TextEncoder().encode(
      `${input.birthDate}|${input.birthTime ?? "unknown"}|${input.mbti ?? "unknown"}`,
    );
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  return {
    preload: async () => { await engine(); },
    derive: async (input: AstrologyInput): Promise<DerivedProfile> => {
      parseAstrologyInput(input);
      const key = await fingerprint(input);
      const cached = resultCache.get(key);
      if (cached) return cached;
      const attempt = (async () => {
        try {
          const loaded = await engine();
          return deriveProfileV2(loaded.calculateAstrologyFacts(input), input.mbti);
        } catch (error) {
          if (error instanceof AstrologyValidationError) throw error;
          modulePromise = null;
          return fallback.derive(input);
        }
      })();
      resultCache.set(key, attempt);
      try { return await attempt; }
      catch (error) { resultCache.delete(key); throw error; }
    },
  };
}

export const browserAstrologyProvider = createBrowserAstrologyProvider();
export const preloadAstrologyEngine = () =>
  browserAstrologyProvider.preload().catch(() => undefined);
```

The result cache contains only SHA-256 fingerprints and derived profiles, never raw birth strings. Add a test with two equivalent input objects that calls the calculator once and a test proving a rejected attempt is removed before retry.

- [ ] **Step 5: Wire preload and safe drafts**

Use `browserAstrologyProvider` as both form defaults. On the date input call `preloadAstrologyEngine` from `onFocus` and `onInput`.

Replace failure storage with exact safe payloads:

```ts
activeStorage?.setItem(CREATE_DRAFT_KEY, JSON.stringify({
  groupName: draft.groupName,
  nickname: draft.nickname,
}));
activeStorage?.setItem(joinDraftKey(inviteToken), JSON.stringify({
  nickname: draft.nickname,
}));
```

Each `readDraft` starts from its empty draft, copies only safe strings, and removes the stored entry after reading. It never restores or writes birth values, MBTI, or known flags.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- src/lib/astrology/browser-provider.test.ts src/features/onboarding/profile-form.test.tsx src/features/onboarding/create-group-form.test.tsx src/features/onboarding/join-group-form.test.tsx && npm run typecheck`

Expected: PASS, including existing unmount and stale-submission coverage.

```bash
git add src/lib/astrology/browser-provider.ts src/lib/astrology/browser-provider.test.ts src/features/onboarding/profile-form.tsx src/features/onboarding/profile-form.test.tsx src/features/onboarding/create-group-form.tsx src/features/onboarding/create-group-form.test.tsx src/features/onboarding/join-group-form.tsx src/features/onboarding/join-group-form.test.tsx
git commit -m "feat: lazy load private browser astrology"
```

## Task 5: Validate exact v2 profiles in Supabase

**Files:**
- Create: `supabase/migrations/202608150003_versioned_astrology_profiles.sql`
- Modify: `supabase/tests/groups_rls.test.sql`

- [ ] **Step 1: Add pgTAP RED coverage**

Add a valid direct-table v2 case:

```sql
select lives_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload)
    values (%L,'00000000-0000-0000-0000-000000000003','Valid v2','tiger','EARTH',null,
    '{"version":2,"animalId":"tiger","animalGroup":"EARTH","mbti":null,"calculationMode":"date-only","primaryElement":"EARTH","polarity":"YANG","elementBalance":{"WOOD":1,"FIRE":2,"EARTH":2,"METAL":0,"WATER":1},"hourKnown":false,"engineVersion":"mofu-four-pillars-v1","animalVersion":"mofu-animal-v1"}')$sql$,
    (select group_id from created_group)),
  'table accepts exact v2 derived profile'
);
```

Add `throws_ok` cases for an extra `birthDate`, a missing/extra element key, negative/decimal counts, a total other than 6/8, scalar/payload mismatch, `date-only` with `hourKnown:true`, unknown engine/animal versions, and v1 carrying a v2 key. Add authenticated create/join RPC acceptance for valid v2 and stable `P0001/INVALID_PROFILE` rejection for malformed v2.

- [ ] **Step 2: Run RED locally**

Run: `npx supabase start && npx supabase db reset && npx supabase test db`

Expected: FAIL because the current exact constraint accepts v1 only.

- [ ] **Step 3: Create a null-safe element validator**

```sql
create function public._element_balance_is_valid(p_balance jsonb, p_expected_total integer)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(case
    when pg_catalog.jsonb_typeof(p_balance) = 'object'
      and p_balance = pg_catalog.jsonb_build_object(
        'WOOD', p_balance -> 'WOOD', 'FIRE', p_balance -> 'FIRE',
        'EARTH', p_balance -> 'EARTH', 'METAL', p_balance -> 'METAL',
        'WATER', p_balance -> 'WATER')
      and (p_balance ->> 'WOOD') ~ '^[0-8]$'
      and (p_balance ->> 'FIRE') ~ '^[0-8]$'
      and (p_balance ->> 'EARTH') ~ '^[0-8]$'
      and (p_balance ->> 'METAL') ~ '^[0-8]$'
      and (p_balance ->> 'WATER') ~ '^[0-8]$'
    then (p_balance ->> 'WOOD')::integer + (p_balance ->> 'FIRE')::integer
       + (p_balance ->> 'EARTH')::integer + (p_balance ->> 'METAL')::integer
       + (p_balance ->> 'WATER')::integer = p_expected_total
    else false end, false);
$$;
```

Set the owner to postgres, revoke execution from `public`, `anon`, and `authenticated`, and grant execute only to `service_role` because local E2E fixture insertion uses that already-trusted role.

- [ ] **Step 4: Replace profile validation with an exact v1/v2 case**

Preserve animal/group and MBTI checks in `public._profile_is_valid`. Keep the current v1 equality branch. Add this v2 equality and semantic branch:

```sql
when '2'::jsonb then p_profile_payload = pg_catalog.jsonb_build_object(
  'version', 2, 'animalId', p_animal_id, 'animalGroup', p_animal_group,
  'mbti', p_mbti, 'calculationMode', p_profile_payload ->> 'calculationMode',
  'primaryElement', p_profile_payload ->> 'primaryElement',
  'polarity', p_profile_payload ->> 'polarity',
  'elementBalance', p_profile_payload -> 'elementBalance',
  'hourKnown', p_profile_payload -> 'hourKnown',
  'engineVersion', p_profile_payload ->> 'engineVersion',
  'animalVersion', p_profile_payload ->> 'animalVersion')
and p_profile_payload ->> 'primaryElement' in ('WOOD','FIRE','EARTH','METAL','WATER')
and p_profile_payload ->> 'polarity' in ('YIN','YANG')
and p_profile_payload ->> 'engineVersion' = 'mofu-four-pillars-v1'
and p_profile_payload ->> 'animalVersion' = 'mofu-animal-v1'
and (
  (p_profile_payload ->> 'calculationMode' = 'date-only'
    and p_profile_payload -> 'hourKnown' = 'false'::jsonb
    and public._element_balance_is_valid(p_profile_payload -> 'elementBalance', 6))
  or
  (p_profile_payload ->> 'calculationMode' = 'date-time'
    and p_profile_payload -> 'hourKnown' = 'true'::jsonb
    and public._element_balance_is_valid(p_profile_payload -> 'elementBalance', 8))
)
```

Drop/recreate `group_members_profile_payload_check` as `check (public._profile_is_valid(animal_id, animal_group::text, mbti, profile_payload))`. Do not change RPC signatures or grants.

- [ ] **Step 5: Verify and commit**

Run: `npx supabase db reset && npx supabase test db`

Expected: all prior v1, RLS, RPC, and new v2 assertions pass.

Run: `npx supabase gen types typescript --local > /tmp/mofutype-database.types.ts && diff -u src/lib/supabase/database.types.ts /tmp/mofutype-database.types.ts`

Expected: no semantic diff because signatures and column types are unchanged.

```bash
git add supabase/migrations/202608150003_versioned_astrology_profiles.sql supabase/tests/groups_rls.test.sql
git commit -m "feat: validate versioned derived profiles"
```

## Task 6: Parse, serialize, and memoize v2 safely

**Files:**
- Modify: `src/lib/supabase/models.ts`
- Modify: `src/lib/supabase/group-repository.ts`
- Modify: `src/lib/supabase/group-repository.test.ts`
- Modify: `src/features/group-graph/build-graph.ts`
- Modify: `src/features/group-graph/build-graph.test.ts`

- [ ] **Step 1: Write mapper/serializer RED tests**

```ts
await repository.createGroup({ name: "Team", nickname: "Mii", profile: profileV2 });
expect(client.createGroupAndJoin).toHaveBeenCalledWith(expect.objectContaining({
  p_profile_payload: profileV2,
}));
expect(JSON.stringify(client.createGroupAndJoin.mock.calls[0]))
  .not.toMatch(/birthDate|birthTime|1996-07-13/);
```

Reject v2 objects with extra keys, inconsistent hour mode, invalid element total, unknown versions, or nested prototype/source mutation. Add a graph test where changing `primaryElement` changes `graphMembersVersion`, while changing `groupId`, `userId`, or `joinedAt` does not.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/supabase/group-repository.test.ts src/features/group-graph/build-graph.test.ts`

Expected: FAIL because v2 is rejected or truncated.

- [ ] **Step 3: Add exact v2 parsing**

Branch `mapDerivedProfile` on `version`. Preserve v1. For v2 require exactly these keys:

```ts
const V2_KEYS = new Set([
  "version", "animalId", "animalGroup", "mbti", "calculationMode",
  "primaryElement", "polarity", "elementBalance", "hourKnown",
  "engineVersion", "animalVersion",
]);

function exactKeys(row: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(row);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}
```

Validate all enums, five exact integer counts, total 6/8, mode/hour agreement, fixed versions, and animal/group/scalar equality. Return a fresh nested balance object.

- [ ] **Step 4: Copy the union without untrusted spreads**

Make `safeProfile` and `graphMemberSnapshot` branch on `profile.version`. Explicitly copy all v2 scalar fields and `{ WOOD, FIRE, EARTH, METAL, WATER }`. This makes relationship-relevant v2 changes part of the semantic topology key and leaves unrelated metadata excluded.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/lib/supabase/group-repository.test.ts src/features/group-graph/build-graph.test.ts src/features/group-graph/group-graph.test.tsx && npm run typecheck`

Expected: PASS; a 30-member topology still creates exactly 435 relationships and only semantic profile changes rebuild it.

```bash
git add src/lib/supabase/models.ts src/lib/supabase/group-repository.ts src/lib/supabase/group-repository.test.ts src/features/group-graph/build-graph.ts src/features/group-graph/build-graph.test.ts
git commit -m "feat: preserve v2 profiles across group data"
```

## Task 7: Compose categorical Five Element and MBTI layers

**Files:**
- Create: `src/lib/relationship/layers.ts`
- Create: `src/lib/relationship/layers.test.ts`
- Modify: `src/lib/relationship/types.ts`
- Modify: `src/lib/relationship/local-provider.ts`
- Modify: `src/lib/relationship/local-provider.test.ts`

- [ ] **Step 1: Write complete rule RED tests**

Test element symmetry/direction and all 12 MBTI patterns:

```ts
expect(classifyElementPair("WOOD", "WOOD").kind).toBe("SAME");
expect(classifyElementPair("WOOD", "FIRE").kind).toBe("GENERATING");
expect(classifyElementPair("FIRE", "WOOD").kind).toBe("GENERATING");
expect(classifyElementPair("WOOD", "EARTH").kind).toBe("CONTROLLING");
expect(classifyElementPair("EARTH", "WOOD").kind).toBe("CONTROLLING");

expect(describeMbtiAxes("ENTJ", "ENFP").map((note) => note.pattern))
  .toEqual(["E/E", "N/N", "T/F", "J/P"]);
expect(describeMbtiAxes("ESFP", "INTJ").map((note) => note.pattern))
  .toEqual(["E/I", "S/N", "T/F", "J/P"]);
expect(describeMbtiAxes(null, "ENTJ")).toEqual([]);
```

Use table-driven coverage to hit both directions of every generating/controlling pair and each same/mixed MBTI entry.

```ts
const generating = [["WOOD", "FIRE"], ["FIRE", "EARTH"], ["EARTH", "METAL"], ["METAL", "WATER"], ["WATER", "WOOD"]] as const;
const controlling = [["WOOD", "EARTH"], ["EARTH", "WATER"], ["WATER", "FIRE"], ["FIRE", "METAL"], ["METAL", "WOOD"]] as const;
for (const [first, second] of generating) {
  expect(classifyElementPair(first, second).kind).toBe("GENERATING");
  expect(classifyElementPair(second, first).kind).toBe("GENERATING");
}
for (const [first, second] of controlling) {
  expect(classifyElementPair(first, second).kind).toBe("CONTROLLING");
  expect(classifyElementPair(second, first).kind).toBe("CONTROLLING");
}
expect(Object.keys(MBTI_AXIS_COPY)).toEqual([
  "E/E", "I/I", "E/I", "S/S", "N/N", "S/N",
  "T/T", "F/F", "T/F", "J/J", "P/P", "J/P",
]);
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/relationship/layers.test.ts src/lib/relationship/local-provider.test.ts`

Expected: FAIL because layer APIs and expanded result fields do not exist.

- [ ] **Step 3: Implement finite element and polarity rules**

Use generating cycle `WOOD→FIRE→EARTH→METAL→WATER→WOOD` and controlling cycle `WOOD→EARTH→WATER→FIRE→METAL→WOOD`. Return only `SAME | GENERATING | CONTROLLING`, direction metadata, and these exact public fragments; do not calculate a numeric compatibility value.

```ts
const ELEMENT_RELATION_COPY = {
  SAME: "同じ五行の感覚を持ち、力を入れたい場所が自然に重なります。",
  GENERATING: "異なる五行が互いの動きを育て、次の一歩を後押しします。",
  CONTROLLING: "異なる五行が互いのやり方を整え、視点の切り替えを促します。",
} as const;

const POLARITY_COPY = {
  SAME: "表現の強さが近く、反応のタイミングを読みやすいふたりです。",
  MIXED: "前へ出る動きと内側で整える動きが交代し、役割に幅が生まれます。",
} as const;
```

Find each profile's dominant elements by selecting every key tied for the maximum count. If the dominant sets overlap, append `得意なエネルギーが重なり、同じ場面で力を出しやすいです。`; otherwise append `得意なエネルギーが異なるため、役割を分けると持ち味が生きます。`. Never display counts.

- [ ] **Step 4: Implement the exact 12 MBTI entries**

```ts
const MBTI_AXIS_COPY = {
  "E/E": "外へ話しながら考えるテンポがそろいやすい。",
  "I/I": "静かな間を尊重すると本音が育ちやすい。",
  "E/I": "話す速さと一人で整理する時間を互いに確保しよう。",
  "S/S": "具体例と実感を共有すると話が早い。",
  "N/N": "可能性や連想を広げる会話が弾みやすい。",
  "S/N": "事実とアイデアのどちらから話しているかを添えると伝わる。",
  "T/T": "理由と基準を言葉にすると納得しやすい。",
  "F/F": "気持ちへの配慮が確認できると安心しやすい。",
  "T/F": "解決案と共感のどちらを求めているか最初に確かめよう。",
  "J/J": "予定と役割が見えると同じペースで動きやすい。",
  "P/P": "余白を残した進め方から面白い展開が生まれやすい。",
  "J/P": "締切を決める部分と自由に変える部分を分けると楽になる。",
} as const;
```

Normalize mixed labels to `E/I`, `S/N`, `T/F`, `J/P` so reversing members keeps identical notes.

- [ ] **Step 5: Expand and compose `RelationshipResult`**

```ts
export type RelationshipCategoryJa =
  | "自然に噛み合う"
  | "違いが刺激になる"
  | "言葉の翻訳が必要"
  | "ペース調整が鍵";

export interface RelationshipResult {
  pairKey: string;
  dynamic: GroupDynamic;
  categoryJa: RelationshipCategoryJa;
  freeTitleJa: string;
  freeSummaryJa: string;
  elementSummaryJa: string | null;
  analysisMode: "full" | "simplified";
  detail: RelationshipDetail & { mbtiAxesJa: readonly string[] };
}
```

Choose the category with explicit predicates: mixed `T/F` or `S/N` means `言葉の翻訳が必要`; otherwise mixed `J/P` or `E/I` means `ペース調整が鍵`; otherwise cross-group or non-same element means `違いが刺激になる`; otherwise `自然に噛み合う`.

For v1-v1/v1-v2, mark simplified and omit element copy. For v2-v2, concatenate the exact element, polarity, and dominant-set fragments. If both `hourKnown` values are true, append `ふたりとも出生時刻を含むため、普段は見せにくい反応まで関係メモに反映しています。` to `unspokenJa`; otherwise do not mention a hidden reaction. MBTI null omits only MBTI notes.

- [ ] **Step 6: Prove symmetry and copy safety**

For v1-v1, v1-v2, v2-v2, known/null MBTI, and all group dynamics, assert A-B equals B-A. Recursively reject result keys or text containing `score`, `percent`, `%`, `％`, or numeric `点` markers.

- [ ] **Step 7: Verify and commit**

Run: `npm test -- src/lib/relationship/layers.test.ts src/lib/relationship/local-provider.test.ts && npm run typecheck`

Expected: PASS for all finite rules, versions, symmetry, null MBTI, and no-score contract.

```bash
git add src/lib/relationship/layers.ts src/lib/relationship/layers.test.ts src/lib/relationship/types.ts src/lib/relationship/local-provider.ts src/lib/relationship/local-provider.test.ts
git commit -m "feat: add categorical astrology relationship layers"
```

## Task 8: Show free facts and unlocked relationship notes

**Files:**
- Create: `src/lib/relationship/unlock.ts`
- Create: `src/lib/relationship/unlock.test.ts`
- Create: `src/features/group-graph/profile-summary.tsx`
- Create: `src/features/group-graph/profile-summary.test.tsx`
- Modify: `src/features/group-graph/group-graph.tsx`
- Modify: `src/features/group-graph/group-graph.test.tsx`
- Modify: `src/features/group-graph/build-graph.ts`
- Modify: `src/features/group-graph/build-graph.test.ts`
- Modify: `src/features/group-graph/group-screen.tsx`
- Modify: `src/features/group-graph/group-screen.test.tsx`
- Modify: `src/features/relationship/relation-sheet.tsx`
- Modify: `src/features/relationship/relation-sheet.test.tsx`
- Modify: `src/features/relationship/relation-route-gate.tsx`
- Modify: `src/features/relationship/relation-route-gate.test.tsx`
- Modify: `src/features/checkout/checkout-panel.tsx`
- Modify: `src/features/checkout/checkout-panel.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write UI RED tests**

```tsx
render(<GroupGraph members={[memberV2, other]} unlocks={[]} onPairSelect={vi.fn()} />);
await user.click(screen.getByRole("button", { name: /Miiを選択/ }));
const summary = screen.getByRole("region", { name: "Miiのタイプ情報" });
expect(summary).toHaveTextContent("虎");
expect(summary).toHaveTextContent("土");
expect(summary).toHaveTextContent("陽");

render(<ProfileSummary member={memberV1} />);
expect(screen.getByText("簡易分析")).toBeVisible();
expect(screen.queryByText(/主な五行/)).not.toBeInTheDocument();
```

Add relation-sheet assertions for category, disclosure, time-unknown copy, locked omission of details, and unlocked rendering of exactly four MBTI notes when present.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/features/group-graph/profile-summary.test.tsx src/features/group-graph/group-graph.test.tsx src/features/relationship/relation-sheet.test.tsx`

Expected: FAIL because the profile summary and expanded result are not rendered.

- [ ] **Step 3: Implement `ProfileSummary`**

Map elements/polarity with:

```ts
const ELEMENT_JA = { WOOD: "木", FIRE: "火", EARTH: "土", METAL: "金", WATER: "水" } as const;
const POLARITY_JA = { YIN: "陰", YANG: "陽" } as const;
const ANIMAL_SUMMARY_JA = {
  fawn: "慎重に距離を縮め、安心できる場所を大切にするタイプ。",
  raccoon: "場になじみながら、必要なことをこつこつ整えるタイプ。",
  "black-panther": "自分らしい美意識と誇りを静かに守るタイプ。",
  sheep: "人とのつながりを見渡し、やわらかく調整するタイプ。",
  wolf: "自分のリズムで考え、独自の道を深く掘るタイプ。",
  monkey: "試しながら学び、空気を軽やかに動かすタイプ。",
  tiger: "筋道と責任を大切にし、頼れる土台をつくるタイプ。",
  koala: "先を読みながら、心地よいペースを設計するタイプ。",
  cheetah: "目標を見つけると、迷わず一歩目を踏み出すタイプ。",
  lion: "大きな視点で場を率い、堂々と決断するタイプ。",
  elephant: "決めたことを粘り強く続け、形にしていくタイプ。",
  pegasus: "ひらめきと自由な感覚で、予想外の景色を見せるタイプ。",
} as const satisfies Readonly<Record<AnimalId, string>>;
```

Render the catalog animal name and fixed one-line MofuType animal description. For v1 show `簡易分析` and no element facts. For v2 date-only show `出生時間を使わない簡易分析です。時間を推測して補完していません。`. Never render numeric element counts.

- [ ] **Step 4: Integrate without breaking graph memoization**

Render `<ProfileSummary member={selectedMember} />` beside the current selection status. Extend the 30-member test: initial relationship factory calls equal 435 and remain 435 after selecting/clearing a node, summary display, and unlock-only rerender.

- [ ] **Step 5: Expand the relation sheet**

Render `categoryJa`, optional `elementSummaryJa`, and:

```tsx
<p className="relation-sheet__disclosure">
  四柱推命の暦情報とMBTIをもとにした、MofuType独自のエンターテインメント分析です。
</p>
```

In unlocked details, show `MBTIの関係メモ` only when `mbtiAxesJa` is nonempty. Keep all existing six sections. Change locked CTA to group scope: `このグループの詳細を300円で解放`.

- [ ] **Step 6: Make one mock unlock apply to the whole group**

Add tests proving that one existing `status: "unlocked"` row marks every current edge unlocked, a member added afterward also gets unlocked edges, group screen treats every selected pair as unlocked, and the direct relation route bypasses checkout for any pair in that group.

Replace pair-specific read predicates with:

```ts
export function isGroupUnlocked(unlocks: readonly RelationUnlock[]): boolean {
  return unlocks.some((unlock) => unlock.status === "unlocked");
}
```

Place this function in `src/lib/relationship/unlock.ts`. In `decorateGraph`, compute it once and assign it to every edge. In `GroupScreen` and `RelationRouteGate`, import the same helper instead of comparing member IDs. Keep the current mock RPC's canonical pair row as the audit marker that caused the group unlock; do not broaden its grants or write additional pair rows. This guarantees relationships for members who join after payment are also open.

Update checkout heading to `グループ全員の詳細レポートを解放` and add `一度解放すると、これから参加するメンバーとの関係も追加料金なしで読めます。`. Keep the selected pair names only as route-entry context. Preserve the 300円 amount, explicit mock-payment notice, retry, unmount guard, and no-second-payment behavior.

- [ ] **Step 7: Add minimal accessible styling**

Use existing card/color tokens, native headings and region names, visible focus, and 320px containment. Do not add animal emoji or create/edit animal SVG files.

- [ ] **Step 8: Verify and commit**

Run: `npm test -- src/lib/relationship/unlock.test.ts src/features/group-graph/profile-summary.test.tsx src/features/group-graph/group-graph.test.tsx src/features/group-graph/build-graph.test.ts src/features/group-graph/group-screen.test.tsx src/features/relationship/relation-sheet.test.tsx src/features/relationship/relation-route-gate.test.tsx src/features/checkout/checkout-panel.test.tsx && npm run typecheck && npm run lint`

Expected: PASS with graph topology and accessibility contracts intact.

```bash
git add src/lib/relationship/unlock.ts src/lib/relationship/unlock.test.ts src/features/group-graph/profile-summary.tsx src/features/group-graph/profile-summary.test.tsx src/features/group-graph/group-graph.tsx src/features/group-graph/group-graph.test.tsx src/features/group-graph/build-graph.ts src/features/group-graph/build-graph.test.ts src/features/group-graph/group-screen.tsx src/features/group-graph/group-screen.test.tsx src/features/relationship/relation-sheet.tsx src/features/relationship/relation-sheet.test.tsx src/features/relationship/relation-route-gate.tsx src/features/relationship/relation-route-gate.test.tsx src/features/checkout/checkout-panel.tsx src/features/checkout/checkout-panel.test.tsx src/app/globals.css
git commit -m "feat: show free astrology and relationship details"
```

## Task 9: Enforce privacy and performance

**Files:**
- Modify: `src/production-source-safety.test.ts`
- Create: `tests/e2e/astrology-privacy-performance.spec.ts`

- [ ] **Step 1: Add static privacy RED tests**

Extend the supplied-string source detector so synthetic storage code containing `birthDate` or `birthTime` fails. Scan production sources and migration 003 for raw birth persistence; allow input field names in React forms but reject their occurrence within 240 characters of `localStorage`, `sessionStorage`, repository payload construction, or Supabase column definitions.

```ts
const RAW_BIRTH_NEAR_STORAGE =
  /(?:localStorage|sessionStorage)[\s\S]{0,240}(?:birthDate|birthTime)|(?:birthDate|birthTime)[\s\S]{0,240}(?:localStorage|sessionStorage)/g;

function detectRawBirthPersistence(source: string): string[] {
  return source.match(RAW_BIRTH_NEAR_STORAGE) ?? [];
}

function scanProductionRawBirthPersistence(): string[] {
  return productionSourceFiles(sourceRoot)
    .flatMap((file) => detectRawBirthPersistence(readFileSync(file, "utf8"))
      .map((match) => `${path.relative(sourceRoot, file)}: ${match}`));
}

expect(detectRawBirthPersistence("sessionStorage.setItem('x', JSON.stringify({ birthDate }))"))
  .toEqual([expect.stringContaining("birthDate")]);
expect(scanProductionRawBirthPersistence()).toEqual([]);
```

Also scan `src/lib/astrology/*.ts` production files for `fetch(`, `XMLHttpRequest`, Supabase imports, or HTTP URLs; the only network-visible operation allowed in that directory is the browser's own dynamic chunk import.

- [ ] **Step 2: Add browser lazy-load and storage RED tests**

```ts
test("loads astrology on demand and never stores raw birth values", async ({ page }) => {
  await page.goto("/");
  const scriptsBefore = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/_next/static/chunks/")).length,
  );
  await page.getByLabel("生年月日").focus();
  await expect.poll(() => page.evaluate(() =>
    performance.getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/_next/static/chunks/")).length,
  )).toBeGreaterThan(scriptsBefore);
  await page.getByLabel("生年月日").fill("1996-07-13");
  await page.getByLabel("出生時刻").fill("12:30");
  const stored = await page.evaluate(() => JSON.stringify({
    local: { ...localStorage }, session: { ...sessionStorage }, href: location.href,
  }));
  expect(stored).not.toContain("1996-07-13");
  expect(stored).not.toContain("12:30");
});
```

Use existing E2E local Supabase helpers to complete creation and assert stored `profile_payload.version = 2` while serialized rows omit both raw values.

- [ ] **Step 3: Add the responsiveness acceptance gate**

Register Chromium `PerformanceObserver` for `longtask`, submit one warmed calculation, and assert navigation/result completes in 1,000ms with no calculation long task above 50ms. If the assertion fails on the repository's pinned browser/runtime, stop before commit and move `calculateAstrologyFacts` behind a module Worker; rerun the same unchanged acceptance test until it passes.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/production-source-safety.test.ts`

Run: `npm run test:e2e -- tests/e2e/astrology-privacy-performance.spec.ts`

Expected: both pass; the initial page has no astrology chunk, raw inputs never persist, v2 is stored locally, calculation finishes under 1 second, and no calculation long task exceeds 50ms.

```bash
git add src/production-source-safety.test.ts tests/e2e/astrology-privacy-performance.spec.ts
git commit -m "test: guard astrology privacy and performance"
```

## Task 10: Document licensing, privacy, and behavior

**Files:**
- Create: `THIRD_PARTY_NOTICES.md`
- Modify: `README.md`

- [ ] **Step 1: Add the exact dependency notice**

```markdown
## lunar-typescript 1.8.6

- Source: https://github.com/6tail/lunar-typescript
- License: MIT
- Use: browser-local solar/lunar calendar, solar-term, and Four Pillars facts

MofuType's animal assignment and relationship wording are original product logic and are not the official 動物占い® 60-character system.
```

- [ ] **Step 2: Document the privacy and calculation boundary**

State that birth date/time are calculated only in the browser and are not written to Supabase, Web Storage, logs, analytics, or URLs; location is not collected; Japan civil time and sect 2 midnight are fixed; unknown time omits the hour pillar; engine failure produces labeled v1 `簡易分析`; and existing v1 members remain compatible.

Include this Japanese disclosure verbatim:

```text
四柱推命の暦情報とMBTIをもとにした、MofuType独自のエンターテインメント分析です。
```

- [ ] **Step 3: Document verification commands**

```bash
npm test
npm run typecheck
npm run lint
npm run build
npx supabase db reset
npx supabase test db
npm run test:e2e
```

State that E2E always uses the local Supabase constants in `playwright.config.ts`, never ambient remote credentials.

- [ ] **Step 4: Commit**

```bash
git add README.md THIRD_PARTY_NOTICES.md
git commit -m "docs: explain original browser astrology engine"
```

## Task 11: Run full integration verification

**Files:**
- Verify every intentional file from Tasks 1–10

- [ ] **Step 1: Reset and test the database from empty state**

Run: `npx supabase start && npx supabase db reset && npx supabase test db`

Expected: all migrations apply once and all pgTAP assertions pass.

- [ ] **Step 2: Run the complete app matrix**

Run: `npm test && npm run typecheck && npm run lint && npm run build`

Expected: all commands exit 0, including source safety, 30-member/435-edge memoization, onboarding race guards, realtime merging, checkout, and relationship routes.

- [ ] **Step 3: Run all browser flows**

Run: `npm run test:e2e`

Expected: group creation, independent-context join, 30-member mobile graph, lazy astrology/privacy/performance, zoom, and 320/390/430px viewport cases pass against local-only Supabase.

- [ ] **Step 4: Compare generated types and inspect scope**

Run these commands individually:

```bash
npx supabase gen types typescript --local > /tmp/mofutype-database.types.ts
diff -u src/lib/supabase/database.types.ts /tmp/mofutype-database.types.ts
git diff --check
git status --short
```

Expected: generated types have no semantic diff, diff check is clean, and only intentional implementation files plus pre-existing user-owned untracked files appear.

- [ ] **Step 5: Stop local services and commit only a real correction**

Run: `npx supabase stop`

If verification changed a tracked test or document, stage the exact corrected paths and use `git commit -m "test: finalize astrology integration coverage"`. If nothing changed, leave the existing commits as the complete history and do not make an empty commit.
