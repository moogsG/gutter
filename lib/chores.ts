import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ChoreBoardData } from "@/types";

const CHORE_STATE_PATH = "/Users/moogs/.openclaw/workspace/memory/chore-state.json";
const CHORE_TIMEZONE = "America/Cancun";
const STALE_CYCLE_DAYS = 21;
const DEFAULT_CHORES = [
  "Bathroom 1",
  "Bathroom 2",
  "Bathroom 3",
  "Bathroom 4",
  "Bathroom 5",
  "Office",
  "Kids room 1",
  "Kids room 2",
  "Master bedroom",
  "Living areas",
  "Outside/yard",
];

interface ChoreStateItem {
  id: string;
  name: string;
  completedInCycle: boolean;
  completedAt: string | null;
  totalCompletions: number;
}

interface ChoreState {
  version: 1;
  cycleNumber: number;
  cycleStartedAt: string;
  lastCompletedCycleAt: string | null;
  chores: ChoreStateItem[];
  history: Array<{ choreId: string; choreName: string; completedAt: string }>;
  lastChoice: { date: string; choiceIds: string[] } | null;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getTodayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHORE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildFreshState(): ChoreState {
  return {
    version: 1,
    cycleNumber: 1,
    cycleStartedAt: getTodayIso(),
    lastCompletedCycleAt: null,
    chores: DEFAULT_CHORES.map((name) => ({
      id: slugify(name),
      name,
      completedInCycle: false,
      completedAt: null,
      totalCompletions: 0,
    })),
    history: [],
    lastChoice: null,
  };
}

function normalizeState(raw: Partial<ChoreState>): ChoreState {
  const byId = new Map((raw.chores || []).map((chore) => [chore.id, chore]));
  return {
    version: 1,
    cycleNumber: raw.cycleNumber || 1,
    cycleStartedAt: raw.cycleStartedAt || getTodayIso(),
    lastCompletedCycleAt: raw.lastCompletedCycleAt || null,
    chores: DEFAULT_CHORES.map((name) => {
      const id = slugify(name);
      const existing = byId.get(id);
      return {
        id,
        name,
        completedInCycle: existing?.completedInCycle ?? false,
        completedAt: existing?.completedAt ?? null,
        totalCompletions: existing?.totalCompletions ?? 0,
      };
    }),
    history: Array.isArray(raw.history) ? raw.history.slice(-200) : [],
    lastChoice:
      raw.lastChoice && Array.isArray(raw.lastChoice.choiceIds)
        ? {
            date: raw.lastChoice.date || getTodayIso(),
            choiceIds: raw.lastChoice.choiceIds,
          }
        : null,
  };
}

function saveState(state: ChoreState) {
  mkdirSync(dirname(CHORE_STATE_PATH), { recursive: true });
  writeFileSync(CHORE_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

function loadState() {
  try {
    const raw = JSON.parse(readFileSync(CHORE_STATE_PATH, "utf8")) as Partial<ChoreState>;
    return normalizeState(raw);
  } catch {
    return saveState(buildFreshState());
  }
}

function getRemainingChores(state: ChoreState) {
  return state.chores.filter((chore) => !chore.completedInCycle);
}

function isCycleStale(state: ChoreState) {
  const startedAt = new Date(`${state.cycleStartedAt}T12:00:00`);
  if (Number.isNaN(startedAt.getTime())) return false;
  const ageInDays = Math.floor((Date.now() - startedAt.getTime()) / 86_400_000);
  return ageInDays >= STALE_CYCLE_DAYS;
}

function resetCycle(state: ChoreState) {
  return {
    ...state,
    cycleNumber: state.cycleNumber + 1,
    cycleStartedAt: getTodayIso(),
    lastCompletedCycleAt: new Date().toISOString(),
    chores: state.chores.map((chore) => ({
      ...chore,
      completedInCycle: false,
      completedAt: null,
    })),
    lastChoice: null,
  };
}

function ensureUsableState(state: ChoreState) {
  if (isCycleStale(state)) {
    return saveState(resetCycle(state));
  }
  return state;
}

function choosePair(state: ChoreState) {
  const remainingChores = getRemainingChores(state);
  if (remainingChores.length === 0) {
    return { state, choices: [] as ChoreStateItem[] };
  }

  const today = getTodayIso();
  const currentChoices =
    state.lastChoice?.date === today
      ? state.lastChoice.choiceIds
          .map((id) => state.chores.find((chore) => chore.id === id))
          .filter((chore): chore is ChoreStateItem => Boolean(chore && !chore.completedInCycle))
      : [];

  if (currentChoices.length > 0) {
    return { state, choices: currentChoices };
  }

  const remaining = remainingChores
    .sort((left, right) => {
      if (left.totalCompletions !== right.totalCompletions) {
        return left.totalCompletions - right.totalCompletions;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 2);

  const nextState = {
    ...state,
    lastChoice: {
      date: today,
      choiceIds: remaining.map((choice) => choice.id),
    },
  };

  return { state: saveState(nextState), choices: remaining };
}

function buildBoard(state: ChoreState): ChoreBoardData {
  const normalized = ensureUsableState(state);
  const pair = choosePair(normalized);
  const choiceIds = new Set(pair.choices.map((choice) => choice.id));
  const completedCount = pair.state.chores.length - getRemainingChores(pair.state).length;
  const nextMove =
    pair.choices.length > 0
      ? `Pick ${pair.choices.map((choice, index) => `${index === 0 ? "A" : "B"}: ${choice.name}`).join(" or ")} at the next cleanup pass and clear one piece of house drag.`
      : "Cycle is clear. Start the next one and keep the house from quietly mutating into a landfill.";

  return {
    generatedAt: new Date().toISOString(),
    cycleNumber: pair.state.cycleNumber,
    cycleStartedAt: pair.state.cycleStartedAt,
    lastCompletedCycleAt: pair.state.lastCompletedCycleAt,
    counts: {
      total: pair.state.chores.length,
      completed: completedCount,
      remaining: pair.state.chores.length - completedCount,
    },
    suggestedChoices: pair.choices.map((choice, index) => ({
      id: choice.id,
      name: choice.name,
      label: index === 0 ? "A" : "B",
    })),
    chores: pair.state.chores.map((chore) => ({
      id: chore.id,
      name: chore.name,
      completedInCycle: chore.completedInCycle,
      completedAt: chore.completedAt,
      totalCompletions: chore.totalCompletions,
      isSuggested: choiceIds.has(chore.id),
    })),
    history: [...pair.state.history]
      .slice(-8)
      .reverse()
      .map((entry) => ({
        choreId: entry.choreId,
        choreName: entry.choreName,
        completedAt: entry.completedAt,
      })),
    nextMove,
  };
}

export function getChoreBoardData() {
  return buildBoard(loadState());
}

function removeLatestHistoryEntry(
  history: ChoreState["history"],
  choreId: string,
  completedAt: string | null,
) {
  let removed = false;

  return history.filter((entry) => {
    if (!removed && entry.choreId === choreId && entry.completedAt === completedAt) {
      removed = true;
      return false;
    }

    return true;
  });
}

export function updateChoreBoard(action: "complete" | "pick" | "reset" | "reopen", selection?: string) {
  let state = ensureUsableState(loadState());

  if (action === "reset") {
    return buildBoard(saveState(resetCycle(state)));
  }

  if (action === "pick") {
    state = saveState({ ...state, lastChoice: null });
    return buildBoard(state);
  }

  const normalized = (selection || "").trim().toLowerCase();
  let choreId = normalized;

  if (normalized === "a" || normalized === "b") {
    const index = normalized === "a" ? 0 : 1;
    choreId = state.lastChoice?.choiceIds[index] || "";
  }

  const target = state.chores.find(
    (chore) =>
      chore.id === choreId ||
      chore.name.toLowerCase() === normalized ||
      slugify(chore.name) === normalized,
  );

  if (!target) {
    throw new Error("Pick a real chore before smashing buttons.");
  }

  if (action === "reopen") {
    if (!target.completedInCycle) {
      throw new Error(`${target.name} is already open.`);
    }

    state = saveState({
      ...state,
      chores: state.chores.map((chore) =>
        chore.id === target.id
          ? {
              ...chore,
              completedInCycle: false,
              completedAt: null,
              totalCompletions: Math.max(0, chore.totalCompletions - 1),
            }
          : chore,
      ),
      history: removeLatestHistoryEntry([...state.history].reverse(), target.id, target.completedAt).reverse(),
      lastChoice: null,
    });

    return buildBoard(state);
  }

  if (target.completedInCycle) {
    throw new Error(`${target.name} is already done this cycle.`);
  }

  const completedAt = new Date().toISOString();
  state = saveState({
    ...state,
    chores: state.chores.map((chore) =>
      chore.id === target.id
        ? { ...chore, completedInCycle: true, completedAt, totalCompletions: chore.totalCompletions + 1 }
        : chore,
    ),
    history: [...state.history, { choreId: target.id, choreName: target.name, completedAt }].slice(-200),
    lastChoice: null,
  });

  return buildBoard(state);
}
