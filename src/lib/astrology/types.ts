export type MBTIType =
  | "ISTJ"
  | "ISFJ"
  | "INFJ"
  | "INTJ"
  | "ISTP"
  | "ISFP"
  | "INFP"
  | "INTP"
  | "ESTP"
  | "ESFP"
  | "ENFP"
  | "ENTP"
  | "ESTJ"
  | "ESFJ"
  | "ENFJ"
  | "ENTJ";

export type AnimalId =
  | "fawn"
  | "raccoon"
  | "black-panther"
  | "sheep"
  | "wolf"
  | "monkey"
  | "tiger"
  | "koala"
  | "cheetah"
  | "lion"
  | "elephant"
  | "pegasus";

export type AnimalGroup = "MOON" | "EARTH" | "SUN";

export interface AstrologyInput {
  birthDate: string;
  birthTime: string | null;
  mbti: MBTIType | null;
}

export interface DerivedProfile {
  version: 1;
  animalId: AnimalId;
  animalGroup: AnimalGroup;
  mbti: MBTIType | null;
  calculationMode: "date-time" | "date-only";
}

export interface AstrologyProvider {
  derive(input: AstrologyInput): Promise<DerivedProfile>;
}
