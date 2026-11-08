# Status

Raycast commands for [st](https://github.com/wassimk/st), which sets your status across Slack and GitHub with a single command, with reminders for Linear.

<img src="media/raycast-st.png" alt="Raycast search for st showing the status commands" width="750">

> [!CAUTION]
> This is a personal tool and is not published to the Raycast Store. Use at your own risk.

## ✨ Features

- **One Command per Status**: Type `lunch`, `vacation`, or `back` in Raycast and press enter.
- **Optional End Time and Message**: Each command takes an inline "Until" and "Message" argument, using the same date and time formats as `st`.
- **Failure Reporting**: Shows which service failed and why, since `st` keeps going when one service errors.
- **No Install Needed**: Downloads the latest `st` release from GitHub on first run, checks for a newer one once a day (or right away with Update CLI), and verifies each download's SHA-256 checksum.
- **AI Integration**: Say "put me on vacation until Monday" or "I'm in a meeting until 3pm" in Raycast AI (requires Raycast Pro). It knows your custom keywords too, like "start my sabbatical, back November 11".

## 🛠️ Setup

Clone the repo and run it in development mode, which adds the extension to Raycast:

```
git clone https://github.com/wassimk/raycast-st.git
cd raycast-st
npm install
npm run dev
```

Raycast asks for two preferences the first time you run a command:

- **Slack Token**: Slack User OAuth Token (`xoxp-...`) with `users.profile:write` and `dnd:write` scopes
- **GitHub Token**: GitHub classic Personal Access Token with `user` and `read:org` scopes

Raycast doesn't load your shell profile, so these are separate from the `SLACK_PAT` and `GITHUB_PAT` environment variables the CLI uses. The extension passes them to `st` under those names.

Meeting and Pairing turn on macOS Do Not Disturb, and Back and Clear Status turn it off, using `st --focus`. If the status has an end time, Do Not Disturb turns off then too. This needs the `st Focus` shortcut in the Shortcuts app. Install it once from a terminal:

```
st setup-focus
```

Custom keywords based on meeting, pairing, or back do the same. Without the shortcut, the status is still set and Raycast shows that Focus failed.

To limit the GitHub busy status to one organization, create `~/.config/st/config.toml` as described in the [st README](https://github.com/wassimk/st#config-file). The extension uses the same file.

## 💻 Commands

| Command | Arguments | Description |
|---------|-----------|-------------|
| Lunch | Until, Message | Lunch with DND until the next quarter hour plus an hour |
| Meeting | Until, Message | In a meeting, optionally until a time, with macOS Do Not Disturb on |
| Pairing | Until, Message | Pairing, optionally until a time, with macOS Do Not Disturb on |
| End of Day | Until, Message | Done for the day with DND until 7am the next work day |
| Vacation | Until, Message | Vacation with DND, GitHub busy |
| Sick | Until, Message | Out sick with DND, GitHub busy |
| Away | Until, Message | Away with DND until 5pm, GitHub busy |
| Back | Message | Clears DND, macOS Do Not Disturb, and GitHub busy, back for 15 minutes |
| Clear Status | | Clears everything, including macOS Do Not Disturb |
| Custom Status | | Lists keywords you added in your `st` config, then asks for Until and Message |
| Update CLI | | Downloads the latest `st` release now instead of waiting for the daily check |

The emoji and status text come from `st`, including any you change in its config. See [Your Own Keywords](https://github.com/wassimk/st#your-own-keywords) in the st README.

Custom Status shows keywords with a `base` from the `[keywords.NAME]` tables in `~/.config/st/config.toml`, like a sabbatical based on vacation. Each one acts like its base keyword, with your emoji and text.

Each command also matches `st <keyword>`, like `st away`, so you can type it the same way as the CLI.

"Until" takes a date, a date and time, or a time today, such as `friday`, `tomorrow`, `3/10 9am`, or `2pm`. See the [st README](https://github.com/wassimk/st#date-formats) for every format and the work day rules.

Vacation and Sick have no default end, so they need an "Until" value if you give a "Message". Without one, `st` reads the message as a date and shows a "Could not parse date" error.

After an out of office status, the HUD reminds you to add a Google Calendar out-of-office event, since Linear reads your away status from there.
