import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">
        Welcome back{user?.first_name ? `, ${user.first_name}` : ""}!
      </h1>
      <p className="text-gray-500 mb-8">What are you cooking today?</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/recipes"
          className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow group"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-green-600">
            Recipes
          </h2>
          <p className="text-gray-500 text-sm">
            Browse, create, and manage your recipe collection.
          </p>
        </Link>

        <Link
          to="/collections"
          className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow group"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-green-600">
            Collections
          </h2>
          <p className="text-gray-500 text-sm">
            Organise recipes into shared cookbooks.
          </p>
        </Link>

        <Link
          to="/events"
          className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow group"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-green-600">
            Events
          </h2>
          <p className="text-gray-500 text-sm">
            Plan dinners and coordinate potlucks with friends.
          </p>
        </Link>
      </div>
    </div>
  );
}
