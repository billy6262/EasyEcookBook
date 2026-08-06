import { useAuth } from "../contexts/AuthContext";

export default function DemoBanner() {
  const { user } = useAuth();
  if (!user?.is_demo) return null;

  return (
    <div className="bg-amber-500 text-white text-sm text-center py-2 px-4">
      You're viewing a{" "}
      <span className="font-semibold">read-only demo</span> — changes are disabled.{" "}
      <a href="/register" className="underline font-medium">
        Sign up
      </a>{" "}
      to create your own recipes.
    </div>
  );
}
