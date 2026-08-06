import apiClient from "./client";

// ── Guest token storage ──────────────────────────────────────────────────────
// Guests (no account) receive a per-event token when they join. It is stored in
// localStorage and sent as the X-Guest-Token header on event-scoped requests.

const guestKey = (eventId: number) => `easyecookbook_guest_${eventId}`;

export function getGuestToken(eventId: number): string | null {
  try {
    return localStorage.getItem(guestKey(eventId));
  } catch {
    return null;
  }
}

export function setGuestToken(eventId: number, token: string): void {
  try {
    localStorage.setItem(guestKey(eventId), token);
  } catch {
    /* ignore */
  }
}

export function clearGuestToken(eventId: number): void {
  try {
    localStorage.removeItem(guestKey(eventId));
  } catch {
    /* ignore */
  }
}

/** Axios config that attaches the guest token header for an event, if present. */
function guestCfg(eventId: number) {
  const token = getGuestToken(eventId);
  return token ? { headers: { "X-Guest-Token": token } } : {};
}

// ── Types ────────────────────────────────────────────────────────────────────

export type EventVisibility = "public" | "private";
export type ParticipantRole = "coordinator" | "contributor";
export type DishType = "linked_recipe" | "custom" | "open_request";

export interface EventListItem {
  id: number;
  title: string;
  event_date: string;
  location: string;
  visibility: EventVisibility;
  participant_count: number;
  created_at: string;
}

export interface EventParticipant {
  id: number;
  user: number | null;
  display_name: string;
  role: ParticipantRole;
  is_guest: boolean;
  joined_at: string;
}

export interface EventIngredient {
  id: number;
  ingredient_name: string;
  quantity: string | null;
  unit: string;
  notes: string;
  is_auto_generated: boolean;
  claimed_by: number | null;
  claimed_by_name: string | null;
}

export interface EventFulfillment {
  id: number;
  custom_name: string;
  notes: string;
  fulfilled_by_name: string;
  ingredients: EventIngredient[];
  created_at: string;
}

export interface EventDish {
  id: number;
  dish_type: DishType;
  request_description: string;
  display_name: string;
  allow_multiple_fulfillments: boolean;
  servings: number;
  notes: string;
  ingredients: EventIngredient[];
  fulfillments: EventFulfillment[];
  is_fulfilled: boolean;
}

export interface EventDetail {
  id: number;
  title: string;
  description: string;
  event_date: string;
  location: string;
  visibility: EventVisibility;
  dishes: EventDish[];
  participants: EventParticipant[];
  my_participant_id: number | null;
  my_role: ParticipantRole | null;
  is_coordinator: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventInvite {
  token: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_valid: boolean;
  created_at: string;
}

export interface InvitePreview {
  invite_valid: boolean;
  already_participant: boolean;
  event: {
    id: number;
    title: string;
    description: string;
    event_date: string;
    location: string;
    coordinator_name: string;
    participant_count: number;
  };
}

export interface IngredientRequest {
  name: string;
  quantity?: string | null;
  unit?: string;
  notes?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const DISH_TYPE_LABELS: Record<DishType, string> = {
  linked_recipe: "Recipe",
  custom: "Dish",
  open_request: "Open request",
};

export function isEventPast(event: { event_date: string }): boolean {
  return new Date(event.event_date).getTime() < Date.now();
}

// ── API calls ────────────────────────────────────────────────────────────────

export const eventsApi = {
  list: () => apiClient.get<EventListItem[]>("/events/"),

  get: (id: number) =>
    apiClient.get<EventDetail>(`/events/${id}/`, guestCfg(id)),

  create: (data: {
    title: string;
    description?: string;
    event_date: string;
    location?: string;
    visibility?: EventVisibility;
  }) => apiClient.post<EventDetail>("/events/", data),

  update: (
    id: number,
    data: Partial<{
      title: string;
      description: string;
      event_date: string;
      location: string;
      visibility: EventVisibility;
    }>
  ) => apiClient.patch<EventDetail>(`/events/${id}/`, data),

  remove: (id: number) => apiClient.delete(`/events/${id}/`),

  // Invite / join
  invitePreview: (token: string) =>
    apiClient.get<InvitePreview>(`/events/invite/${token}/`),

  join: (id: number, inviteToken: string) =>
    apiClient.post<{ participant_id: number }>(`/events/${id}/join/`, {
      invite_token: inviteToken,
    }),

  joinGuest: (
    id: number,
    inviteToken: string,
    guestName: string,
    guestEmail?: string,
    opts?: { resume?: boolean; force_new?: boolean }
  ) =>
    apiClient.post<{ participant_id: number; guest_token: string }>(
      `/events/${id}/join-guest/`,
      {
        invite_token: inviteToken,
        guest_name: guestName,
        guest_email: guestEmail ?? "",
        resume: opts?.resume ?? false,
        force_new: opts?.force_new ?? false,
      }
    ),

  listInvites: (id: number) =>
    apiClient.get<EventInvite[]>(`/events/${id}/invites/`),

  createInvite: (id: number, data: { max_uses?: number | null; expires_at?: string | null }) =>
    apiClient.post<EventInvite>(`/events/${id}/invites/`, data),

  revokeInvite: (id: number, token: string) =>
    apiClient.delete(`/events/${id}/invites/${token}/`),

  // Dishes
  addDish: (
    id: number,
    payload: {
      dish_type: DishType;
      recipe_id?: number | null;
      request_description?: string;
      allow_multiple_fulfillments?: boolean;
      custom_name?: string;
      servings?: number;
      notes?: string;
    }
  ) => apiClient.post<EventDish>(`/events/${id}/dishes/`, payload, guestCfg(id)),

  updateDish: (
    id: number,
    dishId: number,
    payload: Partial<{ custom_name: string; request_description: string; notes: string; servings: number }>
  ) => apiClient.patch<EventDish>(`/events/${id}/dishes/${dishId}/`, payload, guestCfg(id)),

  deleteDish: (id: number, dishId: number) =>
    apiClient.delete(`/events/${id}/dishes/${dishId}/`, guestCfg(id)),

  fulfillDish: (
    id: number,
    dishId: number,
    payload: { custom_name: string; notes?: string; ingredient_requests?: IngredientRequest[] }
  ) => apiClient.post<EventFulfillment>(`/events/${id}/dishes/${dishId}/fulfill/`, payload, guestCfg(id)),

  saveFulfillmentAsRecipe: (id: number, fulfillmentId: number) =>
    apiClient.post<{ recipe_id: number; already_saved: boolean }>(`/events/${id}/fulfillments/${fulfillmentId}/save-as-recipe/`, {}, guestCfg(id)),

  // Ingredient claims
  claimIngredient: (id: number, ingredientId: number) =>
    apiClient.post(`/events/${id}/ingredients/${ingredientId}/claim/`, {}, guestCfg(id)),

  unclaimIngredient: (id: number, ingredientId: number) =>
    apiClient.delete(`/events/${id}/ingredients/${ingredientId}/claim/`, guestCfg(id)),

  // Participants
  removeParticipant: (id: number, participantId: number) =>
    apiClient.delete(`/events/${id}/participants/${participantId}/`),

  leave: (id: number) => apiClient.post(`/events/${id}/leave/`, {}, guestCfg(id)),
};
