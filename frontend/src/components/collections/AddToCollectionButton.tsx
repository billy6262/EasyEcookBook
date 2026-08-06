import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { canEditRecipes, collectionsApi } from "../../api/collections";

interface Props {
  recipeId: number;
  buttonClassName?: string;
}

export default function AddToCollectionButton({ recipeId, buttonClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Only collections the user can add recipes to (owner/contributor)
  const { data: collections = [], isFetching } = useQuery({
    queryKey: ["collections", "mine"],
    queryFn: () => collectionsApi.list("mine").then((r) => r.data),
    enabled: open,
    staleTime: 30_000,
  });

  const editable = collections.filter((c) => canEditRecipes(c.my_role));

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setOpen(false);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const { mutate: addToCollection, isPending: adding } = useMutation({
    mutationFn: (collectionId: number) => collectionsApi.addRecipe(collectionId, recipeId),
    onSuccess: (_, collectionId) => {
      queryClient.invalidateQueries({ queryKey: ["collection", collectionId] });
      const c = editable.find((x) => x.id === collectionId);
      showSuccess(c?.name ?? "collection");
    },
  });

  if (successMsg) {
    return (
      <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 whitespace-nowrap">
        ✓ Added to {successMsg}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={adding}
        onClick={() => setOpen((o) => !o)}
        className={
          buttonClassName ??
          "text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
        }
        title="Add to a collection"
      >
        {adding ? "…" : "📚 + Collection"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded-xl shadow-lg py-1 min-w-48 max-w-64 z-30">
          {isFetching ? (
            <p className="text-xs text-gray-400 px-3 py-2">Loading…</p>
          ) : editable.length > 0 ? (
            <>
              <p className="text-xs text-gray-400 px-3 pt-2 pb-1 font-medium uppercase tracking-wide">
                Your collections
              </p>
              {editable.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addToCollection(c.id)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-green-50 transition-colors"
                >
                  <span className="line-clamp-1">{c.name}</span>
                </button>
              ))}
              <div className="border-t my-1" />
            </>
          ) : (
            <p className="text-xs text-gray-400 px-3 pt-2 pb-1">No collections yet</p>
          )}
          <button
            onClick={() => navigate("/collections/new")}
            className="w-full text-left px-3 py-2 text-sm text-green-600 font-medium hover:bg-green-50 transition-colors"
          >
            + New collection
          </button>
        </div>
      )}
    </div>
  );
}
