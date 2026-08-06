import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api/admin";

const STATUSES = ["", "pending", "completed", "failed", "imported"];

const statusColor: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  imported: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-600",
  pending: "bg-gray-100 text-gray-500",
};

export default function ScrapedPage() {
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "scraped", status],
    queryFn: () =>
      adminApi.listScraped(status ? { status } : undefined).then((r) => r.data.results),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              status === s ? "bg-green-600 text-white" : "border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s || "all"}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-5 text-gray-400">Loading…</div>
        ) : data?.length === 0 ? (
          <div className="p-5 text-gray-400">No scrape records.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Requested by</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 max-w-md truncate">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-green-600 hover:underline"
                    >
                      {s.url}
                    </a>
                    {s.error_message && (
                      <div className="text-xs text-red-500 truncate">{s.error_message}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.requested_by_email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        statusColor[s.status] ?? "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(s.created_at).toLocaleString()}
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
