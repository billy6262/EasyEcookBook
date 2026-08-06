import { Routes, Route, Link } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RecipesListPage from "./pages/recipes/RecipesListPage";
import RecipeDetailPage from "./pages/recipes/RecipeDetailPage";
import RecipeFormPage from "./pages/recipes/RecipeFormPage";
import CookModePage from "./pages/cook/CookModePage";
import PlannerPage from "./pages/planner/PlannerPage";
import NewMealPage from "./pages/planner/NewMealPage";
import MealDetailPage from "./pages/planner/MealDetailPage";
import ShoppingListPage from "./pages/planner/ShoppingListPage";
import CollectionsListPage from "./pages/collections/CollectionsListPage";
import CollectionFormPage from "./pages/collections/CollectionFormPage";
import CollectionDetailPage from "./pages/collections/CollectionDetailPage";

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Authenticated routes */}
      <Route element={<ProtectedRoute />}>
        {/* Cook Mode — full-screen, no nav Layout */}
        <Route path="/cook" element={<CookModePage />} />

        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />

          {/* Recipe routes */}
          <Route path="/recipes" element={<RecipesListPage />} />
          <Route path="/recipes/new" element={<RecipeFormPage />} />
          <Route path="/recipes/:id" element={<RecipeDetailPage />} />
          <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />

          {/* Planner routes */}
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/planner/new" element={<NewMealPage />} />
          <Route path="/planner/shopping" element={<ShoppingListPage />} />
          <Route path="/planner/:id" element={<MealDetailPage />} />

          {/* Collection routes */}
          <Route path="/collections" element={<CollectionsListPage />} />
          <Route path="/collections/new" element={<CollectionFormPage />} />
          <Route path="/collections/:id" element={<CollectionDetailPage />} />
          <Route path="/collections/:id/edit" element={<CollectionFormPage />} />

          {/* Catch-all: unknown authenticated paths */}
          <Route
            path="*"
            element={
              <div className="text-center py-20">
                <p className="text-4xl mb-2">🍽️</p>
                <h1 className="text-xl font-semibold text-gray-800 mb-1">Page not found</h1>
                <p className="text-gray-400 text-sm mb-4">
                  That page doesn't exist or has moved.
                </p>
                <Link to="/" className="text-green-600 hover:underline text-sm">
                  ← Back home
                </Link>
              </div>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
