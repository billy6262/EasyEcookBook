import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventsApi, type EventInvite } from "../../api/events";

interface Props {
  eventId: number;
}

export default function InviteManager({ eventId }: Props) {
  const queryClient = useQueryClient();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["event-invites", eventId],
    queryFn: () => eventsApi.listInvites(eventId).then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["event-invites", eventId] });

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () =>
      eventsApi.createInvite(eventId, {
        max_uses: maxUses ? parseInt(maxUses) : null,
        expires_at: expiresAt || null,
      }),
    onSuccess: () => {
      invalidate();
      setMaxUses("");
      setExpiresAt("");
    },
  });

  const { mutate: revoke } = useMutation({
    mutationFn: (token: string) => eventsApi.revokeInvite(eventId, token),
    onSuccess: invalidate,
  });

  const shareUrl = (token: string) => `${window.location.origin}/events/join/${token}`;

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      /* clipboard blocked; ignore */
    }
  };

  const activeInvites = invites.filter((i: EventInvite) => i.is_valid);

  return (
    <div className="bg-white border rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Invite Links
      </h2>

      {isLoading ? (
        <div className="h-10 bg-gray-100 rounded animate-pulse mb-4" />
      ) : activeInvites.length === 0 ? (
        <p className="text-gray-400 text-sm italic mb-4">
          No active invites. Create one to share this event.
        </p>
      ) : (
        <ul className="space-y-2 mb-4">
          {activeInvites.map((invite) => (
            <li key={invite.token} className="flex items-center gap-2 border rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 truncate font-mono">{shareUrl(invite.token)}</p>
                <p className="text-xs text-gray-400">
                  {invite.uses_count} used
                  {invite.max_uses != null && ` / ${invite.max_uses}`}
                  {invite.expires_at &&
                    ` · expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => copy(invite.token)}
                className="text-xs px-2 py-1 border rounded-lg text-gray-600 hover:bg-gray-50 flex-shrink-0"
              >
                {copiedToken === invite.token ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => window.confirm("Revoke this invite link?") && revoke(invite.token)}
                className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0"
                aria-label="Revoke invite"
                title="Revoke"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Create form */}
      <div className="flex flex-wrap items-end gap-2 border-t pt-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Max uses (optional)</label>
          <input
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="∞"
            className="w-20 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Expires (optional)</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <button
          onClick={() => create()}
          disabled={creating}
          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {creating ? "Creating…" : "+ New link"}
        </button>
      </div>
    </div>
  );
}
