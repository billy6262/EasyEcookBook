import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi, type DishType, type EventDetail } from "../../api/events";
import { recipesApi, type Recipe } from "../../api/recipes";

interface Props {
  event: EventDetail;
}

export default function AddDishForm({ event }: Props) {
  const queryClient = useQueryClient();
  const eventId = event.id;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["event", eventId] });

  const [open, setOpen] = useState(false);
  const [dishType, setDishType] = useState<DishType>("custom");

  // custom / shared
  const [customName, setCustomName] = useState("");
  const [servings, setServings] = useState(4);
  const [notes, setNotes] = useState("");

  // open_request
  const [requestDescription, setRequestDescription] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(false);

  // linked_recipe search
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setDishType("custom");
    setCustomName("");
    setServings(4);
    setNotes("");
    setRequestDescription("");
    setAllowMultiple(false);
    setSearch("");
    setSuggestions([]);
    setSelectedRecipe(null);
    setError(null);
    setOpen(false);
  };

  const { mutate: add, isPending } = useMutation({
    mutationFn: () =>
      eventsApi.addDish(eventId, {
        dish_type: dishType,
        recipe_id: dishType === "linked_recipe" ? selectedRecipe?.id ?? null : null,
        custom_name: dishType === "custom" ? customName.trim() : "",
        request_description: dishType === "open_request" ? requestDescription.trim() : "",
        allow_multiple_fulfillments: dishType === "open_request" ? allowMultiple : false,
        servings,
        notes: notes.trim(),
      }),
    onSuccess: () => {
      invalidate();
      reset();
    },
    onError: () => setError("Couldn't add that dish. Please try again."),
  });

  const fetchSuggestions = async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const res = await recipesApi.search(q);
    setSuggestions(res.data.results ?? []);
    setShowSuggestions(true);
  };

  const canSubmit =
    dishType === "custom"
      ? customName.trim().length > 0
      : dishType === "open_request"
        ? requestDescription.trim().length > 0
        : selectedRecipe != null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-green-300 hover:text-green-600 transition-colors"
      >
        + Add a dish or request
      </button>
    );
  }

  return (
    <div className="border rounded-xl p-4 bg-gray-50">
      {/* Type selector */}
      <div className="flex gap-1 mb-4 text-sm">
        {(
          [
            ["custom", "Bring a dish"],
            ["linked_recipe", "From a recipe"],
            ["open_request", "Request a dish"],
          ] as [DishType, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setDishType(t)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              dishType === t ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {dishType === "custom" && (
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="What are you bringing?"
          autoFocus
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
        />
      )}

      {dishType === "open_request" && (
        <>
          <input
            value={requestDescription}
            onChange={(e) => setRequestDescription(e.target.value)}
            placeholder="What do you need someone to bring?"
            autoFocus
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
            />
            Allow multiple people to bring this
          </label>
        </>
      )}

      {dishType === "linked_recipe" && (
        <div className="relative mb-3">
          {selectedRecipe ? (
            <div className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm bg-white">
              <span className="flex-1 text-gray-800">{selectedRecipe.title}</span>
              <button
                onClick={() => setSelectedRecipe(null)}
                className="text-gray-300 hover:text-red-400 text-lg leading-none"
                aria-label="Clear recipe"
              >
                ×
              </button>
            </div>
          ) : (
            <>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  debounceRef.current = setTimeout(() => fetchSuggestions(e.target.value), 200);
                }}
                onFocus={() => search.trim() && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Search your recipes…"
                autoFocus
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-0.5 py-1 max-h-48 overflow-y-auto">
                  {suggestions.map((r) => (
                    <li
                      key={r.id}
                      onMouseDown={() => {
                        setSelectedRecipe(r);
                        setServings(r.servings || 4);
                        setShowSuggestions(false);
                      }}
                      className="px-3 py-2 text-sm text-gray-700 hover:bg-green-50 cursor-pointer line-clamp-1"
                    >
                      {r.title}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {/* servings for recipe/custom */}
      {dishType !== "open_request" && (
        <div className="flex items-center gap-2 mb-3">
          <label className="text-sm text-gray-500">Servings</label>
          <input
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
      />

      <div className="flex gap-2">
        <button
          onClick={() => { setError(null); add(); }}
          disabled={!canSubmit || isPending}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
        >
          {isPending ? "Adding…" : "Add"}
        </button>
        <button onClick={reset} className="px-4 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-100">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  );
}
