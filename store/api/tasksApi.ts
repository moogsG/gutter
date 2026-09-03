import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { CalendarEvent, CalendarRunwayData, OptionalSourceState, Task, TaskComment } from "@/types";

export type KanbanStatus = "todo" | "in-progress" | "blocked" | "done";

export interface KanbanQueryArgs {
  status: KanbanStatus;
  date?: string;
}

export interface KanbanBoardQueryArgs {
  date?: string;
}

export interface CalendarRunwayQueryArgs {
  date: string;
}

export interface MoveTaskPayload {
  taskId: string;
  status: string;
}

export const tasksApi = createApi({
  reducerPath: "tasksApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["Calendar", "Tasks", "KanbanTasks", "TaskComments"],
  endpoints: (builder) => ({
    getCalendar: builder.query<{ events: CalendarEvent[]; source: OptionalSourceState }, void>({
      query: () => "/calendar",
      providesTags: ["Calendar"],
      keepUnusedDataFor: 30,
    }),
    getCalendarMonth: builder.query<{ events: CalendarEvent[]; source: OptionalSourceState }, string>({
      query: (month) => `/calendar?month=${month}`,
      providesTags: (result, error, month) => [{ type: "Calendar", id: month }],
      keepUnusedDataFor: 30,
    }),
    getCalendarRunway: builder.query<CalendarRunwayData, CalendarRunwayQueryArgs>({
      query: ({ date }) => `/calendar/runway?date=${date}`,
      providesTags: (result, error, { date }) => [{ type: "Calendar", id: `runway-${date}` }],
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
      async onQueryStarted({ taskId, status }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          tasksApi.util.updateQueryData("getKanbanBoardTasks", {}, (tasks) => {
            const task = tasks.find((item) => item.id === taskId);
            if (task) task.status = status;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: ["KanbanTasks"],
    }),
    getTask: builder.query<Task, string>({
      query: (taskId) => `/tasks/${taskId}`,
      providesTags: (_result, _error, taskId) => [{ type: "Tasks", id: taskId }],
    }),
    getTaskComments: builder.query<TaskComment[], string>({
      query: (taskId) => `/tasks/${taskId}/comments`,
      providesTags: (_result, _error, taskId) => [{ type: "TaskComments", id: taskId }],
    }),
    addTaskComment: builder.mutation<TaskComment, { taskId: string; body: string }>({
      query: ({ taskId, body }) => ({
        url: `/tasks/${taskId}/comments`,
        method: "POST",
        body: { body },
      }),
      invalidatesTags: (_result, _error, { taskId }) => [
        { type: "TaskComments", id: taskId },
        { type: "Tasks", id: taskId },
        "KanbanTasks",
      ],
    }),
  }),
});

export const {
  useGetCalendarQuery,
  useGetCalendarMonthQuery,
  useGetCalendarRunwayQuery,
  useGetKanbanBoardTasksQuery,
  useMoveTaskMutation,
  useGetTaskQuery,
  useGetTaskCommentsQuery,
  useAddTaskCommentMutation,
} = tasksApi;
