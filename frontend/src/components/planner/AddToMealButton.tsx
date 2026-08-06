import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { plannerApi } from "../../api/planner";

interface Props {
  recipeId: number;
  buttonClassName?: string;
}

export default function AddToMealButton({ recipeId, buttonClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch upcoming meals only when the dropdown is open
  const { data: upcomingMeals = [], isFetching } = useQuery({
    queryKey: ["planner-meals", "upcoming"],
    queryFn: () =>
      plannerApi
        .listMeals({ status: "planned,shopping", template: "false" })
        .then((r) => r.data),
    enabled: open,
    staleTime: 30_000,
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setOpen(false);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const { mutate: addToMeal, isPending: adding } = useMutation({
    mutationFn: (mealId: number) => plannerApi.addRecipe(mealId, recipeId),
    onSuccess: (_, mealId) => {
      queryClient.invalidateQueries({ queryKey: ["planner-meal", mealId] });
      const meal = upcomingMeals.find((m) => m.id === mealId);
      showSuccess(meal?.display_name ?? "meal");
    },
  });

  const { mutate: createAndAdd, isPending: creating } = useMutation({
    mutationFn: async () => {
      const meal = (await plannerApi.createMeal({})).data;
      await plannerApi.addRecipe(meal.id, recipeId);
      return meal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-meals"] });
      showSuccess("new meal");
    },
  });

  const isPending = adding || creating;

  if (successMsg) {
    return (
      <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 whitespace-nowrap">
        ✓ Added to {successMsg}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName ?? "text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"}
        title="Add to a meal plan"
      >
        {isPending ? "…" : "🍽 + Plan"}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 bg-white border rounded-xl shadow-lg py-1 min-w-44 max-w-60 z-30">
          {isFetching ? (
            <p className="text-xs text-gray-400 px-3 py-2">Loading…</p>
          ) : upcomingMeals.length > 0 ? (
            <>
              <p className="text-xs text-gray-400 px-3 pt-2 pb-1 font-medium uppercase tracking-wide">
                Upcoming meals
              </p>
              {upcomingMeals.map((meal) => (
                <button
                  key={meal.id}
                  onClick={() => addToMeal(meal.id)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-green-50 transition-colors"
                >
                  <span className="line-clamp-1">{meal.display_name}</span>
                </button>
              ))}
              <div className="border-t my-1" />
            </>
          ) : (
            <p className="text-xs text-gray-400 px-3 pt-2 pb-1">No upcoming meals</p>
          )}
          <button
            onClick={() => createAndAdd()}
            className="w-full text-left px-3 py-2 text-sm text-green-600 font-medium hover:bg-green-50 transition-colors"
          >
            + Create new meal
          </button>
        </div>
      )}
    </div>
  );
}
