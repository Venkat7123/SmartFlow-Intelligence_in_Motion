// ──────────────────────────────────────────────
//  Service: GateService
//  Firestore operations for the 'gates' collection.
// ──────────────────────────────────────────────
import { db } from '../config/firebase';
import { Gate } from '../types';

class GateService {
  async getAllGates(): Promise<Gate[]> {
    const snapshot = await db.collection('gates').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Gate));
  }

  async getGateById(gateId: string): Promise<Gate | null> {
    const docRef = await db.collection('gates').doc(gateId).get();
    if (!docRef.exists) return null;
    return { id: docRef.id, ...docRef.data() } as Gate;
  }
}

export default new GateService();
