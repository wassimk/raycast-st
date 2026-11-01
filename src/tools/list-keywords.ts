import { KeywordInfo, listKeywords } from "../lib/status";

/**
 * List every st keyword the user can set, including custom ones from their st config. A custom
 * keyword has a base, the built-in keyword whose behavior it copies, and its own emoji and text.
 */
export default async function tool(): Promise<KeywordInfo[]> {
  return listKeywords();
}
