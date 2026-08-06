import { useCallback, useState } from "react";

const SESSION_KEY = "easyecookbook_cook_session";

export interface RecipeProgress {
  currentStep: number;
  checkedIngredients: number[]; // indices of checked ingredients
  completed: boolean;
}

type CookSession = Record<number, RecipeProgress>;

function defaultProgress(): RecipeProgress {
  return { currentStep: 0, checkedIngredients: [], completed: false };
}

function load(): CookSession {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(session: CookSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore quota errors
  }
}

/**
 * Manages per-recipe cook progress in sessionStorage.
 * State survives page refreshes but is cleared when the browser tab is closed.
 */
export function useCookSession(recipeIds: number[]) {
  const [session, setSession] = useState<CookSession>(() => {
    const stored = load();
    const init: CookSession = {};
    recipeIds.forEach((id) => {
      init[id] = stored[id] ?? defaultProgress();
    });
    return init;
  });

  const update = useCallback(
    (recipeId: number, updater: (prev: RecipeProgress) => RecipeProgress) => {
      setSession((prev) => {
        const next = {
          ...prev,
          [recipeId]: updater(prev[recipeId] ?? defaultProgress()),
        };
        save(next);
        return next;
      });
    },
    []
  );

  const setStep = useCallback(
    (recipeId: number, step: number) =>
      update(recipeId, (p) => ({ ...p, currentStep: step })),
    [update]
  );

  const toggleIngredient = useCallback(
    (recipeId: number, idx: number) =>
      update(recipeId, (p) => ({
        ...p,
        checkedIngredients: p.checkedIngredients.includes(idx)
          ? p.checkedIngredients.filter((i) => i !== idx)
          : [...p.checkedIngredients, idx],
      })),
    [update]
  );

  const markCompleted = useCallback(
    (recipeId: number) =>
      update(recipeId, (p) => ({ ...p, completed: true })),
    [update]
  );

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    const fresh: CookSession = {};
    recipeIds.forEach((id) => (fresh[id] = defaultProgress()));
    setSession(fresh);
  }, [recipeIds]);

  return { session, setStep, toggleIngredient, markCompleted, clearSession };
}
