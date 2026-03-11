# Testing Guide

Gutter uses **Vitest** for unit and integration testing.

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (reruns on file changes)
npm run test:watch

# Interactive UI
npm run test:ui

# With coverage report
npm run test:coverage
```

## Test Structure

```
lib/__tests__/              # Unit tests for utilities
  ├── utils.test.ts
  ├── calendar-colors.test.ts
  └── db.test.ts            # Database integration tests

app/api/**/__tests__/       # API route tests (future)
components/**/__tests__/    # Component tests (future)
```

## Current Test Coverage

### ✅ Unit Tests

- **Utilities** (`lib/utils.ts`): Class name merging (cn helper)
- **Calendar Colors** (`lib/calendar-colors.ts`): Calendar token mapping

### ✅ Integration Tests

- **Database Operations** (`lib/db.test.ts`):
  - CRUD operations for journal entries
  - Collections creation and linking
  - Entry migration
  - Status updates
  - Filtering by date, signifier, and status

## Writing New Tests

### Unit Test Example

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "../my-module";

describe("myFunction", () => {
  it("does something", () => {
    const result = myFunction("input");
    expect(result).toBe("expected output");
  });
});
```

### Database Integration Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";

describe("Database operations", () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(":memory:"); // Use in-memory DB for tests
    db.exec(`CREATE TABLE ...`);
  });

  afterAll(() => {
    db.close();
  });

  it("inserts data", () => {
    db.prepare("INSERT INTO table VALUES (?)").run("value");
    const row = db.prepare("SELECT * FROM table").get();
    expect(row).toBeDefined();
  });
});
```

## Coverage Requirements

### Core Logic

Target: **70%+ coverage** for:

- Utility functions (`lib/`)
- Database operations (`lib/db.ts`, `lib/journal-db.ts`)
- API route handlers (business logic)

### UI Components

Target: **50%+ coverage** for:

- Reusable UI components (`components/ui/`)
- Journal-specific components (`components/journal/`)

Coverage is NOT required for:

- Next.js config files
- Type definitions
- Third-party component wrappers (shadcn/ui)

## Testing Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
beforeEach(() => {
  db.exec("DELETE FROM journal_entries"); // Clean slate
});
```

### 2. Use Descriptive Names

```typescript
// ✅ Good
it("returns empty array when no entries exist", () => {});

// ❌ Bad
it("works", () => {});
```

### 3. Test Edge Cases

```typescript
describe("getCalendarColorToken", () => {
  it("returns default token for unknown calendar", () => {
    expect(getCalendarColorToken("")).toBe("cal-home");
  });
});
```

### 4. Mock External Dependencies

```typescript
vi.mock("@/lib/external-api", () => ({
  fetchData: vi.fn(() => Promise.resolve(mockData)),
}));
```

### 5. Use Test Databases

Never test against production databases. Use:

- In-memory databases (`:memory:`)
- Temporary file databases (`./*.test.db`)
- Clean up after tests

## Continuous Integration

### Pre-commit Hook

Add a pre-commit hook to run tests:

```bash
#!/bin/sh
npm test
```

### GitHub Actions (Example)

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 22
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Test Debugging

### Run a Single Test File

```bash
npx vitest run lib/__tests__/utils.test.ts
```

### Run a Single Test

```bash
npx vitest run -t "returns empty array when no entries exist"
```

### Enable Verbose Output

```bash
npx vitest run --reporter=verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Future Test Plans

### API Route Tests

Test Next.js API routes with proper mocking:

- Journal CRUD (`/api/journal`)
- Collections (`/api/collections`)
- Future Log (`/api/future-log`)
- Tasks (`/api/tasks`)

### Component Tests

Test React components with Testing Library:

- OmniBar (command palette)
- Journal entry list
- Calendar widget
- Theme switcher

### E2E Tests (Playwright)

Test full user flows:

- Add journal entry → mark done → migrate
- Create collection → add entries
- Switch themes

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3)
