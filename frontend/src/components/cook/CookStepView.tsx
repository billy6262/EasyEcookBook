import type { RecipeStep } from "../../api/recipes";

interface Props {
  step: RecipeStep;
  stepIndex: number;
  totalSteps: number;
  isLastStep: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export default function CookStepView({
  step,
  stepIndex,
  totalSteps,
  isLastStep,
  onPrev,
  onNext,
}: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Progress dots */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-gray-400 tabular-nums">
          Step {stepIndex + 1} of {totalSteps}
        </span>
        <div className="flex gap-1 flex-wrap justify-end max-w-48">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < stepIndex
                  ? "w-4 bg-green-300"
                  : i === stepIndex
                  ? "w-6 bg-green-600"
                  : "w-4 bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col justify-center overflow-y-auto">
        <p className="text-gray-900 text-xl leading-relaxed mb-6">
          {step.description}
        </p>

        {step.image && (
          <img
            src={step.image}
            alt={`Step ${stepIndex + 1}`}
            className="w-full max-h-56 object-cover rounded-xl mb-4"
          />
        )}
      </div>

      {/* Prev / Next */}
      <div className="flex gap-3 pt-4 border-t mt-4">
        <button
          onClick={onPrev}
          disabled={stepIndex === 0}
          className="flex-1 py-3.5 border border-gray-200 rounded-xl text-gray-600 font-medium disabled:opacity-30 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm"
        >
          ← Prev
        </button>
        <button
          onClick={onNext}
          className={`flex-2 px-8 py-3.5 rounded-xl font-medium text-sm transition-colors ${
            isLastStep
              ? "bg-green-600 text-white hover:bg-green-700 active:bg-green-800"
              : "bg-green-600 text-white hover:bg-green-700 active:bg-green-800"
          }`}
          style={{ flex: 2 }}
        >
          {isLastStep ? "✓ Finished" : "Next →"}
        </button>
      </div>
    </div>
  );
}
