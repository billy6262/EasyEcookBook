import { useRef, useState } from "react";
import { recipesApi, type Category, type RecipeFilters, type Tag } from "../../api/recipes";

interface Props {
  filters: RecipeFilters;
  categories: Category[];
  selectedFilterTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  onChange: (next: RecipeFilters) => void;
}

export default function RecipeFilters({
  filters,
  categories,
  selectedFilterTags,
  onTagsChange,
  onChange,
}: Props) {
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTagSuggestions = async (q: string) => {
    if (!q.trim()) {
      setTagSuggestions([]);
      setShowTagSuggestions(false);
      return;
    }
    try {
      const res = await recipesApi.searchTags(q);
      const results = (res.data.results ?? []).filter(
        (t) => !selectedFilterTags.find((s) => s.id === t.id)
      );
      setTagSuggestions(results);
      setShowTagSuggestions(true);
    } catch {
      // ignore
    }
  };

  const handleTagInput = (val: string) => {
    setTagInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchTagSuggestions(val), 250);
  };

  const addFilterTag = (tag: Tag) => {
    onTagsChange([...selectedFilterTags, tag]);
    setTagInput("");
    setShowTagSuggestions(false);
  };

  const removeFilterTag = (id: number) =>
    onTagsChange(selectedFilterTags.filter((t) => t.id !== id));

  const hasActiveFilters =
    filters.mine || filters.category || filters.search || selectedFilterTags.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Mine toggle */}
      <button
        onClick={() => onChange({ ...filters, mine: !filters.mine, page: 1 })}
        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
          filters.mine
            ? "bg-green-600 text-white border-green-600"
            : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
        }`}
      >
        My Recipes
      </button>

      {/* Category */}
      {categories.length > 0 && (
        <select
          value={filters.category ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              category: e.target.value ? Number(e.target.value) : undefined,
              page: 1,
            })
          }
          className="text-sm border border-gray-300 rounded-full pl-3 pr-8 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {/* Tag filter — selected pills */}
      {selectedFilterTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-sm rounded-full border border-green-200"
        >
          {tag.name}
          <button
            type="button"
            onClick={() => removeFilterTag(tag.id)}
            className="text-green-600 hover:text-green-900 leading-none"
          >
            ×
          </button>
        </span>
      ))}

      {/* Tag autocomplete input */}
      <div className="relative">
        <input
          value={tagInput}
          onChange={(e) => handleTagInput(e.target.value)}
          onFocus={() => tagInput && setShowTagSuggestions(true)}
          onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
          placeholder="Filter by tag…"
          className="text-sm border border-gray-300 rounded-full pl-3 pr-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 w-36"
        />
        {showTagSuggestions && tagSuggestions.length > 0 && (
          <ul className="absolute z-20 top-full left-0 bg-white border rounded-lg shadow-lg mt-0.5 py-1 min-w-40 max-h-44 overflow-y-auto">
            {tagSuggestions.map((tag) => (
              <li
                key={tag.id}
                onMouseDown={() => addFilterTag(tag)}
                className="px-3 py-1.5 text-sm text-gray-700 hover:bg-green-50 cursor-pointer whitespace-nowrap"
              >
                {tag.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sort */}
      <select
        value={filters.ordering ?? "-created_at"}
        onChange={(e) => onChange({ ...filters, ordering: e.target.value, page: 1 })}
        className="text-sm border border-gray-300 rounded-full pl-3 pr-8 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        <option value="-created_at">Newest first</option>
        <option value="created_at">Oldest first</option>
        <option value="title">Title A–Z</option>
        <option value="-title">Title Z–A</option>
      </select>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          onClick={() => {
            onChange({ ordering: "-created_at", page: 1 });
            onTagsChange([]);
          }}
          className="text-xs text-gray-400 hover:text-red-500 underline px-1"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
