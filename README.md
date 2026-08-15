# MofuType

MBTI와 생년월일·출생시각으로 로컬 동물 프로필을 만들고, 최대 30명이 한 그룹에서 관계 그래프를 공유하는 Next.js 앱입니다. 현재 계산과 300엔 결제는 모두 로컬/모의 구현이며 실제 사주 API·결제 웹훅은 연결하지 않았습니다.

## 로컬 실행

Node.js 22 사용을 권장합니다(`.nvmrc` 포함).

```bash
npm install
npx supabase start
npx supabase db reset
npm run dev
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다. 일반 개발용 `.env.local`에는 다음 두 공개 클라이언트 값이 필요합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`.env.local`과 다른 환경 파일은 Git에 포함되지 않습니다. 서비스 역할 키나 비밀 키를 `NEXT_PUBLIC_*` 변수에 넣지 마세요.

## 검증

E2E 테스트는 실행 중인 로컬 Supabase만 사용합니다. 실행 전 아래처럼 DB를 초기화합니다.

```bash
npm run lint
npm run typecheck
npm test
npx supabase db reset
npx supabase test db
npm run test:e2e
npm run build
```

E2E에는 세 명의 독립 브라우저 참여, 그룹 공용 관계 해금, 30명·435개 관계선, 320px 모바일 가로 넘침 검사가 포함됩니다.

## 현재 데이터·결제 경계

- 생년월일과 출생시각은 브라우저에서 프로필을 계산한 뒤 폐기하며 Supabase에 저장하지 않습니다.
- Supabase에는 동물 ID/그룹, MBTI(모름은 `null`), 계산 모드 등 파생 프로필만 저장합니다.
- 동물/관계 결과는 결정적인 로컬 계산값이며 실제 사주 감정 결과가 아닙니다.
- 300엔 PayPay/카드 화면은 모의 결제입니다. 실제 청구, PayPay 연동, 결제 웹훅은 아직 없습니다.
- 실제 운영 전 결제사 심사, 환불·개인정보·특정상거래법 표기와 서버 웹훅 검증을 완료해야 합니다.
