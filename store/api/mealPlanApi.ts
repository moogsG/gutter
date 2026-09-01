import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { MealPlanData } from "@/types";

export const mealPlanApi = createApi({
  reducerPath: "mealPlanApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["MealPlan"],
  endpoints: (builder) => ({
    getMealPlan: builder.query<MealPlanData, string>({
      query: (date) => `/meal-plan?date=${date}`,
      providesTags: (result, error, date) => [{ type: "MealPlan", id: date }],
      keepUnusedDataFor: 60,
    }),
    regenerateMealPlan: builder.mutation<MealPlanData, string>({
      query: (date) => ({
        url: "/meal-plan",
        method: "POST",
        body: { action: "regenerate", date },
      }),
      invalidatesTags: (result, error, date) => [{ type: "MealPlan", id: date }],
    }),
    toggleMealChecklistItem: builder.mutation<
      MealPlanData,
      { date: string; weekOf: string; sectionId: string; item: string; checked: boolean }
    >({
      query: ({ date, weekOf, sectionId, item, checked }) => ({
        url: "/meal-plan",
        method: "POST",
        body: { action: "toggle-check", date, weekOf, sectionId, item, checked },
      }),
      invalidatesTags: (result, error, input) => [{ type: "MealPlan", id: input.date }],
    }),
    clearMealChecklist: builder.mutation<MealPlanData, { date: string; weekOf: string }>({
      query: ({ date, weekOf }) => ({
        url: "/meal-plan",
        method: "POST",
        body: { action: "clear-checks", date, weekOf },
      }),
      invalidatesTags: (result, error, input) => [{ type: "MealPlan", id: input.date }],
    }),
  }),
});

export const {
  useGetMealPlanQuery,
  useRegenerateMealPlanMutation,
  useToggleMealChecklistItemMutation,
  useClearMealChecklistMutation,
} = mealPlanApi;
