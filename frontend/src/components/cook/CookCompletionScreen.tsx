import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { plannerApi } from "../../api/planner";

interface Props {
  recipes: { id: number; title: string }[];
  onKeepCooking: () => void;
  /** When cooking was launched from a meal, allow saving a cook log. */
  mealId?: number | null;
}

export default function CookCompletionScreen({ recipes, onKeepCooking, mealId }: Props) {
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const { mutate: saveLog, isPending } = useMutation({
    mutationFn: () => plannerApi.createCookingLog(mealId as number, notes.trim()),
    onSuccess: () => setSaved(true),
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="text-7xl mb-6 select-none">🍽️</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">All done!</h2>
      <p className="text-gray-500 mb-3 max-w-sm">
        {recipes.length === 1
          ? `${recipes[0].title} is ready to serve.`
          : `All ${recipes.length} dishes are ready to serve.`}
      </p>

      {/* Completed recipe list */}
      {recipes.length > 1 && (
        <ul className="mb-6 space-y-1">
          {recipes.map((r) => (
            <li key={r.id} className="text-sm text-gray-400">
              ✓ {r.title}
            </li>
          ))}
        </ul>
      )}

      {/* Save to cook log — only when launched from a meal */}
      {mealId ? (
        saved ? (
          <div className="mb-6 flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
            <span>✓</span> Saved to this meal's cook log
          </div>
        ) : (
          <div className="w-full max-w-sm mb-6 text-left">
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Add a note to your cook log{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it turn out? Any tweaks for next time?"
              rows={3}
              className="w-full border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
            />
            <button
              onClick={() => saveLog()}
              disabled={isPending}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
            >
              {isPending ? "Saving…" : "📖 Save to cook log"}
            </button>
          </div>
        )
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <button
          onClick={onKeepCooking}
          className="px-6 py-3 border border-gray-300 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
        >
          Review steps again
        </button>
        <Link
          to={mealId ? `/planner/${mealId}` : "/recipes"}
          className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors text-sm text-center"
        >
          {mealId ? "Back to meal" : "Back to recipes"}
        </Link>
      </div>
    </div>
  );
}
