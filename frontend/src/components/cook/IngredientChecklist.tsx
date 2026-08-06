import { useState } from "react";
import type { RecipeIngredient } from "../../api/recipes";

interface Props {
  ingredients: RecipeIngredient[];
  checkedIndices: number[];
  onToggle: (idx: number) => void;
}

export default function IngredientChecklist({
  ingredients,
  checkedIndices,
  onToggle,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (ingredients.length === 0) return null;

  const checkedCount = checkedIndices.length;

  return (
    <div className="mt-4 border rounded-xl overflow-hidden flex-shrink-0">
      {/* Header / toggle */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Ingredients</span>
          {/* Progress pill */}
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              checkedCount === ingredients.length && ingredients.length > 0
                ? "bg-green-100 text-green-700"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {checkedCount} / {ingredients.length}
          </span>
        </div>
        <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
      </button>

      {/* Ingredient list */}
      {isOpen && (
        <ul className="divide-y divide-gray-50">
          {ingredients.map((ing, idx) => {
            const isChecked = checkedIndices.includes(idx);
            const qty = ing.quantity ? String(parseFloat(ing.quantity)) : "";
            const amount = [qty, ing.unit].filter(Boolean).join(" ");

            return (
              <li key={ing.id}>
                <button
                  onClick={() => onToggle(idx)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                >
                  {/* Checkbox */}
                  <span
                    className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${
                      isChecked
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-gray-300"
                    }`}
                  >
                    {isChecked ? "✓" : ""}
                  </span>

                  {/* Label */}
                  <span
                    className={`text-sm transition-colors ${
                      isChecked
                        ? "line-through text-gray-300"
                        : "text-gray-800"
                    }`}
                  >
                    {amount && (
                      <span className="text-gray-400 mr-1.5">{amount}</span>
                    )}
                    {ing.ingredient_name}
                    {ing.notes && (
                      <span className="text-gray-400 ml-1 text-xs">
                        ({ing.notes})
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
