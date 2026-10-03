export const MULTILINGUAL_EXTRACTION_INSTRUCTION = [
  "The transcript may be English, Hindi, Hinglish, or mixed-script text. Understand it in the language supplied.",
  "Return only the requested structured fields. Never translate, rewrite, summarize, improve, or return a replacement transcript.",
  "Preserve the operator's wording for free-text values; configured select values are resolved separately after extraction.",
].join(" ");

function normalizeOptionText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchToExistingOption(extractedValue: string, options: string[]): string | null {
  const normalizedExtracted = normalizeOptionText(extractedValue);
  if (!normalizedExtracted) return null;

  const exact = options.find((option) => normalizeOptionText(option) === normalizedExtracted);
  if (exact) return exact;

  let best: { option: string; ratio: number } | null = null;
  for (const option of options) {
    const normalizedOption = normalizeOptionText(option);
    if (!normalizedOption) continue;
    const contains = normalizedOption.includes(normalizedExtracted) || normalizedExtracted.includes(normalizedOption);
    if (!contains) continue;
    const ratio =
      Math.min(normalizedOption.length, normalizedExtracted.length) /
      Math.max(normalizedOption.length, normalizedExtracted.length);
    if (ratio >= 0.7 && (!best || ratio > best.ratio)) best = { option, ratio };
  }

  return best?.option ?? null;
}
