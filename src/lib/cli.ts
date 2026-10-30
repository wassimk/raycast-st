import { environment, getPreferenceValues } from "@raycast/api";
import path from "path";
import fs from "fs";
import os from "os";
import afs from "fs/promises";
import https from "https";
import * as tar from "tar";
import { execFile } from "child_process";
import sha256 from "sha256-file";

const repoUrl = "https://github.com/wassimk/st";
const latestReleaseApiUrl = "https://api.github.com/repos/wassimk/st/releases/latest";
const updateCheckIntervalMs = 24 * 60 * 60 * 1000;
const cliPackage = os.arch() === "arm64" ? "st-Darwin-aarch64.tar.gz" : "st-Darwin-x86_64.tar.gz";

export type CLIOutput = {
  stdout: string;
  stderr: string;
};

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            reject(new Error("Redirect with no location header"));
            return;
          }
          file.close();
          fs.unlinkSync(dest);
          downloadFile(redirectUrl, dest).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", reject);
      })
      .on("error", (error) => {
        fs.unlink(dest, () => reject(error));
      });
  });
}

async function sha256FileHash(filename: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    sha256(filename, (error: Error | null, sum: string | null) => {
      if (error) {
        reject(error);
      } else {
        resolve(sum);
      }
    });
  });
}

function stCLIDirectory(): string {
  return path.join(environment.supportPath, "cli");
}

export function stCLIFilePath(): string {
  return path.join(stCLIDirectory(), "st");
}

function cliVersionFilePath(): string {
  return path.join(stCLIDirectory(), "st.version");
}

function lastCheckFilePath(): string {
  return path.join(stCLIDirectory(), "st.last-check");
}

function installedVersion(): string | null {
  try {
    return fs.readFileSync(cliVersionFilePath(), "utf-8").trim() || null;
  } catch {
    return null;
  }
}

function isUpdateCheckDue(): boolean {
  try {
    const lastCheck = Number(fs.readFileSync(lastCheckFilePath(), "utf-8"));
    return Date.now() - lastCheck > updateCheckIntervalMs;
  } catch {
    return true;
  }
}

async function latestVersion(): Promise<string> {
  const response = await fetch(latestReleaseApiUrl, { headers: { "User-Agent": "raycast-st" } });
  if (!response.ok) {
    throw new Error(`GitHub releases API returned ${response.status}`);
  }

  const { tag_name } = (await response.json()) as { tag_name: string };
  return tag_name.replace(/^v/, "");
}

// Each release publishes "<sha256>  <file>" next to the archive
async function expectedHash(version: string): Promise<string> {
  const response = await fetch(`${repoUrl}/releases/download/v${version}/${cliPackage}-sha.txt`);
  if (!response.ok) {
    throw new Error(`Checksum download returned ${response.status}`);
  }

  return (await response.text()).trim().split(/\s+/)[0];
}

// Raycast doesn't load the shell profile, so the tokens come from preferences
function cliEnv(): NodeJS.ProcessEnv {
  const { slackToken, githubToken } = getPreferenceValues<Preferences>();
  return { ...process.env, SLACK_PAT: slackToken, GITHUB_PAT: githubToken };
}

export async function execute(args: string[]): Promise<CLIOutput> {
  const cliPath = await ensureCLI();

  return new Promise((resolve, reject) => {
    execFile(cliPath, args, { env: cliEnv() }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Uses the installed st, checking GitHub for a newer release at most once a day.
// If the check or download fails, an installed st keeps working.
export async function ensureCLI() {
  const cli = stCLIFilePath();
  const installed = fs.existsSync(cli) ? installedVersion() : null;

  if (installed && !isUpdateCheckDue()) {
    return cli;
  }

  try {
    const latest = await latestVersion();
    if (latest !== installed) {
      await installCLI(latest);
    }
    await afs.writeFile(lastCheckFilePath(), String(Date.now()));
  } catch (error) {
    if (installed) {
      console.log(error);
      return cli;
    }
    throw error;
  }

  return cli;
}

async function installCLI(version: string) {
  const cli = stCLIFilePath();
  const cliDir = stCLIDirectory();
  const tempDir = path.join(environment.supportPath, ".tmp");
  const archivePath = path.join(tempDir, cliPackage);

  await afs.mkdir(tempDir, { recursive: true });

  try {
    try {
      await downloadFile(`${repoUrl}/releases/download/v${version}/${cliPackage}`, archivePath);
    } catch {
      throw new Error("Could not download st CLI");
    }

    if ((await sha256FileHash(archivePath)) !== (await expectedHash(version))) {
      throw new Error("Hash of st CLI archive does not match");
    }

    // Replace the old binary only after the new archive checks out
    await afs.mkdir(cliDir, { recursive: true });
    await afs.rm(cli, { force: true });

    try {
      await tar.extract({ file: archivePath, filter: (p) => p === "st", cwd: cliDir });
    } catch {
      throw new Error("Could not extract downloaded archive of st CLI");
    }
  } finally {
    await afs.rm(tempDir, { recursive: true, force: true });
  }

  try {
    await afs.chmod(cli, "755");
    await afs.writeFile(cliVersionFilePath(), version);
  } catch {
    await afs.rm(cli, { force: true });
    await afs.rm(cliVersionFilePath(), { force: true });
    throw new Error("Could not chmod st CLI");
  }
}
