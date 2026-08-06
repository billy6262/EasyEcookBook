import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { recipesApi, type RecipeFilters, type Tag } from "../../api/recipes";
import RecipeCard from "../../components/recipes/RecipeCard";
import RecipeCardSkeleton from "../../components/recipes/RecipeCardSkeleton";
import RecipeFiltersBar from "../../components/recipes/RecipeFilters";
import AddToMealButton from "../../components/planner/AddToMealButton";
import ImportRecipeModal from "../../components/recipes/ImportRecipeModal";

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function RecipesListPage() {
  const [filters, setFilters] = useState<RecipeFilters>({
    mine: true,
    ordering: "-created_at",
    page: 1,
  });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedFilterTags, setSelectedFilterTags] = useState<Tag[]>([]);
  const debouncedSearch = useDebounce(searchInput, 350);

  const activeFilters: RecipeFilters = {
    ...filters,
    search: debouncedSearch || undefined,
    tags: selectedFilterTags.length > 0 ? selectedFilterTags.map((t) => t.id) : undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["recipes", activeFilters],
    queryFn: () => recipesApi.list(activeFilters).then((r) => r.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => recipesApi.listCategories().then((r) => r.data.results ?? []),
    staleTime: Infinity,
  });

  const page = filters.page ?? 1;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Import from URL
          </button>
          <Link
            to="/recipes/new"
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            + New Recipe
          </Link>
        </div>
      </div>

      <ImportRecipeModal open={importModalOpen} onClose={() => setImportModalOpen(false)} />

      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="search"
          placeholder="Search recipes by title or description…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setFilters((f) => ({ ...f, page: 1 }));
          }}
          className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <RecipeFiltersBar
          filters={filters}
          categories={categories}
          selectedFilterTags={selectedFilterTags}
          onTagsChange={(tags) => {
            setSelectedFilterTags(tags);
            setFilters((f) => ({ ...f, page: 1 }));
          }}
          onChange={setFilters}
        />
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </div>
      ) : data?.results.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 mb-4">No recipes found.</p>
          <Link
            to="/recipes/new"
            className="text-green-600 hover:text-green-700 font-medium text-sm"
          >
            Create your first recipe →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data?.results.map((recipe) => (
              <div key={recipe.id} className="relative">
                <RecipeCard recipe={recipe} />
                <div className="absolute bottom-3 right-3">
                  <AddToMealButton recipeId={recipe.id} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(data?.next || data?.previous) && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                disabled={!data?.previous}
                onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}
                className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-400">Page {page}</span>
              <button
                disabled={!data?.next}
                onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}
                className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
