// ──────────────────────────────────────────────
//  Service: FoodService
//  Firestore operations for the 'foodItems' collection.
// ──────────────────────────────────────────────
import { db } from '../config/firebase';
import { FoodItem } from '../types';

class FoodService {
  async getAllFoodItems(): Promise<FoodItem[]> {
    const snapshot = await db.collection('foodItems').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FoodItem));
  }
}

export default new FoodService();
