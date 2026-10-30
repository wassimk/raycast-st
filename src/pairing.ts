import { setStatus, StatusArguments } from "./lib/status";

export default async function Main({ arguments: args }: { arguments: StatusArguments }) {
  await setStatus("pairing", args);
}
