import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="text-xl font-bold text-green-600">
              EasyECookBook
            </Link>
            <div className="flex items-center gap-6">
              <Link
                to="/recipes"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Recipes
              </Link>
              <Link
                to="/planner"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Planner
              </Link>
              <Link
                to="/collections"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Collections
              </Link>
              <span
                className="text-sm text-gray-300 cursor-not-allowed"
                title="Events — coming soon"
                aria-disabled="true"
              >
                Events
              </span>
              <span className="text-sm text-gray-400">{user?.email}</span>
              <button
                onClick={logout}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
