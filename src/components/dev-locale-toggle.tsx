"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import devKo from "@/locales/dev-ko.json";

type DevLocale = "ja" | "ko";

const STORAGE_KEY = "mofutype:dev-locale";
const ATTRIBUTES = ["aria-label", "aria-description", "placeholder", "title"] as const;

const KO_COPY: Readonly<Record<string, string>> = {
  "MofuType ホーム": "MofuType 홈",
  "MofuType グループ": "MofuType 그룹",
  "関係線を色で絞り込む": "관계선을 색상으로 필터링",
  "おしてな！": "눌러봐!",
  "可能性・ペース": "가능성·속도",
  "わたしたち、こんな感じ。": "우리들, 이런 느낌.",
  "わたしたち、": "우리들,",
  "こんな感じ。": "이런 느낌.",
  "ムード": "분위기",
  "誕生日と性格タイプで、友だちとの空気感を一枚の関係マップに。": "생일과 성격 유형으로 친구들과의 분위기를 한 장의 관계 지도로.",
  "グループを作る": "그룹 만들기",
  "MofuTypeって？": "MofuType은?",
  "生年月日からわかる十二支に、出生時刻とMBTIを重ねて、自分らしいタイプへ。": "생년월일로 알 수 있는 십이지에 출생 시각과 MBTI를 더해 나다운 유형을 찾아요.",
  "友だちを招待すると、関係が一枚のマップに。": "친구를 초대하면 관계가 한 장의 지도가 돼요.",
  "グループ作成": "그룹 만들기",
  "はじめる": "시작하기",
  "MofuTypeでできること": "MofuType에서 할 수 있는 것",
  "わたしを知る": "나를 알아보기",
  "生年月日とMBTIから、あなたらしい十二支タイプを見つけます。": "생년월일과 MBTI로 나다운 십이지 유형을 찾아요.",
  "みんなをつなぐ": "모두를 연결하기",
  "友だちやチームを招待して、関係性を一枚のマップに。": "친구나 팀을 초대해 관계를 한 장의 지도로 만들어요.",
  "違いを楽しむ": "다름을 즐기기",
  "それぞれの個性を知って、もっと心地よい関係へ。": "서로의 개성을 알고 더 편안한 관계로 나아가요.",
  "まずは無料で、": "우선 무료로,",
  "みんなの輪郭まで。": "모두의 윤곽까지.",
  "まずは無料で、みんなの輪郭まで。": "우선 무료로, 모두의 윤곽까지.",
  "グループで楽しめること": "그룹에서 즐길 수 있는 것",
  "自分の十二支タイプ": "나의 십이지 유형",
  "みんなの関係マップ": "모두의 관계 지도",
  "関係のひとことラベル": "관계 한마디 라벨",
  "1組 300円": "한 쌍 300엔",
  "気になるふたりを、もう少し深く": "궁금한 두 사람을 조금 더 깊게",
  "十二支・五行・陰陽・MBTIの読み解き": "십이지·오행·음양·MBTI 해석",
  "ふたりでいるときのヒント": "둘이 함께 있을 때의 힌트",
  "それぞれに向けた関わり方": "각자에게 맞는 관계 방식",
  "自分の結果とグループ参加は無料。必要な関係だけ、あとから解放できます。": "내 결과와 그룹 참여는 무료예요. 필요한 관계만 나중에 열 수 있어요.",
  "関係レポートの表示イメージ": "관계 리포트 표시 예시",
  "AさんとBさんのサンプル": "A님과 B님의 예시",
  "Aさん": "A님",
  "Bさん": "B님",
  "ふたりでいるとき": "둘이 함께 있을 때",
  "違うペースが、いいリズムになる。": "서로 다른 속도가 좋은 리듬이 돼요.",
  "違うペースが、": "서로 다른 속도가,",
  "いいリズムになる。": "좋은 리듬이 돼요.",
  "感じ方と動き方の違いを、十二支・五行・陰陽・MBTIの4つの視点から読み解きます。": "느끼는 방식과 행동의 차이를 십이지·오행·음양·MBTI 네 가지 관점으로 풀어봐요.",
  "レポートに含まれる3つの分析": "리포트에 포함되는 세 가지 분석",
  "十二支の関係": "십이지 관계",
  "違いが刺激になる関係": "다름이 좋은 자극이 되는 관계",
  "慎重に確かめたいAさんと、まず動いてみたいBさん。違う速さが、新しい選択肢を生みます。": "신중하게 확인하고 싶은 A님과 먼저 움직여 보고 싶은 B님. 서로 다른 속도가 새로운 선택지를 만들어요.",
  "五行と陰陽": "오행과 음양",
  "整える力と、動かす力": "정리하는 힘과 움직이는 힘",
  "考えを形にする力と、場を前へ進める力。役割が自然に分かれると、ふたりの強みが重なります。": "생각을 형태로 만드는 힘과 상황을 앞으로 이끄는 힘. 역할이 자연스럽게 나뉘면 두 사람의 강점이 겹쳐져요.",
  "MBTIの4つの軸": "MBTI의 네 가지 축",
  "答えの見つけ方が違うふたり": "답을 찾는 방식이 다른 두 사람",
  "ひとりで深める時間と、話しながら広げる時間。結論までの道筋を共有すると伝わりやすくなります。": "혼자 깊이 생각하는 시간과 이야기하며 넓혀 가는 시간. 결론까지의 과정을 공유하면 더 잘 전달돼요.",
  "すれ違うとき": "엇갈릴 때",
  "急いで答えを出したいときほど、考える時間の差がすれ違いに見えやすくなります。": "빨리 답을 내고 싶을수록 생각하는 시간의 차이가 엇갈림처럼 보이기 쉬워요.",
  "わかること": "알 수 있는 것",
  "ふたりの空気感と、すれ違いやすい場面": "두 사람의 분위기와 엇갈리기 쉬운 상황",
  "Aさんへ": "A님에게",
  "Bさんのアイデアが広がる時間を少し待つと、あなたの整理力がもっと伝わります。": "B님의 아이디어가 펼쳐질 시간을 조금 기다리면 A님의 정리하는 힘이 더 잘 전해져요.",
  "Bさんと心地よく関わるためのヒント": "B님과 편안하게 관계 맺는 힌트",
  "Bさんへ": "B님에게",
  "思いつきを先に共有したら、Aさんが考えをまとめる余白も一緒に渡してみてください。": "떠오른 생각을 먼저 공유했다면 A님이 생각을 정리할 여유도 함께 건네 보세요.",
  "Aさんに伝わりやすい距離の取り方": "A님에게 잘 전해지는 거리 두는 법",
  "1組 300円・買い切り": "한 쌍 300엔·일회성 결제",
  "4つの視点と、ふたりそれぞれへのヒントをまとめて読めます。追加料金や自動更新はありません。": "네 가지 관점과 두 사람 각각을 위한 힌트를 한 번에 읽을 수 있어요. 추가 요금이나 자동 갱신은 없어요.",
  "このサンプルは表示イメージです。内容はふたりの組み合わせによって変わります。": "이 샘플은 표시 예시예요. 내용은 두 사람의 조합에 따라 달라져요.",
  "無料でグループを作る": "무료로 그룹 만들기",
  "始める前に、気になること。": "시작하기 전에 궁금한 것.",
  "始める前に、": "시작하기 전에,",
  "気になること。": "궁금한 것.",
  "何人まで使える？": "몇 명까지 쓸 수 있나요?",
  "1グループ30人まで。友だち同士でも、サークルやチームでも使えます。": "그룹당 30명까지, 친구·동아리·팀에서 사용할 수 있어요.",
  "出生時刻やMBTIがわからなくても大丈夫？": "출생 시각이나 MBTI를 몰라도 괜찮나요?",
  "どちらも「わからない」を選べます。入力できる情報だけで結果を表示します。": "둘 다 ‘몰라요’를 선택할 수 있고, 입력 가능한 정보만으로 결과를 보여줘요.",
  "結果はどんなもの？": "결과는 어떤 내용인가요?",
  "自己理解と会話を楽しむための読みものです。科学的・医学的な判定ではありません。": "자기 이해와 대화를 즐기기 위한 읽을거리이며 과학적·의학적 판정이 아니에요.",
  "解放するとわかること": "열면 알 수 있는 내용",
  "解放される内容": "열리는 내용",
  "このふたり1組分を解放します": "이 두 사람 한 쌍의 내용을 열어요",
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
  "十二支の気質": "십이지의 기질",
  "エネルギー": "에너지",
  "情報の捉え方": "정보를 받아들이는 방식",
  "判断の軸": "판단의 기준",
  "進め方": "진행 방식",
  "MBTIの4つの視点": "MBTI의 네 가지 관점",
  "十二支・MBTI・五行と陰陽を重ねた、自己理解のための読み解きです。": "십이지·MBTI·오행과 음양을 함께 살펴보는 자기 이해를 위한 해석입니다.",
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
  "それぞれへのヒント": "각자에게 필요한 힌트",
  "関係ページに戻る": "관계 페이지로 돌아가기",
  "今回のお支払い": "이번 결제",
  "合計 300円": "합계 300엔",
  "定期課金や自動更新はありません": "정기 결제나 자동 갱신은 없어요",
  "決済完了後、このふたりの関係レポートをすぐに表示します": "결제가 끝나면 두 사람의 관계 리포트를 바로 보여드려요",
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

  const relationshipLabel = devKo.relationshipLabels[
    content as keyof typeof devKo.relationshipLabels
  ];
  if (relationshipLabel) return `${leading}${relationshipLabel}${trailing}`;

  const zodiacEntries = Object.entries(devKo.zodiacNames);
  const zodiacName = devKo.zodiacNames[content as keyof typeof devKo.zodiacNames];
  if (zodiacName) return `${leading}${zodiacName}${trailing}`;
  const zodiacType = zodiacEntries.find(([name]) => content === `${name}タイプ`);
  if (zodiacType) return `${leading}${zodiacType[1]} 타입${trailing}`;
  const zodiacTemperament = zodiacEntries.find(([name]) => content === `${name}の気質`);
  if (zodiacTemperament) return `${leading}${zodiacTemperament[1]}의 기질${trailing}`;

  const mbtiReading = content.match(/^([EISNTFJP]{4})の思考と行動$/);
  if (mbtiReading) return `${leading}${mbtiReading[1]}의 사고와 행동${trailing}`;

  const axisReading = content.match(/^([EISNTFJP]) · (エネルギー|情報の捉え方|判断の軸|進め方)$/);
  if (axisReading) {
    return `${leading}${axisReading[1]} · ${KO_COPY[axisReading[2]]}${trailing}`;
  }

  for (const [modifierJa, modifierKo] of Object.entries(devKo.characterModifiers)) {
    const zodiac = zodiacEntries.find(([name]) => content === `${modifierJa}${name}`);
    if (zodiac) return `${leading}${modifierKo} ${zodiac[1]}${trailing}`;
  }

  const elementPolarity = content.match(/^(木|火|土|金|水)・(陰|陽)$/);
  if (elementPolarity) {
    const element = devKo.fiveElements[elementPolarity[1] as keyof typeof devKo.fiveElements];
    const polarity = devKo.polarities[elementPolarity[2] as keyof typeof devKo.polarities];
    return `${leading}${element}・${polarity}${trailing}`;
  }
  const elementStyle = content.match(/^(木|火|土|金|水)・(陰|陽)の行動スタイル$/);
  if (elementStyle) {
    const element = devKo.fiveElements[elementStyle[1] as keyof typeof devKo.fiveElements];
    const polarity = devKo.polarities[elementStyle[2] as keyof typeof devKo.polarities];
    return `${leading}${element}・${polarity}의 행동 스타일${trailing}`;
  }
  const combinedReading = content.match(/^(.+?) × (?:([EISNTFJP]{4}) × )?(木|火|土|金|水)・(陰|陽)$/);
  if (combinedReading) {
    const zodiac = devKo.zodiacNames[combinedReading[1] as keyof typeof devKo.zodiacNames]
      ?? combinedReading[1];
    const element = devKo.fiveElements[combinedReading[3] as keyof typeof devKo.fiveElements];
    const polarity = devKo.polarities[combinedReading[4] as keyof typeof devKo.polarities];
    const mbti = combinedReading[2] ? ` × ${combinedReading[2]}` : "";
    return `${leading}${zodiac}${mbti} × ${element}・${polarity}${trailing}`;
  }
  const element = devKo.fiveElements[content as keyof typeof devKo.fiveElements];
  if (element) return `${leading}${element}${trailing}`;
  const polarity = devKo.polarities[content as keyof typeof devKo.polarities];
  if (polarity) return `${leading}${polarity}${trailing}`;
  if (content === "タイプとして、生年月日から導いた傾向です。") {
    return `${leading} 유형으로 생년월일에서 도출한 성향입니다.${trailing}`;
  }

  let translatedCharacter = content;
  for (const [ja, ko] of Object.entries(devKo.characterFragments)) {
    translatedCharacter = translatedCharacter.replace(ja, ko);
  }
  if (translatedCharacter !== content) return `${leading}${translatedCharacter}${trailing}`;

  const memberCount = content.match(/^メンバー\s*(\d+)人$/);
  if (memberCount) return `${leading}멤버 ${memberCount[1]}명${trailing}`;
  const zodiacTendency = content.match(/^(.+)タイプとして、生年月日から導いた傾向です。$/);
  if (zodiacTendency) {
    const zodiac = devKo.zodiacNames[zodiacTendency[1] as keyof typeof devKo.zodiacNames]
      ?? zodiacTendency[1];
    return `${leading}${zodiac} 유형으로 생년월일에서 도출한 성향입니다.${trailing}`;
  }
  return value;
}

interface TranslationRecord { ja: string; ko: string }

const subscribeToHostname = () => () => {};
const isLocalHostname = () =>
  process.env.NEXT_PUBLIC_DEV_LOCALE_TOGGLE === "1"
  || ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

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
      <button
        type="button"
        aria-pressed={locale === "ko"}
        aria-label={locale === "ja" ? "한국어로 보기" : "日本語で見る"}
        onClick={() => setLocale((current) => current === "ja" ? "ko" : "ja")}
      >
        {locale === "ja" ? "KO" : "JP"}
      </button>
    </aside>
  );
}
