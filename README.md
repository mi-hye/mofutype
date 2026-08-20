# MofuType

MBTI와 생년월일·출생시각으로 로컬 十二支·오행 프로필을 만들고, 최대 30명이 한 그룹에서 관계 그래프를 공유하는 Next.js 앱입니다. 프로필 계산에는 외부 사주 API를 사용하지 않습니다. 관계 리포트는 Eximbay의 PayPay·카드 결제와 연결되는 100엔 단건 상품입니다.

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
- Supabase에는 十二支 ID, MBTI(모름은 `null`), 오행·음양 분포와 계산 모드 등 파생 프로필만 저장합니다.
- 十二支·관계 결과는 결정적인 로컬 계산값이며 과학적·의학적 판정이 아닙니다.
- 결제 주문 금액은 DB에서 `100 JPY`로 고정되며 브라우저가 금액을 정할 수 없습니다.
- 그룹 멤버는 주문 생성·조회만 가능하고, 결제확정 RPC는 `service_role`만 실행할 수 있습니다.
- `eximbay-payment-session` Edge Function만 Eximbay 비밀 API 키를 사용해 결제 준비용 FGKey를 생성합니다.
- Eximbay의 `status_url` 응답은 `eximbay-payment-status`가 공식 검증 API로 다시 확인합니다. 금액·통화·MID가 모두 일치한 성공 거래만 그룹 전체에서 해제됩니다.
- 브라우저가 직접 호출하던 모의 해제 RPC 권한은 제거했습니다. 로컬 모의 결제는 원격 Supabase에서 작동하지 않는 로컬 전용 Edge Function만 사용합니다.
- 실제 운영 전 결제사 심사, 환불·개인정보·특정상거래법 표기와 결제사 서명 검증을 완료해야 합니다.

로컬 Edge Function 테스트용 비밀값은 추적되지 않는 `supabase/functions/.env.local`에 둡니다.

```dotenv
EXIMBAY_ENVIRONMENT=test
EXIMBAY_MID=엑심베이에서-발급받은-MID
EXIMBAY_API_KEY=엑심베이에서-발급받은-서버용-API키
PAYMENT_SITE_URL=https://배포된-서비스-도메인
```

```bash
npx supabase functions serve \
  --env-file supabase/functions/.env.local
```

운영 전에는 Supabase secret을 등록하고 결제 함수 두 개를 배포합니다. `EXIMBAY_API_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`는 프런트 환경변수나 저장소에 넣지 않습니다.

```bash
npx supabase secrets set --env-file supabase/functions/.env.local
npx supabase functions deploy eximbay-payment-session
npx supabase functions deploy eximbay-payment-status --no-verify-jwt
```

프런트 배포 환경에는 `NEXT_PUBLIC_PAYMENT_PROVIDER=eximbay`를 설정합니다. MID와 API 키가 발급되기 전에는 이 값을 설정하지 않으며 로컬 화면만 모의 결제로 동작합니다.
