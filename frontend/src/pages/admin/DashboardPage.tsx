import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api/admin";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border rounded-xl p-5">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminApi.getStats().then((r) => r.data),
  });

  if (isLoading || !data) {
    return <div className="text-gray-400">Loading stats…</div>;
  }

  const maxCount = Math.max(1, ...data.signups_last_30d.map((d) => d.count));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total users" value={data.total_users} />
        <StatCard label="Active users" value={data.active_users} />
        <StatCard label="Staff" value={data.staff_users} />
        <StatCard label="Recipes" value={data.total_recipes} />
        <StatCard label="Hidden recipes" value={data.hidden_recipes} />
        <StatCard label="Comments" value={data.total_comments} />
        <StatCard label="Outstanding invites" value={data.outstanding_invites} />
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Signups — last 30 days
        </h2>
        {data.signups_last_30d.length === 0 ? (
          <p className="text-sm text-gray-400">No signups in the last 30 days.</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {data.signups_last_30d.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end group">
                <div
                  className="w-full bg-green-500 rounded-t hover:bg-green-600 transition-colors"
                  style={{ height: `${(d.count / maxCount) * 100}%` }}
                  title={`${d.day}: ${d.count}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
