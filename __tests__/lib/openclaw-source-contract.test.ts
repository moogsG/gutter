import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const optionalWorkspaceSurfaces = [
  ["lib/project-runway.ts", "components/journal/ProjectRunwayBoard.tsx"],
  ["lib/linkedin.ts", "components/journal/LinkedInBoard.tsx"],
  ["app/api/radar/route.ts", "components/journal/FollowThroughRadar.tsx"],
  ["lib/date-night.ts", "components/journal/DateNightBoard.tsx"],
  ["app/api/truth/route.ts", "components/journal/ProjectTruthBoard.tsx"],
] as const;

function listProductionTypeScript(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return listProductionTypeScript(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("OpenClaw optional-source contract", () => {
  it.each([
    "app/api/sessions/route.ts",
    "app/api/status/route.ts",
    "lib/habits.ts",
  ])("%s resolves workspace data through OPENCLAW_WORKSPACE_PATH", (sourcePath) => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("getOpenClawWorkspacePath");
    expect(source).not.toMatch(/\.openclaw["'],\s*["']workspace|\.openclaw["'],\s*["']workspace/);
  });

  it.each(optionalWorkspaceSurfaces)(
    "%s uses the validated workspace path and exposes actionable UI degradation",
    (sourcePath, componentPath) => {
      const source = readFileSync(sourcePath, "utf8");
      const component = readFileSync(componentPath, "utf8");

      expect(source).toContain("getOpenClawWorkspacePath");
      expect(source).toMatch(/OptionalSourceState|sources?:/);
      expect(source).not.toMatch(/homedir\(\).*\.openclaw|\/Users\//);
      expect(component).toContain("OptionalSourceNotice");
    },
  );

  it("discovers every production OpenClaw path consumer and rejects direct workspace construction", () => {
    const consumers = ["app", "lib"]
      .flatMap(listProductionTypeScript)
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter(({ source }) => /\.openclaw|OPENCLAW_(?:WORKSPACE|AGENTS)_PATH/.test(source));

    expect(consumers.map(({ path }) => path)).toEqual(expect.arrayContaining([
      expect.stringContaining("app/api/daily-log/route.ts"),
      expect.stringContaining("app/api/sessions/route.ts"),
    ]));

    for (const { path, source } of consumers) {
      if (path.endsWith("lib/paths.ts")) continue;
      expect(source, path).toMatch(/getOpenClaw(?:Workspace|Agents)Path/);
      expect(source, path).not.toMatch(/["']\.openclaw["']/);
    }
  });
});
