import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type SiteSettings } from "../../api/admin";
import { useAuth } from "../../contexts/AuthContext";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuper = !!user?.is_superuser;

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => adminApi.getSettings().then((r) => r.data),
  });

  const update = useMutation({
    mutationFn: (patch: Partial<SiteSettings>) => adminApi.updateSettings(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "settings"] }),
  });

  if (isLoading || !data) return <div className="text-gray-400">Loading…</div>;

  return (
    <div className="max-w-xl space-y-6">
      {!isSuper && (
        <p className="text-sm text-gray-500 bg-gray-50 border rounded-lg p-3">
          These settings are read-only. Only a superuser can change them.
        </p>
      )}

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Registration mode</h2>
          <p className="text-xs text-gray-400 mb-3">
            Controls whether new users need a valid invite token to sign up.
          </p>
          <div className="flex gap-2">
            {(["open", "invite_only"] as const).map((mode) => (
              <button
                key={mode}
                disabled={!isSuper || update.isPending}
                onClick={() => update.mutate({ registration_mode: mode })}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  data.registration_mode === mode
                    ? "bg-green-600 text-white"
                    : "border text-gray-600 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {mode === "open" ? "Open" : "Invite only"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Read-only demo</h2>
            <p className="text-xs text-gray-400">
              Allow visitors to explore the app as a read-only demo user.
            </p>
          </div>
          <button
            disabled={!isSuper || update.isPending}
            onClick={() => update.mutate({ demo_enabled: !data.demo_enabled })}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              data.demo_enabled ? "bg-green-600" : "bg-gray-300"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                data.demo_enabled ? "translate-x-6" : ""
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
