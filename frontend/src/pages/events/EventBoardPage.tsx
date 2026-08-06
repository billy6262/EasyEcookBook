import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearGuestToken,
  eventsApi,
  getGuestToken,
  type EventParticipant,
} from "../../api/events";
import { useAuth } from "../../contexts/AuthContext";
import DishCard from "../../components/events/DishCard";
import AddDishForm from "../../components/events/AddDishForm";
import InviteManager from "../../components/events/InviteManager";

export default function EventBoardPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventsApi.get(eventId).then((r) => r.data),
    enabled: !!eventId && !Number.isNaN(eventId),
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["event", eventId] });

  const { mutate: removeParticipant } = useMutation({
    mutationFn: (pid: number) => eventsApi.removeParticipant(eventId, pid),
    onSuccess: invalidate,
  });

  const { mutate: leave } = useMutation({
    mutationFn: () => eventsApi.leave(eventId),
    onSuccess: () => {
      clearGuestToken(eventId);
      navigate(isAuthenticated ? "/events" : "/");
    },
  });

  const { mutate: deleteEvent } = useMutation({
    mutationFn: () => eventsApi.remove(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      navigate("/events");
    },
  });

  const Brand = () =>
    isAuthenticated ? (
      <Link to="/events" className="text-sm text-gray-400 hover:text-gray-600">
        ← Events
      </Link>
    ) : (
      <span className="text-lg font-bold text-green-600">EasyECookBook</span>
    );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-40 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-4xl mb-2">🔒</p>
          <h1 className="text-lg font-semibold text-gray-800 mb-1">Can't open this event</h1>
          <p className="text-gray-400 text-sm mb-4">
            You may need an invite, or the event no longer exists.
          </p>
          <Link to={isAuthenticated ? "/events" : "/"} className="text-green-600 hover:underline text-sm">
            ← Go back
          </Link>
        </div>
      </div>
    );
  }

  const myId = event.my_participant_id;
  const isCoordinator = event.is_coordinator;
  const canParticipate = myId != null;
  const isGuest = !isAuthenticated && !!getGuestToken(eventId);

  const Participant = ({ p }: { p: EventParticipant }) => (
    <li className="flex items-center gap-2 py-1.5 text-sm group">
      <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
        {p.display_name.charAt(0).toUpperCase()}
      </span>
      <span className="flex-1 text-gray-700">
        {p.display_name}
        {p.id === myId && <span className="text-gray-400"> (you)</span>}
      </span>
      {p.role === "coordinator" ? (
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Host</span>
      ) : (
        p.is_guest && <span className="text-xs text-gray-400">guest</span>
      )}
      {isCoordinator && p.role !== "coordinator" && (
        <button
          onClick={() => window.confirm(`Remove ${p.display_name}?`) && removeParticipant(p.id)}
          className="text-gray-300 hover:text-red-400 text-lg leading-none opacity-0 group-hover:opacity-100 transition"
          aria-label={`Remove ${p.display_name}`}
        >
          ×
        </button>
      )}
    </li>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Brand />
          {isCoordinator && (
            <Link
              to={`/events/${eventId}/edit`}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            {event.visibility === "public" && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Public</span>
            )}
          </div>
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
          {event.location && <p className="text-sm text-gray-500 mt-0.5">📍 {event.location}</p>}
          {event.description && (
            <p className="text-gray-600 mt-3 leading-relaxed">{event.description}</p>
          )}
        </div>

        {!canParticipate && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-2 mb-6">
            You're viewing this event but haven't joined, so you can't sign up for dishes.
          </div>
        )}

        {/* Coordinator: invites */}
        {isCoordinator && (
          <div className="mb-4">
            <InviteManager eventId={eventId} />
          </div>
        )}

        {/* Dishes */}
        <section className="bg-white border rounded-xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Dishes &amp; Requests
          </h2>
          <div className="space-y-3">
            {event.dishes.length === 0 ? (
              <p className="text-gray-400 text-sm italic">Nothing planned yet.</p>
            ) : (
              event.dishes.map((dish) => (
                <DishCard
                  key={dish.id}
                  event={event}
                  dish={dish}
                  canSaveRecipe={isAuthenticated}
                />
              ))
            )}
            {canParticipate && (
              <div className="pt-1">
                <AddDishForm event={event} />
              </div>
            )}
          </div>
        </section>

        {/* Participants */}
        <section className="bg-white border rounded-xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Who's coming
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({event.participants.length})
            </span>
          </h2>
          <ul className="divide-y">
            {event.participants.map((p) => (
              <Participant key={p.id} p={p} />
            ))}
          </ul>
        </section>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 mt-2">
          {canParticipate && !isCoordinator && (
            <button
              onClick={() => window.confirm("Leave this event?") && leave()}
              className="px-4 py-2 border border-gray-200 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {isGuest ? "Leave event" : "Leave event"}
            </button>
          )}
          {isCoordinator && (
            <button
              onClick={() =>
                window.confirm("Delete this event? This cannot be undone.") && deleteEvent()
              }
              className="px-4 py-2 border border-red-200 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Delete event
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
