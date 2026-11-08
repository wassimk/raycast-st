import { Action, ActionPanel, Form, Icon, List } from "@raycast/api";
import os from "os";
import path from "path";
import { useEffect, useState } from "react";
import {
  BuiltInKeyword,
  emojiFor,
  KeywordInfo,
  listKeywords,
  setStatus,
  StatusArguments,
  usesFocus,
} from "./lib/status";

const configPath = path.join(os.homedir(), ".config", "st", "config.toml");

// Same examples as the built-in commands' "Until" placeholders
const UNTIL_EXAMPLES: Record<BuiltInKeyword, string | null> = {
  lunch: "1:30pm",
  meeting: "3pm",
  pairing: "3pm",
  eod: "monday 8am",
  vacation: "3/10 9am",
  sick: "tomorrow",
  away: "2pm",
  back: null,
  clear: null,
};

function StatusForm({ keyword }: { keyword: KeywordInfo }) {
  const example = keyword.base ? UNTIL_EXAMPLES[keyword.base] : null;

  return (
    <Form
      navigationTitle={keyword.keyword}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Set Status"
            icon={Icon.Check}
            onSubmit={(values: StatusArguments) => setStatus(keyword.keyword, values, usesFocus(keyword.base))}
          />
        </ActionPanel>
      }
    >
      <Form.Description title={keyword.keyword} text={`Acts like ${keyword.base}`} />
      {example ? <Form.TextField id="when" title="Until" placeholder={example} /> : null}
      <Form.TextField id="message" title="Message" placeholder={keyword.text || "Emoji only"} />
    </Form>
  );
}

export default function Command() {
  const [keywords, setKeywords] = useState<KeywordInfo[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    listKeywords()
      .then((all) => setKeywords(all.filter((k) => k.base !== null)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const openConfig = <Action.Open title="Open Config File" icon={Icon.Gear} target={configPath} />;

  return (
    <List isLoading={keywords === undefined && error === undefined} searchBarPlaceholder="Search your keywords">
      {error ? (
        <List.EmptyView icon={Icon.ExclamationMark} title="Could not load keywords" description={error} />
      ) : (
        <List.EmptyView
          icon={Icon.Tag}
          title="No custom keywords"
          description="Add one under [keywords.NAME] with a base in ~/.config/st/config.toml"
          actions={<ActionPanel>{openConfig}</ActionPanel>}
        />
      )}
      {keywords?.map((keyword) => (
        <List.Item
          key={keyword.keyword}
          title={keyword.keyword}
          subtitle={keyword.text}
          icon={emojiFor(keyword.emoji) ?? Icon.Tag}
          accessories={[{ text: keyword.emoji }, { tag: `like ${keyword.base}` }]}
          actions={
            <ActionPanel>
              <Action.Push title="Set Status" icon={Icon.Check} target={<StatusForm keyword={keyword} />} />
              {openConfig}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
