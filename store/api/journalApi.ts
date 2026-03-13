import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  JournalEntry,
  NewEntry,
  Collection,
  FutureLogEntry,
  SemanticSearchResult,
} from "@/types/journal";

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
              // Search top-level and children
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
        } catch {
          undos.forEach((p) => p.undo());
        }
      },
      invalidatesTags: (result, error, { collection_id }) =>
        collection_id !== undefined ? ["Collections"] : [],
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
              // Check top-level
              const idx = draft.findIndex((e) => e.id === id);
              if (idx !== -1) {
                if (hard) {
                  draft.splice(idx, 1);
                } else {
                  draft[idx].status = "killed";
                }
                return;
              }
              // Check children
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
        } catch {
          undos.forEach((p) => p.undo());
        }
      },
    }),
    migrateEntries: builder.mutation<
      { success: boolean; count: number },
      { entryIds: string[]; targetDate: string }
    >({
      query: (body) => ({
        url: "/journal/migrate",
        method: "POST",
        body,
      }),
      invalidatesTags: ["JournalDay", "JournalMonth"],
    }),
    getUnresolved: builder.query<JournalEntry[], string>({
      query: (month) => `/journal/unresolved?month=${month}`,
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
    searchEntries: builder.query<JournalEntry[], string>({
      query: (q) => `/journal/search?q=${encodeURIComponent(q)}&limit=20`,
    }),
    semanticSearch: builder.query<SemanticSearchResult[], { q: string; limit?: number }>({
      query: ({ q, limit = 5 }) =>
        `/search/semantic?q=${encodeURIComponent(q)}&limit=${limit}`,
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
  useSearchEntriesQuery,
  useLazySearchEntriesQuery,
  useSemanticSearchQuery,
  useLazySemanticSearchQuery,
} = journalApi;
