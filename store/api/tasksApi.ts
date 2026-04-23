import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { CalendarEvent, Task } from "@/types";

export type KanbanStatus = "todo" | "in-progress" | "blocked" | "done";

export interface KanbanQueryArgs {
  status: KanbanStatus;
  date?: string;
}

export interface KanbanBoardQueryArgs {
  date?: string;
}

export interface MoveTaskPayload {
  taskId: string;
  status: string;
}

export const tasksApi = createApi({
  reducerPath: "tasksApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["Calendar", "Tasks", "KanbanTasks"],
  endpoints: (builder) => ({
    getCalendar: builder.query<{ events: CalendarEvent[] }, void>({
      query: () => "/calendar",
      providesTags: ["Calendar"],
      keepUnusedDataFor: 30,
    }),
    getCalendarMonth: builder.query<{ events: CalendarEvent[] }, string>({
      query: (month) => `/calendar?month=${month}`,
      providesTags: (result, error, month) => [{ type: "Calendar", id: month }],
      keepUnusedDataFor: 30,
    }),
    // Kanban: fetch all board tasks in a single request, then group client-side
    getKanbanBoardTasks: builder.query<Task[], KanbanBoardQueryArgs>({
      query: ({ date }) => {
        const params = new URLSearchParams({ status: "open,in-progress,blocked,done", limit: "500" });
        if (date) params.set("date", date);
        return `/tasks?${params.toString()}`;
      },
      providesTags: (result, error, { date }) => [
        { type: "KanbanTasks", id: `board-${date ?? "all"}` },
        "KanbanTasks",
      ],
    }),
    // Kanban: move a task to a new status column
    moveTask: builder.mutation<{ ok: boolean }, MoveTaskPayload>({
      query: ({ taskId, status }) => ({
        url: "/tasks",
        method: "POST",
        body: { action: "move", taskId, status },
      }),
      invalidatesTags: ["KanbanTasks"],
    }),
  }),
});

export const {
  useGetCalendarQuery,
  useGetCalendarMonthQuery,
  useGetKanbanBoardTasksQuery,
  useMoveTaskMutation,
} = tasksApi;
