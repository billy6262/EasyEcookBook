import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminUser } from "../../api/admin";
import { useAuth } from "../../contexts/AuthContext";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () =>
      adminApi.listUsers(search ? { search } : undefined).then((r) => r.data.results),
  });

  const update = useMutation({
    mutationFn: ({ pk, data }: { pk: number; data: { is_active?: boolean; is_staff?: boolean } }) =>
      adminApi.updateUser(pk, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const canEdit = (u: AdminUser) =>
    u.pk !== me?.pk && !u.is_demo && !(u.is_superuser && !me?.is_superuser);

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Search by email or username…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm border rounded-lg px-3 py-2 text-sm"
      />

      <div className="bg-white border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-5 text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Recipes</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.pk} className="border-t">
                  <td className="px-4 py-3">
                    {u.email}
                    {u.is_demo && (
                      <span className="ml-2 text-xs text-gray-400">(demo)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.recipe_count}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(u.date_joined).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        u.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_superuser ? "Superuser" : u.is_staff ? "Staff" : "Member"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit(u) && (
                        <>
                          <button
                            onClick={() =>
                              update.mutate({ pk: u.pk, data: { is_active: !u.is_active } })
                            }
                            className="px-3 py-1 border rounded-lg text-xs hover:bg-gray-50"
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                          {me?.is_superuser && !u.is_superuser && (
                            <button
                              onClick={() =>
                                update.mutate({ pk: u.pk, data: { is_staff: !u.is_staff } })
                              }
                              className="px-3 py-1 border rounded-lg text-xs hover:bg-gray-50"
                            >
                              {u.is_staff ? "Demote" : "Make staff"}
                            </button>
                          )}
                        </>
                      )}
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
