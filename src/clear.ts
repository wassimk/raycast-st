import { setStatus } from "./lib/status";

export default async function Main() {
  await setStatus("clear");
}
