import { Keyword, runStatus } from "../lib/status";

type Input = {
  /**
   * The status to set. lunch, meeting, and pairing are short breaks. eod is done for the day.
   * vacation, sick, and away are out of office and mark GitHub busy. back returns from any of
   * these, and clear removes every status.
   */
  keyword: Keyword;
  /**
   * When the user will be back, as a date, a date and time, or a time today. Examples: "friday",
   * "tomorrow", "3/10", "3/10 9am", "2pm". Leave empty to use the keyword's default end.
   */
  when?: string;
  /**
   * Custom status text that replaces the keyword's default text. Only set this when the user asks
   * for specific wording.
   */
  message?: string;
};

/**
 * Set the user's status across Slack and GitHub
 */
export default async function tool(input: Input): Promise<string> {
  const { keyword, when, message } = input;
  return runStatus(keyword, keyword === "clear" ? {} : { when, message });
}
