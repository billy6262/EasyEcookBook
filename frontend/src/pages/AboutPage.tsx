import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

const TECH = {
  Backend: ["Django 5", "Django REST Framework", "PostgreSQL", "JWT auth", "MinIO (S3)", "Docker Compose"],
  Frontend: ["React 18", "TypeScript", "Vite", "Tailwind CSS", "TanStack Query", "React Router"],
  Tooling: ["Git", "Docker", "REST APIs", "Postgres full-text search"],
};

const FEATURES: { icon: string; title: string; body: string }[] = [
  {
    icon: "📖",
    title: "Recipes",
    body: "Full CRUD with cover images, tags, categories, forking, and Postgres full-text search.",
  },
  {
    icon: "🍳",
    title: "Cook Mode",
    body: "Distraction-free, step-by-step cooking with a screen wake-lock and per-recipe progress saved locally.",
  },
  {
    icon: "🗓️",
    title: "Meal Planner",
    body: "Plan meals, auto-generate scaled shopping lists, track a planned → shopped → cooked flow, and reuse templates.",
  },
  {
    icon: "📚",
    title: "Collections",
    body: "Shareable cookbooks with owner / contributor / viewer roles and public discovery.",
  },
  {
    icon: "🎉",
    title: "Events",
    body: "Potluck coordination: invite links, no-account guest access, dish sign-ups, and per-ingredient claiming.",
  },
  {
    icon: "🧾",
    title: "Cooking Log",
    body: "Record every time a meal is cooked, with notes and history — and save a dish someone brought as a recipe.",
  },
];

const HIGHLIGHTS: string[] = [
  "Role-based, object-level permissions across recipes, collections, and events (with IDOR fixes and hardened settings).",
  "Guest authentication for events via a custom token middleware — no account required to participate.",
  "Server-driven UI state with TanStack Query: optimistic-feeling updates, cache invalidation, and typed API clients.",
  "Fully containerized dev environment (Django, Postgres, MinIO, Vite) orchestrated with Docker Compose.",
];

export default function AboutPage() {
  const { isAuthenticated, user } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-green-600">EasyECookBook</span>
          <div className="flex items-center gap-4 text-sm">
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <span className="text-gray-400">{user?.first_name || user?.email}</span>
                <Link
                  to="/"
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Home
                </Link>
              </>
            ) : (
              <>
                <Link to="/" className="text-gray-500 hover:text-gray-800">
                  Home
                </Link>
                <Link
                  to="/login"
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <section className="text-center mb-14">
          <span className="inline-block text-xs uppercase tracking-wider text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1 mb-4">
            Showcase project
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">EasyEcookBook</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            A self-hosted, full-stack digital cookbook that grows with how people actually cook —
            from saving recipes to planning weekly meals to coordinating a full potluck with friends.
          </p>
        </section>

        {/* Features */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-gray-900 mb-6">What it does</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white border rounded-xl p-5">
                <div className="text-2xl mb-2">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tech stack */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Built with</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(TECH).map(([group, items]) => (
              <div key={group} className="bg-white border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {group}
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <li
                      key={item}
                      className="text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Engineering highlights */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Engineering highlights</h2>
          <ul className="space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex gap-3 bg-white border rounded-xl p-4">
                <span className="text-green-600 flex-shrink-0">✓</span>
                <span className="text-sm text-gray-600 leading-relaxed">{h}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* About the developer */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-gray-900 mb-6">About the developer</h2>
          <div className="bg-white border rounded-xl p-6 sm:p-8">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                AD
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Andrew Dorchak</h3>
                <p className="text-sm text-gray-500">Junior Software Developer · Seattle, WA</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              I'm a software developer with a B.S. in Computer Science from Western Governors
              University and a background leading mission-critical operations in the U.S. Coast
              Guard. As a Traffic Management Specialist and Team Lead for Vessel Traffic Service
              Puget Sound, I built internal web tools and automation that cumulatively saved roughly
              1,400 staff-hours a year while coordinating the safe transit of over a thousand vessels
              annually.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">
              I enjoy building full-stack applications end to end — including a machine-learning web
              dashboard that integrates the OpenAI API with crowd-sourced reports to predict orca
              locations in the Puget Sound. EasyEcookBook is where I explore product-minded
              full-stack engineering: real auth, role-based access, and a feature set that keeps
              growing.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 text-sm">
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Languages</h4>
                <p className="text-gray-500">Python, JavaScript / TypeScript, SQL, C++</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Frameworks &amp; tools</h4>
                <p className="text-gray-500">React, Django, Vite, Spring Boot, Git, Docker</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Education</h4>
                <p className="text-gray-500">B.S. Computer Science — WGU (2025)</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Certifications</h4>
                <p className="text-gray-500">LPI Linux Essentials · ITIL Foundation</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <a
                href="https://github.com/billy6262"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:border-green-400 hover:text-green-600 transition-colors"
              >
                GitHub ↗
              </a>
              <a
                href="https://orca.amdorchak.top"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:border-green-400 hover:text-green-600 transition-colors"
              >
                Orca ML Dashboard ↗
              </a>
              <a
                href="mailto:Andrew.Dorchak98@Gmail.com"
                className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:border-green-400 hover:text-green-600 transition-colors"
              >
                Email
              </a>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <Link
            to={isAuthenticated ? "/" : "/login"}
            className="inline-block px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
          >
            {isAuthenticated ? "Go to your kitchen →" : "Explore the app →"}
          </Link>
        </section>
      </main>

      <footer className="border-t bg-white">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-gray-400">
          EasyEcookBook · Built by Andrew Dorchak
        </div>
      </footer>
    </div>
  );
}
