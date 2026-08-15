# MofuType Group Relationship Graph Design

## 1. Product goal

MofuType is a mobile-first Japanese web app for groups of friends, classmates, coworkers, or partners. A group creator shares one link. Each participant enters a nickname, birth date, optional birth time, and optional MBTI. The group page renders every participant as a custom animal character and visualizes all pairwise relationships as an interactive graph.

The product does not reduce a relationship to a percentage. Free users see the graph and a short summary for each pair. A group member may pay 300 JPY to unlock one pair's detailed relationship report. Once unlocked, that report is visible to every member of the same group.

The first release completes the full user flow and UI with local astrology/relationship calculation and mock payment. Supabase provides shared group persistence and realtime updates from the start. A later release replaces the local astrology provider and mock payment provider with production webhooks without changing the UI contracts.

## 2. Audience and language

- Primary audience: Japanese Gen Z and millennials arriving from X.
- All user-facing interface, validation, results, and share copy are Japanese.
- Internal types, code symbols, and developer documentation use English.
- Copy is conversational, punchy, and shareable rather than formal or clinical.

## 3. Visual direction

Use Soft Pop as the base style and add Zine Punch accents:

- Warm cream surfaces with coral, butter yellow, mint, and lilac accents.
- Rounded cards and friendly controls combined with bold Japanese headlines, sticker-like highlights, and strong dark outlines.
- Twelve original SVG animal characters replace emoji and third-party icons.
- Animal assets share a `0 0 256 256` viewBox, transparent background, rounded outlines, flat colors, and a consistent visual system.
- The design system exposes color, spacing, radius, shadow, type, and motion tokens so visual polish can be adjusted after functional implementation.
- Motion clarifies state: new members enter, selected nodes lift, connected edges brighten, and detail panels slide up. Motion respects reduced-motion preferences.

Required animal files under `public/animals/`:

1. `fawn.svg`
2. `raccoon.svg`
3. `black-panther.svg`
4. `sheep.svg`
5. `wolf.svg`
6. `monkey.svg`
7. `tiger.svg`
8. `koala.svg`
9. `cheetah.svg`
10. `lion.svg`
11. `elephant.svg`
12. `pegasus.svg`

Temporary code-native placeholders may be used until the final SVG files arrive, but the public asset contract remains fixed.

## 4. Core user flow

### 4.1 Create a group

The creator enters:

- Group name, required.
- Display nickname, required.
- Birth date through `input[type="date"]`, required.
- Birth time through `input[type="time"]`, optional, with a mutually exclusive `わからない` control.
- MBTI from the sixteen types, optional, with a mutually exclusive `わからない` control.

The browser calculates the creator's derived animal profile, calls a transactional `create_group_and_join` Supabase RPC, and navigates to the group graph. The RPC creates the group and first member atomically. The page exposes a shareable, unguessable invitation URL.

### 4.2 Join a group

Anyone with a valid invitation link may join without a visible account-registration step. Supabase anonymous authentication supplies an internal user identity. The participant completes the same personal form except for the group name.

A transactional `join_group` Supabase RPC validates the invitation, prevents duplicate membership for the same anonymous user, enforces the 30-member limit, and inserts the derived profile. The raw birth date and birth time are not stored in Supabase.

### 4.3 Explore the graph

- Every member appears as an animal node labeled with their nickname.
- Every unordered member pair has one relationship edge. Thirty members produce at most 435 edges.
- Selecting a node highlights every incident edge and fades unrelated edges.
- Selecting an edge opens a pair detail sheet with a free one-line summary and locked report sections.
- The graph supports touch pan and pinch zoom.
- Node size adapts to group size: large for 2–6, medium for 7–15, and compact for 16–30 participants.
- In dense graphs, nonselected edges remain low-opacity while the selected node's connections receive the strongest visual priority.

### 4.4 Unlock a relationship

The pair detail sheet offers `このふたりを300円で解放`. In the first release this opens a mock checkout and completes a mock payment. The resulting unlock is stored once per group and unordered member pair.

An unlocked report is shared by the whole group. All current and future group members can read it. Realtime updates change the edge and detail sheet to `解放済み` without requiring a reload.

## 5. Application architecture

Use Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, React Flow, Supabase, Vitest, React Testing Library, and Playwright.

Primary routes:

- `/`: product introduction and group creation form.
- `/g/[inviteToken]`: group join gate for nonmembers and graph for members.
- `/g/[inviteToken]/relation/[pairKey]`: shareable pair detail route or modal-backed route state.
- `/checkout/[pairKey]`: mock checkout in the first release.
- `/tokushoho`: Japanese commercial transaction disclosure template.
- `/api/og`: dynamic group or pair Open Graph image.

Primary boundaries:

- `AstrologyProvider`: converts raw birth input into a safe derived animal profile. `LocalAstrologyProvider` ships first; `WebhookAstrologyProvider` replaces it later.
- `RelationshipProvider`: creates group dynamics, free pair summaries, and detailed pair reports from derived profiles. It is deterministic and local in the first release.
- `PaymentProvider`: unlocks a pair. `MockPaymentProvider` ships first; a KOMOJU or Stripe provider replaces it later.
- `GroupRepository`: wraps Supabase group, membership, realtime, and unlock operations so UI components do not depend on raw database calls.
- Graph view: converts members into stable nodes and pair results into stable edges. Presentation and selection state remain separate from relationship calculation.

## 6. Data and privacy

Supabase anonymous authentication is invisible to the user. Row Level Security and RPCs enforce group membership and prevent broad anonymous reads.

### 6.1 Tables

`groups`

- `id` UUID primary key
- `name` text
- `invite_token_hash` text unique
- `created_by` UUID
- `max_members` integer fixed to 30
- `created_at` timestamptz

`group_members`

- `id` UUID primary key
- `group_id` UUID foreign key
- `user_id` UUID
- `nickname` text
- `animal_id` text
- `animal_group` enum: `MOON`, `EARTH`, or `SUN`
- `mbti` text nullable; null represents unknown
- `profile_payload` JSONB containing versioned, non-raw derived traits
- `joined_at` timestamptz
- Unique constraint on `(group_id, user_id)`

`relation_unlocks`

- `id` UUID primary key
- `group_id` UUID foreign key
- `member_low_id` UUID
- `member_high_id` UUID
- `status` enum: `pending`, `unlocked`, or `failed`
- `payment_provider` text
- `payment_reference` text nullable
- `unlocked_by` UUID
- `unlocked_at` timestamptz nullable
- Unique constraint on `(group_id, member_low_id, member_high_id)`

The application sorts member IDs before creating a pair key, so A–B and B–A are always the same relationship.

### 6.2 Sensitive input

- Raw birth date and birth time exist only in form state while the local provider runs.
- Only the derived animal ID, group, MBTI selection, and versioned traits are sent to Supabase.
- The later astrology webhook receives raw birth input only for the immediate analysis request and returns derived output. Persistent storage of raw birth data is outside this scope.
- Environment secrets never enter source control. The implementation creates a documented `.env.local` template location and asks the user to supply the Supabase values.

## 7. Relationship logic

The first release uses deterministic local logic so the same input always produces the same profile and pair result.

- Birth date and known birth time feed a versioned mapping function that produces one of the twelve animals.
- Unknown birth time uses an explicit date-only branch rather than inventing a time.
- MBTI modifies behavioral copy when known; unknown MBTI produces animal-only copy without a penalty or fake assumption.
- Animal group dynamics use MOON, EARTH, and SUN superiority rules from the original project specification.
- Relationship results contain categorical dynamics and written summaries, not numeric compatibility percentages.
- Detailed reports include attraction, friction, unspoken feelings, communication guidance, reconciliation guidance, and long-term maintenance tips.

The initial twelve-animal mapping is a product placeholder behind a versioned provider. It must not be presented as a validated traditional fortune-telling calculation. The later webhook can replace the provider without changing persisted profile and relationship interfaces.

## 8. Supabase realtime and access model

- A new browser session calls Supabase anonymous sign-in.
- Group creation returns the public invitation token once; Supabase stores only its hash.
- `create_group_and_join` creates the group and creator membership atomically and returns the invitation token and identifiers.
- `join_group` accepts the invitation token and derived participant profile, resolves the group, locks the group row, checks capacity, and inserts or returns membership.
- Clients do not directly insert or update protected group, membership, or unlock rows; all state transitions use narrowly scoped RPCs.
- Authorized group members may select other members and unlock rows for their group only.
- Clients subscribe to membership insertions and relation-unlock changes scoped to the joined group.
- The UI reconciles realtime events by stable IDs and falls back to an explicit refresh control while disconnected.
- The invitation link is the access mechanism. There is no passcode and no public group directory.

## 9. Error handling

- Invalid or deleted invitation: dedicated Japanese error state with a path back to group creation.
- Full group: RPC rejects the thirty-first unique member and the UI preserves their input while explaining the limit.
- Duplicate join: returns the existing membership instead of inserting a second node.
- Nickname collision: duplicate display names are allowed but receive a short visual discriminator derived from member identity.
- Missing MBTI or birth time: the provider follows its explicit unknown branch.
- Supabase/network failure: preserve unfinished form values in session storage, show retry UI, and never claim participation succeeded before confirmation.
- Realtime disconnect: show connection status, retry automatically, and expose manual refresh.
- Duplicate payment callback: the unique pair constraint and idempotent provider contract return the existing unlock.
- Failed mock or real payment: keep the detail report locked and allow a safe retry.

## 10. Testing and acceptance criteria

### 10.1 Unit tests

- Valid and invalid date/time/MBTI inputs.
- Known and unknown birth-time branches.
- Deterministic animal mapping.
- MOON/EARTH/SUN group dynamics.
- MBTI-known and MBTI-unknown relationship copy.
- Canonical unordered pair keys.
- Node sizing thresholds and incident-edge highlighting.

### 10.2 Component tests

- Group creation and join forms enforce required fields and unknown toggles.
- Selecting a node highlights exactly its incident edges.
- Selecting an edge opens the correct pair sheet.
- Locked and unlocked report states render correctly.
- Dense graph controls remain keyboard and touch accessible.

### 10.3 Integration and end-to-end tests

- A creates a group and obtains an invitation link.
- B and C join through separate anonymous sessions.
- A receives both additions through realtime updates.
- C has edges to A and B.
- The thirty-first participant is rejected transactionally.
- A mock-pays for A–B and B/C sessions receive the shared unlock.
- An unrelated group cannot read members or unlocks through RLS or RPCs.
- Refreshing or reopening the valid group link restores membership for the same anonymous session.

### 10.4 Completion criteria

- Production build, lint, type checking, unit tests, component tests, and the core Playwright flow pass.
- The mobile experience works at 320 px width and common modern phone sizes.
- No raw birth date/time or Supabase secret is present in database rows, URLs, client logs, or Git history.
- The app uses custom SVG asset paths and contains no animal emoji in production UI.
- Visual detail may be iterated later without changing route, provider, repository, or database contracts.

## 11. Delivery sequence

1. Initialize the Next.js project and Git repository, then connect `https://github.com/mi-hye/mofutype.git`.
2. Install the Supabase CLI locally as a development dependency and link project `xshphvgyehzmwrlfmwjf`.
3. Create the ignored local environment file and ask the user to populate its documented public and secret values.
4. Implement schema, RLS, RPCs, and generated database types.
5. Implement local profile and relationship providers with tests.
6. Implement forms, group repository, realtime graph, relationship sheets, and mock checkout.
7. Add legal and Open Graph routes.
8. Run automated and visual verification, then iterate on visual polish and replace placeholders with the final twelve SVG assets.

Production payment, production astrology webhook, persistent raw birth data, public group discovery, account profiles, group moderation tools, and bundle pricing are explicitly outside the first release.
