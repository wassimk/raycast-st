import { setStatus, StatusArguments } from "./lib/status";

export default async function Main({ arguments: { message } }: { arguments: StatusArguments }) {
  await setStatus("back", { message });
}
