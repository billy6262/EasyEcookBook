import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
      navigate("/");
    } catch {
      setError("root", { message: "Invalid email or password." });
    }
  };

  const onDemo = async () => {
    try {
      await demoLogin();
      navigate("/");
    } catch {
      setError("root", { message: "The demo is currently unavailable." });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-sm border max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
          <ThemeToggle />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              {...register("email")}
              type="email"
              autoComplete="email"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              {...register("password")}
              type="password"
              autoComplete="current-password"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="text-red-500 text-sm">{errors.root.message}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <button
          type="button"
          onClick={onDemo}
          disabled={isSubmitting}
          className="mt-3 w-full border border-green-600 text-green-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-green-50 disabled:opacity-50 transition-colors"
        >
          View live demo (read-only)
        </button>

        <p className="mt-4 text-sm text-center text-gray-500">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="text-green-600 hover:text-green-700 font-medium"
          >
            Register
          </Link>
        </p>
        <p className="mt-2 text-sm text-center text-gray-500">
          <Link
            to="/password-reset"
            className="text-gray-400 hover:text-gray-600"
          >
            Forgot password?
          </Link>
        </p>
        <p className="mt-4 pt-4 border-t text-sm text-center text-gray-400">
          <Link to="/about" className="hover:text-green-600">
            About this project ↗
          </Link>
        </p>
      </div>
    </div>
  );
}
