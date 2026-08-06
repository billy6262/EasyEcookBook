import { STATUS_COLOURS, STATUS_LABELS, type MealStatus } from "../../api/planner";

interface Props {
  status: MealStatus;
  className?: string;
}

export default function StatusBadge({ status, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[status]} ${className}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
