import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collectionsApi, type CollectionVisibility } from "../../api/collections";

export default function CollectionFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const collectionId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CollectionVisibility>("private");
  const [error, setError] = useState<string | null>(null);

  // Load existing collection when editing
  const { data: existing } = useQuery({
    queryKey: ["collection", collectionId],
    queryFn: () => collectionsApi.get(collectionId).then((r) => r.data),
    enabled: isEdit && !Number.isNaN(collectionId),
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description);
      setVisibility(existing.visibility);
    }
  }, [existing]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), description: description.trim(), visibility };
      return isEdit
        ? collectionsApi.update(collectionId, payload)
        : collectionsApi.create(payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["collection", collectionId] });
      navigate(`/collections/${res.data.id}`);
    },
    onError: () => setError("Something went wrong. Please try again."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please give your collection a name.");
      return;
    }
    setError(null);
    save();
  };

  return (
    <div className="max-w-xl mx-auto">
      <Link
        to={isEdit ? `/collections/${collectionId}` : "/collections"}
        className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block"
      >
        ← {isEdit ? "Back to collection" : "Collections"}
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? "Edit Collection" : "New Collection"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white border rounded-xl p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weeknight Dinners"
            autoFocus
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this collection about?"
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
          <div className="flex gap-2">
            {(["private", "public"] as CollectionVisibility[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  visibility === v
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {v === "private" ? "🔒 Private" : "🌐 Public"}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {visibility === "private"
              ? "Only you and invited members can see this collection."
              : "Anyone can discover this collection under “Discover.”"}
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Collection"}
          </button>
          <Link
            to={isEdit ? `/collections/${collectionId}` : "/collections"}
            className="px-5 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
