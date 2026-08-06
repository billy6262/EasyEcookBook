import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/admin";

type Tab = "recipes" | "comments";

export default function ModerationPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("recipes");

  const recipes = useQuery({
    queryKey: ["admin", "mod-recipes"],
    queryFn: () => adminApi.listRecipes().then((r) => r.data.results),
    enabled: tab === "recipes",
  });

  const comments = useQuery({
    queryKey: ["admin", "mod-comments"],
    queryFn: () => adminApi.listComments().then((r) => r.data.results),
    enabled: tab === "comments",
  });

  const recipeMut = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "hide" | "unhide" | "delete" }) =>
      action === "hide"
        ? adminApi.hideRecipe(id)
        : action === "unhide"
        ? adminApi.unhideRecipe(id)
        : adminApi.deleteRecipe(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "mod-recipes"] }),
  });

  const commentMut = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "hide" | "unhide" | "delete" }) =>
      action === "hide"
        ? adminApi.hideComment(id)
        : action === "unhide"
        ? adminApi.unhideComment(id)
        : adminApi.deleteComment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "mod-comments"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["recipes", "comments"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              tab === t ? "bg-green-600 text-white" : "border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {tab === "recipes" ? (
          recipes.isLoading ? (
            <div className="p-5 text-gray-400">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Author</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipes.data?.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">{r.title}</td>
                    <td className="px-4 py-3 text-gray-500">{r.created_by_email}</td>
                    <td className="px-4 py-3">
                      {r.is_hidden ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                          Hidden
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">{r.visibility}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            recipeMut.mutate({ id: r.id, action: r.is_hidden ? "unhide" : "hide" })
                          }
                          className="px-3 py-1 border rounded-lg text-xs hover:bg-gray-50"
                        >
                          {r.is_hidden ? "Unhide" : "Hide"}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete recipe "${r.title}"? This cannot be undone.`))
                              recipeMut.mutate({ id: r.id, action: "delete" });
                          }}
                          className="px-3 py-1 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : comments.isLoading ? (
          <div className="p-5 text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Comment</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Recipe</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {comments.data?.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 max-w-xs truncate">{c.body}</td>
                  <td className="px-4 py-3 text-gray-500">{c.author_email}</td>
                  <td className="px-4 py-3 text-gray-500">{c.recipe_title}</td>
                  <td className="px-4 py-3">
                    {c.is_hidden ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                        Hidden
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Visible</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          commentMut.mutate({ id: c.id, action: c.is_hidden ? "unhide" : "hide" })
                        }
                        className="px-3 py-1 border rounded-lg text-xs hover:bg-gray-50"
                      >
                        {c.is_hidden ? "Unhide" : "Hide"}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this comment? This cannot be undone."))
                            commentMut.mutate({ id: c.id, action: "delete" });
                        }}
                        className="px-3 py-1 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
