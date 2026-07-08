import type { RecipeStep } from "../../api/recipes";

interface Props {
  steps: RecipeStep[];
}

export default function StepListDisplay({ steps }: Props) {
  if (steps.length === 0) {
    return <p className="text-gray-400 text-sm italic">No steps listed.</p>;
  }

  return (
    <ol className="space-y-6">
      {steps.map((step, idx) => (
        <li key={step.id} className="flex gap-4">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 font-semibold text-sm flex items-center justify-center">
            {idx + 1}
          </span>
          <div className="flex-1 pt-0.5">
            <p className="text-gray-800 text-sm leading-relaxed">{step.description}</p>
            {step.image && (
              <img
                src={step.image}
                alt={`Step ${idx + 1}`}
                className="mt-3 rounded-lg w-full max-w-xs"
              />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
