import { environment, getPreferenceValues } from "@raycast/api";
import path from "path";
import fs from "fs";
import os from "os";
import afs from "fs/promises";
import https from "https";
import * as tar from "tar";
import { execFile } from "child_process";
import sha256 from "sha256-file";

const cliVersion = "0.3.0";
const cliFileInfos = {
  x64: {
    arch: "x86_64",
    pkg: "st-Darwin-x86_64.tar.gz",
    sha256: "94a3a7da0bbcc2a7eed19cb4d5f8ceabd0380aa11a0d2130f3c11af3ff554d06",
  },
  arm64: {
    arch: "aarch64",
    pkg: "st-Darwin-aarch64.tar.gz",
    sha256: "3496600e790e7cd74f6f7620e341ee6cd952b9e776d6bec8f6b82cdc73d84591",
  },
};
const cliFileInfo = os.arch() === "arm64" ? cliFileInfos.arm64 : cliFileInfos.x64;

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

function isCurrentVersion(): boolean {
  try {
    return fs.readFileSync(cliVersionFilePath(), "utf-8").trim() === cliVersion;
  } catch {
    return false;
  }
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

export async function ensureCLI() {
  const cli = stCLIFilePath();

  if (fs.existsSync(cli) && isCurrentVersion()) {
    return cli;
  }

  // Remove outdated binary before re-downloading
  if (fs.existsSync(cli)) {
    fs.unlinkSync(cli);
  }

  const repoUrl = "https://github.com/wassimk/st";
  const binaryURL = `${repoUrl}/releases/download/v${cliVersion}/${cliFileInfo.pkg}`;
  const cliDir = stCLIDirectory();
  const tempDir = path.join(environment.supportPath, ".tmp");

  await afs.mkdir(tempDir, { recursive: true });
  const archivePath = path.join(tempDir, cliFileInfo.pkg);

  try {
    await downloadFile(binaryURL, archivePath);
  } catch {
    throw new Error("Could not download st CLI");
  }

  try {
    const archiveHash = await sha256FileHash(archivePath);

    if (archiveHash !== cliFileInfo.sha256) {
      throw new Error("Hash of st CLI archive does not match");
    }

    await afs.mkdir(cliDir, { recursive: true });
    await tar.extract({ file: archivePath, filter: (p) => p === "st", cwd: cliDir });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Hash")) {
      throw error;
    }
    throw new Error("Could not extract downloaded archive of st CLI");
  } finally {
    await afs.rm(tempDir, { recursive: true });
  }

  try {
    await afs.chmod(cli, "755");
    await afs.writeFile(cliVersionFilePath(), cliVersion);
  } catch {
    await afs.rm(cli, { force: true });
    await afs.rm(cliVersionFilePath(), { force: true });
    throw new Error("Could not chmod st CLI");
  }

  return cli;
}
