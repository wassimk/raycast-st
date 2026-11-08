import { showHUD, showToast, Toast } from "@raycast/api";
import { nameToEmoji } from "gemoji";
import { execute } from "./cli";

export type BuiltInKeyword = "lunch" | "meeting" | "pairing" | "eod" | "vacation" | "sick" | "away" | "back" | "clear";

// A built-in keyword, or one added in the st config
export type Keyword = BuiltInKeyword | (string & {});

// One entry from `st keywords --json`. base is the built-in keyword a custom one acts like,
// and null for a built-in keyword.
export type KeywordInfo = {
  keyword: string;
  base: BuiltInKeyword | null;
  emoji: string;
  text: string;
  dnd: boolean;
  github_busy: boolean;
  out_of_office: boolean;
};

export type StatusArguments = {
  when?: string;
  message?: string;
};

type ServiceResult = {
  service: string;
  mark: string;
  detail: string;
};

// Slack uses GitHub's emoji names for standard emoji. Custom workspace emoji, like
// :virtual-meeting:, have no Unicode version, so they're dropped.
export function emojiFor(shortcode: string): string | undefined {
  return nameToEmoji[shortcode.replace(/^:|:$/g, "")];
}

// Meetings and pairing turn on macOS Do Not Disturb, and back and clear turn it off
const FOCUS_KEYWORDS: readonly string[] = ["meeting", "pairing", "back", "clear"];

// Takes a built-in keyword, or the base a custom keyword acts like
export function usesFocus(keyword: string | null): boolean {
  return keyword !== null && FOCUS_KEYWORDS.includes(keyword);
}

// "When" can be a date and a time, which st expects as separate words. The message stays one
// word so st can't read a message like "3 day weekend" as a time. --focus goes first, since st
// before 0.6.0 read a flag after the message as more message text.
export function buildArgs(keyword: Keyword, { when, message }: StatusArguments, focus = false): string[] {
  const whenWords = when?.trim().split(/\s+/).filter(Boolean) ?? [];
  const messageWords = message?.trim() ? [message.trim()] : [];
  return [...(focus ? ["--focus"] : []), keyword, ...whenWords, ...messageWords];
}

// st prints one line per service, like "  Slack   ✓ In a meeting :virtual-meeting:"
function parseResults(output: string): ServiceResult[] {
  return output
    .split("\n")
    .map((line) => line.match(/^\s*(\w+)\s+([✓✗!-])\s+(.*)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(([, service, mark, detail]) => ({ service, mark, detail }));
}

function replaceShortcodes(text: string): string {
  return text
    .replace(/:[\w+'-]+:/g, (shortcode) => emojiFor(shortcode) ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

// Every keyword st knows after the config is applied, built-in ones first. Config warnings go
// to stderr, so only stdout is parsed.
export async function listKeywords(): Promise<KeywordInfo[]> {
  const { stdout } = await execute(["keywords", "--json"]);
  return JSON.parse(stdout) as KeywordInfo[];
}

export async function runStatus(keyword: Keyword, args: StatusArguments = {}, focus = false): Promise<string> {
  const { stdout, stderr } = await execute(buildArgs(keyword, args, focus));
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

export async function setStatus(keyword: Keyword, args: StatusArguments = {}, focus = false) {
  let output: string;
  try {
    output = await runStatus(keyword, args, focus);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Could not set status",
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const results = parseResults(output);
  const failures = results.filter((r) => r.mark === "✗");

  // st exits 0 even when a service fails, so check each line
  if (failures.length > 0) {
    await showToast({
      style: Toast.Style.Failure,
      title: `${failures.map((f) => f.service).join(" and ")} failed`,
      message: failures.map((f) => `${f.service}: ${f.detail}`).join("\n"),
    });
    return;
  }

  const slack = results.find((r) => r.service === "Slack");
  const reminder = results.find((r) => r.mark === "!");
  const summary = [slack ? `✓ ${replaceShortcodes(slack.detail)}` : "✓ Status set", reminder?.detail]
    .filter(Boolean)
    .join(" · ");

  await showHUD(summary);
}
