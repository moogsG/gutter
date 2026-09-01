"use client";

import Link from "next/link";
import { CalendarHeart, CheckSquare, ChefHat, ShoppingCart } from "lucide-react";
import type { TomorrowLaunchpadData } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatEventDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TomorrowFamilyPanel({ family }: { family: TomorrowLaunchpadData["family"] }) {
  const groceryPreview = family.grocery.sections
    .filter((section) => section.items.length > 0)
    .slice(0, 2);

  return (
    <Card className="bg-card/85">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Family Ops
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Dinner, house drag, and relationship reality in one place instead of three separate guilt puddles.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/meal-plan">Meal plan</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/chores">Chores</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/date-night">Date night</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-border/60 bg-background/35 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Tomorrow dinner</p>
                <p className="mt-2 text-lg font-medium text-foreground">
                  {family.dinner?.mealName || "No dinner plan found"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {family.dinner
                    ? `${family.dinner.day} • ${family.dinner.prepTime}`
                    : "Meal planning still needs a kick."}
                </p>
              </div>
              <Badge variant="outline" className="gap-1">
                <ChefHat className="h-3.5 w-3.5" />
                {family.mealPlan.source}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-foreground">
              {family.dinner?.notes || "No meal note available yet."}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {family.mealPlan.displayRange
                ? `${family.mealPlan.displayRange} • ${
                    family.mealPlan.updatedAt
                      ? `updated ${new Date(family.mealPlan.updatedAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}`
                      : "update time unknown"
                  }`
                : "Meal plan range unavailable"}
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/35 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Grocery load</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{family.grocery.itemCount}</p>
            <p className="text-sm text-muted-foreground">unchecked grocery items</p>
            <div className="mt-3 space-y-2">
              {groceryPreview.length ? groceryPreview.map((section) => (
                <div key={section.id} className="rounded-xl border border-border/50 bg-background/40 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{section.title}</p>
                  <p className="mt-1 text-sm text-foreground">{section.items.slice(0, 3).join(", ")}</p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No grocery sections generated yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-background/35 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">House drag</p>
                <p className="mt-2 text-lg font-medium text-foreground">
                  {family.chores.remaining === null ? "Chore state unavailable" : `${family.chores.remaining} chores left this cycle`}
                </p>
              </div>
              {family.chores.cycleNumber !== null ? <Badge variant="outline">Cycle {family.chores.cycleNumber}</Badge> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {family.chores.suggestedChoices.length ? family.chores.suggestedChoices.map((choice) => (
                <Badge key={choice.id} variant="secondary" className="gap-1">
                  <CheckSquare className="h-3.5 w-3.5" />
                  {choice.label}: {choice.name}
                </Badge>
              )) : <Badge variant="outline">No suggested pair</Badge>}
            </div>
            <p className="mt-3 text-sm text-foreground">{family.chores.nextMove || "No chore nudge available."}</p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/35 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Relationship drift</p>
                <p className="mt-2 text-lg font-medium text-foreground">
                  {family.relationship.nextEventTitle || "No real date context found"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatEventDate(family.relationship.nextEventDate) || family.relationship.headline || "Jess support context is thin."}
                </p>
              </div>
              <Badge variant={family.relationship.status === "locked-in" ? "secondary" : "outline"} className="gap-1">
                <CalendarHeart className="h-3.5 w-3.5" />
                {family.relationship.status}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-foreground">
              {family.relationship.nextMove || "No relationship next move surfaced."}
            </p>
          </div>
        </div>

        {family.nextMove ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-foreground">
            {family.nextMove}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
