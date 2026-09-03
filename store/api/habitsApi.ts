import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { HabitCheckInState, HabitsMomentumData } from "@/types";

export const habitsApi = createApi({
  reducerPath: "habitsApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api` }),
  tagTypes: ["Habits"],
  endpoints: (builder) => ({
    getHabitsMomentum: builder.query<HabitsMomentumData, string>({
      query: (date) => `/habits?date=${date}`,
      providesTags: (result, error, date) => [{ type: "Habits", id: date }],
      keepUnusedDataFor: 60,
    }),
    setHabitCheckIn: builder.mutation<
      { habitId: string; date: string; state: HabitCheckInState },
      { habitId: string; date: string; state: HabitCheckInState }
    >({
      query: (body) => ({ url: "/habits", method: "POST", body }),
      async onQueryStarted({ habitId, date, state }, { dispatch, queryFulfilled }) {
        const patch = dispatch(habitsApi.util.updateQueryData("getHabitsMomentum", date, (draft) => {
          const habit = draft.today.find((item) => item.habitId === habitId);
          if (habit) habit.state = state;
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const { useGetHabitsMomentumQuery, useSetHabitCheckInMutation } = habitsApi;
