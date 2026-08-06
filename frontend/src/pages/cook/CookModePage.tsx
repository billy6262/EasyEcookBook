import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { recipesApi, type Recipe } from "../../api/recipes";
import { useWakeLock } from "../../hooks/useWakeLock";
import { useCookSession } from "../../hooks/useCookSession";
import RecipeTabBar from "../../components/cook/RecipeTabBar";
import CookStepView from "../../components/cook/CookStepView";
import IngredientChecklist from "../../components/cook/IngredientChecklist";
import CookCompletionScreen from "../../components/cook/CookCompletionScreen";

export default function CookModePage() {
  const [searchParams] = useSearchParams();
  const recipeIds = (searchParams.get("recipes") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => n > 0);

  const mealParam = Number(searchParams.get("meal"));
  const mealId = mealParam > 0 ? mealParam : null;

  const { isActive: wakeLockActive } = useWakeLock();
  const { session, setStep, toggleIngredient, markCompleted, clearSession } =
    useCookSession(recipeIds);

  const [activeRecipeId, setActiveRecipeId] = useState(recipeIds[0] ?? 0);

  // Fetch all recipes in parallel
  const queries = useQueries({
    queries: recipeIds.map((id) => ({
      queryKey: ["recipe", id],
      queryFn: () => recipesApi.get(id).then((r) => r.data),
      enabled: id > 0,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const recipes = queries.map((q) => q.data).filter((r): r is Recipe => !!r);

  const activeRecipe = recipes.find((r) => r.id === activeRecipeId);
  const activeProgress = session[activeRecipeId];
  const steps = activeRecipe?.steps ?? [];
  const currentStepObj = steps[activeProgress?.currentStep ?? 0];
  const allCompleted =
    recipes.length > 0 && recipeIds.every((id) => session[id]?.completed);

  // Keep latest handlers in a ref to avoid stale closures in the keyboard effect
  const handlersRef = useRef({ handleNext: () => {}, handlePrev: () => {} });

  const handleNext = useCallback(() => {
    if (!activeProgress || !activeRecipe) return;
    const next = activeProgress.currentStep + 1;
    if (next >= steps.length) {
      markCompleted(activeRecipeId);
      // Auto-switch to first incomplete recipe
      const nextId = recipeIds.find(
        (id) => id !== activeRecipeId && !session[id]?.completed
      );
      if (nextId) setActiveRecipeId(nextId);
    } else {
      setStep(activeRecipeId, next);
    }
  }, [
    activeProgress,
    activeRecipe,
    activeRecipeId,
    steps.length,
    recipeIds,
    session,
    setStep,
    markCompleted,
  ]);

  const handlePrev = useCallback(() => {
    if (!activeProgress) return;
    setStep(activeRecipeId, Math.max(0, activeProgress.currentStep - 1));
  }, [activeProgress, activeRecipeId, setStep]);

  // Keep ref in sync
  useEffect(() => {
    handlersRef.current = { handleNext, handlePrev };
  });

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "ArrowRight") handlersRef.current.handleNext();
      if (e.key === "ArrowLeft") handlersRef.current.handlePrev();

      const digit = parseInt(e.key);
      if (digit >= 1 && digit <= recipeIds.length) {
        setActiveRecipeId(recipeIds[digit - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recipeIds]);

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (recipeIds.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-gray-500">No recipes selected for cooking.</p>
        <Link to="/recipes" className="text-green-600 hover:underline text-sm">
          ← Browse recipes
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  // ── Layout ──────────────────────────────────────────────────────────────────

  const tabRecipes = recipes.map((r) => ({
    id: r.id,
    title: r.title,
    currentStep: session[r.id]?.currentStep ?? 0,
    totalSteps: r.steps?.length ?? 0,
    completed: session[r.id]?.completed ?? false,
  }));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20 flex-shrink-0">
        <Link
          to="/recipes"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          ← Exit
        </Link>
        <span className="text-sm font-semibold text-gray-800">Cook Mode</span>
        {/* Wake lock indicator */}
        <span
          title={
            wakeLockActive
              ? "Screen will stay on"
              : "Screen lock not active (browser limitation)"
          }
          className={`text-base ${wakeLockActive ? "text-yellow-500" : "text-gray-300"}`}
        >
          {wakeLockActive ? "☀️" : "🔅"}
        </span>
      </header>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <RecipeTabBar
        recipes={tabRecipes}
        activeId={activeRecipeId}
        onSelect={setActiveRecipeId}
      />

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pb-6 pt-4 min-h-0">
        {allCompleted ? (
          <CookCompletionScreen
            recipes={recipes.map((r) => ({ id: r.id, title: r.title }))}
            mealId={mealId}
            onKeepCooking={() => {
              clearSession();
              setActiveRecipeId(recipeIds[0]);
            }}
          />
        ) : session[activeRecipeId]?.completed ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <span className="text-5xl">✓</span>
            <p className="text-gray-600 font-medium">{activeRecipe?.title} is done!</p>
            <p className="text-sm text-gray-400">
              Switch to another tab to continue.
            </p>
          </div>
        ) : !currentStepObj ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400 text-sm">No steps found for this recipe.</p>
          </div>
        ) : (
          <>
            <CookStepView
              step={currentStepObj}
              stepIndex={activeProgress?.currentStep ?? 0}
              totalSteps={steps.length}
              isLastStep={
                (activeProgress?.currentStep ?? 0) === steps.length - 1
              }
              onPrev={handlePrev}
              onNext={handleNext}
            />
            <IngredientChecklist
              ingredients={activeRecipe?.ingredients ?? []}
              checkedIndices={activeProgress?.checkedIngredients ?? []}
              onToggle={(idx) => toggleIngredient(activeRecipeId, idx)}
            />
          </>
        )}
      </div>
    </div>
  );
}
