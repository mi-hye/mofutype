# MofuType Eto Supabase Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy animal/group profile schema with an exact privacy-safe 十二支 profile schema while preserving group security, capacity, realtime, and group-wide unlock behavior.

**Architecture:** Add one destructive forward migration that empties legacy product data, drops legacy RPC signatures and the animal-group enum, then recreates the member profile contract around `zodiac_id` and exact derived JSON. Keep migration history and all group/RLS/unlock boundaries. Verify locally with pgTAP before any remote operation.

**Tech Stack:** Supabase CLI 2.114, PostgreSQL, pgcrypto, pgTAP, generated Supabase TypeScript types

---

## File map

- `supabase/migrations/202608150003_reset_eto_profiles.sql`: destructive local schema transition and new RPCs.
- `supabase/tests/groups_rls.test.sql`: rewritten full security, validation, capacity, and unlock suite.
- Generated TypeScript files intentionally remain unchanged until integration Plan 3, so the current app still typechecks after this SQL-only phase.

### Task 1: Replace the pgTAP contract before the migration

**Files:**
- Modify: `supabase/tests/groups_rls.test.sql`

- [ ] **Step 1: Rewrite profile fixtures around one exact valid payload**

Use a fixture equivalent to:

```sql
jsonb_build_object(
  'version', 1,
  'zodiacId', 'dragon',
  'mbti', 'INFP',
  'dayMaster', jsonb_build_object('element', 'WOOD', 'polarity', 'YANG'),
  'fiveElements', jsonb_build_object('WOOD', 2, 'FIRE', 1, 'EARTH', 1, 'METAL', 1, 'WATER', 1),
  'yinYang', jsonb_build_object('YIN', 3, 'YANG', 3),
  'calculationMode', 'date-only',
  'boundaryState', 'exact',
  'engineVersion', 'mofu-eto-four-pillars-v1'
)
```

Add direct-table and RPC cases for every zodiac, null MBTI, invalid lowercase
MBTI, extra/missing keys, scalar mismatch, negative/fractional counts, wrong 6/8
totals, exact/null mismatch, ambiguous with non-null distributions, and raw keys
such as `birthDate`, `birth_time`, `dob`, and `time`.

- [ ] **Step 2: Preserve and update security tests**

Keep tests for anon RPC denial, anon/auth direct DML denial, member-only SELECT,
SECURITY DEFINER with empty search path, hashed 32-byte invite tokens, stable
errors, duplicate join, 30-member capacity, canonical same-group pairs, first
unlock audit preservation, realtime publication, and exact table count.

- [ ] **Step 3: Run SQL RED**

Run:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

Expected: FAIL because the current schema has `animal_id`/`animal_group` and old
RPC signatures instead of the new zodiac contract.

### Task 2: Add the destructive forward migration and new validation helper

**Files:**
- Create: `supabase/migrations/202608150003_reset_eto_profiles.sql`

- [ ] **Step 1: Remove old data and signatures explicitly**

Start the migration with explicit targets:

```sql
truncate table public.groups cascade;

drop function if exists public.create_group_and_join(text, text, text, text, text, jsonb);
drop function if exists public.join_group(text, text, text, text, text, jsonb);
drop function if exists public._profile_is_valid(text, text, text, jsonb);

alter table public.group_members
  drop constraint if exists group_members_profile_payload_check,
  drop constraint if exists group_members_animal_group_check,
  drop column animal_id,
  drop column animal_group,
  add column zodiac_id text,
  add column profile_version integer;

drop type public.animal_group;
```

Then set the new columns NOT NULL after the empty-table transition and add the
12-ID and `profile_version = 1` checks.

- [ ] **Step 2: Implement null-safe exact JSON validation**

Create `public._eto_profile_is_valid(p_zodiac_id text, p_mbti text,
p_profile_payload jsonb)` as immutable, SECURITY DEFINER, `search_path = ''`,
owned by postgres, and unexecutable by clients. Its predicate must require exact
top-level equality with `jsonb_build_object`, exact `dayMaster`, exact five-key
and two-key count objects, integer JSON-number regexes, scalar equality, and
these state rules:

```text
exact + date-time  => fiveElements total 8, yinYang total 8
exact + date-only  => fiveElements total 6, yinYang total 6
solar-term-ambiguous + date-only => both count objects JSON null
```

Use `coalesce(complete_predicate, false)` so PostgreSQL CHECK cannot accept SQL
NULL. Because exact JSON equality forbids every extra key, raw birth fields are
rejected at both RPC and table boundaries.

- [ ] **Step 3: Attach the same helper to the table boundary**

Add a CHECK calling `_eto_profile_is_valid(zodiac_id, mbti, profile_payload)` and
require `(profile_payload ->> 'version')::integer = profile_version`. Preserve
the existing group/user unique keys and same-group composite foreign keys used
by `relation_unlocks`.

### Task 3: Recreate create/join RPCs with the new arguments

**Files:**
- Modify: `supabase/migrations/202608150003_reset_eto_profiles.sql`

- [ ] **Step 1: Create the exact RPC signatures**

Use these signatures and no overloads:

```sql
create function public.create_group_and_join(
  p_name text,
  p_nickname text,
  p_zodiac_id text,
  p_mbti text,
  p_profile_payload jsonb
) returns table(group_id uuid, member_id uuid, invite_token text);

create function public.join_group(
  p_invite_token text,
  p_nickname text,
  p_zodiac_id text,
  p_mbti text,
  p_profile_payload jsonb
) returns table(group_id uuid, member_id uuid);
```

- [ ] **Step 2: Preserve transaction and security behavior**

Both functions must authenticate before profile validation, trim names, raise
the existing stable `P0001` messages, insert `profile_version = 1`, and have
`security definer set search_path = ''`. `join_group` must lock the group row
before duplicate/capacity checks. Revoke from public/anon and grant only to
authenticated.

- [ ] **Step 3: Leave unlock and invite preview behavior intact**

Do not recreate `unlock_relation_mock`, `get_group_invite_preview`, RLS policies,
indexes, or realtime publication unless a dependency requires it. The truncated
groups cascade old unlocks, while their schema and audit guarantees remain.

### Task 4: Prove the local reset from a fresh database

**Files:**
- Modify: `supabase/tests/groups_rls.test.sql` only for failures caused by test mechanics

- [ ] **Step 1: Reset and run pgTAP GREEN**

Run:

```bash
npx supabase db reset
npx supabase test db
```

Expected: every assertion passes, the migration applies exactly once, and no old
animal enum/column/function signature remains.

- [ ] **Step 2: Run catalog probes**

Use `psql` through `npx supabase db query` or the local database container to
assert:

```sql
select count(*) from public.groups; -- 0
select count(*) from pg_type where typname = 'animal_group'; -- 0
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'group_members';
```

Expected member-specific columns include `zodiac_id`, `mbti`,
`profile_payload`, and `profile_version`, and exclude `animal_id` and
`animal_group`.

- [ ] **Step 3: Run application regression commands**

Run: `npm test && npm run typecheck && npm run lint && git diff --check`
Expected: current application tests remain green because generated TS and
production callers have not switched yet.

- [ ] **Step 4: Commit the local schema phase**

```bash
git add supabase/migrations/202608150003_reset_eto_profiles.sql supabase/tests/groups_rls.test.sql
git commit -m "feat: reset group schema for eto profiles"
```

### Task 5: Stop before remote destruction

**Files:** none

- [ ] **Step 1: Verify scope without mutating the remote project**

Run `npx supabase projects list` and, if linked, read
`supabase/.temp/project-ref`. The only acceptable ref for this project is
`xshphvgyehzmwrlfmwjf`.

- [ ] **Step 2: Report the exact destructive effect**

Report that applying migration `202608150003` deletes all groups, members,
relation unlocks, and invalidates every old invite link. Do not run `db push` in
this plan. Remote application happens only after Plan 3 passes its complete
local E2E matrix and the user confirms the verified project ref.

Plan 2 ends with a locally proven destructive migration and zero remote writes.
