interface TabRecipe {
  id: number;
  title: string;
  currentStep: number;
  totalSteps: number;
  completed: boolean;
}

interface Props {
  recipes: TabRecipe[];
  activeId: number;
  onSelect: (id: number) => void;
}

export default function RecipeTabBar({ recipes, activeId, onSelect }: Props) {
  return (
    <div className="bg-white border-b overflow-x-auto flex-shrink-0">
      <div className="flex min-w-max">
        {recipes.map((recipe, idx) => {
          const isActive = recipe.id === activeId;
          const progressPct =
            recipe.totalSteps > 0
              ? ((recipe.currentStep + (recipe.completed ? 1 : 0)) /
                  recipe.totalSteps) *
                100
              : 0;

          return (
            <button
              key={recipe.id}
              onClick={() => onSelect(recipe.id)}
              className={`relative flex flex-col items-start px-4 pt-3 pb-2.5 min-w-36 max-w-52 text-left transition-colors focus:outline-none ${
                isActive
                  ? "bg-green-50 text-green-800"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {/* Keyboard hint number */}
              <span className="text-xs text-gray-300 mb-0.5 tabular-nums">
                {idx + 1}
              </span>

              {/* Title */}
              <span className="text-sm font-medium line-clamp-1 mb-1.5 pr-2">
                {recipe.completed ? "✓ " : ""}
                {recipe.title}
              </span>

              {/* Step count */}
              <span className="text-xs text-gray-400">
                {recipe.completed
                  ? "Done"
                  : recipe.totalSteps > 0
                  ? `Step ${recipe.currentStep + 1} / ${recipe.totalSteps}`
                  : "No steps"}
              </span>

              {/* Progress bar at bottom of tab */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-100">
                <div
                  className={`h-full transition-all duration-300 ${
                    recipe.completed ? "bg-green-500" : "bg-green-400"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
