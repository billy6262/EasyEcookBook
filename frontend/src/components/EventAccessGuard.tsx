import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getGuestToken } from "../api/events";

/**
 * Gate for the standalone event board. Allows access when the visitor is either
 * authenticated OR holds a guest token for this event. Everyone else is sent to
 * the login page. The board itself is rendered outside the main app Layout so
 * that guests aren't dropped into the logged-in shell.
 */
export default function EventAccessGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const hasGuestToken = !!(id && getGuestToken(Number(id)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  if (isAuthenticated || hasGuestToken) {
    return <Outlet />;
  }
  return <Navigate to="/login" replace />;
}
