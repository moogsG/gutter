import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  JournalEntry,
  NewEntry,
  Collection,
  FutureLogEntry,
  SemanticSearchResult,
} from "@/types/journal";
import type { TodayFocusWidget } from "@/components/journal/today-focus/widget-types";

export interface MorningViewPromptSummary {
  id: string;
  title: string;
  prompt_text: string;
  source_type: string;
  source_config: string | null;
  ui_config: string | null;
  frequency: string;
  active: number;
  sort_order: number;
  last_run: string | null;
}

export interface TodayFocusWidgetRefreshResponse {
  promptId: string;
  result: {
    prompt: MorningViewPromptSummary;
    content: string;
    error?: string;
    widget?: TodayFocusWidget;
  };
  cachedAt: string;
}

export interface HealthCutMealLogResponse {
  ok: boolean;
  entry: {
    id: string;
    date: string;
    text: string;
    created_at: string;
  };
}

export interface HealthCutPrepLockResponse {
  ok: boolean;
  entry: {
    id: string;
    date: string;
    text: string;
    created_at: string;
  };
  targetDate: string;
}

export interface HealthCutCleanupResponse {
  ok: boolean;
  requestedDate: string;
  category: "omad" | "workout" | "alcohol" | "prep" | "nutrition" | "other" | null;
  killedCount: number;
  remainingAudit: HealthCutQueryResponse["audit"];
}

export interface HealthCutQueryResponse {
  requestedDate: string;
  displayDate: string;
  generatedAt: string;
  mode: "cut" | "weekend";
  counts: {
    done: number;
    remaining: number;
    blocked: number;
    total: number;
  };
  checkpoints: Array<{
    id: string;
    text: string;
    status: "open" | "in-progress" | "blocked" | "done";
    category: "omad" | "workout" | "alcohol" | "prep" | "nutrition" | "other";
  }>;
  mealLog: {
    required: boolean;
    completed: boolean;
    prompt: string;
    entriesCount: number;
    latestEntry?: {
      id: string;
      text: string;
      createdAt: string;
    };
  };
  prepLock: {
    targetDate: string;
    completed: boolean;
    prompt: string;
    entriesCount: number;
    latestEntry?: {
      id: string;
      text: string;
      createdAt: string;
    };
  };
  history: Array<{
    date: string;
    label: string;
    total: number;
    done: number;
    remaining: number;
    blocked: number;
    mealLogged: boolean;
  }>;
  audit: {
    unresolvedCount: number;
    staleCount: number;
    cleanupEligibleCount: number;
    categoriesWithStale: number;
    oldestOpenDate: string | null;
    oldestOpenDays: number | null;
    groups: Array<{
      category: "omad" | "workout" | "alcohol" | "prep" | "nutrition" | "other";
      unresolvedCount: number;
      staleCount: number;
      cleanupEligibleCount: number;
      oldestOpenDate: string | null;
      newestOpenDate: string | null;
      items: Array<{
        id: string;
        date: string;
        text: string;
        status: "open" | "in-progress" | "blocked" | "done";
        ageDays: number;
      }>;
    }>;
    nextMove: string;
  };
}

export const journalApi = createApi({
  reducerPath: "journalApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api`,
  }),
  tagTypes: ["JournalDay", "Collections", "FutureLog", "JournalMonth"],
  endpoints: (builder) => ({
    getEntries: builder.query<JournalEntry[], string>({
      query: (date) => `/journal?date=${date}`,
      providesTags: (result, error, date) => [{ type: "JournalDay", id: date }],
    }),
    addEntry: builder.mutation<JournalEntry, NewEntry>({
      query: (body) => ({
        url: "/journal",
        method: "POST",
        body,
      }),
      async onQueryStarted(body, { dispatch, queryFulfilled }) {
        const tempId = `temp-${Date.now()}`;
        const optimisticEntry: JournalEntry = {
          id: tempId,
          date: body.date,
          signifier: body.signifier,
          text: body.text,
          status: "open",
          lane: (body as JournalEntry).lane || null,
          priority: (body as JournalEntry).priority || null,
          waiting_on: (body as JournalEntry).waiting_on || null,
          tags: body.tags || [],
          parent_id: body.parent_id || null,
          sort_order: 9999,
          children: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const patchResult = dispatch(
          journalApi.util.updateQueryData("getEntries", body.date, (draft) => {
            if (body.parent_id) {
              // Find parent and add as child
              const parent = draft.find((e) => e.id === body.parent_id);
              if (parent) {
                if (!parent.children) parent.children = [];
                optimisticEntry.sort_order = parent.children.length;
                parent.children.push(optimisticEntry);
              } else {
                draft.push(optimisticEntry);
              }
            } else {
              optimisticEntry.sort_order = draft.length;
              draft.push(optimisticEntry);
            }
          })
        );

        try {
          await queryFulfilled;
          // Refetch to get properly nested structure from server
          dispatch(journalApi.util.invalidateTags([{ type: "JournalDay", id: body.date }]));
        } catch {
          patchResult.undo();
        }
      },
    }),
    updateEntry: builder.mutation<void, { id: string; _date?: string } & Partial<JournalEntry>>({
      query: ({ id, _date, ...body }) => ({
        url: `/journal/${id}`,
        method: "PATCH",
        body,
      }),
      async onQueryStarted({ id, _date, ...patch }, { dispatch, queryFulfilled }) {
        const undos: Array<{ undo: () => void }> = [];

        if (_date) {
          const patchResult = dispatch(
            journalApi.util.updateQueryData("getEntries", _date, (draft) => {
              for (const entry of draft) {
                if (entry.id === id) {
                  Object.assign(entry, patch, { updated_at: new Date().toISOString() });
                  return;
                }
                const child = entry.children?.find((c) => c.id === id);
                if (child) {
                  Object.assign(child, patch, { updated_at: new Date().toISOString() });
                  return;
                }
              }
            })
          );
          undos.push(patchResult);
        }

        try {
          await queryFulfilled;
          if (_date) {
            dispatch(journalApi.util.invalidateTags([{ type: "JournalDay", id: _date }]));
          }
        } catch {
          undos.forEach((p) => p.undo());
        }
      },
      invalidatesTags: (result, error, { _date, collection_id }) => {
        const tags: Array<{ type: "JournalDay"; id: string } | "Collections" | "JournalMonth"> = ["JournalMonth"];
        if (_date) tags.push({ type: "JournalDay", id: _date });
        if (collection_id !== undefined) tags.push("Collections");
        return tags;
      },
    }),
    deleteEntry: builder.mutation<void, { id: string; hard?: boolean; _date?: string }>({
      query: ({ id, hard }) => ({
        url: `/journal/${id}${hard ? "?hard=true" : ""}`,
        method: "DELETE",
      }),
      async onQueryStarted({ id, hard, _date }, { dispatch, queryFulfilled }) {
        const undos: Array<{ undo: () => void }> = [];

        if (_date) {
          const patchResult = dispatch(
            journalApi.util.updateQueryData("getEntries", _date, (draft) => {
              const idx = draft.findIndex((e) => e.id === id);
              if (idx !== -1) {
                if (hard) {
                  draft.splice(idx, 1);
                } else {
                  draft[idx].status = "killed";
                }
                return;
              }
              for (const entry of draft) {
                if (!entry.children) continue;
                const cIdx = entry.children.findIndex((c) => c.id === id);
                if (cIdx !== -1) {
                  if (hard) {
                    entry.children.splice(cIdx, 1);
                  } else {
                    entry.children[cIdx].status = "killed";
                  }
                  return;
                }
              }
            })
          );
          undos.push(patchResult);
        }

        try {
          await queryFulfilled;
          if (_date) {
            dispatch(journalApi.util.invalidateTags([{ type: "JournalDay", id: _date }]));
          }
        } catch {
          undos.forEach((p) => p.undo());
        }
      },
      invalidatesTags: (result, error, { _date }) =>
        _date ? [{ type: "JournalDay", id: _date }] : [],
    }),
    migrateEntries: builder.mutation<
      {
        success: boolean;
        targetDate: string;
        requestedCount: number;
        migratedCount: number;
        skippedCount: number;
      },
      { entryIds: string[]; targetDate: string }
    >({
      query: (body) => ({
        url: "/journal/migrate",
        method: "POST",
        body,
      }),
      invalidatesTags: ["JournalDay", "JournalMonth"],
    }),
    getUnresolved: builder.query<JournalEntry[], { before: string }>({
      query: ({ before }) => `/journal/unresolved?before=${before}`,
      providesTags: ["JournalMonth"],
    }),
    getCollections: builder.query<Collection[], void>({
      query: () => "/collections",
      providesTags: ["Collections"],
    }),
    createCollection: builder.mutation<Collection, { title: string; icon?: string }>({
      query: (body) => ({
        url: "/collections",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Collections"],
    }),
    getCollection: builder.query<Collection & { entries: JournalEntry[] }, string>({
      query: (id) => `/collections/${id}`,
      providesTags: (result, error, id) => [{ type: "Collections", id }],
    }),
    getFutureLog: builder.query<FutureLogEntry[], string | void>({
      query: (month) => (month ? `/future-log?month=${month}` : "/future-log"),
      providesTags: ["FutureLog"],
    }),
    createFutureLogEntry: builder.mutation<
      FutureLogEntry,
      { target_month: string; signifier: string; text: string }
    >({
      query: (body) => ({
        url: "/future-log",
        method: "POST",
        body,
      }),
      invalidatesTags: ["FutureLog"],
    }),
    updateFutureLogEntry: builder.mutation<
      FutureLogEntry,
      Pick<FutureLogEntry, "id" | "target_month" | "signifier" | "text">
    >({
      query: ({ id, ...body }) => ({
        url: `/future-log/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["FutureLog"],
    }),
    markFutureLogEntryMigrated: builder.mutation<FutureLogEntry, string>({
      query: (id) => ({
        url: `/future-log/${id}`,
        method: "PATCH",
        body: { migrated: true },
      }),
      invalidatesTags: ["FutureLog"],
    }),
    deleteFutureLogEntry: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({ url: `/future-log/${id}`, method: "DELETE" }),
      invalidatesTags: ["FutureLog"],
    }),
    searchEntries: builder.query<JournalEntry[], string>({
      query: (q) => `/journal/search?q=${encodeURIComponent(q)}&limit=20`,
    }),
    semanticSearch: builder.query<SemanticSearchResult[], { q: string; limit?: number }>({
      query: ({ q, limit = 5 }) =>
        `/search/semantic?q=${encodeURIComponent(q)}&limit=${limit}`,
    }),
    getHealthCut: builder.query<HealthCutQueryResponse, string | void>({
      query: (date) => (date ? `/health-cut?date=${date}` : "/health-cut"),
      providesTags: (result, error, date) =>
        date ? [{ type: "JournalDay", id: date }, "JournalMonth"] : ["JournalMonth"],
    }),
    refreshTodayFocusWidget: builder.mutation<TodayFocusWidgetRefreshResponse, string>({
      query: (promptId) => ({
        url: `/morning-view/summary?promptId=${encodeURIComponent(promptId)}&force=true`,
        method: "GET",
      }),
    }),
    submitHealthCutMealLog: builder.mutation<HealthCutMealLogResponse, { date: string; text: string; promptId?: string }>({
      query: ({ date, text }) => ({
        url: "/health-cut/meal-log",
        method: "POST",
        body: { date, text },
      }),
      invalidatesTags: (result, error, { date }) => [{ type: "JournalDay", id: date }, "JournalMonth"],
    }),
    submitHealthCutPrepLock: builder.mutation<HealthCutPrepLockResponse, { date: string; text: string }>({
      query: ({ date, text }) => ({
        url: "/health-cut/prep-lock",
        method: "POST",
        body: { date, text },
      }),
      invalidatesTags: (result, error, { date }) => [{ type: "JournalDay", id: date }, "JournalMonth"],
    }),
    cleanupHealthCutBacklog: builder.mutation<
      HealthCutCleanupResponse,
      { date: string; category?: "omad" | "workout" | "alcohol" | "prep" | "nutrition" | "other" }
    >({
      query: ({ date, category }) => ({
        url: "/health-cut",
        method: "POST",
        body: { action: "cleanup-stale", date, category },
      }),
      invalidatesTags: (result, error, { date }) => [{ type: "JournalDay", id: date }, "JournalMonth"],
    }),
  }),
});

export const {
  useGetEntriesQuery,
  useAddEntryMutation,
  useUpdateEntryMutation,
  useDeleteEntryMutation,
  useMigrateEntriesMutation,
  useGetUnresolvedQuery,
  useGetCollectionsQuery,
  useCreateCollectionMutation,
  useGetCollectionQuery,
  useGetFutureLogQuery,
  useCreateFutureLogEntryMutation,
  useUpdateFutureLogEntryMutation,
  useMarkFutureLogEntryMigratedMutation,
  useDeleteFutureLogEntryMutation,
  useSearchEntriesQuery,
  useLazySearchEntriesQuery,
  useSemanticSearchQuery,
  useLazySemanticSearchQuery,
  useGetHealthCutQuery,
  useRefreshTodayFocusWidgetMutation,
  useSubmitHealthCutMealLogMutation,
  useSubmitHealthCutPrepLockMutation,
  useCleanupHealthCutBacklogMutation,
} = journalApi;
