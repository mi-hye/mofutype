import { calculateFourPillarsFacts } from "./four-pillars";
import type { DerivedEtoProfile, EtoProvider } from "./types";
import { parseEtoInput } from "./validation";
import { zodiacForGregorianYear } from "./zodiac";

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

function cloneProfileFacts(
  facts: ReturnType<typeof calculateFourPillarsFacts>,
) {
  return {
    dayMaster: { ...facts.dayMaster },
    fiveElements: facts.fiveElements === null ? null : { ...facts.fiveElements },
    yinYang: facts.yinYang === null ? null : { ...facts.yinYang },
  };
}

export const localEtoProvider: EtoProvider = {
  async derive(input, todayIso = todayInTokyo()): Promise<DerivedEtoProfile> {
    const parsed = parseEtoInput(input, todayIso);
    const facts = calculateFourPillarsFacts(input, todayIso);
    const cloned = cloneProfileFacts(facts);

    return {
      version: 1,
      zodiacId: zodiacForGregorianYear(parsed.year),
      mbti: parsed.mbti,
      dayMaster: cloned.dayMaster,
      fiveElements: cloned.fiveElements,
      yinYang: cloned.yinYang,
      calculationMode: facts.calculationMode,
      boundaryState: facts.boundaryState,
      engineVersion: "mofu-eto-four-pillars-v1",
    };
  },
};
