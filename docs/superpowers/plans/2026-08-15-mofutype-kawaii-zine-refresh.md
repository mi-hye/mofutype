# MofuType Kawaii Zine UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 그룹 생성·참여·관계 그래프 동작과 접근성을 그대로 유지하면서 전체 화면을 A안 `Kawaii Zine` 스타일로 리프레시한다.

**Architecture:** DOM 계약과 데이터 흐름은 바꾸지 않고, CSS 디자인 토큰과 안정적인 class/data attribute를 중심으로 시각 계층을 재구성한다. 꼭 필요한 랜딩 장식과 그래프 상태 표식만 JSX에 추가하며, 동물 자산은 기존 `/animals/<id>.svg` 계약과 텍스트 폴백을 유지한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS, Vitest, Testing Library, React Flow

---

### Task 1: Kawaii Zine 디자인 토큰과 공통 프리미티브

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/primitives.test.tsx`
- Test: `src/production-source-safety.test.ts`

- [ ] **Step 1: 공통 프리미티브 계약을 실패 테스트로 고정한다**

`primitives.test.tsx`에 primary/secondary/ghost 버튼의 `data-variant`, 카드 변형, 상태 배너의 접근 가능한 이름과 설명이 유지되는지 검사한다. CSS 소스에는 `--hot-pink`, `--mint-pop`, `--shadow-zine`, `prefers-reduced-motion`이 있어야 한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/components/ui/primitives.test.tsx src/production-source-safety.test.ts`

Expected: 새 Kawaii Zine 토큰 검사만 FAIL하고 기존 의미/접근성 검사는 PASS한다.

- [ ] **Step 3: 공통 토큰과 컴포넌트 상태를 구현한다**

`globals.css`의 기존 변수명을 호환 유지하면서 핫핑크·코랄·민트·옐로·라일락 팔레트, 3px 잉크 테두리, 6px 오프셋 그림자, 눌림 상태를 추가한다. `.ui-button`, `.ui-card`, `.status-banner`, `.animal-avatar`는 새 토큰만 사용하고 44px 터치 대상과 `:focus-visible`을 유지한다.

- [ ] **Step 4: 공통 검사를 통과시킨다**

Run: `npm test -- src/components/ui/primitives.test.tsx src/production-source-safety.test.ts`

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add src/app/globals.css src/components/ui/primitives.test.tsx src/production-source-safety.test.ts
git commit -m "style: add kawaii zine design tokens"
```

### Task 2: 랜딩과 온보딩 폼 리프레시

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/features/onboarding/profile-form.tsx`
- Modify: `src/features/onboarding/profile-form.test.tsx`
- Modify: `src/features/onboarding/join-group-form.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: 강한 카피와 장식의 의미 계약을 실패 테스트로 작성한다**

랜딩 테스트는 `みんなの関係、ぜんぶ丸見え。`, `#かわいい`, `#ちょい毒`, 실제 생성 폼, `#create`로 이동하는 primary CTA를 검사한다. 프로필 폼 테스트는 네이티브 `date`/`time`, 실제 checkbox, 오류 연결이 그대로인지 검사한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/app/page.test.tsx src/features/onboarding/profile-form.test.tsx`

Expected: 새 카피·장식 계약이 FAIL한다.

- [ ] **Step 3: 랜딩과 폼을 구현한다**

`page.tsx`에 zine masthead, 짧은 헤드라인, CSS 장식용 `aria-hidden` 요소, 해시 스티커를 추가하고 CTA를 `#create`에 연결한다. 폼 DOM 의미는 유지하고 `.unknown-toggle`을 CSS 스티커형 토글로 바꾸며 네이티브 date/time 입력은 그대로 둔다. 참여 프리뷰는 티켓형 카드로 스타일링한다.

- [ ] **Step 4: 온보딩 검사를 통과시킨다**

Run: `npm test -- src/app/page.test.tsx src/features/onboarding/profile-form.test.tsx src/features/onboarding/create-group-form.test.tsx src/features/onboarding/join-group-form.test.tsx`

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add src/app/page.tsx src/app/page.test.tsx src/app/globals.css src/features/onboarding/profile-form.tsx src/features/onboarding/profile-form.test.tsx src/features/onboarding/join-group-form.tsx
git commit -m "style: refresh landing and onboarding"
```

### Task 3: 그룹 화면과 관계 그래프 리프레시

**Files:**
- Modify: `src/features/group-graph/animal-node.tsx`
- Modify: `src/features/group-graph/group-graph.tsx`
- Modify: `src/features/group-graph/group-graph.test.tsx`
- Modify: `src/features/group-graph/group-screen.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: 그래프 상태 표식의 실패 테스트를 작성한다**

선택 노드는 `SELECTED` 텍스트 표식을, 잠금 해제 관계는 기존 접근 가능한 `解放済み` 텍스트와 시각 클래스/데이터 속성을 제공해야 한다. 캔버스 `aria-hidden`, 키보드용 관계 목록, 클릭 동작은 기존 테스트로 함께 고정한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/features/group-graph/group-graph.test.tsx src/features/group-graph/group-screen.test.tsx`

Expected: 새 선택 표식 검사만 FAIL한다.

- [ ] **Step 3: 그래프와 그룹 화면을 구현한다**

동물 노드에 선택 스티커를 추가하고, 캔버스에는 도트 배경·잉크 프레임·스티커형 노드·낮은 기본 edge opacity·선택/해제 edge 강조를 적용한다. 그룹 헤더는 zine cover heading으로, 연결 상태와 작업 버튼은 겹치지 않는 반응형 도구 모음으로 만든다. 16~30명 레이아웃 좌표와 그래프 계산은 변경하지 않는다.

- [ ] **Step 4: 그래프 검사를 통과시킨다**

Run: `npm test -- src/features/group-graph/group-graph.test.tsx src/features/group-graph/group-screen.test.tsx src/features/group-graph/build-graph.test.ts`

Expected: PASS, 30명 edge 435개와 재계산 예산이 유지된다.

- [ ] **Step 5: 커밋한다**

```bash
git add src/features/group-graph/animal-node.tsx src/features/group-graph/group-graph.tsx src/features/group-graph/group-graph.test.tsx src/features/group-graph/group-screen.tsx src/app/globals.css
git commit -m "style: refresh relationship graph"
```

### Task 4: 시각 검증과 회귀 마감

**Files:**
- Modify: `src/app/globals.css`
- Modify: affected tests only when they encode the approved visual contract

- [ ] **Step 1: 전체 자동 검증을 실행한다**

Run: `npm test && npm run typecheck && npm run lint && npm run build`

Expected: 모든 명령 exit 0, 기존 기능·접근성·소스 안전성 테스트 PASS.

- [ ] **Step 2: 실제 브라우저에서 핵심 화면을 확인한다**

`http://127.0.0.1:3000`에서 랜딩과 생성 폼을 320px 및 데스크톱 폭으로 확인한다. 유효한 로컬 그룹 fixture가 있으면 참여/그래프도 확인하며, 없으면 컴포넌트 테스트의 2·16·30명 fixture로 레이아웃 회귀를 확인한다. 콘솔 error/warn은 0이어야 한다.

- [ ] **Step 3: 시각 결함만 최소 수정한다**

가로 스크롤, 44px 미만 주요 컨트롤, 텍스트 잘림, 대비 부족, 장식의 클릭 방해가 발견되면 CSS만 조정한다. 데이터 흐름, Supabase 계약, 관계 엔진은 수정하지 않는다.

- [ ] **Step 4: 최종 검증을 다시 실행한다**

Run: `npm test && npm run typecheck && npm run lint && npm run build && git diff --check`

Expected: 모두 exit 0.

- [ ] **Step 5: 커밋한다**

```bash
git add src docs/superpowers/specs/2026-08-15-mofutype-kawaii-zine-refresh-design.md docs/superpowers/plans/2026-08-15-mofutype-kawaii-zine-refresh.md
git commit -m "style: complete kawaii zine refresh"
```
