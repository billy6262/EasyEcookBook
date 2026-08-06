import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DISH_TYPE_LABELS,
  eventsApi,
  type EventDetail,
  type EventDish,
  type EventIngredient,
  type IngredientRequest,
} from "../../api/events";
import { formatQuantity } from "../../utils/quantity";

const DISH_TYPE_COLOURS: Record<string, string> = {
  linked_recipe: "bg-green-100 text-green-700",
  custom: "bg-blue-100 text-blue-700",
  open_request: "bg-amber-100 text-amber-700",
};

interface Props {
  event: EventDetail;
  dish: EventDish;
  canSaveRecipe: boolean;
}

export default function DishCard({ event, dish, canSaveRecipe }: Props) {
  const queryClient = useQueryClient();
  const eventId = event.id;
  const myId = event.my_participant_id;
  const canManage = event.is_coordinator; // coordinator can always delete; adder handled server-side
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["event", eventId] });

  const [fulfillOpen, setFulfillOpen] = useState(false);

  const { mutate: claim } = useMutation({
    mutationFn: (ingId: number) => eventsApi.claimIngredient(eventId, ingId),
    onSuccess: invalidate,
  });
  const { mutate: unclaim } = useMutation({
    mutationFn: (ingId: number) => eventsApi.unclaimIngredient(eventId, ingId),
    onSuccess: invalidate,
  });
  const { mutate: deleteDish } = useMutation({
    mutationFn: () => eventsApi.deleteDish(eventId, dish.id),
    onSuccess: invalidate,
  });
  const { mutate: saveAsRecipe, isPending: savingRecipe } = useMutation({
    mutationFn: (fulfillmentId: number) => eventsApi.saveFulfillmentAsRecipe(eventId, fulfillmentId),
    onSuccess: () => invalidate(),
  });

  function IngredientRow({ ing }: { ing: EventIngredient }) {
    const amount = [formatQuantity(ing.quantity), ing.unit].filter(Boolean).join(" ");
    const mine = ing.claimed_by != null && ing.claimed_by === myId;
    return (
      <li className="flex items-center gap-2 py-1.5 text-sm">
        <span className="flex-1 text-gray-700">
          {amount && <span className="text-gray-400 mr-1.5">{amount}</span>}
          {ing.ingredient_name}
        </span>
        {ing.claimed_by != null ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="text-green-600">✓ {ing.claimed_by_name}</span>
            {mine && (
              <button
                onClick={() => unclaim(ing.id)}
                className="text-gray-300 hover:text-red-400 underline"
              >
                unclaim
              </button>
            )}
          </span>
        ) : myId ? (
          <button
            onClick={() => claim(ing.id)}
            className="text-xs px-2 py-0.5 border border-gray-200 rounded-full text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
          >
            I'll bring this
          </button>
        ) : (
          <span className="text-xs text-gray-300">unclaimed</span>
        )}
      </li>
    );
  }

  return (
    <div className="border rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{dish.display_name || "Untitled dish"}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${DISH_TYPE_COLOURS[dish.dish_type]}`}>
              {DISH_TYPE_LABELS[dish.dish_type]}
            </span>
          </div>
          {dish.dish_type === "open_request" && dish.request_description && (
            <p className="text-sm text-gray-500 mt-1">{dish.request_description}</p>
          )}
          {dish.notes && <p className="text-xs text-gray-400 mt-1 italic">{dish.notes}</p>}
        </div>
        {canManage && (
          <button
            onClick={() => window.confirm("Remove this dish?") && deleteDish()}
            className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0"
            aria-label="Remove dish"
            title="Remove dish"
          >
            ×
          </button>
        )}
      </div>

      {/* Ingredients for recipe / custom dishes */}
      {dish.dish_type !== "open_request" && dish.ingredients.length > 0 && (
        <ul className="divide-y border-t mt-2">
          {dish.ingredients.map((ing) => (
            <IngredientRow key={ing.id} ing={ing} />
          ))}
        </ul>
      )}

      {/* Open request: fulfillments */}
      {dish.dish_type === "open_request" && (
        <div className="mt-2">
          {dish.fulfillments.length > 0 && (
            <div className="space-y-3">
              {dish.fulfillments.map((f) => (
                <div key={f.id} className="border-t pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{f.custom_name}</span>{" "}
                      <span className="text-gray-400">— {f.fulfilled_by_name}</span>
                    </p>
                    {canSaveRecipe && f.ingredients.length > 0 && (
                      <button
                        onClick={() => saveAsRecipe(f.id)}
                        disabled={savingRecipe}
                        className="text-xs text-green-600 hover:underline disabled:opacity-50 flex-shrink-0"
                      >
                        Save as recipe
                      </button>
                    )}
                  </div>
                  {f.notes && <p className="text-xs text-gray-400 italic">{f.notes}</p>}
                  {f.ingredients.length > 0 && (
                    <ul className="divide-y mt-1">
                      {f.ingredients.map((ing) => (
                        <IngredientRow key={ing.id} ing={ing} />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Fulfil button */}
          {myId && !dish.is_fulfilled && (
            <button
              onClick={() => setFulfillOpen(true)}
              className="mt-3 text-sm px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg font-medium hover:bg-amber-50 transition-colors"
            >
              🙋 I'll bring this
            </button>
          )}
          {dish.is_fulfilled && dish.fulfillments.length > 0 && !dish.allow_multiple_fulfillments && (
            <p className="mt-2 text-xs text-green-600">✓ Covered</p>
          )}
        </div>
      )}

      {fulfillOpen && (
        <FulfillDishModal
          eventId={eventId}
          dishId={dish.id}
          onClose={() => setFulfillOpen(false)}
          onDone={() => {
            setFulfillOpen(false);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

// ── Fulfil modal ──────────────────────────────────────────────────────────────

function FulfillDishModal({
  eventId,
  dishId,
  onClose,
  onDone,
}: {
  eventId: number;
  dishId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [customName, setCustomName] = useState("");
  const [rows, setRows] = useState<IngredientRequest[]>([{ name: "", quantity: "", unit: "" }]);
  const [error, setError] = useState<string | null>(null);

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () =>
      eventsApi.fulfillDish(eventId, dishId, {
        custom_name: customName.trim(),
        ingredient_requests: rows
          .filter((r) => r.name.trim())
          .map((r) => ({
            name: r.name.trim(),
            quantity: r.quantity?.toString().trim() || null,
            unit: r.unit?.trim() || "",
          })),
      }),
    onSuccess: onDone,
    onError: () => setError("Couldn't submit. Please try again."),
  });

  const setRow = (i: number, patch: Partial<IngredientRequest>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900 mb-3">What are you bringing?</h3>
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Dish name (e.g. Garlic mashed potatoes)"
          autoFocus
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
        />

        <p className="text-xs font-medium text-gray-500 mb-1.5">Ingredients (optional)</p>
        <div className="space-y-2 mb-3">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={r.quantity ?? ""}
                onChange={(e) => setRow(i, { quantity: e.target.value })}
                placeholder="Qty"
                className="w-14 border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                value={r.unit ?? ""}
                onChange={(e) => setRow(i, { unit: e.target.value })}
                placeholder="Unit"
                className="w-20 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                value={r.name}
                onChange={(e) => setRow(i, { name: e.target.value })}
                placeholder="Ingredient"
                className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          ))}
        </div>
        <button
          onClick={() => setRows((rs) => [...rs, { name: "", quantity: "", unit: "" }])}
          className="text-xs text-green-600 hover:underline mb-4"
        >
          + Add ingredient
        </button>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => (customName.trim() ? submit() : setError("Please name your dish."))}
            disabled={isPending}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Sign up"}
          </button>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm text-gray-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
