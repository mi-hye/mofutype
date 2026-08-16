import { Solar } from "lunar-typescript";

import type {
  BoundaryState,
  CalculationMode,
  ElementCounts,
  EtoInput,
  FiveElement,
  MbtiType,
  Polarity,
  YinYangCounts,
} from "./types";
import { parseEtoInput } from "./validation";

const STEMS = [..."甲乙丙丁戊己庚辛壬癸"];
const BRANCHES = [..."子丑寅卯辰巳午未申酉戌亥"];
const STEM_WU_XING = [..."木木火火土土金金水水"];
const BRANCH_WU_XING = [..."水土木木土火火土金金土水"];
const TOKYO_TO_LIBRARY_BASIS_MINUTES = 60;

function todayInTokyo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// lunar-typescript emits solar-term civil timestamps on a UTC+8 basis. Japan
// civil input is UTC+9, so only exact year/month lookup is shifted back 60 min.
function toLibraryCivilBasis(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute));
  instant.setUTCMinutes(
    instant.getUTCMinutes() - TOKYO_TO_LIBRARY_BASIS_MINUTES,
  );
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
    hour: instant.getUTCHours(),
    minute: instant.getUTCMinutes(),
  };
}

const ELEMENT_BY_CHARACTER = {
  木: "WOOD",
  火: "FIRE",
  土: "EARTH",
  金: "METAL",
  水: "WATER",
} as const satisfies Readonly<Record<string, FiveElement>>;

type ParsedEtoInput = ReturnType<typeof parseEtoInput>;
interface PillarFact {
  readonly stem: string;
  readonly branch: string;
  readonly wuXing: string;
}

function japanEightChar(parsed: ParsedEtoInput) {
  const solar = parsed.hour === null || parsed.minute === null
    ? Solar.fromYmd(parsed.year, parsed.month, parsed.day)
    : Solar.fromYmdHms(
        parsed.year,
        parsed.month,
        parsed.day,
        parsed.hour,
        parsed.minute,
        0,
      );
  const eightChar = solar.getLunar().getEightChar();
  eightChar.setSect(2);
  return eightChar;
}

function exactYearMonth(
  parsed: ParsedEtoInput,
  hour: number,
  minute: number,
) {
  const shifted = toLibraryCivilBasis(
    parsed.year,
    parsed.month,
    parsed.day,
    hour,
    minute,
  );
  const lunar = Solar.fromYmdHms(
    shifted.year,
    shifted.month,
    shifted.day,
    shifted.hour,
    shifted.minute,
    0,
  ).getLunar();
  const eightChar = lunar.getEightChar();
  eightChar.setSect(2);
  return {
    year: {
      stem: eightChar.getYearGan(),
      branch: eightChar.getYearZhi(),
      wuXing: eightChar.getYearWuXing(),
    },
    month: {
      stem: eightChar.getMonthGan(),
      branch: eightChar.getMonthZhi(),
      wuXing: eightChar.getMonthWuXing(),
    },
  };
}

function samePillar(left: PillarFact, right: PillarFact) {
  return left.stem === right.stem && left.branch === right.branch;
}

function elementFor(character: string): FiveElement {
  const element = ELEMENT_BY_CHARACTER[
    character as keyof typeof ELEMENT_BY_CHARACTER
  ];
  if (element === undefined) throw new Error("Unsupported Four Pillars symbol");
  return element;
}

function polarityFor(character: string, kind: "stem" | "branch"): Polarity {
  const index = (kind === "stem" ? STEMS : BRANCHES).indexOf(character);
  if (index < 0) throw new Error("Unsupported Four Pillars symbol");
  return index % 2 === 0 ? "YANG" : "YIN";
}

function timePillarForDay(dayStem: string, timeBranch: string): PillarFact {
  const dayGanIndex = STEMS.indexOf(dayStem);
  const timeZhiIndex = BRANCHES.indexOf(timeBranch);
  if (dayGanIndex < 0 || timeZhiIndex < 0) {
    throw new Error("Unsupported Four Pillars symbol");
  }

  const timeGanIndex = ((dayGanIndex % 5) * 2 + timeZhiIndex) % 10;
  return {
    stem: STEMS[timeGanIndex],
    branch: BRANCHES[timeZhiIndex],
    wuXing: `${STEM_WU_XING[timeGanIndex]}${BRANCH_WU_XING[timeZhiIndex]}`,
  };
}

function countPillars(pillars: readonly PillarFact[]) {
  const fiveElements: Record<FiveElement, number> = {
    WOOD: 0,
    FIRE: 0,
    EARTH: 0,
    METAL: 0,
    WATER: 0,
  };
  const yinYang: Record<Polarity, number> = { YIN: 0, YANG: 0 };

  for (const { stem, branch, wuXing } of pillars) {
    const elements = [...wuXing];
    if (elements.length !== 2) {
      throw new Error("Unsupported Four Pillars element data");
    }
    fiveElements[elementFor(elements[0])] += 1;
    fiveElements[elementFor(elements[1])] += 1;
    yinYang[polarityFor(stem, "stem")] += 1;
    yinYang[polarityFor(branch, "branch")] += 1;
  }
  return { fiveElements, yinYang };
}

export interface FourPillarsFacts {
  birthYear: number;
  mbti: MbtiType | null;
  dayMaster: Readonly<{ element: FiveElement; polarity: Polarity }>;
  fiveElements: ElementCounts | null;
  yinYang: YinYangCounts | null;
  calculationMode: CalculationMode;
  boundaryState: BoundaryState;
}

export function calculateFourPillarsFacts(
  input: EtoInput,
  todayIso = todayInTokyo(),
): FourPillarsFacts {
  return calculateParsedFourPillarsFacts(parseEtoInput(input, todayIso));
}

function calculateParsedFourPillarsFacts(
  parsed: ParsedEtoInput,
): FourPillarsFacts {
  const japan = japanEightChar(parsed);
  const day = {
    stem: japan.getDayGan(),
    branch: japan.getDayZhi(),
    wuXing: japan.getDayWuXing(),
  };
  const dayMaster = {
    element: elementFor(day.wuXing[0]),
    polarity: polarityFor(day.stem, "stem"),
  };
  const identityFacts = { birthYear: parsed.year, mbti: parsed.mbti };

  if (parsed.hour === null || parsed.minute === null) {
    const start = exactYearMonth(parsed, 0, 0);
    const end = exactYearMonth(parsed, 23, 59);
    if (
      !samePillar(start.year, end.year) ||
      !samePillar(start.month, end.month)
    ) {
      return {
        ...identityFacts,
        dayMaster,
        fiveElements: null,
        yinYang: null,
        calculationMode: "date-only",
        boundaryState: "solar-term-ambiguous",
      };
    }

    const counts = countPillars([start.year, start.month, day]);
    return {
      ...identityFacts,
      dayMaster,
      ...counts,
      calculationMode: "date-only",
      boundaryState: "exact",
    };
  }

  const exact = exactYearMonth(parsed, parsed.hour, parsed.minute);
  const time = timePillarForDay(day.stem, japan.getTimeZhi());
  const counts = countPillars([exact.year, exact.month, day, time]);
  return {
    ...identityFacts,
    dayMaster,
    ...counts,
    calculationMode: "date-time",
    boundaryState: "exact",
  };
}
