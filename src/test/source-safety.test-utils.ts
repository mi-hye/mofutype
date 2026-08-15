const FORBIDDEN_ANIMAL_SYMBOLS = [
  "🦌",
  "🦝",
  "🐈‍⬛",
  "🐈",
  "🐑",
  "🐏",
  "🐺",
  "🐒",
  "🐵",
  "🐯",
  "🐅",
  "🐨",
  "🐆",
  "🦁",
  "🐘",
  "🦄",
  "🐴",
  "🐎",
] as const;

const HTML_INJECTION_APIS = ["dangerouslySetInnerHTML", ".innerHTML"] as const;

const LEGACY_PRODUCTION_PATTERNS = [
  ["legacy type AnimalId", /\bAnimalId\b/],
  ["legacy type AnimalGroup", /\bAnimalGroup\b/],
  ["legacy property animalId", /\banimalId\b/],
  ["legacy property animalGroup", /\banimalGroup\b/],
  ["legacy column animal_id", /\banimal_id\b/],
  ["legacy column animal_group", /\banimal_group\b/],
  ["legacy group MOON", /\bMOON(?:_OVER_[A-Z]+)?\b/],
  ["legacy group SUN", /\bSUN(?:_OVER_[A-Z]+)?\b/],
  ["legacy group EARTH_OVER", /\bEARTH_OVER_[A-Z]+\b/],
  ["legacy animal fawn", /\bfawn\b/],
  ["legacy animal raccoon", /\braccoon\b/],
  ["legacy animal black-panther", /\bblack-panther\b/],
  ["legacy animal pegasus", /\bpegasus\b/],
  ["legacy animal wolf", /\bwolf\b/],
  ["legacy animal koala", /\bkoala\b/],
  ["legacy animal cheetah", /\bcheetah\b/],
  ["legacy animal lion", /\blion\b/],
  ["legacy animal elephant", /\belephant\b/],
  ["legacy asset directory /animals/", /\/animals\//],
  ["legacy copy 動物占い", /動物占い/],
  ["legacy copy 動物タイプ", /動物タイプ/],
] as const satisfies readonly (readonly [string, RegExp])[];

export function findUnsafeProductionSource(source: string): string[] {
  const animalViolations = FORBIDDEN_ANIMAL_SYMBOLS.filter((symbol) =>
    source.includes(symbol),
  ).map((symbol) => `animal emoji ${symbol}`);
  const injectionViolations = HTML_INJECTION_APIS.filter((api) =>
    source.includes(api),
  ).map((api) => `HTML injection API ${api}`);

  return [...animalViolations, ...injectionViolations];
}

export function findLegacyProductionSource(source: string): string[] {
  return LEGACY_PRODUCTION_PATTERNS
    .filter(([, pattern]) => pattern.test(source))
    .map(([label]) => label);
}
