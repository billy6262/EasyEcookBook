import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { plannerApi, STATUS_COLOURS, STATUS_LABELS, type PlannedMeal } from "../api/planner";

function PlannerWidget() {
  const { data: activeMeals = [], isLoading: loadingActive } = useQuery({
    queryKey: ["planner-meals", "home-active"],
    queryFn: () =>
      plannerApi.listMeals({ status: "planned,shopping", template: "false" }).then((r) => r.data),
  });

  const { data: shoppedMeals = [], isLoading: loadingShopped } = useQuery({
    queryKey: ["planner-meals", "home-shopped"],
    queryFn: () =>
      plannerApi.listMeals({ status: "shopped" }).then((r) => r.data),
  });

  const isLoading = loadingActive || loadingShopped;
  const totalCount = activeMeals.length + shoppedMeals.length;

  function MealRow({ meal }: { meal: PlannedMeal }) {
    return (
      <Link
        to={`/planner/${meal.id}`}
        className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group"
      >
        <span className="text-sm text-gray-800 group-hover:text-green-600 line-clamp-1 flex-1">
          {meal.display_name}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {meal.planned_date && (
            <span className="text-xs text-gray-400">
              {new Date(meal.planned_date + "T00:00:00").toLocaleDateString(undefined, {
                month: "short", day: "numeric",
              })}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[meal.status]}`}>
            {STATUS_LABELS[meal.status]}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Meal Planner</h2>
        <Link to="/planner" className="text-sm text-green-600 hover:underline">
          View all →
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-4">
          <p className="text-gray-400 text-sm mb-3">No active meals planned.</p>
          <Link
            to="/planner/new"
            className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            + Plan a meal
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {shoppedMeals.length > 0 && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">
              Ready to Cook
            </p>
          )}
          {shoppedMeals.map((m) => <MealRow key={m.id} meal={m} />)}

          {activeMeals.length > 0 && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mt-3 mb-1">
              Upcoming
            </p>
          )}
          {activeMeals.map((m) => <MealRow key={m.id} meal={m} />)}

          <div className="pt-3 mt-1 border-t">
            <Link
              to="/planner/new"
              className="block text-center text-sm text-green-600 hover:text-green-700 font-medium"
            >
              + Plan a new meal
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">
        Welcome back{user?.first_name ? `, ${user.first_name}` : ""}!
      </h1>
      <p className="text-gray-500 mb-8">What are you cooking today?</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Link
          to="/recipes"
          className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow group"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-green-600">
            Recipes
          </h2>
          <p className="text-gray-500 text-sm">
            Browse, create, and manage your recipe collection.
          </p>
        </Link>

        <Link
          to="/collections"
          className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow group"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-green-600">
            Collections
          </h2>
          <p className="text-gray-500 text-sm">
            Organise recipes into shared cookbooks.
          </p>
        </Link>

        <Link
          to="/events"
          className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow group"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-green-600">
            Events
          </h2>
          <p className="text-gray-500 text-sm">
            Plan dinners and coordinate potlucks with friends.
          </p>
        </Link>
      </div>

      <PlannerWidget />
    </div>
  );
}
