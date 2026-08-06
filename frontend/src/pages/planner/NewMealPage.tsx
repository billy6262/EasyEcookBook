import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { plannerApi, type PlannedMeal } from "../../api/planner";
import { recipesApi, type Recipe } from "../../api/recipes";

interface RecipeRow {
  recipe: Recipe;
  targetServings: number | "";
}

export default function NewMealPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = async (q: string) => {
    if (!q.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
    const res = await recipesApi.search(q);
    const already = new Set(recipes.map((r) => r.recipe.id));
    setSuggestions((res.data.results ?? []).filter((r) => !already.has(r.id)));
    setShowSuggestions(true);
  };

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const addRecipe = (recipe: Recipe) => {
    setRecipes((prev) => [...prev, { recipe, targetServings: recipe.servings }]);
    setSearchInput("");
    setShowSuggestions(false);
  };

  const { mutate: createMeal, isPending } = useMutation({
    mutationFn: async () => {
      const meal = (
        await plannerApi.createMeal({
          name: name.trim() || undefined,
          planned_date: plannedDate || null,
          notes: notes.trim(),
          is_template: isTemplate,
        })
      ).data;

      for (const row of recipes) {
        await plannerApi.addRecipe(
          meal.id,
          row.recipe.id,
          row.targetServings ? Number(row.targetServings) : null
        );
      }

      return meal;
    },
    onSuccess: (meal: PlannedMeal) => {
      queryClient.invalidateQueries({ queryKey: ["planner-meals"] });
      navigate(`/planner/${meal.id}`);
    },
    onError: () => setError("Something went wrong. Please try again."),
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Meal Plan</h1>

      <div className="space-y-6">
        {/* Basic info */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-gray-400 font-normal">(optional — defaults to recipe titles)</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunday Roast"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned Date</label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTemplate}
                  onChange={(e) => setIsTemplate(e.target.checked)}
                  className="w-4 h-4 accent-green-600"
                />
                <span className="text-sm text-gray-700">Save as template</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes about this meal…"
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Recipes */}
        <div className="bg-white border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Recipes</h2>

          {/* Added recipes */}
          {recipes.length > 0 && (
            <div className="space-y-2 mb-4">
              {recipes.map((row, idx) => (
                <div key={row.recipe.id} className="flex items-center gap-3 border rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-800 flex-1 line-clamp-1">{row.recipe.title}</span>
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    Servings
                    <input
                      type="number"
                      min={1}
                      value={row.targetServings}
                      onChange={(e) => {
                        const next = [...recipes];
                        next[idx] = { ...row, targetServings: e.target.value ? Number(e.target.value) : "" };
                        setRecipes(next);
                      }}
                      className="w-14 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setRecipes(recipes.filter((_, i) => i !== idx))}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* Recipe search */}
          <div className="relative">
            <input
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => searchInput && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search recipes to add…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-0.5 py-1 max-h-48 overflow-y-auto">
                {suggestions.map((r) => (
                  <li
                    key={r.id}
                    onMouseDown={() => addRecipe(r)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-green-50 cursor-pointer"
                  >
                    {(r.cover_image || r.cover_image_url) && (
                      <img
                        src={r.cover_image || r.cover_image_url!}
                        className="w-7 h-7 rounded object-cover flex-shrink-0"
                        alt=""
                      />
                    )}
                    <span className="text-sm text-gray-700">{r.title}</span>
                    <span className="text-xs text-gray-400 ml-auto">{r.servings} srv</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Actions */}
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => createMeal()}
            className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : "Save Meal Plan"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/planner")}
            className="px-4 py-2.5 border text-gray-500 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
