import type { AnimalGroup, AnimalId } from "./types";

export interface Animal {
  readonly nameJa: string;
  readonly asset: string;
  readonly group: AnimalGroup;
}

export const ANIMAL_ORDER = [
  "fawn",
  "raccoon",
  "black-panther",
  "sheep",
  "wolf",
  "monkey",
  "tiger",
  "koala",
  "cheetah",
  "lion",
  "elephant",
  "pegasus",
] as const satisfies readonly AnimalId[];

export const ANIMALS = {
  fawn: {
    nameJa: "こじか",
    asset: "/animals/fawn.svg",
    group: "MOON",
  },
  raccoon: {
    nameJa: "たぬき",
    asset: "/animals/raccoon.svg",
    group: "MOON",
  },
  "black-panther": {
    nameJa: "黒ひょう",
    asset: "/animals/black-panther.svg",
    group: "MOON",
  },
  sheep: {
    nameJa: "ひつじ",
    asset: "/animals/sheep.svg",
    group: "MOON",
  },
  wolf: {
    nameJa: "狼",
    asset: "/animals/wolf.svg",
    group: "EARTH",
  },
  monkey: {
    nameJa: "猿",
    asset: "/animals/monkey.svg",
    group: "EARTH",
  },
  tiger: {
    nameJa: "虎",
    asset: "/animals/tiger.svg",
    group: "EARTH",
  },
  koala: {
    nameJa: "コアラ",
    asset: "/animals/koala.svg",
    group: "EARTH",
  },
  cheetah: {
    nameJa: "チータ",
    asset: "/animals/cheetah.svg",
    group: "SUN",
  },
  lion: {
    nameJa: "ライオン",
    asset: "/animals/lion.svg",
    group: "SUN",
  },
  elephant: {
    nameJa: "ゾウ",
    asset: "/animals/elephant.svg",
    group: "SUN",
  },
  pegasus: {
    nameJa: "ペガサス",
    asset: "/animals/pegasus.svg",
    group: "SUN",
  },
} as const satisfies Readonly<Record<AnimalId, Animal>>;
