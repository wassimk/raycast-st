import { showHUD, showToast, Toast } from "@raycast/api";
import { updateCLI } from "./lib/cli";

export default async function Main() {
  await showToast({ style: Toast.Style.Animated, title: "Checking for st updates" });

  try {
    const { version, updated } = await updateCLI();
    await showHUD(updated ? `Updated st to ${version}` : `st ${version} is the latest`);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Could not update st",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
