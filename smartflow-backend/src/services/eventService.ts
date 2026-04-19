// ──────────────────────────────────────────────
//  Service: EventService
//  All Firestore operations for the 'events'
//  and users/{uid}/events collections.
// ──────────────────────────────────────────────
import { db } from '../config/firebase';
import { Event } from '../types';

class EventService {
  // ── Global events ────────────────────────────
  async getAllEvents(): Promise<Event[]> {
    const snapshot = await db.collection('events').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Event));
  }

  async getEventById(eventId: string): Promise<Event | null> {
    const docRef = await db.collection('events').doc(eventId).get();
    if (!docRef.exists) return null;
    return { id: docRef.id, ...docRef.data() } as Event;
  }

  async createEvent(data: Omit<Event, 'id'>): Promise<Event> {
    const ref = await db.collection('events').add({
      ...data,
      createdAt: new Date().toISOString(),
    });
    const created = await ref.get();
    return { id: created.id, ...created.data() } as Event;
  }

  async updateEvent(eventId: string, data: Partial<Event>): Promise<Event> {
    await db.collection('events').doc(eventId).update({
      ...data,
      updatedAt: new Date().toISOString(),
    });
    const updated = await db.collection('events').doc(eventId).get();
    return { id: updated.id, ...updated.data() } as Event;
  }

  async deleteEvent(eventId: string): Promise<void> {
    await db.collection('events').doc(eventId).delete();
  }

  // ── User-specific events ─────────────────────
  async getUserEvents(userId: string): Promise<Event[]> {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('events')
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Event));
  }

  async addUserEvent(userId: string, eventData: Partial<Event>): Promise<Event> {
    const docId = (eventData.id ?? (eventData as any).eventId) as string;
    const ref = db
      .collection('users')
      .doc(userId)
      .collection('events')
      .doc(docId);

    await ref.set({ ...eventData, addedAt: new Date().toISOString() }, { merge: true });
    const snap = await ref.get();
    return { id: snap.id, ...snap.data() } as Event;
  }

  async removeUserEvent(userId: string, eventId: string): Promise<void> {
    await db
      .collection('users')
      .doc(userId)
      .collection('events')
      .doc(eventId)
      .delete();
  }
}

export default new EventService();
