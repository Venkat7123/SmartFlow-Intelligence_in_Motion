import { db } from './config';
import { collection, doc, setDoc, getDocs, getDoc, query, where } from 'firebase/firestore';
import { Event, Gate, Order, User, FoodItem } from '@/types';
import { mockEvents, myEvents, gates, mockOrders, foodItems, currentUser, crowdChartData } from '@/lib/mockData';

/**
 * CAUTION: Run this function ONCE from dev tools to populate your database with dummy data!
 * It will overwrite existing document fields matching these IDs!
 */
export async function seedFirestore() {
  console.log('Seeding firestore with mock data...');

  try {
    // Seed Events
    for (const event of mockEvents) {
      await setDoc(doc(db, 'events', event.id), event);
    }

    // Seed My Events
    const myEventsRef = collection(db, 'users', currentUser.id, 'events');
    for (const event of myEvents) {
      await setDoc(doc(myEventsRef, event.id), event);
    }
    
    // Seed Gates
    for (const gate of gates) {
      await setDoc(doc(db, 'gates', gate.id), gate);
    }
    
    // Seed Orders (Nested under currentUser for context of personal queries)
    const userOrdersRef = collection(db, 'users', currentUser.id, 'orders');
    for (const order of mockOrders) {
      await setDoc(doc(userOrdersRef, order.id), order);
    }
    
    // Seed Food Items
    for (const item of foodItems) {
      await setDoc(doc(db, 'foodItems', item.id), item);
    }
    
    // Seed generic User 
    await setDoc(doc(db, 'users', currentUser.id), currentUser);
    
    // Seed Crowd Data (Storing as a single document holding the array for simplicity)
    await setDoc(doc(db, 'metrics', 'crowdData'), { data: crowdChartData });

    console.log('Seeding COMPLETE! ✅');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}
