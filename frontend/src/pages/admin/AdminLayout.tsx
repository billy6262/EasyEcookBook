import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/invites", label: "Invites" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/moderation", label: "Moderation" },
  { to: "/admin/scraped", label: "Scraper Log" },
  { to: "/admin/settings", label: "Settings" },
];

export default function AdminLayout() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
      </div>

      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
