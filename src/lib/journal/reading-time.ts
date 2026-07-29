import { wordCount } from "./validation";
import type { ContentBlock } from "./types";

const WORDS_PER_MINUTE = 200;

/** Computed at render time from the content blocks — never stored. */
export function computeReadingTimeMinutes(content: ContentBlock[]): number {
  const words = wordCount(content);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
