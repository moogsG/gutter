# CODING-STANDARDS.md — Web App Development Rules

These rules apply to ALL web apps built by Jynx and her agents. No exceptions.

---

## Stack Defaults

Unless Moogs says otherwise, new web apps use:
- **Framework:** Next.js (latest stable)
- **Runtime:** bun
- **UI:** shadcn/ui + Tailwind CSS
- **State:** RTK Query (Redux Toolkit)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind only — zero inline styles

---

## Hard Rules (Non-Negotiable)

### 1. NO INLINE STYLES. EVER.
```tsx
// ❌ NEVER
<div style={{ color: "red", background: "rgba(0,0,0,0.5)" }}>

// ✅ ALWAYS
<div className="text-red-500 bg-black/50">
```
- All styling through Tailwind classes or CSS custom properties
- If Tailwind doesn't have it, use arbitrary values: `text-[#c8ccd8]`
- If it's reusable, add it to globals.css as a utility class
- Dynamic values that MUST be computed at runtime: use CSS variables set via `style={{ '--my-var': value }}` and consume in className

### 2. NO RAW FETCH IN COMPONENTS
```tsx
// ❌ NEVER
useEffect(() => {
  fetch('/api/tasks').then(r => r.json()).then(setData)
}, [])

// ✅ ALWAYS — RTK Query
const { data, isLoading, error } = useGetTasksQuery()
```
- Define API endpoints ONCE in an RTK Query API slice
- Components subscribe to cached data
- Polling, refetching, invalidation handled by RTK
- Loading/error states come free

### 3. NO DUPLICATE DATA
- Each piece of data has ONE source of truth
- ONE API endpoint per resource
- ONE store slice per domain
- If two widgets need the same data, they use the same query hook
- Never fetch the same endpoint from two different components

### 4. COMPONENTS ARE DUMB
```tsx
// ❌ Widget fetches its own data, manages its own state, renders its own UI
// ✅ Widget receives data via props or RTK hooks, only renders UI
```
- Separate data fetching (hooks/RTK) from presentation (components)
- Components should be testable with mock data
- Business logic lives in hooks or RTK slices, not in JSX

### 5. THEME-FIRST STYLING
```tsx
// ❌ Hardcoded colors
<div className="bg-[#0d0f1a] text-[#c8ccd8] border-[#1a1a22]">

// ✅ Theme tokens
<div className="bg-background text-foreground border-border">
```
- Use shadcn theme tokens: `background`, `foreground`, `card`, `muted`, `primary`, `destructive`, etc.
- Custom brand colors go in CSS variables in globals.css
- Components should look correct if the theme changes
- ONE place to update colors: globals.css

### 6. ONE COMPONENT PER FILE
- File name matches export name: `TaskCard.tsx` exports `TaskCard`
- Max 150 lines per component file — if longer, split it
- Colocate types with the component or in a shared `types.ts`

### 7. NO BACKUP FILES IN REPO
```bash
# ❌ NEVER leave these
Component.tsx.bak
Component.tsx.bak2
globals.css.backup
globals.css.original
fix-thing.js
manual-fix.js
```
- Git is the backup system
- Commit before making changes
- Use branches for experiments
- Clean up after yourself

---

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes (server-side only)
│   ├── globals.css       # Theme variables + utility classes
│   ├── layout.tsx        # Root layout (providers, fonts)
│   └── page.tsx          # Page composition (layout only)
├── components/
│   ├── ui/               # shadcn base components (don't edit)
│   └── widgets/          # App-specific widgets
├── hooks/                # Custom React hooks
├── lib/
│   ├── utils.ts          # cn() and shared utilities
│   └── db.ts             # Database access (server-side)
├── store/
│   ├── store.ts          # RTK store configuration
│   └── api/              # RTK Query API slices
│       ├── tasksApi.ts
│       ├── calendarApi.ts
│       └── agentApi.ts
└── types/
    └── index.ts          # Shared TypeScript types
```

---

## Component Pattern

```tsx
// src/components/widgets/TaskList.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetTasksQuery } from "@/store/api/tasksApi";

export function TaskList() {
  const { data: tasks, isLoading, error } = useGetTasksQuery();

  if (isLoading) return <TaskListSkeleton />;
  if (error) return null; // or error state

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks?.map(task => (
          <TaskItem key={task.id} task={task} />
        ))}
      </CardContent>
    </Card>
  );
}

function TaskItem({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-foreground">{task.title}</span>
      <Badge variant="outline" className="text-xs">{task.project}</Badge>
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border">
      <CardHeader className="pb-3">
        <Skeleton className="h-3 w-16" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </CardContent>
    </Card>
  );
}
```

---

## RTK Query API Pattern

```tsx
// src/store/api/tasksApi.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Task } from "@/types";

export const tasksApi = createApi({
  reducerPath: "tasksApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  tagTypes: ["Tasks"],
  endpoints: (builder) => ({
    getTasks: builder.query<Task[], void>({
      query: () => "/tasks",
      providesTags: ["Tasks"],
      // Poll every 30 seconds
      pollingInterval: 30000,
    }),
    completeTask: builder.mutation<void, string>({
      query: (taskId) => ({
        url: "/tasks",
        method: "POST",
        body: { action: "complete", taskId },
      }),
      invalidatesTags: ["Tasks"],
    }),
  }),
});

export const { useGetTasksQuery, useCompleteTaskMutation } = tasksApi;
```

---

## CSS Theme Pattern

```css
/* globals.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

/* Brand colors — ONE place, referenced everywhere */
:root {
  --brand-pink: #e45b9d;
  --brand-cyan: #56c7b9;
  --brand-rose-gold: #b76e79;
}

.dark {
  --background: oklch(0.07 0.02 270);
  --foreground: oklch(0.85 0.02 280);
  --card: oklch(0.1 0.02 270);
  --card-foreground: oklch(0.85 0.02 280);
  --muted: oklch(0.15 0.02 270);
  --muted-foreground: oklch(0.5 0.02 280);
  --border: oklch(0.18 0.02 270);
  --primary: oklch(0.6 0.15 350);
  --primary-foreground: oklch(0.98 0 0);
  /* ... etc */
}
```

---

## Agent Rules for Building

### Before writing code:
1. Read this file
2. Read the project's existing code to understand patterns
3. Plan the change — know which files you'll touch

### While writing code:
4. ONE file at a time — don't batch edit 37 files
5. Build after each file change — catch errors early
6. Never use sed/find-replace for JSX — too fragile
7. If a file is > 150 lines, split it before modifying

### After writing code:
8. `bun run build` must pass
9. No .bak files left behind
10. No fix-*.js scripts left behind
11. Commit with a meaningful message

### Never:
- Mass find-and-replace across components
- Leave backup files in the repo
- Use inline styles
- Duplicate data fetching
- Create components that manage their own fetch lifecycle
- Skip the build check

---

## Git Workflow

- **Commit before experiments** — always have a clean rollback point
- **Branch for big changes** — `jynx/feature-name`
- **Small commits** — one logical change per commit
- **Build must pass** before committing

---

_This is a living document. Update it when we learn something new._
_Last updated: 2026-03-04_

---

## Domain-Driven Design (DDD)

Use DDD when the app has real business logic — not for simple CRUD dashboards, but when domains get complex.

### When to apply DDD:
- Multiple bounded contexts (e.g. Tasks, Agents, Calendar are separate domains)
- Business rules that aren't just "fetch and display"
- Data transformations that belong in the domain, not the UI

### Structure:
```
src/
├── domains/
│   ├── tasks/
│   │   ├── types.ts          # Task entity, value objects
│   │   ├── service.ts        # Business logic (complete, block, prioritize)
│   │   ├── api.ts            # RTK Query endpoints for tasks
│   │   └── components/       # UI components specific to tasks
│   ├── agents/
│   │   ├── types.ts
│   │   ├── service.ts
│   │   ├── api.ts
│   │   └── components/
│   └── calendar/
│       ├── types.ts
│       ├── service.ts
│       ├── api.ts
│       └── components/
```

### Rules:
- Domains don't import from other domains directly — use the store as the bridge
- Business logic lives in `service.ts`, not in components or API routes
- Types are the contract — define them first, build around them
- If you can't name the domain, it probably doesn't need DDD — keep it simple

---

## Testing

### Test what matters:
- **API routes** — every endpoint gets at least one happy-path test
- **Business logic** — domain services get unit tests
- **Complex components** — if it has conditional rendering or user interaction, test it
- **Don't test** — simple presentational components, shadcn wrappers, obvious pass-throughs

### Stack:
- **Test runner:** bun test (built-in, fast)
- **Component testing:** @testing-library/react when needed
- **API testing:** direct function calls to route handlers

### Pattern:
```tsx
// src/domains/tasks/__tests__/service.test.ts
import { describe, expect, test } from "bun:test";
import { prioritizeTasks, isOverdue } from "../service";

describe("task service", () => {
  test("overdue tasks sort first", () => {
    const tasks = [
      { id: "1", title: "Future", dueDate: "2026-12-01" },
      { id: "2", title: "Overdue", dueDate: "2026-01-01" },
    ];
    const sorted = prioritizeTasks(tasks);
    expect(sorted[0].id).toBe("2");
  });

  test("isOverdue returns true for past dates", () => {
    expect(isOverdue("2026-01-01")).toBe(true);
  });
});
```

### Rules:
- Tests live next to what they test: `__tests__/` folder or `.test.ts` suffix
- Run `bun test` before committing — must pass
- No snapshot tests — they're brittle and nobody reads the diffs
- Mock external APIs, never mock internal logic

---

## shadcn/ui Rules

### Setup (MANDATORY — Do This First):
Every new web app MUST have shadcn initialized before any UI code is written. No exceptions.

1. `bunx shadcn@latest init` — creates `components.json`, `lib/utils.ts` with `cn()`
2. `bunx shadcn@latest add button card badge` — install baseline components immediately
3. Wire CSS variables in `globals.css` to match the project's theme
4. Verify: `components.json` exists, `components/ui/` has files, `cn()` works

**If a project has Tailwind but no `components.json`, shadcn is NOT set up.** Having `tailwindcss` in package.json means nothing if shadcn isn't initialized. Don't ship UI without it.

Add components as needed: `bunx shadcn@latest add dialog dropdown-menu tooltip input`

### Rules:
- **NEVER edit files in `components/ui/`** — these are shadcn's. Treat them as read-only.
- To customize, wrap them:
```tsx
// src/components/widgets/BrandCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BrandCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
```
- Use shadcn's variant system — don't reinvent buttons/badges/inputs
- Theme via CSS variables in globals.css, not by editing shadcn components

---

## Bun

Bun is the runtime. Not Node. Not npm. Not yarn.

### Commands:
- **Install deps:** `bun install`
- **Dev server:** `bun run dev`
- **Build:** `bun run build`
- **Test:** `bun test`
- **Add package:** `bun add <package>`
- **Add dev package:** `bun add -d <package>`

### Rules:
- `bun.lock` is the lockfile — commit it
- Never use `npm install` or `yarn add` — bun only
- Use `bun:test` for testing, not jest
- Scripts go in package.json `scripts` — run via `bun run <script>`
- If something works in Node but not Bun, file it and find a Bun-compatible alternative

---

_Last updated: 2026-03-04_
