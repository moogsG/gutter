import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { CalendarEvent, Task } from "@/types";

export type KanbanStatus = "todo" | "in-progress" | "blocked" | "done";

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
    // Kanban: fetch tasks for a specific kanban column status
    getKanbanTasks: builder.query<Task[], KanbanStatus>({
      query: (status) => `/tasks?status=${status}&limit=200`,
      providesTags: (result, error, status) => [
        { type: "KanbanTasks", id: status },
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
  useGetKanbanTasksQuery,
  useMoveTaskMutation,
} = tasksApi;
