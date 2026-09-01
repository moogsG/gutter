"use client";

import { CalendarDays, ChefHat, Loader2, RefreshCcw, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { GroceryChecklistCard } from "@/components/journal/GroceryChecklistCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useClearMealChecklistMutation,
  useGetMealPlanQuery,
  useRegenerateMealPlanMutation,
  useToggleMealChecklistItemMutation,
} from "@/store/api/mealPlanApi";

function shiftDate(date: string, amount: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return next.toISOString().split("T")[0];
}

function getCancunTodayDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function MealPlanBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error, isFetching } = useGetMealPlanQuery(date);
  const [regenerateMealPlan, { isLoading: isRegenerating }] = useRegenerateMealPlanMutation();
  const [toggleMealChecklistItem, { isLoading: isChecklistSaving }] = useToggleMealChecklistItemMutation();
  const [clearMealChecklist, { isLoading: isChecklistClearing }] = useClearMealChecklistMutation();
  const isSavingChecklist = isChecklistSaving || isChecklistClearing;

  const handleToggle = async (sectionId: string, item: string, checked: boolean) => {
    if (!data) return;
    try {
      await toggleMealChecklistItem({ date, weekOf: data.weekOf, sectionId, item, checked }).unwrap();
    } catch {
      toast.error("Checklist update failed. Even groceries are fighting back.");
    }
  };

  const handleClear = async () => {
    if (!data || data.groceryCheckedCount === 0) return;
    if (!window.confirm("Clear this week's grocery checks and start the list over?")) return;

    try {
      await clearMealChecklist({ date, weekOf: data.weekOf }).unwrap();
      toast.success("Grocery checks cleared");
    } catch {
      toast.error("Could not clear the grocery checklist.");
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <JournalHeader
        date={date}
        onPrevDay={() => onDateChange(shiftDate(date, -1))}
        onNextDay={() => onDateChange(shiftDate(date, 1))}
        onToday={() => onDateChange(getCancunTodayDate())}
        showCapture={false}
      />

      <main className="flex-1 px-4 py-5 sm:px-6">
        {isLoading ? <MealPlanSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-chart-2/20 bg-[linear-gradient(135deg,rgba(127,225,179,0.18),rgba(255,255,255,0.02),rgba(244,187,68,0.12))] p-5 shadow-[0_0_60px_rgba(127,225,179,0.12)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-chart-2">Family dinner map</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">{data.displayRange}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    One obvious place for dinner, prep, and grocery drag so Jess is not carrying this whole circus alone.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1 border-chart-2/30 bg-background/40 px-3 py-1">
                    <ChefHat className="h-3.5 w-3.5" /> {data.highlight?.mealName || "No dinner"}
                  </Badge>
                  <Badge variant="outline" className="gap-1 border-chart-2/30 bg-background/40 px-3 py-1">
                    <ShoppingBasket className="h-3.5 w-3.5" /> {data.groceryRemainingCount} left
                  </Badge>
                  <Badge variant="outline" className="gap-1 border-chart-2/30 bg-background/40 px-3 py-1">
                    {data.groceryCheckedCount}/{data.groceryItemCount} grabbed
                  </Badge>
                  <Button
                    variant="outline"
                    className="gap-2 border-chart-2/30 bg-background/40"
                    onClick={() => void regenerateMealPlan(date)}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Refresh week
                  </Button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <Card className="border-chart-2/20 bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><ChefHat className="h-4 w-4 text-chart-2" /> Tonight&apos;s Best Bet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-3xl border border-chart-2/20 bg-chart-2/10 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-chart-2">{data.highlight?.day || "No day selected"}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{data.highlight?.mealName || "No meal planned"}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{data.highlight?.prepTime} • {data.highlight?.texture}</p>
                    <p className="mt-3 text-sm text-foreground">{data.highlight?.notes || "Generate a plan to get dinner unstuck."}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(data.highlight?.ingredients || []).map((ingredient) => (
                      <Badge key={ingredient} variant="secondary">{ingredient}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isFetching ? "Refreshing live..." : `Plan source: ${data.source} • Updated ${new Date(data.planUpdatedAt || data.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-chart-2" /> The Week</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.meals.map((meal) => (
                    <div key={meal.day} className="rounded-3xl border border-border/60 bg-background/35 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{meal.day}</p>
                      <p className="mt-2 text-lg font-medium text-foreground">{meal.mealName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{meal.prepTime} • {meal.category.replaceAll("_", " ")}</p>
                      <p className="mt-3 text-sm text-foreground">{meal.notes}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <GroceryChecklistCard
              checklist={data.groceryChecklist}
              checkedCount={data.groceryCheckedCount}
              remainingCount={data.groceryRemainingCount}
              isSaving={isSavingChecklist}
              onToggle={handleToggle}
              onClear={handleClear}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}

function FailureState() {
  return (
    <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
      <CardContent className="p-5 text-sm text-foreground">
        Meal planning failed to load. The `Meals` tab was being useless again.
      </CardContent>
    </Card>
  );
}

function MealPlanSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-[2rem]" />
        <Skeleton className="h-80 rounded-[2rem]" />
      </div>
      <Skeleton className="h-72 rounded-[2rem]" />
    </div>
  );
}
