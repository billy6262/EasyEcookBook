import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recipesApi } from "../../api/recipes";
import { useAuth } from "../../contexts/AuthContext";
import IngredientListDisplay from "../../components/recipes/IngredientListDisplay";
import StepListDisplay from "../../components/recipes/StepListDisplay";
import CommentsSection from "../../components/recipes/CommentsSection";
import AccompanimentsSection from "../../components/recipes/AccompanimentsSection";

function formatTime(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const recipeId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: recipe, isLoading, error } = useQuery({
    queryKey: ["recipe", recipeId],
    queryFn: () => recipesApi.get(recipeId).then((r) => r.data),
    enabled: !!recipeId && !Number.isNaN(recipeId),
  });

  const { mutate: fork, isPending: isForking } = useMutation({
    mutationFn: () => recipesApi.fork(recipeId),
    onSuccess: (res) => navigate(`/recipes/${res.data.id}/edit`),
  });

  const { mutate: deleteRecipe, isPending: isDeleting } = useMutation({
    mutationFn: () => recipesApi.delete(recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      navigate("/recipes");
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-4">
        <div className="h-64 bg-gray-200 rounded-xl" />
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-1/4" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-4">Recipe not found.</p>
        <Link to="/recipes" className="text-green-600 hover:underline text-sm">
          ← Back to recipes
        </Link>
      </div>
    );
  }

  const isOwner = user?.pk === recipe.created_by.id;
  const imageSrc = recipe.cover_image || recipe.cover_image_url;
  const authorName = recipe.created_by.first_name || recipe.created_by.email.split("@")[0];

  return (
    <article className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link to="/recipes" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-4">
        ← Recipes
      </Link>

      {/* Hero image */}
      {imageSrc && (
        <div className="aspect-video w-full overflow-hidden rounded-xl mb-6 bg-gray-100">
          <img src={imageSrc} alt={recipe.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Title + meta */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">{recipe.title}</h1>
          {recipe.visibility === "private" && (
            <span className="flex-shrink-0 px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full mt-1">
              Private
            </span>
          )}
        </div>

        {recipe.forked_from && (
          <p className="text-sm text-gray-400 mb-3">
            Forked from{" "}
            <Link to={`/recipes/${recipe.forked_from}`} className="text-green-600 hover:underline">
              original recipe
            </Link>
          </p>
        )}

        {recipe.description && (
          <p className="text-gray-600 mb-4 leading-relaxed">{recipe.description}</p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          {recipe.servings > 0 && <span>🍽 {recipe.servings} servings</span>}
          {recipe.prep_time != null && <span>⏱ Prep: {formatTime(recipe.prep_time)}</span>}
          {recipe.cook_time != null && <span>🔥 Cook: {formatTime(recipe.cook_time)}</span>}
          {recipe.fork_count > 0 && <span>🔖 {recipe.fork_count} forks</span>}
          <span className="text-gray-400">by {authorName}</span>
        </div>

        {/* Category + Tags */}
        {(recipe.category || (recipe.tags && recipe.tags.length > 0)) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {recipe.category && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full border border-gray-200">
                {recipe.category.name}
              </span>
            )}
            {recipe.tags?.map((t) => (
              <span
                key={t.id}
                className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full border border-green-200"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 mb-8 pb-6 border-b">
        {isOwner ? (
          <>
            <Link
              to={`/recipes/${recipeId}/edit`}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Edit
            </Link>
            <button
              onClick={() => {
                if (window.confirm("Delete this recipe? This cannot be undone.")) {
                  deleteRecipe();
                }
              }}
              disabled={isDeleting}
              className="px-4 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </>
        ) : (
          <button
            onClick={() => fork()}
            disabled={isForking}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isForking ? "Forking…" : "🔖 Fork this recipe"}
          </button>
        )}
      </div>

      {/* Ingredients + Steps — two-column on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 mb-10">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Ingredients{recipe.ingredients?.length ? ` (${recipe.ingredients.length})` : ""}
          </h2>
          <IngredientListDisplay ingredients={recipe.ingredients ?? []} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Steps</h2>
          <StepListDisplay steps={recipe.steps ?? []} />
        </div>
      </div>

      {/* Comments */}
      <div className="border-t pt-8 space-y-10">
        <AccompanimentsSection recipeId={recipeId} isOwner={isOwner} />
        <CommentsSection recipeId={recipeId} />
      </div>
    </article>
  );
}
