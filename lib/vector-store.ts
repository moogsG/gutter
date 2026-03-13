/**
 * LanceDB vector store for semantic search and RAG context.
 *
 * Uses @xenova/transformers for local embeddings (no API key required).
 * Model: Xenova/all-MiniLM-L6-v2 — 384-dim, fast, good quality.
 *
 * Tables:
 *   journal_entries — id, text, date, signifiers, collection_id, vector
 *   meeting_transcripts — id, text, title, date, vector
 */

import { connect, type Connection, type Table } from "@lancedb/lancedb";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

// ─── Constants ───────────────────────────────────────────────────────────────

const LANCEDB_PATH = process.env.LANCEDB_PATH || "./gutter-lancedb";
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
const VECTOR_DIM = 384;
const DEFAULT_TOP_K = 5;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JournalVector {
  id: string;
  text: string;
  date: string;
  signifier: string;
  collection_id: string;
  vector: number[];
}

export interface MeetingTranscriptVector {
  id: string;
  text: string;
  title: string;
  date: string;
  vector: number[];
}

export interface SemanticSearchResult {
  id: string;
  text: string;
  date: string;
  signifier: string;
  collection_id: string;
  _distance: number;
}

export interface MeetingContextResult {
  id: string;
  text: string;
  date: string;
  title: string;
  _distance: number;
}

// ─── Globals (survive Next.js hot reload) ────────────────────────────────────

const g = globalThis as typeof globalThis & {
  _lanceDbConn?: Connection;
  _embedPipeline?: any;
  _embedPipelineLoading?: Promise<any>;
};

// ─── Embedding pipeline ───────────────────────────────────────────────────────

async function getEmbedPipeline(): Promise<any> {
  if (g._embedPipeline) return g._embedPipeline;

  // Deduplicate concurrent init calls
  if (g._embedPipelineLoading) return g._embedPipelineLoading;

  g._embedPipelineLoading = (async () => {
    const { pipeline, env } = await import("@xenova/transformers");

    // Cache models locally in the project to avoid re-downloading
    env.cacheDir = join(process.cwd(), ".cache", "transformers");

    const pipe = await pipeline("feature-extraction", EMBEDDING_MODEL, {
      quantized: true,
    });
    g._embedPipeline = pipe;
    g._embedPipelineLoading = undefined;
    return pipe;
  })();

  return g._embedPipelineLoading;
}

/**
 * Embed a single string into a 384-dim float32 vector.
 */
export async function embed(text: string): Promise<number[]> {
  const pipe = await getEmbedPipeline();
  // mean-pool over token dimension, normalize
  const output = await pipe(text.trim(), { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

// ─── LanceDB connection ───────────────────────────────────────────────────────

async function getDb(): Promise<Connection> {
  if (g._lanceDbConn) return g._lanceDbConn;

  // Ensure directory exists
  if (!existsSync(LANCEDB_PATH)) {
    mkdirSync(LANCEDB_PATH, { recursive: true });
  }

  g._lanceDbConn = await connect(LANCEDB_PATH);
  return g._lanceDbConn;
}

// ─── Table accessors (create if needed) ──────────────────────────────────────

async function getJournalTable(): Promise<Table> {
  const db = await getDb();
  const tableNames = await db.tableNames();

  if (!tableNames.includes("journal_entries")) {
    // Bootstrap with a dummy row so the schema is created, then delete it
    const seed: Record<string, unknown> = {
      id: "__seed__",
      text: "",
      date: "",
      signifier: "",
      collection_id: "",
      vector: new Array(VECTOR_DIM).fill(0),
    };
    const table = await db.createTable("journal_entries", [seed]);
    await table.delete('id = "__seed__"');
    return table;
  }

  return db.openTable("journal_entries");
}

async function getMeetingTable(): Promise<Table> {
  const db = await getDb();
  const tableNames = await db.tableNames();

  if (!tableNames.includes("meeting_transcripts")) {
    const seed: Record<string, unknown> = {
      id: "__seed__",
      text: "",
      title: "",
      date: "",
      vector: new Array(VECTOR_DIM).fill(0),
    };
    const table = await db.createTable("meeting_transcripts", [seed]);
    await table.delete('id = "__seed__"');
    return table;
  }

  return db.openTable("meeting_transcripts");
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

/**
 * Embed and upsert a journal entry into the vector store.
 * Deletes existing row with the same id before inserting (upsert semantics).
 */
export async function upsertJournalEntry(entry: {
  id: string;
  text: string;
  date: string;
  signifier: string;
  collection_id?: string | null;
}): Promise<void> {
  if (!entry.text?.trim()) return;

  const [table, vector] = await Promise.all([
    getJournalTable(),
    embed(entry.text),
  ]);

  // Delete existing row if present
  try {
    await table.delete(`id = "${entry.id}"`);
  } catch {
    // Table may be empty — ignore
  }

  const row: Record<string, unknown> = {
    id: entry.id,
    text: entry.text,
    date: entry.date,
    signifier: entry.signifier,
    collection_id: entry.collection_id ?? "",
    vector,
  };
  await table.add([row]);
}

/**
 * Embed and upsert a meeting transcript.
 */
export async function upsertMeetingTranscript(record: {
  id: string;
  text: string;
  title: string;
  date: string;
}): Promise<void> {
  if (!record.text?.trim()) return;

  const [table, vector] = await Promise.all([
    getMeetingTable(),
    embed(record.text),
  ]);

  try {
    await table.delete(`id = "${record.id}"`);
  } catch {
    // ignore
  }

  const row: Record<string, unknown> = {
    id: record.id,
    text: record.text,
    title: record.title,
    date: record.date,
    vector,
  };
  await table.add([row]);
}

/**
 * Delete a journal entry from the vector store.
 */
export async function deleteJournalEntry(id: string): Promise<void> {
  try {
    const table = await getJournalTable();
    await table.delete(`id = "${id}"`);
  } catch {
    // Ignore — entry may not exist yet
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Semantic search over journal entries.
 * Returns top-K results sorted by cosine distance (ascending).
 */
export async function searchJournalEntries(
  query: string,
  topK = DEFAULT_TOP_K
): Promise<SemanticSearchResult[]> {
  const [table, queryVec] = await Promise.all([
    getJournalTable(),
    embed(query),
  ]);

  const results = await table
    .search(queryVec)
    .limit(topK)
    .toArray();

  return results.map((r: any) => ({
    id: r.id as string,
    text: r.text as string,
    date: r.date as string,
    signifier: r.signifier as string,
    collection_id: r.collection_id as string,
    _distance: r._distance as number,
  }));
}

/**
 * Semantic search for meeting context — searches both journal entries
 * and meeting transcripts, returns interleaved top-K results.
 */
export async function searchMeetingContext(
  query: string,
  topK = DEFAULT_TOP_K
): Promise<MeetingContextResult[]> {
  const queryVec = await embed(query);

  // Search journal entries and meeting transcripts in parallel
  const [journalTable, meetingTable] = await Promise.all([
    getJournalTable(),
    getMeetingTable(),
  ]);

  const [journalResults, meetingResults] = await Promise.all([
    journalTable.search(queryVec).limit(topK).toArray().catch(() => []),
    meetingTable.search(queryVec).limit(topK).toArray().catch(() => []),
  ]);

  const mapped: MeetingContextResult[] = [
    ...journalResults.map((r: any) => ({
      id: r.id as string,
      text: r.text as string,
      date: r.date as string,
      title: `Journal: ${r.date}`,
      _distance: r._distance as number,
    })),
    ...meetingResults.map((r: any) => ({
      id: r.id as string,
      text: r.text as string,
      date: r.date as string,
      title: r.title as string,
      _distance: r._distance as number,
    })),
  ];

  // Sort by distance, return top-K
  return mapped
    .sort((a, b) => a._distance - b._distance)
    .slice(0, topK);
}
