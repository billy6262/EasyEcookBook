import type { RecipeIngredient } from "../../api/recipes";

interface Props {
  ingredients: RecipeIngredient[];
}

export default function IngredientListDisplay({ ingredients }: Props) {
  if (ingredients.length === 0) {
    return <p className="text-gray-400 text-sm italic">No ingredients listed.</p>;
  }

  return (
    <ul className="space-y-2">
      {ingredients.map((ing) => {
      const qty = ing.quantity ? String(parseFloat(ing.quantity)) : "";
        const amount = [qty, ing.unit].filter(Boolean).join(" ");
        return (
          <li key={ing.id} className="flex gap-3 text-sm">
            {amount && (
              <span className="text-gray-400 w-20 flex-shrink-0 text-right tabular-nums">
                {amount}
              </span>
            )}
            <span className={`text-gray-900 ${!amount ? "ml-23" : ""}`}>
              {ing.ingredient_name}
            </span>
            {ing.notes && (
              <span className="text-gray-400 italic text-xs self-center">
                ({ing.notes})
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
