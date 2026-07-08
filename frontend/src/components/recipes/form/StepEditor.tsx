import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface StepRow {
  _id: string;
  description: string;
}

interface RowProps {
  row: StepRow;
  index: number;
  onChange: (updated: StepRow) => void;
  onRemove: () => void;
}

function SortableStepRow({ row, index, onChange, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-3 items-start bg-white border rounded-lg px-3 py-3"
    >
      {/* Step number */}
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 font-semibold text-sm flex items-center justify-center mt-0.5">
        {index + 1}
      </span>

      {/* Description */}
      <textarea
        value={row.description}
        onChange={(e) => onChange({ ...row, description: e.target.value })}
        placeholder={`Describe step ${index + 1}…`}
        rows={2}
        className="flex-1 text-sm bg-gray-50 border-0 rounded px-2 py-1.5 resize-y focus:outline-none focus:ring-1 focus:ring-green-400"
      />

      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0 mt-1 text-lg leading-none select-none"
        tabIndex={-1}
      >
        ⠿
      </button>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-200 hover:text-red-400 flex-shrink-0 text-xl leading-none transition-colors mt-0.5"
        tabIndex={-1}
      >
        ×
      </button>
    </div>
  );
}

interface Props {
  value: StepRow[];
  onChange: (rows: StepRow[]) => void;
}

export default function StepEditor({ value, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const from = value.findIndex((r) => r._id === active.id);
      const to = value.findIndex((r) => r._id === over.id);
      onChange(arrayMove(value, from, to));
    }
  };

  const updateRow = (idx: number, updated: StepRow) => {
    const next = [...value];
    next[idx] = updated;
    onChange(next);
  };

  const addRow = () => {
    onChange([...value, { _id: Math.random().toString(36).slice(2), description: "" }]);
  };

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value.map((r) => r._id)} strategy={verticalListSortingStrategy}>
          {value.map((row, idx) => (
            <SortableStepRow
              key={row._id}
              row={row}
              index={idx}
              onChange={(updated) => updateRow(idx, updated)}
              onRemove={() => onChange(value.filter((_, i) => i !== idx))}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium py-1 px-1"
      >
        <span className="text-lg leading-none">+</span> Add step
      </button>
    </div>
  );
}
