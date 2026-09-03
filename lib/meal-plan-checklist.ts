import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MealPlanChecklistSection, MealPlanGrocerySection } from "@/types";
import { getOpenClawWorkspacePath } from "@/lib/paths";

const WORKSPACE_ROOT = getOpenClawWorkspacePath();
const CHECKLIST_PATH = join(WORKSPACE_ROOT, "memory", "meal-plan-checklist.json");

interface StoredChecklistState {
  version: 1;
  weeks: Record<string, Record<string, true>>;
}

const EMPTY_STATE: StoredChecklistState = {
  version: 1,
  weeks: {},
};

function buildKey(sectionId: string, item: string) {
  return `${sectionId}::${item}`;
}

async function loadState(): Promise<StoredChecklistState> {
  try {
    const raw = await readFile(CHECKLIST_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredChecklistState>;
    return {
      version: 1,
      weeks: parsed.weeks && typeof parsed.weeks === "object" ? parsed.weeks : {},
    };
  } catch {
    return EMPTY_STATE;
  }
}

async function saveState(state: StoredChecklistState) {
  await mkdir(join(WORKSPACE_ROOT, "memory"), { recursive: true });
  await writeFile(CHECKLIST_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function getMealChecklist(
  weekOf: string,
  grocerySections: MealPlanGrocerySection[],
): Promise<{
  groceryChecklist: MealPlanChecklistSection[];
  groceryCheckedCount: number;
  groceryRemainingCount: number;
}> {
  const state = await loadState();
  const checkedMap = state.weeks[weekOf] || {};
  const groceryChecklist = grocerySections.map((section) => {
    const items = section.items.map((label) => ({
      label,
      checked: Boolean(checkedMap[buildKey(section.id, label)]),
    }));
    const checkedCount = items.filter((item) => item.checked).length;

    return {
      id: section.id,
      title: section.title,
      items,
      checkedCount,
      totalCount: items.length,
    };
  });

  const groceryCheckedCount = groceryChecklist.reduce((sum, section) => sum + section.checkedCount, 0);
  const groceryTotalCount = groceryChecklist.reduce((sum, section) => sum + section.totalCount, 0);

  return {
    groceryChecklist,
    groceryCheckedCount,
    groceryRemainingCount: Math.max(groceryTotalCount - groceryCheckedCount, 0),
  };
}

export async function updateMealChecklistItem(input: {
  weekOf: string;
  sectionId: string;
  item: string;
  checked?: boolean;
}) {
  const state = await loadState();
  const week = { ...(state.weeks[input.weekOf] || {}) };
  const key = buildKey(input.sectionId, input.item);

  if (input.checked === false) {
    delete week[key];
  } else {
    week[key] = true;
  }

  state.weeks[input.weekOf] = week;
  await saveState(state);
}

export async function clearMealChecklistWeek(weekOf: string) {
  const state = await loadState();
  if (!state.weeks[weekOf]) return;
  delete state.weeks[weekOf];
  await saveState(state);
}
