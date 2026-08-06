import React, { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { plannerApi, STATUS_NEXT_LABEL } from "../../api/planner";
import { recipesApi, type Recipe } from "../../api/recipes";
import StatusBadge from "../../components/planner/StatusBadge";

export default function MealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const mealId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [cookNotesOpen, setCookNotesOpen] = useState(false);
  const [cookNotes, setCookNotes] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [customName, setCustomName] = useState("");
  const [customQty, setCustomQty] = useState("");
  const [customUnit, setCustomUnit] = useState("");

  // Cook-log management
  const [addingLogOpen, setAddingLogOpen] = useState(false);
  const [newLogNotes, setNewLogNotes] = useState("");
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editingLogNotes, setEditingLogNotes] = useState("");

  const { data: meal, isLoading } = useQuery({
    queryKey: ["planner-meal", mealId],
    queryFn: () => plannerApi.getMeal(mealId).then((r) => r.data),
    enabled: !!mealId,
  });

  const { data: shoppingItems = [] } = useQuery({
    queryKey: ["planner-shopping", mealId],
    queryFn: () =>
      plannerApi.getShoppingItems().then((r) =>
        r.data.filter((i) => i.planned_meal === mealId)
      ),
    enabled: !!mealId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["planner-meal", mealId] });
    queryClient.invalidateQueries({ queryKey: ["planner-meals"] });
  };

  const { mutate: removeRecipe } = useMutation({
    mutationFn: (recipeId: number) => plannerApi.removeRecipe(mealId, recipeId),
    onSuccess: invalidate,
  });

  const { mutate: addRecipe } = useMutation({
    mutationFn: (r: Recipe) => plannerApi.addRecipe(mealId, r.id, r.servings),
    onSuccess: () => { invalidate(); setSearchInput(""); setShowSuggestions(false); },
  });

  const { mutate: updateServings } = useMutation({
    mutationFn: ({ recipeId, servings }: { recipeId: number; servings: number }) =>
      plannerApi.addRecipe(mealId, recipeId, servings),
    onSuccess: invalidate,
  });

  const { mutate: generateList, isPending: generatingList } = useMutation({
    mutationFn: () => plannerApi.generateShoppingList(mealId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner-shopping", mealId] }),
  });

  const { mutate: advance, isPending: advancing } = useMutation({
    mutationFn: () => plannerApi.advanceStatus(mealId, cookNotes),
    onSuccess: () => { invalidate(); setCookNotesOpen(false); setCookNotes(""); },
  });

  const { mutate: deleteMeal } = useMutation({
    mutationFn: () => plannerApi.deleteMeal(mealId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["planner-meals"] }); navigate("/planner"); },
  });

  const { mutate: saveAsTemplate, isPending: savingTemplate } = useMutation({
    mutationFn: () => plannerApi.saveAsTemplate(mealId),
    onSuccess: invalidate,
  });

  const { mutate: addCookingLog, isPending: addingLog } = useMutation({
    mutationFn: () => plannerApi.createCookingLog(mealId, newLogNotes.trim()),
    onSuccess: () => { invalidate(); setAddingLogOpen(false); setNewLogNotes(""); },
  });

  const { mutate: saveLogEdit } = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      plannerApi.updateCookingLog(id, notes.trim()),
    onSuccess: () => { invalidate(); setEditingLogId(null); setEditingLogNotes(""); },
  });

  const { mutate: deleteCookingLog } = useMutation({
    mutationFn: (logId: number) => plannerApi.deleteCookingLog(logId),
    onSuccess: invalidate,
  });

  const { mutate: toggleItem } = useMutation({
    mutationFn: ({ id, checked }: { id: number; checked: boolean }) =>
      plannerApi.updateShoppingItem(id, { is_checked: checked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner-shopping", mealId] }),
  });

  const { mutate: addCustomItem, isPending: addingItem } = useMutation({
    mutationFn: () =>
      plannerApi.createShoppingItem({
        ingredient_name: customName.trim(),
        quantity: customQty.trim() || null,
        unit: customUnit.trim(),
        planned_meal: mealId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-shopping", mealId] });
      setCustomName("");
      setCustomQty("");
      setCustomUnit("");
    },
  });

  const { mutate: removeItem } = useMutation({
    mutationFn: (itemId: number) => plannerApi.deleteShoppingItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner-shopping", mealId] }),
  });

  const fetchSuggestions = async (q: string) => {
    if (!q.trim()) { setSuggestions([]); setShowSuggestions(false); setIsSearching(false); return; }
    setIsSearching(true);
    setShowSuggestions(true);
    try {
      const already = new Set((meal?.meal_recipes ?? []).map((mr) => mr.recipe.id));
      const res = await recipesApi.search(q);
      setSuggestions((res.data.results ?? []).filter((r) => !already.has(r.id)));
      setActiveIndex(-1);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    searchInputRef.current?.focus();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      if (target) addRecipe(target);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  if (isLoading || !meal) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="h-40 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const nextLabel = STATUS_NEXT_LABEL[meal.status];
  const recipeIds = (meal.meal_recipes ?? []).map((mr) => mr.recipe.id).join(",");
  const checkedCount = shoppingItems.filter((i) => i.is_checked).length;

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/planner" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← Meal Planner
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{meal.display_name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={meal.status} />
            {meal.planned_date && (
              <span className="text-sm text-gray-400">
                📅 {new Date(meal.planned_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
            )}
            {meal.is_template && (
              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Template</span>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {recipeIds && (
            <Link
              to={`/cook?recipes=${recipeIds}&meal=${mealId}`}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              🍳 Cook
            </Link>
          )}
          {nextLabel && (
            <button
              onClick={() =>
                meal.status === "shopped"
                  ? setCookNotesOpen(true)
                  : advance()
              }
              disabled={advancing}
              className="px-3 py-2 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 disabled:opacity-50 transition-colors"
            >
              {advancing ? "…" : nextLabel}
            </button>
          )}
        </div>
      </div>

      {/* Cook notes modal for mark-as-cooked */}
      {cookNotesOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Mark as Cooked</h3>
            <textarea
              value={cookNotes}
              onChange={(e) => setCookNotes(e.target.value)}
              placeholder="Any notes about this cook? (optional)"
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => advance()}
                disabled={advancing}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {advancing ? "Saving…" : "Mark as Cooked"}
              </button>
              <button onClick={() => setCookNotesOpen(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-500">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipes */}
      <section className="bg-white border rounded-xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Recipes</h2>

        {(meal.meal_recipes ?? []).length === 0 ? (
          <p className="text-gray-400 text-sm italic">No recipes added yet.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {(meal.meal_recipes ?? []).map((mr) => {
              const img = mr.recipe.cover_image || mr.recipe.cover_image_url;
              return (
                <div key={mr.id} className="flex items-center gap-3 border rounded-lg px-3 py-2.5 group">
                  {img && (
                    <img src={img} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
                  )}
                  <Link
                    to={`/recipes/${mr.recipe.id}`}
                    className="flex-1 text-sm text-gray-800 hover:text-green-600 line-clamp-1"
                  >
                    {mr.recipe.title}
                  </Link>
                  {/* Serving size stepper */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => updateServings({
                        recipeId: mr.recipe.id,
                        servings: Math.max(1, (mr.target_servings ?? mr.recipe.servings) - 1),
                      })}
                      className="w-5 h-5 rounded border border-gray-200 text-gray-400 hover:border-green-400 hover:text-green-600 text-sm leading-none flex items-center justify-center transition-colors"
                      aria-label="Decrease servings"
                    >−</button>
                    <span className="text-xs text-gray-600 w-6 text-center tabular-nums">
                      {mr.target_servings ?? mr.recipe.servings}
                    </span>
                    <button
                      onClick={() => updateServings({
                        recipeId: mr.recipe.id,
                        servings: (mr.target_servings ?? mr.recipe.servings) + 1,
                      })}
                      className="w-5 h-5 rounded border border-gray-200 text-gray-400 hover:border-green-400 hover:text-green-600 text-sm leading-none flex items-center justify-center transition-colors"
                      aria-label="Increase servings"
                    >+</button>
                    <span className="text-xs text-gray-400 ml-0.5">srv</span>
                  </div>
                  <button
                    onClick={() => removeRecipe(mr.recipe.id)}
                    className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-lg leading-none"
                  >×</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add recipe search */}
        <div className="relative">
          <div className="relative flex items-center">
            <input
              ref={searchInputRef}
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                if (!e.target.value.trim()) { clearSearch(); return; }
                debounceRef.current = setTimeout(() => fetchSuggestions(e.target.value), 200);
              }}
              onFocus={() => { if (searchInput.trim()) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => { setShowSuggestions(false); setActiveIndex(-1); }, 150)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search recipes to add…"
              autoComplete="off"
              className="w-full border rounded-lg pl-3 pr-16 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {isSearching && (
                <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {searchInput && !isSearching && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); clearSearch(); }}
                  className="text-gray-300 hover:text-gray-500 leading-none text-lg"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          {showSuggestions && (suggestions.length > 0 || isSearching || searchInput.trim()) && (
            <ul className="absolute z-10 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-0.5 py-1 max-h-56 overflow-y-auto">
              {isSearching ? (
                <li className="px-3 py-2 text-sm text-gray-400 italic">Searching…</li>
              ) : suggestions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-400 italic">No recipes found for "{searchInput}"</li>
              ) : (
                suggestions.map((r, idx) => (
                  <li
                    key={r.id}
                    onMouseDown={() => addRecipe(r)}
                    className={`px-3 py-2 text-sm cursor-pointer line-clamp-1 transition-colors ${
                      idx === activeIndex ? "bg-green-50 text-green-700" : "text-gray-700 hover:bg-green-50"
                    }`}
                  >
                    {r.title}
                    {r.servings > 0 && <span className="ml-2 text-xs text-gray-400">{r.servings} srv</span>}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </section>

      {/* Shopping list */}
      <section className="bg-white border rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Shopping List
            {shoppingItems.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {checkedCount}/{shoppingItems.length} checked
              </span>
            )}
          </h2>
          <button
            onClick={() => generateList()}
            disabled={generatingList || (meal.meal_recipes ?? []).length === 0}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            {generatingList ? "Generating…" : "↺ Regenerate from recipes"}
          </button>
        </div>

        {shoppingItems.length === 0 ? (
          <p className="text-gray-400 text-sm italic">
            No items yet. Click "Regenerate from recipes" to auto-populate, or add custom items below.
          </p>
        ) : (
          <ul className="divide-y">
            {shoppingItems.map((item) => {
              const qty = item.quantity ? String(parseFloat(item.quantity)) : "";
              const amount = [qty, item.unit].filter(Boolean).join(" ");
              return (
                <li key={item.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => toggleItem({ id: item.id, checked: !item.is_checked })}
                    className="flex-1 flex items-center gap-3 py-2.5 text-left hover:bg-gray-50 transition-colors rounded px-1"
                  >
                    <span className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${item.is_checked ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                      {item.is_checked ? "✓" : ""}
                    </span>
                    <span className={`text-sm flex-1 ${item.is_checked ? "line-through text-gray-300" : "text-gray-800"}`}>
                      {amount && <span className="text-gray-400 mr-1.5">{amount}</span>}
                      {item.ingredient_name}
                    </span>
                    {!item.is_auto_generated && (
                      <span className="text-xs bg-blue-50 text-blue-500 border border-blue-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        custom
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition text-lg leading-none flex-shrink-0 pr-1"
                    aria-label="Remove item"
                  >×</button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Add custom item */}
        <form
          onSubmit={(e) => { e.preventDefault(); if (customName.trim()) addCustomItem(); }}
          className="flex items-center gap-2 mt-3 pt-3 border-t"
        >
          <input
            value={customQty}
            onChange={(e) => setCustomQty(e.target.value)}
            placeholder="Qty"
            className="w-14 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            value={customUnit}
            onChange={(e) => setCustomUnit(e.target.value)}
            placeholder="Unit"
            className="w-20 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Add a custom item…"
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={!customName.trim() || addingItem}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            {addingItem ? "…" : "+ Add"}
          </button>
        </form>
      </section>

      {/* Notes */}
      {meal.notes && (
        <section className="bg-white border rounded-xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{meal.notes}</p>
        </section>
      )}

      {/* Cook History */}
      <section className="bg-white border rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Cook History
            {(meal.cooked_count ?? 0) > 0 && (
              <span className="ml-2 text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                {meal.cooked_count}× cooked
              </span>
            )}
          </h2>
          {!addingLogOpen && (
            <button
              onClick={() => setAddingLogOpen(true)}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              + Log a cook
            </button>
          )}
        </div>

        {/* Add-log form */}
        {addingLogOpen && (
          <div className="mb-4 border rounded-lg p-3 bg-gray-50">
            <textarea
              value={newLogNotes}
              onChange={(e) => setNewLogNotes(e.target.value)}
              placeholder="Notes about this cook? (optional)"
              rows={2}
              autoFocus
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={() => addCookingLog()}
                disabled={addingLog}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {addingLog ? "Saving…" : "Save cook"}
              </button>
              <button
                onClick={() => { setAddingLogOpen(false); setNewLogNotes(""); }}
                className="px-3 py-1.5 border rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {(meal.cooking_logs ?? []).length === 0 ? (
          <p className="text-gray-400 text-sm italic">
            Not cooked yet. Log a cook to start your history.
          </p>
        ) : (
          <ol className="space-y-3">
            {(meal.cooking_logs ?? [])
              .slice()
              .sort((a, b) => new Date(b.cooked_at).getTime() - new Date(a.cooked_at).getTime())
              .map((log, i) => (
                <li key={log.id} className="flex gap-3 text-sm group">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-semibold">
                    {(meal.cooking_logs ?? []).length - i}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-400 text-xs mb-0.5">
                      {new Date(log.cooked_at).toLocaleDateString(undefined, {
                        weekday: "short", year: "numeric", month: "short", day: "numeric",
                      })}
                    </p>
                    {editingLogId === log.id ? (
                      <div className="mt-1">
                        <textarea
                          value={editingLogNotes}
                          onChange={(e) => setEditingLogNotes(e.target.value)}
                          rows={2}
                          autoFocus
                          className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveLogEdit({ id: log.id, notes: editingLogNotes })}
                            className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingLogId(null); setEditingLogNotes(""); }}
                            className="px-3 py-1 border rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : log.notes ? (
                      <p className="text-gray-700 whitespace-pre-wrap">{log.notes}</p>
                    ) : (
                      <p className="text-gray-300 italic">No notes</p>
                    )}
                  </div>
                  {editingLogId !== log.id && (
                    <div className="flex items-start gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => { setEditingLogId(log.id); setEditingLogNotes(log.notes); }}
                        className="text-gray-300 hover:text-gray-600 text-xs"
                        title="Edit notes"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => window.confirm("Delete this cook log?") && deleteCookingLog(log.id)}
                        className="text-gray-300 hover:text-red-400 text-lg leading-none"
                        title="Delete log"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </li>
              ))}
          </ol>
        )}
      </section>

      {/* Bottom actions */}
      <div className="flex items-center justify-end gap-2 mt-2">
        {!meal.is_template && !meal.source_template && (
          <button
            onClick={() => saveAsTemplate()}
            disabled={savingTemplate}
            className="px-4 py-2 border border-purple-200 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50 disabled:opacity-50 transition-colors"
            title="Save this meal as a reusable template"
          >
            {savingTemplate ? "Saving…" : "📋 Save as Template"}
          </button>
        )}
        <button
          onClick={() => window.confirm("Delete this meal plan?") && deleteMeal()}
          className="px-4 py-2 border border-red-200 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
        >
          Delete meal plan
        </button>
      </div>
    </div>
  );
}
