import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { MealPlanData, MealPlanGrocerySection, MealPlanMeal } from "@/types";
import { getMealChecklist } from "@/lib/meal-plan-checklist";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";
import { getExecutable, getOpenClawWorkspacePath } from "@/lib/paths";

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = getOpenClawWorkspacePath();
const MEAL_PLANNER_ROOT = join(WORKSPACE_ROOT, "meal-planner");
const PLANS_DIR = join(MEAL_PLANNER_ROOT, "plans");
const MEAL_GENERATOR_PATH = join(MEAL_PLANNER_ROOT, "src", "meal-generator.ts");
const BUN_BIN = getExecutable("BUN_BIN", "bun");

interface StoredWeeklyPlan {
  week_of: string;
  meals: Array<{
    day: string;
    meal: {
      name: string;
      texture: string;
      ingredients: string[];
      category: string;
      prep_time: string;
      notes: string;
    };
  }>;
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getCancunTodayDate(): string {
  return getJournalDate();
}

function getWeekStart(date: Date): string {
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const diffToMonday = date.getDay() === 0 ? -6 : 1 - date.getDay();
  return shiftJournalDate(localDate, diffToMonday);
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function formatRange(weekOf: string): string {
  const start = new Date(`${weekOf}T12:00:00`);
  const end = new Date(`${shiftDate(weekOf, 6)}T12:00:00`);
  const startText = start.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const endText = end.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `${startText} - ${endText}`;
}

function toMeal(day: string, meal: StoredWeeklyPlan["meals"][number]["meal"]): MealPlanMeal {
  return {
    day,
    mealName: meal.name,
    prepTime: meal.prep_time,
    texture: meal.texture,
    notes: meal.notes,
    ingredients: meal.ingredients,
    category: meal.category,
  };
}

function parseGroceryMarkdown(raw: string): MealPlanGrocerySection[] {
  const sections: MealPlanGrocerySection[] = [];
  const lines = raw.split("\n");
  let current: MealPlanGrocerySection | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      current = {
        id: line.slice(3).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: line.slice(3).trim(),
        items: [],
      };
      sections.push(current);
      continue;
    }

    if (current && line.startsWith("- [ ] ")) {
      current.items.push(line.slice(6).trim());
    }
  }

  return sections;
}

async function loadPlan(weekOf: string): Promise<{ plan: StoredWeeklyPlan; updatedAt: string } | null> {
  const planPath = join(PLANS_DIR, `plan-${weekOf}.json`);
  try {
    const [raw, metadata] = await Promise.all([readFile(planPath, "utf8"), stat(planPath)]);
    return {
      plan: JSON.parse(raw) as StoredWeeklyPlan,
      updatedAt: metadata.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

async function loadGrocerySections(weekOf: string): Promise<MealPlanGrocerySection[]> {
  const groceryPath = join(PLANS_DIR, `grocery-${weekOf}.md`);
  const raw = await readFile(groceryPath, "utf8");
  return parseGroceryMarkdown(raw);
}

async function ensureMealPlannerFiles() {
  await access(MEAL_GENERATOR_PATH);
  await mkdir(PLANS_DIR, { recursive: true });
}

async function generatePlanForDate(requestedDate: string) {
  await ensureMealPlannerFiles();

  const generatorUrl = pathToFileURL(MEAL_GENERATOR_PATH).href;
  const script = `
    import { mkdir, writeFile } from "node:fs/promises";
    import { join } from "node:path";
    import { generateWeeklyPlan, generateGroceryList, formatWeeklyPlan, formatGroceryList, getWeekStart } from ${JSON.stringify(generatorUrl)};

    const targetDate = new Date(${JSON.stringify(`${requestedDate}T12:00:00`)});
    const outputDir = ${JSON.stringify(PLANS_DIR)};
    const plan = generateWeeklyPlan(targetDate);
    const grocery = generateGroceryList(plan);
    const weekOf = getWeekStart(targetDate);

    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, \`plan-\${weekOf}.json\`), JSON.stringify(plan, null, 2) + "\\n", "utf8");
    await writeFile(join(outputDir, \`plan-\${weekOf}.md\`), formatWeeklyPlan(plan) + "\\n", "utf8");
    await writeFile(join(outputDir, \`grocery-\${weekOf}.md\`), formatGroceryList(grocery), "utf8");
  `;

  await execFileAsync(BUN_BIN, ["--eval", script], {
    cwd: MEAL_PLANNER_ROOT,
    env: process.env,
  });
}

async function ensurePlanArtifacts(requestedDate: string, weekOf: string, forceRegenerate?: boolean) {
  const existingPlan = !forceRegenerate ? await loadPlan(weekOf) : null;
  if (existingPlan) {
    try {
      const grocerySections = await loadGrocerySections(weekOf);
      return { ...existingPlan, grocerySections, source: "saved" as const };
    } catch {
      // Missing grocery file means the shared planner state is incomplete; rebuild it from the source module.
    }
  }

  await generatePlanForDate(requestedDate);
  const generatedPlan = await loadPlan(weekOf);
  if (!generatedPlan) {
    throw new Error("Meal planner did not produce a weekly plan.");
  }

  const grocerySections = await loadGrocerySections(weekOf);
  return { ...generatedPlan, grocerySections, source: "generated" as const };
}

export async function getMealPlanData(requestedDate: string, options?: { forceRegenerate?: boolean }): Promise<MealPlanData> {
  if (!isValidIsoDate(requestedDate)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }

  const weekOf = getWeekStart(new Date(`${requestedDate}T12:00:00`));
  if (!existsSync(MEAL_PLANNER_ROOT)) {
    return {
      requestedDate,
      weekOf,
      displayRange: formatRange(weekOf),
      generatedAt: new Date().toISOString(),
      planUpdatedAt: null,
      source: {
        state: "not-configured",
        message: "Meals needs the optional meal-planner workspace.",
        recovery: "configure",
      },
      planSource: null,
      highlight: null,
      meals: [],
      grocerySections: [],
      groceryItemCount: 0,
      groceryChecklist: [],
      groceryCheckedCount: 0,
      groceryRemainingCount: 0,
    };
  }

  let artifacts: Awaited<ReturnType<typeof ensurePlanArtifacts>>;
  try {
    artifacts = await ensurePlanArtifacts(requestedDate, weekOf, options?.forceRegenerate);
  } catch {
    return {
      requestedDate,
      weekOf,
      displayRange: formatRange(weekOf),
      generatedAt: new Date().toISOString(),
      planUpdatedAt: null,
      source: {
        state: "unavailable",
        message: "The meal planner is configured but unavailable. Check its files and retry.",
        recovery: "retry",
      },
      planSource: null,
      highlight: null,
      meals: [],
      grocerySections: [],
      groceryItemCount: 0,
      groceryChecklist: [],
      groceryCheckedCount: 0,
      groceryRemainingCount: 0,
    };
  }

  const { plan, updatedAt, grocerySections, source } = artifacts;
  const meals = plan.meals.map(({ day, meal }) => toMeal(day, meal));
  const highlightDay = new Date(`${requestedDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  const highlight = meals.find((meal) => meal.day === highlightDay) || meals[0] || null;
  const checklist = await getMealChecklist(plan.week_of, grocerySections);

  return {
    requestedDate,
    weekOf: plan.week_of,
    displayRange: formatRange(plan.week_of),
    generatedAt: new Date().toISOString(),
    planUpdatedAt: updatedAt,
    source: {
      state: meals.length > 0 ? "ready" : "empty",
      message: meals.length > 0 ? "Meal plan loaded." : "The meal plan contains no meals.",
      recovery: null,
    },
    planSource: source,
    highlight,
    meals,
    grocerySections,
    groceryItemCount: grocerySections.reduce((sum, section) => sum + section.items.length, 0),
    groceryChecklist: checklist.groceryChecklist,
    groceryCheckedCount: checklist.groceryCheckedCount,
    groceryRemainingCount: checklist.groceryRemainingCount,
  };
}
