import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { plannerApi, type ShoppingItem } from "../../api/planner";

type ViewMode = "grouped" | "flat";

interface MergedItem {
  key: string;
  ingredient_name: string;
  quantity: string;
  is_checked: boolean;
  ids: number[];
  sources: string[];
}

function mergeItems(items: ShoppingItem[]): MergedItem[] {
  const map = new Map<string, MergedItem>();
  for (const item of items) {
    const key = item.ingredient_name.toLowerCase().trim();
    const existing = map.get(key);
    const qty = item.quantity ? parseFloat(item.quantity) : null;
    if (existing) {
      if (qty !== null) {
        const prevQty = parseFloat(existing.quantity) || 0;
        existing.quantity = String(Math.round((prevQty + qty) * 1000) / 1000);
      }
      existing.ids.push(item.id);
      if (item.planned_meal_name && !existing.sources.includes(item.planned_meal_name)) {
        existing.sources.push(item.planned_meal_name);
      }
      if (!item.is_checked) existing.is_checked = false;
    } else {
      map.set(key, {
        key,
        ingredient_name: item.ingredient_name,
        quantity: item.quantity ? String(parseFloat(item.quantity)) : "",
        is_checked: item.is_checked,
        ids: [item.id],
        sources: item.planned_meal_name ? [item.planned_meal_name] : [],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.ingredient_name.localeCompare(b.ingredient_name)
  );
}

export default function ShoppingListPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [newItem, setNewItem] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["planner-shopping-global"],
    queryFn: () => plannerApi.getShoppingItems().then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["planner-shopping-global"] });

  const { mutate: toggleItem } = useMutation({
    mutationFn: ({ id, checked }: { id: number; checked: boolean }) =>
      plannerApi.updateShoppingItem(id, { is_checked: checked }),
    onSuccess: invalidate,
  });

  const { mutate: toggleMerged } = useMutation({
    mutationFn: ({ ids, checked }: { ids: number[]; checked: boolean }) =>
      plannerApi.bulkCheck(ids, checked),
    onSuccess: invalidate,
  });

  const { mutate: clearChecked, isPending: clearing } = useMutation({
    mutationFn: () => plannerApi.clearChecked(),
    onSuccess: invalidate,
  });

  const { mutate: addItem } = useMutation({
    mutationFn: (name: string) =>
      plannerApi.createShoppingItem({ ingredient_name: name }),
    onSuccess: () => { invalidate(); setNewItem(""); },
  });

  const checkedCount = items.filter((i) => i.is_checked).length;

  // Group by meal
  const groups = new Map<string, { mealId: number | null; name: string; items: ShoppingItem[] }>();
  for (const item of items) {
    const key = item.planned_meal ? String(item.planned_meal) : "manual";
    if (!groups.has(key)) {
      groups.set(key, {
        mealId: item.planned_meal,
        name: item.planned_meal_name ?? "Manual items",
        items: [],
      });
    }
    groups.get(key)!.items.push(item);
  }

  const mergedItems = mergeItems(items);

  function ItemRow({ item }: { item: ShoppingItem }) {
    const qty = item.quantity ? String(parseFloat(item.quantity)) : "";
    const amount = [qty, item.unit].filter(Boolean).join(" ");
    return (
      <li>
        <button
          onClick={() => toggleItem({ id: item.id, checked: !item.is_checked })}
          className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
        >
          <span className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${item.is_checked ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
            {item.is_checked ? "✓" : ""}
          </span>
          <span className={`text-sm ${item.is_checked ? "line-through text-gray-300" : "text-gray-800"}`}>
            {amount && <span className="text-gray-400 mr-1.5">{amount}</span>}
            {item.ingredient_name}
          </span>
        </button>
      </li>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/planner" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← Meal Planner
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shopping List</h1>
          {items.length > 0 && (
            <p className="text-sm text-gray-400 mt-0.5">
              {checkedCount}/{items.length} items checked
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border text-xs overflow-hidden">
            <button
              onClick={() => setViewMode("grouped")}
              className={`px-2.5 py-1.5 ${viewMode === "grouped" ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
            >
              Grouped
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={`px-2.5 py-1.5 ${viewMode === "flat" ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
            >
              Merged
            </button>
          </div>
          {checkedCount > 0 && (
            <button
              onClick={() => clearChecked()}
              disabled={clearing}
              className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {clearing ? "…" : "Clear checked"}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border rounded-xl">
          <p className="text-gray-400 mb-3">Your shopping list is empty.</p>
          <Link to="/planner/new" className="text-green-600 text-sm hover:underline">
            Plan a meal to auto-populate it →
          </Link>
        </div>
      ) : viewMode === "grouped" ? (
        /* ── Grouped view ──────────────────────────────────────────── */
        <div className="space-y-4">
          {Array.from(groups.values()).map((group) => (
            <div key={group.name} className="bg-white border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b">
                <span className="text-sm font-medium text-gray-700">{group.name}</span>
                {group.mealId && (
                  <Link
                    to={`/planner/${group.mealId}`}
                    className="text-xs text-green-600 hover:underline"
                  >
                    View meal →
                  </Link>
                )}
              </div>
              <ul className="px-4 divide-y">
                {group.items.map((item) => <ItemRow key={item.id} item={item} />)}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        /* ── Flat merged view ──────────────────────────────────────── */
        <div className="bg-white border rounded-xl overflow-hidden">
          <ul className="px-4 divide-y">
            {mergedItems.map((merged) => (
              <li key={merged.key}>
                <button
                  onClick={() => toggleMerged({ ids: merged.ids, checked: !merged.is_checked })}
                  className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${merged.is_checked ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                    {merged.is_checked ? "✓" : ""}
                  </span>
                  <span className={`text-sm flex-1 ${merged.is_checked ? "line-through text-gray-300" : "text-gray-800"}`}>
                    {merged.quantity && <span className="text-gray-400 mr-1.5">{merged.quantity}</span>}
                    {merged.ingredient_name}
                  </span>
                  {merged.sources.length > 0 && (
                    <span className="text-xs text-gray-300">{merged.sources.join(", ")}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Manual add */}
      <div className="mt-4 flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && newItem.trim() && addItem(newItem.trim())}
          placeholder="Add item manually…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={() => newItem.trim() && addItem(newItem.trim())}
          disabled={!newItem.trim()}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
