// ──────────────────────────────────────────────
//  Service: MetricsService
//  Firestore operations for crowd/metrics data.
// ──────────────────────────────────────────────
import { db } from '../config/firebase';
import { CrowdDataPoint } from '../types';

class MetricsService {
  async getCrowdData(): Promise<CrowdDataPoint[]> {
    const docRef = await db.collection('metrics').doc('crowdData').get();
    if (!docRef.exists) return [];
    return (docRef.data()?.data ?? []) as CrowdDataPoint[];
  }
}

export default new MetricsService();
