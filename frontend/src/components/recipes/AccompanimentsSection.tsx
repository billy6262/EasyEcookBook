import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recipesApi, type Recipe } from "../../api/recipes";

interface Props {
  recipeId: number;
  isOwner: boolean;
}

export default function AccompanimentsSection({ recipeId, isOwner }: Props) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: accompaniments = [] } = useQuery({
    queryKey: ["accompaniments", recipeId],
    queryFn: () => recipesApi.listAccompaniments(recipeId).then((r) => r.data),
  });

  const { mutate: addLink, isPending: isAdding } = useMutation({
    mutationFn: (linkedId: number) => recipesApi.addAccompaniment(recipeId, linkedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accompaniments", recipeId] });
      setSearchInput("");
      setShowSuggestions(false);
    },
  });

  const { mutate: removeLink } = useMutation({
    mutationFn: (linkedId: number) => recipesApi.removeAccompaniment(recipeId, linkedId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accompaniments", recipeId] }),
  });

  const fetchSuggestions = async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await recipesApi.search(q);
      const linkedIds = new Set([recipeId, ...accompaniments.map((a) => a.id)]);
      setSuggestions((res.data.results ?? []).filter((r) => !linkedIds.has(r.id)));
      setShowSuggestions(true);
    } catch {
      // ignore
    }
  };

  const handleInput = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  // Hide section entirely for non-owners when no accompaniments exist
  if (accompaniments.length === 0 && !isOwner) return null;

  return (
    <section>
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Goes well with
        {accompaniments.length > 0 && (
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({accompaniments.length})
          </span>
        )}
      </h3>

      {/* Linked recipe chips */}
      {accompaniments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {accompaniments.map((acc) => {
            const img = acc.cover_image || acc.cover_image_url;
            return (
              <div key={acc.id} className="relative group">
                <Link
                  to={`/recipes/${acc.id}`}
                  className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 hover:shadow-sm hover:border-green-300 transition-all"
                >
                  {img ? (
                    <img
                      src={img}
                      alt={acc.title}
                      className="w-8 h-8 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />
                  )}
                  <span className="text-sm text-gray-800">{acc.title}</span>
                </Link>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => removeLink(acc.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border rounded-full flex items-center justify-center shadow-sm text-gray-400 hover:text-red-500 hover:border-red-300 opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Owner: search input to link a recipe */}
      {isOwner && (
        <div className="relative">
          <input
            value={searchInput}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => searchInput && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            disabled={isAdding}
            placeholder="Search recipes to link…"
            className="w-full sm:w-80 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 top-full left-0 bg-white border rounded-lg shadow-lg mt-0.5 w-full sm:w-80 py-1 max-h-52 overflow-y-auto">
              {suggestions.map((r) => {
                const img = r.cover_image || r.cover_image_url;
                return (
                  <li
                    key={r.id}
                    onMouseDown={() => addLink(r.id)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-green-50 cursor-pointer"
                  >
                    {img ? (
                      <img src={img} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-gray-100 flex-shrink-0" />
                    )}
                    <span className="text-sm text-gray-700 line-clamp-1">{r.title}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {showSuggestions && suggestions.length === 0 && searchInput.trim() && (
            <div className="absolute top-full left-0 w-full sm:w-80 bg-white border rounded-lg shadow-sm mt-0.5 px-3 py-2 text-sm text-gray-400">
              No matching recipes found
            </div>
          )}
        </div>
      )}
    </section>
  );
}
