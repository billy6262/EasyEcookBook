import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type Invite } from "../../api/admin";

export default function InvitesPage() {
  const queryClient = useQueryClient();
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "invites"],
    queryFn: () => adminApi.listInvites().then((r) => r.data.results),
  });

  const create = useMutation({
    mutationFn: () =>
      adminApi.createInvite({
        max_uses: maxUses,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "invites"] });
      setExpiresAt("");
      setMaxUses(1);
    },
  });

  const revoke = useMutation({
    mutationFn: (id: number) => adminApi.revokeInvite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "invites"] }),
  });

  const copyLink = async (invite: Invite) => {
    await navigator.clipboard.writeText(invite.share_url);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Create */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Create invite
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Max uses</span>
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value)))}
              className="w-24 border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Expires (optional)</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            Generate
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-5 text-gray-400">Loading…</div>
        ) : data?.length === 0 ? (
          <div className="p-5 text-gray-400">No invites yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Uses</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Used by</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((inv) => (
                <tr key={inv.id} className="border-t">
                  <td className="px-4 py-3">
                    {inv.uses_count} / {inv.max_uses}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        inv.is_valid
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {inv.is_valid ? "Valid" : "Expired/used"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{inv.used_by_email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => copyLink(inv)}
                        className="px-3 py-1 border rounded-lg text-xs hover:bg-gray-50"
                      >
                        {copiedId === inv.id ? "Copied!" : "Copy link"}
                      </button>
                      <button
                        onClick={() => revoke.mutate(inv.id)}
                        className="px-3 py-1 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50"
                      >
                        Revoke
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
