import { Link } from "react-router-dom";
import { isMealStale, type PlannedMeal } from "../../api/planner";
import StatusBadge from "./StatusBadge";

interface Props {
  meal: PlannedMeal;
  staleDays?: number;
}

export default function MealCard({ meal, staleDays = 3 }: Props) {
  const stale = isMealStale(meal, staleDays);

  const dateStr = meal.planned_date
    ? new Date(meal.planned_date + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Link
      to={`/planner/${meal.id}`}
      className={`block bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${
        stale ? "border-amber-300" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">
          {meal.display_name}
        </h3>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <StatusBadge status={meal.status} />
          {meal.is_template && (
            <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
              Template
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
        {dateStr && <span>📅 {dateStr}</span>}
        {meal.recipe_count !== undefined && (
          <span>🍽 {meal.recipe_count} recipe{meal.recipe_count !== 1 ? "s" : ""}</span>
        )}
        {stale && (
          <span className="text-amber-600 font-medium">⚠ Waiting to be cooked</span>
        )}
      </div>
    </Link>
  );
}
