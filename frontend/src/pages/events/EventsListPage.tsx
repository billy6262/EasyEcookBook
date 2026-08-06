import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { eventsApi, isEventPast, type EventListItem } from "../../api/events";

function EventCard({ event }: { event: EventListItem }) {
  const past = isEventPast(event);
  return (
    <Link
      to={`/events/${event.id}`}
      className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow group flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-green-600 line-clamp-2">
          {event.title}
        </h3>
        {event.visibility === "public" && (
          <span className="flex-shrink-0 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            Public
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500">
        📅{" "}
        {new Date(event.event_date).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
      {event.location && <p className="text-sm text-gray-400 mt-1">📍 {event.location}</p>}
      <div className="mt-auto pt-3 flex items-center gap-2 text-xs text-gray-400">
        <span>
          {event.participant_count} guest{event.participant_count === 1 ? "" : "s"}
        </span>
        {past && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Past</span>
        )}
      </div>
    </Link>
  );
}

export default function EventsListPage() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsApi.list().then((r) => r.data),
  });

  const now = Date.now();
  const upcoming = events
    .filter((e) => new Date(e.event_date).getTime() >= now)
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  const past = events
    .filter((e) => new Date(e.event_date).getTime() < now)
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <Link
          to="/events/new"
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          + New Event
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-10 text-center">
          <p className="text-gray-400 text-sm mb-3">No events yet.</p>
          <Link to="/events/new" className="text-green-600 text-sm hover:underline">
            Plan your first event →
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-base font-semibold text-gray-700 mb-3">
              Upcoming
              {upcoming.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400">({upcoming.length})</span>
              )}
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No upcoming events.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-gray-700 mb-3">
                Past
                <span className="ml-2 text-sm font-normal text-gray-400">({past.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {past.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
