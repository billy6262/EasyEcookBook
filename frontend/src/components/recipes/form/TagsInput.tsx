import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recipesApi, type Tag } from "../../../api/recipes";

interface Props {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
}

export default function TagsInput({ value, onChange }: Props) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const fetchSuggestions = async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await recipesApi.searchTags(q);
      const results = (res.data.results ?? []).filter(
        (t) => !value.find((v) => v.id === t.id)
      );
      setSuggestions(results);
      setShowSuggestions(true);
    } catch {
      // ignore
    }
  };

  const handleInput = (val: string) => {
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const { mutate: createTag, isPending } = useMutation({
    mutationFn: (name: string) => recipesApi.createTag(name),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      onChange([...value, res.data]);
      setInput("");
      setShowSuggestions(false);
    },
  });

  const addTag = (tag: Tag) => {
    if (!value.find((t) => t.id === tag.id)) {
      onChange([...value, tag]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (id: number) => onChange(value.filter((t) => t.id !== id));

  const exactMatch = suggestions.find(
    (s) => s.name.toLowerCase() === input.trim().toLowerCase()
  );
  const showCreate = input.trim().length > 0 && !exactMatch;

  return (
    <div>
      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-sm rounded-full"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="text-green-600 hover:text-green-900 leading-none text-base"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search / create input */}
      <div className="relative">
        <input
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => input && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (exactMatch) addTag(exactMatch);
              else if (showCreate && input.trim()) createTag(input.trim());
            }
          }}
          placeholder="Search or create a tag…"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        {showSuggestions && (suggestions.length > 0 || showCreate) && (
          <ul className="absolute z-20 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-0.5 py-1 max-h-44 overflow-y-auto">
            {suggestions.map((tag) => (
              <li
                key={tag.id}
                onMouseDown={() => addTag(tag)}
                className="px-3 py-1.5 text-sm text-gray-700 hover:bg-green-50 cursor-pointer"
              >
                {tag.name}
              </li>
            ))}
            {showCreate && (
              <li
                onMouseDown={() => !isPending && createTag(input.trim())}
                className="px-3 py-1.5 text-sm text-green-600 font-medium hover:bg-green-50 cursor-pointer"
              >
                {isPending ? (
                  "Creating…"
                ) : (
                  <>
                    + Create{" "}
                    <span className="font-semibold">"{input.trim()}"</span>
                  </>
                )}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
