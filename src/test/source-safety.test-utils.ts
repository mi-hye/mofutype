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

export function findUnsafeProductionSource(source: string): string[] {
  const animalViolations = FORBIDDEN_ANIMAL_SYMBOLS.filter((symbol) =>
    source.includes(symbol),
  ).map((symbol) => `animal emoji ${symbol}`);
  const injectionViolations = HTML_INJECTION_APIS.filter((api) =>
    source.includes(api),
  ).map((api) => `HTML injection API ${api}`);

  return [...animalViolations, ...injectionViolations];
}
