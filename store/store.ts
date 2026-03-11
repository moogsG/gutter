import { configureStore } from "@reduxjs/toolkit";
import { journalApi } from "./api/journalApi";
import { meetingPrepApi } from "./api/meetingPrepApi";
import { tasksApi } from "./api/tasksApi";

export const store = configureStore({
  reducer: {
    [journalApi.reducerPath]: journalApi.reducer,
    [meetingPrepApi.reducerPath]: meetingPrepApi.reducer,
    [tasksApi.reducerPath]: tasksApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(
    journalApi.middleware,
    meetingPrepApi.middleware,
    tasksApi.middleware
  ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
import { useDispatch } from "react-redux";
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
