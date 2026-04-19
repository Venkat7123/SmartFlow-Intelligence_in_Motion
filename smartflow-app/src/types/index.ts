export interface Event {
  id: string;
  title: string;
  venue: string;
  location?: string;
  date: string;
  time: string;
  category: string;
  imageUrl: string;
  isLive: boolean;
  crowdDensity: number;
  price: number;
  arrivalTime: string;
  tag?: string;
  currentCrowd?: number;
}

export interface Gate {
  id: string;
  name: string;
  waitMinutes: number;
  capacity: number;
  distance?: string;
  prediction?: string;
}

export interface Order {
  id: string;
  name: string;
  price: number;
  status: 'preparing' | 'ready' | 'collected';
  eta: string;
  counter: string;
  imageUrl: string;
}

export interface User {
  id: string;
  name: string;
  location: string;
  memberType: string;
  avatar: string;
  eventsAttended: number;
  milesWalked: number;
  smartEntries: number;
  ordersMade: number;
}

export interface FoodItem {
  id: string;
  name: string;
  vendor: string;
  price: number;
  imageUrl: string;
}

export interface MapLayer {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
}
