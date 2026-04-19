import { Event, Gate, Order, FoodItem, User, MapLayer } from '../types';
import { auth } from './firebase/config';

// NEXT_PUBLIC_API_URL should be in .env.local, defaults to localhost:5000
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Helper to get the Firebase ID token for the authenticated user.
 */
async function getToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken();
}

/**
 * Reusable fetch wrapper that automatically attaches the auth token.
 */
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = await getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// ──────────────────────────────────────────────
//  Events Layer
// ──────────────────────────────────────────────
export async function getEvents(): Promise<Event[]> {
  return fetchAPI('/events');
}

export async function getEventById(id: string): Promise<Event> {
  return fetchAPI(`/events/${id}`);
}

export async function getMyEvents(userId: string): Promise<Event[]> {
  if (!userId) return [];
  return fetchAPI(`/users/${userId}/events`);
}

export async function addUserEvent(userId: string, event: Partial<Event>): Promise<Event> {
  return fetchAPI(`/users/${userId}/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function removeUserEvent(userId: string, eventId: string): Promise<void> {
  return fetchAPI(`/users/${userId}/events/${eventId}`, {
    method: 'DELETE',
  });
}

// ──────────────────────────────────────────────
//  Gates Layer
// ──────────────────────────────────────────────
export async function getGates(): Promise<Gate[]> {
  return fetchAPI('/gates');
}

// ──────────────────────────────────────────────
//  Food Items Layer
// ──────────────────────────────────────────────
export async function getFoodItems(): Promise<FoodItem[]> {
  return fetchAPI('/food');
}

// ──────────────────────────────────────────────
//  Orders Layer
// ──────────────────────────────────────────────
export async function getMyOrders(userId: string): Promise<Order[]> {
  if (!userId) return [];
  return fetchAPI(`/users/${userId}/orders`);
}

export async function createOrder(userId: string, data: Partial<Order>): Promise<Order> {
  return fetchAPI(`/users/${userId}/orders`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ──────────────────────────────────────────────
//  User Profile Layer
// ──────────────────────────────────────────────
export async function getUserProfile(userId: string): Promise<User | null> {
  if (!userId) return null;
  try {
    return await fetchAPI(`/users/${userId}`);
  } catch (error) {
    // If not found, backend returns 404, throwing an error
    return null;
  }
}

export async function updateUserProfile(userId: string, data: Partial<User>): Promise<void> {
  if (!userId) return;
  await fetchAPI(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ──────────────────────────────────────────────
//  Metrics / Crowd Layer
// ──────────────────────────────────────────────
export async function getCrowdData(): Promise<{time: string, crowd: number}[]> {
  return fetchAPI('/metrics/crowd');
}
