import { Link } from "react-router-dom";
import type { Recipe } from "../../api/recipes";

interface Props {
  recipe: Recipe;
}

export default function RecipeCard({ recipe }: Props) {
  const totalTime = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0);
  const imageSrc = recipe.cover_image || recipe.cover_image_url;
  const authorName =
    recipe.created_by.first_name || recipe.created_by.email.split("@")[0];

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="group bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow flex flex-col"
    >
      {/* Cover image */}
      <div className="aspect-video bg-gray-100 overflow-hidden flex-shrink-0">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors line-clamp-2 text-sm leading-snug">
            {recipe.title}
          </h3>
          {recipe.visibility === "private" && (
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          )}
        </div>

        {recipe.description && (
          <p className="text-gray-400 text-xs line-clamp-2 mb-3">{recipe.description}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-gray-400">
          {totalTime > 0 && <span>{totalTime} min</span>}
          {recipe.servings > 0 && <span>{recipe.servings} servings</span>}
          {recipe.fork_count > 0 && <span>{recipe.fork_count} forks</span>}
        </div>

        {/* Category + tags */}
        {(recipe.category || (recipe.tags && recipe.tags.length > 0)) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {recipe.category && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                {recipe.category.name}
              </span>
            )}
            {recipe.tags?.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full border border-green-100"
              >
                {t.name}
              </span>
            ))}
            {(recipe.tags?.length ?? 0) > 3 && (
              <span className="text-xs text-gray-400">
                +{(recipe.tags?.length ?? 0) - 3}
              </span>
            )}
          </div>
        )}

        <p className="text-xs text-gray-300 mt-2">{authorName}</p>
      </div>
    </Link>
  );
}
