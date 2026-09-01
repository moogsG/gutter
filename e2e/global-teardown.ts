import { rmSync } from "node:fs";

export default function globalTeardown() {
  const directory = process.env.GUTTER_E2E_DIRECTORY;
  if (directory) rmSync(directory, { recursive: true, force: true });
}