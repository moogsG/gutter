import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Calendar CLI contract", () => {
  it("defaults to the accli command documented for local setup", async () => {
    vi.stubEnv("CALENDAR_CLI", "");
    vi.resetModules();

    const { env } = await import("@/lib/env");

    expect(env.calendarCli).toBe("npx @joargp/accli");
  });

  it("keeps every tracked setup surface on the zero-argument calendar listing command", () => {
    const setupSurfaces = [
      "CONFIGURATION.md",
      "INSTALLATION.md",
      "README.md",
      "FAQ.md",
      "docs/CALENDAR-SETUP.md",
      "docs/GOOGLE-CALENDAR-HUB-SETUP.md",
      "scripts/verify-ai-setup.sh",
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(setupSurfaces).toContain(
      "List your calendars with `npx @joargp/accli calendars`.",
    );
    expect(setupSurfaces).not.toContain("@joargp/accli calendars list");
    expect(setupSurfaces).not.toContain("ACCLI_CMD");
  });

  it("uses a configured accli executable for the supported read protocol", async () => {
    const { buildCalendarEventsCommand } = await import("@/lib/calendar");

    expect(
      buildCalendarEventsCommand(
        "/opt/tools/accli",
        "Family Calendar",
        "2026-09-02",
        "2026-09-08",
      ),
    ).toBe(
      '/opt/tools/accli events "Family Calendar" --from 2026-09-02T00:00:00 --to 2026-09-08T23:59:59 --json',
    );
  });

  it("uses the same configured accli protocol when creating events", async () => {
    const { buildCreateCalendarEventCommand } = await import("@/lib/calendar");

    expect(
      buildCreateCalendarEventCommand("/opt/tools/accli", {
        summary: "Family dinner",
        date: "2026-09-02",
        startTime: "18:00",
        endTime: "19:00",
        calendar: "Family Calendar",
      }),
    ).toBe(
      '/opt/tools/accli create --calendar-name "Family Calendar" --summary "Family dinner" --start "2026-09-02T18:00" --end "2026-09-02T19:00" --json',
    );
  });

  it("keeps direct accli process invocation inside the shared Calendar implementation", () => {
    const productionFiles = execFileSync(
      "git",
      ["ls-files", "*.ts", "*.tsx", ":(exclude)__tests__/**"],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .filter((path) => path !== "lib/calendar.ts");

    const directCallPaths = productionFiles.filter((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("node:child_process") && source.includes("@joargp/accli");
    });

    expect(directCallPaths).toEqual([]);
  });
});
