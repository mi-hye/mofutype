# MofuType Eto Domain Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, browser-local 十二支, Four Pillars, Five Element, Yin/Yang, MBTI character, and categorical relationship engine alongside the current production engine.

**Architecture:** Build the new domain in `src/lib/eto` without importing the legacy animal catalog. Isolate `lunar-typescript` behind one adapter, emit a minimal privacy-safe `DerivedEtoProfile`, and compose relationship categories from three independent categorical layers. This phase is side-by-side so the current app remains green until the schema and UI switch plans run.

**Tech Stack:** TypeScript 6, Vitest 4, `lunar-typescript@1.8.6`, Next.js browser runtime

---

## File map

- `src/lib/eto/types.ts`: exact domain contracts and enums.
- `src/lib/eto/validation.ts`: strict date, time, and MBTI parsing.
- `src/lib/eto/zodiac.ts`: Jan-1 十二支 calculation and the 12-entry catalog.
- `src/lib/eto/character.ts`: 16 MBTI modifiers and compositional character copy.
- `src/lib/eto/four-pillars.ts`: the only `lunar-typescript` import and JST/solar-term handling.
- `src/lib/eto/provider.ts`: converts validated input and Four Pillars facts into the stored profile.
- `src/lib/eto/relationship.ts`: zodiac, Five Element, MBTI, majority, and directional tips.
- Colocated `.test.ts` files verify every table and boundary.

### Task 1: Install the calendar dependency and define exact contracts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/eto/types.ts`
- Create: `src/lib/eto/validation.ts`
- Create: `src/lib/eto/validation.test.ts`

- [ ] **Step 1: Write the failing validation tests**

Create `src/lib/eto/validation.test.ts` with table tests for `1900-01-01`,
`2000-02-29`, `1899-12-31`, `2000-02-30`, a future date relative to an injected
`2026-08-15`, `00:00`, `23:59`, `24:00`, every MBTI constant, lowercase `infp`,
and null MBTI/time. Assert stable codes `INVALID_BIRTH_DATE`,
`INVALID_BIRTH_TIME`, and `INVALID_MBTI`.

```ts
expect(parseEtoInput(
  { birthDate: "2000-02-29", birthTime: null, mbti: null },
  "2026-08-15",
)).toEqual({ year: 2000, month: 2, day: 29, hour: null, minute: null, mbti: null });

expect(() => parseEtoInput(
  { birthDate: "1899-12-31", birthTime: null, mbti: null },
  "2026-08-15",
)).toThrowError(expect.objectContaining({ code: "INVALID_BIRTH_DATE" }));
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npm test -- src/lib/eto/validation.test.ts`
Expected: FAIL because `./validation` does not exist.

- [ ] **Step 3: Add the dependency and domain contracts**

Run: `npm install lunar-typescript@1.8.6`

Create `src/lib/eto/types.ts` with these exact public types:

```ts
export const ZODIAC_IDS = [
  "rat", "ox", "tiger", "rabbit", "dragon", "snake",
  "horse", "sheep", "monkey", "rooster", "dog", "boar",
] as const;
export type ZodiacId = (typeof ZODIAC_IDS)[number];

export const MBTI_TYPES = [
  "ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ",
] as const;
export type MbtiType = (typeof MBTI_TYPES)[number];
export type FiveElement = "WOOD" | "FIRE" | "EARTH" | "METAL" | "WATER";
export type Polarity = "YIN" | "YANG";
export type CalculationMode = "date-time" | "date-only";
export type BoundaryState = "exact" | "solar-term-ambiguous";
export type ElementCounts = Readonly<Record<FiveElement, number>>;
export type YinYangCounts = Readonly<Record<Polarity, number>>;

export interface EtoInput {
  birthDate: string;
  birthTime: string | null;
  mbti: MbtiType | null;
}

export interface DerivedEtoProfile {
  version: 1;
  zodiacId: ZodiacId;
  mbti: MbtiType | null;
  dayMaster: { element: FiveElement; polarity: Polarity };
  fiveElements: ElementCounts | null;
  yinYang: YinYangCounts | null;
  calculationMode: CalculationMode;
  boundaryState: BoundaryState;
  engineVersion: "mofu-eto-four-pillars-v1";
}

export interface EtoProvider {
  derive(input: EtoInput, todayIso?: string): Promise<DerivedEtoProfile>;
}
```

- [ ] **Step 4: Implement strict shared parsing**

In `validation.ts`, use anchored regexes, UTC date reconstruction, an inclusive
minimum of `1900-01-01`, and lexicographic comparison of normalized ISO dates.
Expose `parseEtoInput(input, todayIso)` and an `EtoValidationError` with the three
stable codes tested above. Validate MBTI with `new Set(MBTI_TYPES)` and never
uppercase or coerce invalid input.

- [ ] **Step 5: Run GREEN and commit**

Run: `npm test -- src/lib/eto/validation.test.ts && npm run typecheck`
Expected: all validation tests PASS and typecheck exits 0.

```bash
git add package.json package-lock.json src/lib/eto/types.ts src/lib/eto/validation.ts src/lib/eto/validation.test.ts
git commit -m "feat: add eto domain contracts and validation"
```

### Task 2: Add the 十二支 and MBTI character catalogs

**Files:**
- Create: `src/lib/eto/zodiac.ts`
- Create: `src/lib/eto/zodiac.test.ts`
- Create: `src/lib/eto/character.ts`
- Create: `src/lib/eto/character.test.ts`

- [ ] **Step 1: Write RED tests for all catalog combinations**

Assert that `zodiacForGregorianYear(2020)` is `rat`, 2021 is `ox`, 2022 is
`tiger`, 2023 is `rabbit`, 2024 is `dragon`, and 2019/2031 are both `boar`.
Iterate every `ZODIAC_IDS × MBTI_TYPES` combination and assert exactly 192 unique
input keys, non-empty Japanese titles/descriptions, and stable repeated output.
Assert null MBTI yields `${nameJa}タイプ` for all 12 IDs.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/eto/zodiac.test.ts src/lib/eto/character.test.ts`
Expected: FAIL because the two modules do not exist.

- [ ] **Step 3: Implement the zodiac catalog and year formula**

Create an exact `ZODIACS` record containing the names and keywords approved in
the spec and asset paths `/zodiac/<id>.png`. Use this formula:

```ts
export function zodiacForGregorianYear(year: number): ZodiacId {
  if (!Number.isInteger(year)) throw new RangeError("Invalid Gregorian year");
  return ZODIAC_IDS[((year - 2020) % 12 + 12) % 12];
}
```

- [ ] **Step 4: Implement compositional character copy**

Create `MBTI_MODIFIERS` with all 16 approved Japanese modifiers. Expose:

```ts
export interface CharacterCopy {
  titleJa: string;
  zodiacTraitsJa: readonly [string, string, string];
  mbtiModifierJa: string | null;
  descriptionJa: string;
}

export function createCharacterCopy(
  zodiacId: ZodiacId,
  mbti: MbtiType | null,
): CharacterCopy;
```

Build the description from one zodiac base sentence and one optional MBTI
sentence. Do not store 192 complete descriptions and do not use randomness.

- [ ] **Step 5: Run GREEN and commit**

Run: `npm test -- src/lib/eto/zodiac.test.ts src/lib/eto/character.test.ts`
Expected: PASS with 192 combinations and 12 null-MBTI cases.

```bash
git add src/lib/eto/zodiac.ts src/lib/eto/zodiac.test.ts src/lib/eto/character.ts src/lib/eto/character.test.ts
git commit -m "feat: add zodiac and MBTI character catalog"
```

### Task 3: Implement JST Four Pillars facts without persisting raw input

**Files:**
- Create: `src/lib/eto/four-pillars.ts`
- Create: `src/lib/eto/four-pillars.test.ts`
- Create: `src/lib/eto/provider.ts`
- Create: `src/lib/eto/provider.test.ts`

- [ ] **Step 1: Write boundary and privacy tests**

Cover actual 立春 2024 at `2024-02-04 17:27 JST`, one minute before/after,
month solar-term boundaries, JST `00:00`, leap day, date-time totals of 8,
date-only totals of 6, and an unknown-time solar-term date. The ambiguous case
must return a fixed day master, null element/yin-yang counts, and
`solar-term-ambiguous`. Assert no output key contains `birth`, `date`, `time`,
`pillar`, `stem`, or `branch`.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/eto/four-pillars.test.ts src/lib/eto/provider.test.ts`
Expected: FAIL because the adapter and provider do not exist.

- [ ] **Step 3: Implement the isolated library adapter**

Only `four-pillars.ts` may import `Solar` from `lunar-typescript`. Reuse the
verified civil-basis correction by subtracting 60 minutes before requesting
exact year/month terms from the library, while reading day/time pillars from the
unshifted JST civil date with `EightChar.setSect(2)`.

Count one element and one polarity for each stem and branch in the available
year/month/day/hour pillars. Heavenly stem and earthly branch indices use even
index = YANG and odd index = YIN. Compare exact year/month at 00:00 and 23:59
for unknown time; if they differ, return null distributions rather than choosing
one candidate.

- [ ] **Step 4: Implement the provider**

`deriveEtoProfile` must call `parseEtoInput`, derive `zodiacId` only from the
Gregorian input year, map the day stem to the day-master element/polarity, clone
count records, and return the exact `DerivedEtoProfile` shape. Export the
production boundary with no fallback:

```ts
export const localEtoProvider: EtoProvider = {
  async derive(input, todayIso) {
    return deriveEtoProfile(calculateFourPillarsFacts(input, todayIso));
  },
};
```

The concrete facts object must carry the parsed `mbti` and Gregorian birth year
in memory only so `deriveEtoProfile` can compose the result; neither field is
added to persisted output beyond `mbti` and `zodiacId`. Do not catch calculation
failures into a fake profile.

- [ ] **Step 5: Run GREEN and commit**

Run: `npm test -- src/lib/eto/four-pillars.test.ts src/lib/eto/provider.test.ts && npm run typecheck`
Expected: all adapter/provider tests PASS and typecheck exits 0.

```bash
git add src/lib/eto/four-pillars.ts src/lib/eto/four-pillars.test.ts src/lib/eto/provider.ts src/lib/eto/provider.test.ts
git commit -m "feat: derive privacy-safe eto profiles locally"
```

### Task 4: Build the balanced categorical relationship engine

**Files:**
- Create: `src/lib/eto/relationship.ts`
- Create: `src/lib/eto/relationship.test.ts`

- [ ] **Step 1: Write exhaustive RED tests**

Test all 66 unordered distinct zodiac pairs plus all 12 same pairs. Assert the
six 六合 pairs, 12 三合 pairs, six 六冲 pairs, and general fallback. Test the five
generating and five controlling element directions, same element/polarity,
distribution complement when counts exist, and null distributions. Iterate all
256 MBTI pairs and assert A/B category symmetry. Test majority agreement, all
three different, null MBTI, and directional A/B tip swapping.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/eto/relationship.test.ts`
Expected: FAIL because `relationship.ts` does not exist.

- [ ] **Step 3: Implement exact layer results**

Define these public categories:

```ts
export type RelationshipCategory =
  | "NATURAL_INTERLOCK"
  | "EXPANDING_POSSIBILITIES"
  | "POSITIVE_STIMULATION"
  | "LEARNING_EACH_OTHERS_PACE";
```

Store 六合, 六冲, and 三合 as canonical unordered IDs; never duplicate reversed
pairs. Implement MBTI rules in the mutually exclusive order from the spec:
4 same, 3 same, exactly 2 with only E/I+J/P different, other exactly 2, then
0–1 same. Implement Five Element generating/controlling cycles as lookup records,
not nested conditionals.

- [ ] **Step 4: Implement majority and copy composition**

Expose `createEtoRelationship({memberA, memberB})` with this input boundary:

```ts
export interface EtoRelationshipMember {
  id: string;
  profile: DerivedEtoProfile;
}

export interface CreateEtoRelationshipInput {
  memberA: EtoRelationshipMember;
  memberB: EtoRelationshipMember;
}
```

Use `canonicalPairKey`, count
category occurrences without numeric compatibility scores, choose zodiac on a
tie, and return:

```ts
{
  pairKey,
  category,
  headlineJa,
  zodiacInsight,
  fiveElementInsight,
  mbtiInsight,
  tips: { togetherJa, forPersonAJa, forPersonBJa },
}
```

The public model must not contain `score`, `percentage`, `rank`, or numeric point
fields. Sort only for pair identity and symmetric headline; preserve A/B for
directional tips.

- [ ] **Step 5: Run GREEN and commit**

Run: `npm test -- src/lib/eto/relationship.test.ts && npm run typecheck`
Expected: exhaustive relationship tests PASS.

```bash
git add src/lib/eto/relationship.ts src/lib/eto/relationship.test.ts
git commit -m "feat: add balanced eto relationship engine"
```

### Task 5: Verify the isolated domain phase

**Files:**
- Create: `THIRD_PARTY_NOTICES.md`

- [ ] **Step 1: Record the MIT dependency**

Add `lunar-typescript 1.8.6 — MIT — https://github.com/6tail/lunar-typescript`
without copying library source or fortune text.

- [ ] **Step 2: Run the complete domain and repository verification**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm audit
git diff --check
```

Expected: every command exits 0 and audit reports zero known vulnerabilities.

- [ ] **Step 3: Commit the notice**

```bash
git add THIRD_PARTY_NOTICES.md
git commit -m "docs: record local calendar dependency"
```

Plan 1 ends with the new engine tested but not yet used by production forms.
