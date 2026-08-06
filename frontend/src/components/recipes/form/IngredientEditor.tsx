import { useRef, useState } from "react";
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
import { recipesApi } from "../../../api/recipes";

export interface IngredientRow {
  _id: string;
  ingredient_name: string;
  quantity: string;
  unit: string;
  notes: string;
}

interface RowProps {
  row: IngredientRow;
  onChange: (updated: IngredientRow) => void;
  onRemove: () => void;
}

function SortableIngredientRow({ row, onChange, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [suggestions, setSuggestions] = useState<{ id: number; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = async (val: string) => {
    if (val.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await recipesApi.searchIngredients(val);
      setSuggestions(res.data.results ?? []);
      setShowSuggestions(true);
    } catch {
      // ignore
    }
  };

  const handleNameChange = (val: string) => {
    onChange({ ...row, ingredient_name: val });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-white border rounded-lg px-2 py-2 group"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0 select-none text-lg leading-none"
        tabIndex={-1}
      >
        ⠿
      </button>

      {/* Quantity */}
      <input
        value={row.quantity}
        onChange={(e) => onChange({ ...row, quantity: e.target.value })}
        placeholder="Qty"
        className="w-16 text-sm bg-gray-50 border-0 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-400"
      />

      {/* Unit */}
      <input
        value={row.unit}
        onChange={(e) => onChange({ ...row, unit: e.target.value })}
        placeholder="Unit"
        className="w-20 text-sm bg-gray-50 border-0 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-400"
      />

      {/* Ingredient name + autocomplete */}
      <div className="relative flex-1 min-w-0">
        <input
          value={row.ingredient_name}
          onChange={(e) => handleNameChange(e.target.value)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Ingredient name *"
          className="w-full text-sm bg-gray-50 border-0 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-400"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-20 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-0.5 py-1 max-h-36 overflow-y-auto">
            {suggestions.map((s) => (
              <li
                key={s.id}
                onMouseDown={() => {
                  onChange({ ...row, ingredient_name: s.name });
                  setShowSuggestions(false);
                }}
                className="px-3 py-1.5 text-sm text-gray-700 hover:bg-green-50 cursor-pointer"
              >
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Notes */}
      <input
        value={row.notes}
        onChange={(e) => onChange({ ...row, notes: e.target.value })}
        placeholder="Notes"
        className="w-28 text-sm bg-gray-50 border-0 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-400 hidden sm:block"
      />

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-200 hover:text-red-400 flex-shrink-0 text-xl leading-none transition-colors"
        tabIndex={-1}
      >
        ×
      </button>
    </div>
  );
}

interface Props {
  value: IngredientRow[];
  onChange: (rows: IngredientRow[]) => void;
}

export default function IngredientEditor({ value, onChange }: Props) {
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

  const updateRow = (idx: number, updated: IngredientRow) => {
    const next = [...value];
    next[idx] = updated;
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...value,
      { _id: Math.random().toString(36).slice(2), ingredient_name: "", quantity: "", unit: "", notes: "" },
    ]);
  };

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value.map((r) => r._id)} strategy={verticalListSortingStrategy}>
          {value.map((row, idx) => (
            <SortableIngredientRow
              key={row._id}
              row={row}
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
        <span className="text-lg leading-none">+</span> Add ingredient
      </button>
    </div>
  );
}
