import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  canEditRecipes,
  collectionsApi,
  isOwner,
  ROLE_BADGE_COLOURS,
  ROLE_LABELS,
  type MemberRole,
} from "../../api/collections";
import { recipesApi, type Recipe } from "../../api/recipes";
import { useAuth } from "../../contexts/AuthContext";
import RecipeCard from "../../components/recipes/RecipeCard";

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const collectionId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Add-recipe search
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add-member form
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Exclude<MemberRole, "owner">>("viewer");
  const [memberError, setMemberError] = useState<string | null>(null);

  const { data: collection, isLoading } = useQuery({
    queryKey: ["collection", collectionId],
    queryFn: () => collectionsApi.get(collectionId).then((r) => r.data),
    enabled: !!collectionId && !Number.isNaN(collectionId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["collection", collectionId] });

  const { mutate: addRecipe } = useMutation({
    mutationFn: (recipeId: number) => collectionsApi.addRecipe(collectionId, recipeId),
    onSuccess: () => {
      invalidate();
      setSearchInput("");
      setSuggestions([]);
      setShowSuggestions(false);
    },
  });

  const { mutate: removeRecipe } = useMutation({
    mutationFn: (recipeId: number) => collectionsApi.removeRecipe(collectionId, recipeId),
    onSuccess: invalidate,
  });

  const { mutate: addMember, isPending: addingMember } = useMutation({
    mutationFn: () => collectionsApi.addMember(collectionId, memberEmail.trim(), memberRole),
    onSuccess: () => {
      invalidate();
      setMemberEmail("");
      setMemberRole("viewer");
      setMemberError(null);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMemberError(detail ?? "Could not add member.");
    },
  });

  const { mutate: updateMemberRole } = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: Exclude<MemberRole, "owner"> }) =>
      collectionsApi.updateMember(collectionId, userId, role),
    onSuccess: invalidate,
  });

  const { mutate: removeMember } = useMutation({
    mutationFn: (userId: number) => collectionsApi.removeMember(collectionId, userId),
    onSuccess: invalidate,
  });

  const { mutate: deleteCollection } = useMutation({
    mutationFn: () => collectionsApi.remove(collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      navigate("/collections");
    },
  });

  const { mutate: leaveCollection } = useMutation({
    mutationFn: () => collectionsApi.leave(collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      navigate("/collections");
    },
  });

  const fetchSuggestions = async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    setShowSuggestions(true);
    try {
      const existing = new Set((collection?.recipes ?? []).map((r) => r.recipe.id));
      const res = await recipesApi.search(q);
      setSuggestions((res.data.results ?? []).filter((r) => !existing.has(r.id)));
    } finally {
      setIsSearching(false);
    }
  };

  if (isLoading || !collection) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-40 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const role = collection.my_role;
  const canEdit = canEditRecipes(role);
  const owner = isOwner(role);
  const isMember = role === "contributor" || role === "viewer";

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/collections" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← Collections
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{collection.name}</h1>
            {collection.visibility === "public" && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Public</span>
            )}
            {role && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE_COLOURS[role]}`}>
                {ROLE_LABELS[role]}
              </span>
            )}
          </div>
          {collection.description && (
            <p className="text-gray-600 mt-2 leading-relaxed">{collection.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {collection.recipe_count} recipe{collection.recipe_count === 1 ? "" : "s"} ·{" "}
            {collection.member_count} member{collection.member_count === 1 ? "" : "s"} · by{" "}
            {collection.created_by_email}
          </p>
        </div>

        {owner && (
          <div className="flex gap-2 flex-shrink-0">
            <Link
              to={`/collections/${collectionId}/edit`}
              className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Edit
            </Link>
          </div>
        )}
      </div>

      {/* Recipes */}
      <section className="bg-white border rounded-xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Recipes
        </h2>

        {/* Add recipe search (contributors + owners) */}
        {canEdit && (
          <div className="relative mb-4">
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                if (!e.target.value.trim()) {
                  setSuggestions([]);
                  setShowSuggestions(false);
                  return;
                }
                debounceRef.current = setTimeout(() => fetchSuggestions(e.target.value), 200);
              }}
              onFocus={() => searchInput.trim() && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search recipes to add…"
              autoComplete="off"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {showSuggestions && (suggestions.length > 0 || isSearching || searchInput.trim()) && (
              <ul className="absolute z-10 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-0.5 py-1 max-h-56 overflow-y-auto">
                {isSearching ? (
                  <li className="px-3 py-2 text-sm text-gray-400 italic">Searching…</li>
                ) : suggestions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-400 italic">
                    No recipes found for "{searchInput}"
                  </li>
                ) : (
                  suggestions.map((r) => (
                    <li
                      key={r.id}
                      onMouseDown={() => addRecipe(r.id)}
                      className="px-3 py-2 text-sm text-gray-700 hover:bg-green-50 cursor-pointer line-clamp-1"
                    >
                      {r.title}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}

        {collection.recipes.length === 0 ? (
          <p className="text-gray-400 text-sm italic">
            No recipes yet.{canEdit ? " Search above to add some." : ""}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collection.recipes.map((entry) => (
              <div key={entry.id} className="relative group">
                <RecipeCard recipe={entry.recipe} />
                {canEdit && (
                  <button
                    onClick={() => removeRecipe(entry.recipe.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 opacity-0 group-hover:opacity-100 transition text-lg leading-none flex items-center justify-center shadow-sm"
                    title="Remove from collection"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Members */}
      <section className="bg-white border rounded-xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Members
        </h2>

        <ul className="divide-y mb-4">
          {collection.members.map((m) => {
            const displayName =
              [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
            const isSelf = m.user_id === user?.pk;
            return (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">
                    {displayName}
                    {isSelf && <span className="text-gray-400"> (you)</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                </div>

                {/* Owner controls for non-owner members */}
                {owner && m.role !== "owner" ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        updateMemberRole({
                          userId: m.user_id,
                          role: e.target.value as Exclude<MemberRole, "owner">,
                        })
                      }
                      className="text-xs border rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="contributor">Contributor</option>
                    </select>
                    <button
                      onClick={() => removeMember(m.user_id)}
                      className="text-gray-300 hover:text-red-400 text-lg leading-none"
                      title="Remove member"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_BADGE_COLOURS[m.role]}`}
                  >
                    {ROLE_LABELS[m.role]}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {/* Owner: invite by email */}
        {owner && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (memberEmail.trim()) addMember();
            }}
            className="border-t pt-4"
          >
            <p className="text-xs font-medium text-gray-500 mb-2">Invite a member</p>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="member@email.com"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as Exclude<MemberRole, "owner">)}
                className="border rounded-lg px-2 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="viewer">Viewer</option>
                <option value="contributor">Contributor</option>
              </select>
              <button
                type="submit"
                disabled={!memberEmail.trim() || addingMember}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                {addingMember ? "…" : "Invite"}
              </button>
            </div>
            {memberError && <p className="text-xs text-red-500 mt-2">{memberError}</p>}
          </form>
        )}
      </section>

      {/* Danger / leave actions */}
      <div className="flex items-center justify-end gap-2 mt-2">
        {isMember && (
          <button
            onClick={() => window.confirm("Leave this collection?") && leaveCollection()}
            className="px-4 py-2 border border-gray-200 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Leave collection
          </button>
        )}
        {owner && (
          <button
            onClick={() =>
              window.confirm("Delete this collection? This cannot be undone.") &&
              deleteCollection()
            }
            className="px-4 py-2 border border-red-200 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Delete collection
          </button>
        )}
      </div>
    </div>
  );
}
