import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isMealStale, plannerApi } from "../../api/planner";
import MealCard from "../../components/planner/MealCard";

const STALENESS_KEY = "easyecookbook_staleness_days";

function loadStaleDays(): number {
  try {
    const v = localStorage.getItem(STALENESS_KEY);
    return v ? Math.max(1, parseInt(v)) : 3;
  } catch {
    return 3;
  }
}

export default function PlannerPage() {
  const [staleDays, setStaleDays] = useState(loadStaleDays);
  const [shopSort, setShopSort] = useState<"chrono" | "alpha">("chrono");

  const { data: upcomingMeals = [], isLoading: loadingUpcoming } = useQuery({
    queryKey: ["planner-meals", "upcoming"],
    queryFn: () =>
      plannerApi.listMeals({ status: "planned,shopping", template: "false" }).then((r) => r.data),
  });

  const { data: shoppedMeals = [], isLoading: loadingShopped } = useQuery({
    queryKey: ["planner-meals", "shopped"],
    queryFn: () =>
      plannerApi.listMeals({ status: "shopped" }).then((r) => r.data),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["planner-meals", "templates"],
    queryFn: () => plannerApi.listMeals({ template: "true" }).then((r) => r.data),
  });

  const sortedShopped = [...shoppedMeals].sort((a, b) =>
    shopSort === "alpha"
      ? a.display_name.localeCompare(b.display_name)
      : new Date(a.shopped_at ?? a.created_at).getTime() -
        new Date(b.shopped_at ?? b.created_at).getTime()
  );

  const staleCount = shoppedMeals.filter((m) => isMealStale(m, staleDays)).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meal Planner</h1>
        <div className="flex gap-2">
          <Link
            to="/planner/shopping"
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            🛒 Shopping List
          </Link>
          <Link
            to="/planner/new"
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            + New Meal
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Upcoming ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Upcoming
            {upcomingMeals.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({upcomingMeals.length})
              </span>
            )}
          </h2>

          {loadingUpcoming ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : upcomingMeals.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-3">No upcoming meals planned.</p>
              <Link to="/planner/new" className="text-green-600 text-sm hover:underline">
                Plan a meal →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMeals.map((meal) => (
                <MealCard key={meal.id} meal={meal} staleDays={staleDays} />
              ))}
            </div>
          )}
        </section>

        {/* ── Ready to Cook ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-700">
              Ready to Cook
              {shoppedMeals.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({shoppedMeals.length}
                  {staleCount > 0 && (
                    <span className="text-amber-600"> · {staleCount} stale</span>
                  )}
                  )
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {/* Sort toggle */}
              <div className="flex rounded-lg border text-xs overflow-hidden">
                <button
                  onClick={() => setShopSort("chrono")}
                  className={`px-2 py-1 ${shopSort === "chrono" ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                >
                  Date
                </button>
                <button
                  onClick={() => setShopSort("alpha")}
                  className={`px-2 py-1 ${shopSort === "alpha" ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                >
                  A–Z
                </button>
              </div>
              {/* Staleness setting */}
              <label className="flex items-center gap-1 text-xs text-gray-400">
                ⚠ after
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={staleDays}
                  onChange={(e) => {
                    const v = Math.max(1, parseInt(e.target.value) || 3);
                    setStaleDays(v);
                    localStorage.setItem(STALENESS_KEY, String(v));
                  }}
                  className="w-10 border rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                days
              </label>
            </div>
          </div>

          {loadingShopped ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : sortedShopped.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm">
                Nothing here yet. Mark a meal as shopped to see it here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedShopped.map((meal) => (
                <MealCard key={meal.id} meal={meal} staleDays={staleDays} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Templates ──────────────────────────────────────────────────────── */}
      {templates.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Templates ({templates.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((meal) => (
              <MealCard key={meal.id} meal={meal} staleDays={staleDays} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
