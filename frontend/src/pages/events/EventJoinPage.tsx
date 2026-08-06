import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { eventsApi, setGuestToken } from "../../api/events";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Centered card wrapper. Defined at module scope (NOT inside the component) so
 * it isn't re-created on every render — otherwise the inputs inside would
 * remount on each keystroke and lose focus.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8">{children}</div>
    </div>
  );
}

export default function EventJoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: preview, isLoading, isError } = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => eventsApi.invitePreview(token!).then((r) => r.data),
    enabled: !!token,
    retry: false,
  });

  const eventId = preview?.event.id;

  const { mutate: joinAsUser, isPending: joiningUser } = useMutation({
    mutationFn: () => eventsApi.join(eventId!, token!),
    onSuccess: () => navigate(`/events/${eventId}`),
    onError: () => setError("Couldn't join. The invite may be expired."),
  });

  const finishGuest = (guestToken: string) => {
    setGuestToken(eventId!, guestToken);
    navigate(`/events/${eventId}`);
  };

  const { mutate: joinAsGuest, isPending: joiningGuest } = useMutation({
    mutationFn: () => eventsApi.joinGuest(eventId!, token!, guestName.trim(), guestEmail.trim()),
    onSuccess: (res) => finishGuest(res.data.guest_token),
    onError: (err: unknown) => {
      const resp = (
        err as {
          response?: {
            status?: number;
            data?: { detail?: string };
          };
        }
      ).response;
      if (resp?.status === 409 && resp.data?.detail) {
        setError(resp.data.detail);
      } else {
        setError("Couldn't join. Please check your details and try again.");
      }
    },
  });

  if (isLoading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </Shell>
    );
  }

  if (isError || !preview) {
    return (
      <Shell>
        <div className="text-center">
          <p className="text-4xl mb-3">🔗</p>
          <h1 className="text-lg font-semibold text-gray-800 mb-1">Invite not found</h1>
          <p className="text-gray-400 text-sm mb-4">This invite link is invalid.</p>
          <Link to="/" className="text-green-600 hover:underline text-sm">
            ← Go home
          </Link>
        </div>
      </Shell>
    );
  }

  const { event, invite_valid, already_participant } = preview;

  return (
    <Shell>
      <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">You're invited to</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h1>
      <p className="text-sm text-gray-500">
        📅{" "}
        {new Date(event.event_date).toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
      {event.location && <p className="text-sm text-gray-500 mt-1">📍 {event.location}</p>}
      <p className="text-xs text-gray-400 mt-2">
        Hosted by {event.coordinator_name} · {event.participant_count} going
      </p>
      {event.description && (
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">{event.description}</p>
      )}

      <div className="border-t my-5" />

      {!invite_valid ? (
        <p className="text-sm text-red-500">This invite has expired or reached its limit.</p>
      ) : already_participant ? (
        <button
          onClick={() => navigate(`/events/${event.id}`)}
          className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          You're in — go to the event →
        </button>
      ) : isAuthenticated ? (
        <button
          onClick={() => joinAsUser()}
          disabled={joiningUser}
          className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {joiningUser ? "Joining…" : "Join this event"}
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!guestName.trim()) return setError("Please enter your name.");
            setError(null);
            joinAsGuest();
          }}
          className="space-y-3"
        >
          <p className="text-sm font-medium text-gray-700">Join as a guest</p>
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Your name"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            placeholder="Email (optional)"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={joiningGuest}
            className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {joiningGuest ? "Joining…" : "Join as guest"}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Have an account?{" "}
            <Link to="/login" className="text-green-600 hover:underline">
              Log in
            </Link>{" "}
            to join with it.
          </p>
        </form>
      )}

      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
    </Shell>
  );
}
