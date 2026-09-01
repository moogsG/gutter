import { configureStore } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";
import { choresApi } from "./api/choresApi";
import { dateNightApi } from "./api/dateNightApi";
import { habitsApi } from "./api/habitsApi";
import { journalApi } from "./api/journalApi";
import { linkedinApi } from "./api/linkedinApi";
import { mealPlanApi } from "./api/mealPlanApi";
import { meetingPrepApi } from "./api/meetingPrepApi";
import { radarApi } from "./api/radarApi";
import { projectRunwayApi } from "./api/projectRunwayApi";
import { resetApi } from "./api/resetApi";
import { schoolApi } from "./api/schoolApi";
import { sessionsApi } from "./api/sessionsApi";
import { statusApi } from "./api/statusApi";
import { tasksApi } from "./api/tasksApi";
import { tomorrowApi } from "./api/tomorrowApi";
import { truthApi } from "./api/truthApi";
import { triageApi } from "./api/triageApi";
import { wipApi } from "./api/wipApi";

export const store = configureStore({
  reducer: {
    [choresApi.reducerPath]: choresApi.reducer,
    [dateNightApi.reducerPath]: dateNightApi.reducer,
    [habitsApi.reducerPath]: habitsApi.reducer,
    [journalApi.reducerPath]: journalApi.reducer,
    [linkedinApi.reducerPath]: linkedinApi.reducer,
    [mealPlanApi.reducerPath]: mealPlanApi.reducer,
    [meetingPrepApi.reducerPath]: meetingPrepApi.reducer,
    [projectRunwayApi.reducerPath]: projectRunwayApi.reducer,
    [radarApi.reducerPath]: radarApi.reducer,
    [resetApi.reducerPath]: resetApi.reducer,
    [schoolApi.reducerPath]: schoolApi.reducer,
    [sessionsApi.reducerPath]: sessionsApi.reducer,
    [statusApi.reducerPath]: statusApi.reducer,
    [tasksApi.reducerPath]: tasksApi.reducer,
    [tomorrowApi.reducerPath]: tomorrowApi.reducer,
    [truthApi.reducerPath]: truthApi.reducer,
    [triageApi.reducerPath]: triageApi.reducer,
    [wipApi.reducerPath]: wipApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(
    choresApi.middleware,
    dateNightApi.middleware,
    habitsApi.middleware,
    journalApi.middleware,
    linkedinApi.middleware,
    mealPlanApi.middleware,
    meetingPrepApi.middleware,
    projectRunwayApi.middleware,
    radarApi.middleware,
    resetApi.middleware,
    schoolApi.middleware,
    sessionsApi.middleware,
    statusApi.middleware,
    tasksApi.middleware,
    tomorrowApi.middleware,
    truthApi.middleware,
    triageApi.middleware,
    wipApi.middleware,
  ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
