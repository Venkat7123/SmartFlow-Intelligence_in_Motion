// ──────────────────────────────────────────────
//  Service: UserService
//  Firestore operations for users/{uid} documents.
// ──────────────────────────────────────────────
import { db } from '../config/firebase';
import { UserProfile } from '../types';

class UserService {
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const docRef = await db.collection('users').doc(userId).get();
    if (!docRef.exists) return null;
    return { id: docRef.id, ...docRef.data() } as UserProfile;
  }

  async updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const ref = db.collection('users').doc(userId);
    await ref.set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as UserProfile;
  }
}

export default new UserService();
