import { showHUD, showToast, Toast } from "@raycast/api";
import { execute } from "./cli";

export type Keyword = "lunch" | "meeting" | "pairing" | "eod" | "vacation" | "sick" | "away" | "back" | "clear";

export type StatusArguments = {
  when?: string;
  message?: string;
};

type ServiceResult = {
  service: string;
  mark: string;
  detail: string;
};

// Slack shortcodes st prints, shown as emoji in the HUD. Custom workspace emoji are dropped.
const EMOJI: Record<string, string> = {
  fork_and_knife: "🍴",
  mantelpiece_clock: "🕰️",
  desert_island: "🏝️",
  face_with_thermometer: "🤒",
  no_entry: "⛔",
  inbox_tray: "📥",
};

// "When" can be a date and a time, which st expects as separate words. The message stays one
// word so st can't read a message like "3 day weekend" as a time.
export function buildArgs(keyword: Keyword, { when, message }: StatusArguments): string[] {
  const whenWords = when?.trim().split(/\s+/).filter(Boolean) ?? [];
  const messageWords = message?.trim() ? [message.trim()] : [];
  return [keyword, ...whenWords, ...messageWords];
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
    .replace(/:([\w+-]+):/g, (_, name: string) => EMOJI[name] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function runStatus(keyword: Keyword, args: StatusArguments = {}): Promise<string> {
  const { stdout, stderr } = await execute(buildArgs(keyword, args));
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

export async function setStatus(keyword: Keyword, args: StatusArguments = {}) {
  let output: string;
  try {
    output = await runStatus(keyword, args);
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
