# MofuType Eto Product Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch onboarding, Supabase repository, realtime graph, relationship details, and local E2E fixtures from the legacy animal model to the tested 十二支 domain and schema.

**Architecture:** Regenerate database types from the reset local schema, replace all production `AnimalId`/group fields with `DerivedEtoProfile`, and inject the new provider at the existing form boundary. Preserve graph topology memoization, RLS/realtime behavior, and payment-unlock flow while changing only relationship data and copy. Remove raw birth drafts from browser storage.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Supabase JS, React Flow, Vitest, Testing Library, Playwright

---

## File map

- `src/lib/supabase/{models,group-repository,app-database.types,database.types}.ts`: new wire contract.
- `src/features/onboarding/*`: provider switch and zero-persistence raw input.
- `src/components/zodiac-avatar.tsx`: new 12-asset avatar contract.
- `src/features/group-graph/{zodiac-node,build-graph,group-graph}.tsx`: zodiac member snapshots.
- `src/features/relationship/*`: three-layer result presentation.
- `tests/e2e/seed.ts`: exact new profile fixtures.
- `src/production-source-safety.test.ts`: enforced legacy-source removal.

### Task 1: Regenerate and map the new Supabase wire contract

**Files:**
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/lib/supabase/app-database.types.ts`
- Modify: `src/lib/supabase/app-database.types.test-d.ts`
- Modify: `src/lib/supabase/models.ts`
- Modify: `src/lib/supabase/group-repository.ts`
- Modify: corresponding Supabase unit tests

- [ ] **Step 1: Write failing mapper and RPC argument tests**

Replace old fixtures with exact dragon/INFP and ambiguous/null profiles. Assert
runtime rejection of extra raw keys, wrong sums, scalar mismatch, and legacy
`animalId`/`animalGroup`. Add compile-time assertions that both create/join RPCs
accept `p_mbti: string | null`, require `p_zodiac_id`, and expose no animal args.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/lib/supabase && npm run typecheck`
Expected: FAIL against legacy generated types and mappers.

- [ ] **Step 3: Generate local database types without hand editing**

Run:

```bash
npx supabase gen types typescript --local > /tmp/mofutype-database.types.ts
```

Compare the file, then replace `src/lib/supabase/database.types.ts` with the
generator output using `apply_patch`. Keep the `AppDatabase` wrapper solely for
the codegen nullability omission on the two `p_mbti` arguments; update its
generic to require `{ p_mbti: string; p_zodiac_id: string }`.

- [ ] **Step 4: Implement exact runtime mapping**

`GroupMember` becomes:

```ts
export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  nickname: string;
  zodiacId: ZodiacId;
  mbti: MbtiType | null;
  profile: DerivedEtoProfile;
  joinedAt: string;
}
```

Map nested objects with explicit key-count, enum, integer, total, nullability,
and scalar-equality checks. Never cast an unchecked JSON object directly to the
profile type.

- [ ] **Step 5: Update repository payloads**

Replace `safeProfile` with an explicit deep clone of the new exact keys. Build
RPC args with `p_zodiac_id`, `p_mbti`, and `p_profile_payload`. Keep auth,
realtime, stale request, preview, capacity, unlock, and public error behavior
unchanged.

- [ ] **Step 6: Run GREEN and commit**

Run: `npm test -- src/lib/supabase && npm run typecheck`
Expected: Supabase suites and strict type assertions PASS.

```bash
git add src/lib/supabase src/lib/supabase/*.test.ts src/lib/supabase/*.test-d.ts
git commit -m "feat: map eto profiles through Supabase"
```

### Task 2: Switch onboarding and eliminate raw birth drafts

**Files:**
- Modify: `src/features/onboarding/schema.ts`
- Modify: `src/features/onboarding/profile-form.tsx`
- Modify: `src/features/onboarding/create-group-form.tsx`
- Modify: `src/features/onboarding/join-group-form.tsx`
- Modify: their colocated tests

- [ ] **Step 1: Write privacy RED tests**

Assert the date input has `min="1900-01-01"` and a clock-derived `max`, unknown
time clears the value, and MBTI unknown yields null. On repository failure,
provide a throwing/recording `Storage` and assert neither form calls `setItem`
with birth date/time. Seed old draft keys and assert they are removed rather than
loaded. Assert the successful callback/navigation happens after form state is
cleared.

- [ ] **Step 2: Run RED**

Run:

```bash
npm test -- src/features/onboarding/schema.test.ts src/features/onboarding/profile-form.test.tsx src/features/onboarding/create-group-form.test.tsx src/features/onboarding/join-group-form.test.tsx
```

Expected: FAIL because the forms currently persist the complete draft.

- [ ] **Step 3: Share the new constants and provider**

Import `MBTI_TYPES`, `EtoProvider`, and `localEtoProvider` from `src/lib/eto`.
Remove production imports from `src/lib/astrology`. Keep provider injection in
props so tests use deterministic fakes.

- [ ] **Step 4: Remove persistent drafts completely**

Delete `readDraft` and every `setItem` call. On mount, best-effort remove
`mofutype:create-group:draft` and the current invite draft key only to invalidate
legacy data. On submit success, call `setDraft(emptyDraft())` before navigation
or `onJoined`. React state may retain input after a recoverable network error,
but no Storage, URL, console, or analytics sink may receive it.

- [ ] **Step 5: Run GREEN and commit**

Run the four focused suites above plus `npm run typecheck`.
Expected: all onboarding and privacy tests PASS.

```bash
git add src/features/onboarding src/lib/eto
git commit -m "feat: onboard with local eto profiles privately"
```

### Task 3: Replace graph member and avatar contracts

**Files:**
- Create: `src/components/zodiac-avatar.tsx`
- Create: `src/components/zodiac-avatar.test.tsx`
- Delete: `src/components/animal-avatar.tsx`
- Delete: `src/components/animal-avatar.test.tsx`
- Create: `src/features/group-graph/zodiac-node.tsx`
- Delete: `src/features/group-graph/animal-node.tsx`
- Modify: `src/features/group-graph/build-graph.ts`
- Modify: `src/features/group-graph/group-graph.tsx`
- Modify: graph tests
- Add: `public/zodiac/*.png` (the existing 12 user-provided assets)

- [ ] **Step 1: Write avatar and graph RED tests**

Test all 12 catalog asset URLs, accessible names, error fallback, selected state,
and rerender retry. Update graph fixtures to `zodiacId` profiles and assert the
same exact 1–30 node/edge counts, 30-member 435 relationship calls, selection,
unlock-only memoization, keyboard list, and mobile ring spacing.

- [ ] **Step 2: Run RED**

Run:

```bash
npm test -- src/components/zodiac-avatar.test.tsx src/features/group-graph
```

Expected: FAIL because production still imports animal contracts.

- [ ] **Step 3: Implement the new avatar and node**

`ZodiacAvatar` accepts `{zodiacId, nickname, size, selected}` and reads
`ZODIACS[zodiacId]`. Keep the existing resilient `<img onError>` behavior and
use `${nickname}の${nameJa}` as the accessible name. `ZodiacNode` preserves
React Flow handles, nickname, discriminator, and selection marker.

- [ ] **Step 4: Preserve graph performance while replacing snapshots**

`RelationshipGraphMember` picks only `id`, `nickname`, `zodiacId`, `mbti`, and
`profile`. `graphMemberSnapshot` explicitly deep-clones the new profile,
including null count records. Rename the React Flow node type from `animal` to
`zodiac`, but do not change positions, selection decoration, unlock styling,
canvas hiding, pointer controls, or canonical keyboard list.

- [ ] **Step 5: Run GREEN and commit**

Run focused graph/avatar suites and `npm run typecheck`.
Expected: all prior topology/performance contracts remain green with zodiac data.

```bash
git add public/zodiac src/components src/features/group-graph
git commit -m "feat: render zodiac relationship graph"
```

### Task 4: Present the three relationship layers

**Files:**
- Modify: `src/features/relationship/relation-sheet.tsx`
- Modify: `src/features/relationship/relation-sheet.test.tsx`
- Modify: `src/features/relationship/relation-route-gate.tsx`
- Modify: `src/features/group-graph/group-screen.tsx`
- Modify: affected tests and `src/app/globals.css`

- [ ] **Step 1: Write relationship UI RED tests**

Assert the free view displays the representative category and one-line headline.
When unlocked, assert headings `十二支の関係`, `五行と陰陽`, `MBTIの4つの軸`,
`ふたりでいるとき`, and each directional member tip. With null MBTI, assert a
neutral unavailable note rather than a locked/paid penalty. With null element
counts, assert the solar-term boundary note and no invented balance claim.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/features/relationship src/features/group-graph/group-screen.test.tsx`
Expected: FAIL against the old six generic detail fields.

- [ ] **Step 3: Switch relationship creation and presentation**

Replace `createRelationship` imports with `createEtoRelationship`. Render the
three typed insights without parsing prose or checking string markers. Preserve
pair route validation, checkout link construction, group-wide unlock state,
close behavior, and locked skeleton accessibility.

- [ ] **Step 4: Add only required styles and run GREEN**

Add semantic classes for layer cards and directional tips using existing Kawaii
Zine tokens. Do not redesign global UI. Run focused tests and `npm run typecheck`.

```bash
git add src/features/relationship src/features/group-graph/group-screen.tsx src/features/group-graph/group-screen.test.tsx src/app/globals.css
git commit -m "feat: show layered eto relationship insights"
```

### Task 5: Remove every legacy production dependency and update E2E

**Files:**
- Delete: `src/lib/astrology/animals.ts`
- Delete or replace: remaining `src/lib/astrology/*`
- Delete or replace: remaining `src/lib/relationship/local-provider*`
- Modify: `tests/e2e/seed.ts`
- Modify: `tests/e2e/group-flow.spec.ts`
- Modify: `tests/e2e/mobile-graph.spec.ts`
- Modify: `src/production-source-safety.test.ts`
- Modify: all remaining old fixtures found by `rg`

- [ ] **Step 1: Add a failing legacy-source scanner**

Scan production TS/TSX/CSS and generated application models, excluding migration
history, tests, docs, and generated Supabase comments. Fail on `AnimalId`,
`AnimalGroup`, `animalId`, `animalGroup`, `MOON`, `EARTH_OVER`, `SUN_OVER`,
`fawn`, `raccoon`, `black-panther`, `pegasus`, `/animals/`, `動物占い`, and
`動物タイプ`.

- [ ] **Step 2: Replace E2E fixtures with exact profiles**

Cycle through the 12 zodiac IDs. Use valid six-count date-only profiles with
fixed day masters and `engineVersion: "mofu-eto-four-pillars-v1"`. Keep the
service-role key Node-only, local URL constants, 30-member fixture strategy, and
two independent browser contexts.

- [ ] **Step 3: Remove legacy files and imports**

Use
`rg -n 'AnimalId|AnimalGroup|animalId|animalGroup|MOON_OVER|EARTH_OVER|SUN_OVER|animal_group|/animals/' src tests`
and remove every production dependency. Check the standalone legacy enum strings
`"MOON"` and `"SUN"` separately; do not flag the valid Five Element value
`"EARTH"`. Do not delete SQL migration history; migration 003 is the explicit
transition record.

- [ ] **Step 4: Run the full local verification matrix**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npx supabase db reset
npx supabase test db
npm run test:e2e
git diff --check
```

Expected: all commands exit 0; E2E proves create, join, realtime graph, 30 members,
MBTI unknown, time unknown, and unlocked detail.

- [ ] **Step 5: Commit the cleanup**

```bash
git add src tests supabase public/zodiac
git commit -m "refactor: remove legacy animal relationship model"
```

### Task 6: Apply the verified destructive migration remotely

**Files:** none

- [ ] **Step 1: Reconfirm the linked target and migration set**

Read `supabase/.temp/project-ref` and require exact value
`xshphvgyehzmwrlfmwjf`. Run `npx supabase migration list --linked` and verify
only migration `202608150003` is pending. If either check differs, stop without
remote mutation and report it.

- [ ] **Step 2: State the deletion immediately before execution**

Tell the user that every existing group, member, unlock, and invite link in that
project will be deleted and cannot be recovered unless an external backup exists.
Proceed only after the user confirms this exact target at execution time.

- [ ] **Step 3: Push the migration**

Run: `npx supabase db push --linked`
Expected: migration `202608150003_reset_eto_profiles.sql` applies successfully.

- [ ] **Step 4: Verify remote shape without inserting user data**

Run `npx supabase migration list --linked` and confirm local/remote versions
match. Open the app and create a disposable test group only if the user authorizes
remote test data; otherwise stop at schema verification.

- [ ] **Step 5: Final commit if verification changed tracked files**

Do not commit `supabase/.temp`, secrets, local logs, or generated runtime state.
If no tracked file changed, no commit is needed.

Plan 3 ends with the production code and remote schema on the new model.
