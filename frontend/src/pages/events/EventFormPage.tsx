import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventsApi, type EventVisibility } from "../../api/events";

/** Convert an ISO datetime to the value a <input type="datetime-local"> expects. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const eventId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] = useState<EventVisibility>("private");
  const [error, setError] = useState<string | null>(null);

  const { data: existing } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventsApi.get(eventId).then((r) => r.data),
    enabled: isEdit && !Number.isNaN(eventId),
  });

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setDescription(existing.description);
      setEventDate(toLocalInput(existing.event_date));
      setLocation(existing.location);
      setVisibility(existing.visibility);
    }
  }, [existing]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        event_date: eventDate,
        location: location.trim(),
        visibility,
      };
      return isEdit ? eventsApi.update(eventId, payload) : eventsApi.create(payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      navigate(`/events/${res.data.id}`);
    },
    onError: () => setError("Something went wrong. Please try again."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Please give your event a name.");
    if (!eventDate) return setError("Please pick a date and time.");
    setError(null);
    save();
  };

  return (
    <div className="max-w-xl mx-auto">
      <Link
        to={isEdit ? `/events/${eventId}` : "/events"}
        className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block"
      >
        ← {isEdit ? "Back to event" : "Events"}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? "Edit Event" : "New Event"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white border rounded-xl p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Friendsgiving Potluck"
            autoFocus
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the occasion?"
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date &amp; time</label>
            <input
              type="datetime-local"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where?"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
          <div className="flex gap-2">
            {(["private", "public"] as EventVisibility[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  visibility === v
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {v === "private" ? "🔒 Private" : "🌐 Public"}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {visibility === "private"
              ? "Only people with an invite link can see this event."
              : "Anyone with the link can view this event."}
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Event"}
          </button>
          <Link
            to={isEdit ? `/events/${eventId}` : "/events"}
            className="px-5 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
