import {
  calculateFourPillarsFacts,
  type FourPillarsFacts,
} from "./four-pillars";
import type { DerivedEtoProfile, EtoProvider } from "./types";
import { zodiacForGregorianYear } from "./zodiac";

function cloneProfileFacts(
  facts: FourPillarsFacts,
) {
  return {
    dayMaster: { ...facts.dayMaster },
    fiveElements: facts.fiveElements === null ? null : { ...facts.fiveElements },
    yinYang: facts.yinYang === null ? null : { ...facts.yinYang },
  };
}

export function deriveEtoProfile(
  facts: FourPillarsFacts,
): DerivedEtoProfile {
  const cloned = cloneProfileFacts(facts);

  return {
    version: 1,
    zodiacId: zodiacForGregorianYear(facts.birthYear),
    mbti: facts.mbti,
    dayMaster: cloned.dayMaster,
    fiveElements: cloned.fiveElements,
    yinYang: cloned.yinYang,
    calculationMode: facts.calculationMode,
    boundaryState: facts.boundaryState,
    engineVersion: "mofu-eto-four-pillars-v1",
  };
}

export const localEtoProvider: EtoProvider = {
  async derive(input, todayIso): Promise<DerivedEtoProfile> {
    return deriveEtoProfile(calculateFourPillarsFacts(input, todayIso));
  },
};
