import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  collectionsApi,
  ROLE_BADGE_COLOURS,
  ROLE_LABELS,
  type Collection,
  type CollectionScope,
} from "../../api/collections";

const TABS: { key: CollectionScope; label: string }[] = [
  { key: "mine", label: "My Collections" },
  { key: "shared", label: "Shared with Me" },
  { key: "public", label: "Discover" },
];

function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <Link
      to={`/collections/${collection.id}`}
      className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow group flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-green-600 line-clamp-2">
          {collection.name}
        </h3>
        {collection.visibility === "public" && (
          <span className="flex-shrink-0 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            Public
          </span>
        )}
      </div>

      {collection.description && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{collection.description}</p>
      )}

      <div className="mt-auto flex items-center gap-2 text-xs text-gray-400">
        <span>{collection.recipe_count} recipe{collection.recipe_count === 1 ? "" : "s"}</span>
        <span>·</span>
        <span>{collection.member_count} member{collection.member_count === 1 ? "" : "s"}</span>
        {collection.my_role && (
          <span className={`ml-auto px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE_COLOURS[collection.my_role]}`}>
            {ROLE_LABELS[collection.my_role]}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function CollectionsListPage() {
  const [scope, setScope] = useState<CollectionScope>("mine");

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections", scope],
    queryFn: () => collectionsApi.list(scope).then((r) => r.data),
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
        <Link
          to="/collections/new"
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          + New Collection
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setScope(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              scope === tab.key
                ? "border-green-600 text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-10 text-center">
          {scope === "mine" ? (
            <>
              <p className="text-gray-400 text-sm mb-3">
                You haven't created any collections yet.
              </p>
              <Link to="/collections/new" className="text-green-600 text-sm hover:underline">
                Create your first collection →
              </Link>
            </>
          ) : scope === "shared" ? (
            <p className="text-gray-400 text-sm">
              No one has shared a collection with you yet.
            </p>
          ) : (
            <p className="text-gray-400 text-sm">
              No public collections to discover right now.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      )}
    </div>
  );
}
