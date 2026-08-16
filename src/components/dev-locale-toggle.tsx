"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type DevLocale = "ja" | "ko";

const STORAGE_KEY = "mofutype:dev-locale";
const ATTRIBUTES = ["aria-label", "aria-description", "placeholder", "title"] as const;

const KO_COPY: Readonly<Record<string, string>> = {
  "MofuType ホーム": "MofuType 홈",
  "MofuType グループ": "MofuType 그룹",
  "わたしたち、こんな感じ。": "우리들, 이런 느낌.",
  "わたしたち、": "우리들,",
  "こんな感じ。": "이런 느낌.",
  "ムード": "분위기",
  "誕生日と性格タイプで、友だちとの空気感を一枚の関係マップに。": "생일과 성격 유형으로 친구들과의 분위기를 한 장의 관계 지도로.",
  "グループを作る": "그룹 만들기",
  "グループ作成": "그룹 만들기",
  "はじめる": "시작하기",
  "MofuTypeでできること": "MofuType에서 할 수 있는 것",
  "わたしを知る": "나를 알아보기",
  "生年月日とMBTIから、あなたらしい動物タイプを見つけます。": "생년월일과 MBTI로 나다운 동물 유형을 찾아요.",
  "みんなをつなぐ": "모두를 연결하기",
  "友だちやチームを招待して、関係性を一枚のマップに。": "친구나 팀을 초대해 관계를 한 장의 지도로 만들어요.",
  "違いを楽しむ": "다름을 즐기기",
  "それぞれの個性を知って、もっと心地よい関係へ。": "서로의 개성을 알고 더 편안한 관계로 나아가요.",
  "グループ名": "그룹 이름",
  "グループ名入力フォーム": "그룹 이름 입력 폼",
  "次へ": "다음",
  "グループはプロフィール入力のあとに作成されます。": "그룹은 프로필 입력 후 생성됩니다.",
  "プロフィール": "프로필",
  "プロフィールを入力": "프로필 입력",
  "あと少しでグループ完成です。": "조금만 더 입력하면 그룹이 완성돼요.",
  "グループ名を変更": "그룹 이름 변경",
  "プロフィール入力フォーム": "프로필 입력 폼",
  "グループ作成フォーム": "그룹 생성 폼",
  "作成するグループ": "생성할 그룹",
  "ニックネーム": "닉네임",
  "生年月日": "생년월일",
  "出生時刻": "출생 시각",
  "出生時刻はわからない": "출생 시각을 몰라요",
  "MBTIはわからない": "MBTI를 몰라요",
  "選択してください": "선택해 주세요",
  "グループを作成": "그룹 생성",
  "入力内容を確認しています": "입력 내용을 확인하고 있어요",
  "先にグループ名を入力してください。": "먼저 그룹 이름을 입력해 주세요.",
  "グループ名を入力する": "그룹 이름 입력",
  "グループに招待されています": "그룹에 초대받았어요",
  "招待されたグループ": "초대받은 그룹",
  "プロフィールを入力して、グループに参加しましょう。": "프로필을 입력하고 그룹에 참여해 보세요.",
  "グループ参加フォーム": "그룹 참여 폼",
  "グループに参加": "그룹 참여",
  "接続中": "연결 중",
  "グループに接続しています": "그룹에 연결하고 있어요",
  "再接続中": "재연결 중",
  "もう一度つないでいます": "다시 연결하고 있어요",
  "オフライン": "오프라인",
  "通信環境を確認してください": "네트워크 상태를 확인해 주세요",
  "エラー": "오류",
  "接続できませんでした": "연결하지 못했습니다",
  "接続完了": "연결 완료",
  "グループにつながりました": "그룹에 연결됐어요",
  "接続を再試行": "연결 다시 시도",
  "最新の情報に更新": "최신 정보로 새로고침",
  "グループを更新できませんでした。通信環境を確認してください。": "그룹을 새로고침하지 못했습니다. 네트워크 상태를 확인해 주세요.",
  "わたしの四柱推命": "나의 사주 결과",
  "診断結果の詳細": "진단 결과 상세",
  "MBTI未設定": "MBTI 미설정",
  "月タイプ": "달 유형",
  "地球タイプ": "지구 유형",
  "太陽タイプ": "태양 유형",
  "出生時刻を反映": "출생 시각 반영",
  "生年月日で診断": "생년월일로 진단",
  "生まれ持った気質": "타고난 기질",
  "メンバー": "멤버",
  "招待リンクを共有": "초대 링크 공유",
  "共有方法": "공유 방법",
  "共有メニューを閉じる": "공유 메뉴 닫기",
  "リンクをコピー": "링크 복사",
  "アプリで共有": "앱으로 공유",
  "共有しました": "공유했습니다",
  "招待リンクをコピーしました": "초대 링크를 복사했습니다",
  "共有できませんでした。もう一度お試しください。": "공유하지 못했습니다. 다시 시도해 주세요.",
  "共有リンクを準備しています": "공유 링크를 준비하고 있어요",
  "共有リンクを作成できません。": "공유 링크를 만들 수 없습니다.",
  "関係詳細を閉じる": "관계 상세 닫기",
  "閉じる": "닫기",
  "この関係の共有ページ": "이 관계 공유 페이지",
  "解放済み": "열람 완료",
  "惹かれ合う理由": "서로 끌리는 이유",
  "すれ違いやすい点": "엇갈리기 쉬운 점",
  "言葉にしにくい本音": "말로 하기 어려운 속마음",
  "会話のコツ": "대화의 요령",
  "仲直りのヒント": "화해의 힌트",
  "長くつきあうヒント": "오래 지내는 힌트",
  "ロック中の詳細": "잠긴 상세 내용",
  "このふたりを300円で解放": "두 사람의 관계를 300엔에 열기",
  "これはモック決済です。実際の請求は発生しません。": "개발용 모의 결제이며 실제 청구는 발생하지 않습니다.",
  "関係レポートを解放": "관계 리포트 열기",
  "支払い方法": "결제 방법",
  "PayPay（モック）": "PayPay(모의 결제)",
  "カード（モック）": "카드(모의 결제)",
  "もう一度試す": "다시 시도",
  "モック決済を完了": "모의 결제 완료",
  "特定商取引法に基づく表記": "특정상거래법에 따른 표기",
  "処理中": "처리 중",
};

function koreanCopy(value: string): string {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const content = value.trim();
  const exact = KO_COPY[content];
  if (exact) return `${leading}${exact}${trailing}`;

  const memberCount = content.match(/^メンバー\s*(\d+)人$/);
  if (memberCount) return `${leading}멤버 ${memberCount[1]}명${trailing}`;
  const animalTendency = content.match(/^(.+)タイプとして、生年月日から導いた傾向です。$/);
  if (animalTendency) return `${leading}${animalTendency[1]} 유형으로 생년월일에서 도출한 성향입니다.${trailing}`;
  return value;
}

interface TranslationRecord { ja: string; ko: string }

const subscribeToHostname = () => () => {};
const isLocalHostname = () => ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

export function DevLocaleToggle() {
  const available = useSyncExternalStore(subscribeToHostname, isLocalHostname, () => false);
  const [locale, setLocale] = useState<DevLocale>(() =>
    typeof window !== "undefined" && window.sessionStorage.getItem(STORAGE_KEY) === "ko" ? "ko" : "ja"
  );
  const textRecords = useRef(new WeakMap<Text, TranslationRecord>());
  const attributeRecords = useRef(new WeakMap<Element, Map<string, TranslationRecord>>());

  useEffect(() => {
    if (!available) return;
    const translateText = (node: Text) => {
      if (node.parentElement?.closest("[data-dev-locale-toggle]")) return;
      let record = textRecords.current.get(node);
      if (!record || (node.data !== record.ja && node.data !== record.ko)) {
        record = { ja: node.data, ko: koreanCopy(node.data) };
        textRecords.current.set(node, record);
      }
      node.data = locale === "ko" ? record.ko : record.ja;
    };

    const translateElement = (element: Element) => {
      if (element.closest("[data-dev-locale-toggle]")) return;
      let records = attributeRecords.current.get(element);
      if (!records) {
        records = new Map();
        attributeRecords.current.set(element, records);
      }
      for (const attribute of ATTRIBUTES) {
        const value = element.getAttribute(attribute);
        if (value === null) continue;
        let record = records.get(attribute);
        if (!record || (value !== record.ja && value !== record.ko)) {
          record = { ja: value, ko: koreanCopy(value) };
          records.set(attribute, record);
        }
        element.setAttribute(attribute, locale === "ko" ? record.ko : record.ja);
      }
    };

    const translateTree = () => {
      translateElement(document.body);
      for (const element of document.body.querySelectorAll("*")) translateElement(element);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        translateText(node as Text);
        node = walker.nextNode();
      }
      document.documentElement.lang = locale;
    };

    const observer = new MutationObserver(() => {
      observer.disconnect();
      translateTree();
      observe();
    });
    const observe = () => observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });
    translateTree();
    observe();
    window.sessionStorage.setItem(STORAGE_KEY, locale);
    return () => observer.disconnect();
  }, [available, locale]);

  if (!available) return null;

  return (
    <aside className="dev-locale-toggle" data-dev-locale-toggle aria-label="개발용 언어 보기">
      <span>DEV</span>
      <div role="group" aria-label="표시 언어">
        <button type="button" aria-pressed={locale === "ko"} aria-label="한국어로 보기"
          onClick={() => setLocale("ko")}>KO</button>
        <button type="button" aria-pressed={locale === "ja"} aria-label="日本語で見る"
          onClick={() => setLocale("ja")}>JP</button>
      </div>
    </aside>
  );
}
