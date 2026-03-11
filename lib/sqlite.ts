/**
 * SQLite compatibility shim.
 * Uses bun:sqlite when running under Bun (production), falls back to
 * better-sqlite3 when running under Node (dev/test).
 *
 * Exposes a Database class with the better-sqlite3 API surface:
 *   db.prepare(sql) → { run(), get(), all() }
 *   db.exec(sql)
 *   db.pragma(pragma)
 */

// Detect bun:sqlite availability by attempting to load it
// process.versions.bun is unreliable in Next.js server workers (which are Node processes)
let isBun = false;
try {
  require("bun:sqlite");
  isBun = true;
} catch {
  isBun = false;
}

type Statement = {
  run: (...params: any[]) => any;
  get: (...params: any[]) => any;
  all: (...params: any[]) => any[];
};

export class Database {
  private _db: any;

  constructor(path: string) {
    if (isBun) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Database: BunDB } = require("bun:sqlite");
      this._db = new BunDB(path, { create: true });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const BetterSqlite = require("better-sqlite3");
      this._db = new BetterSqlite(path);
    }
  }

  prepare(sql: string): Statement {
    if (isBun) {
      const stmt = this._db.prepare(sql);
      return {
        run: (...params: any[]) => stmt.run(...params),
        get: (...params: any[]) => stmt.get(...params),
        all: (...params: any[]) => stmt.all(...params),
      };
    }
    return this._db.prepare(sql);
  }

  exec(sql: string): void {
    // Both bun:sqlite and better-sqlite3 support .exec()
    this._db.exec(sql);
  }

  pragma(pragma: string): any {
    if (isBun) {
      try {
        return this._db.run(`PRAGMA ${pragma}`);
      } catch {
        // Some pragmas are not settable, ignore
      }
    } else {
      return this._db.pragma(pragma);
    }
  }
}

export default Database;
