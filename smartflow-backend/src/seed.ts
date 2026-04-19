import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const events = [
    {
    title: "Chennai Super Kings vs. Royal Challengers Bangalore",
    venue: "M. A. Chidambaram Stadium",
    location: "Chennai",
    date: "April 18, 2026",
    time: "7:30 PM",
    imageUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80",
    crowdDensity: 95,
    isLive: false,
    category: "IPL Cricket"
  },
  {
    title: "Mumbai Indians vs. Delhi Capitals",
    venue: "Wankhede Stadium",
    location: "Mumbai",
    date: "April 20, 2026",
    time: "7:30 PM",
    imageUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80",
    crowdDensity: 80,
    isLive: false,
    category: "IPL Cricket"
  },
  {
    title: "Kolkata Knight Riders vs. Sunrisers Hyderabad",
    venue: "Eden Gardens",
    location: "Kolkata",
    date: "April 22, 2026",
    time: "7:30 PM",
    imageUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80",
    crowdDensity: 65,
    isLive: false,
    category: "IPL Cricket"
  },
  {
    title: "Delhi Capitals vs. Royal Challengers Bangalore",
    venue: "Arun Jaitley Stadium",
    location: "Delhi",
    date: "April 25, 2026",
    time: "7:30 PM",
    imageUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80",
    crowdDensity: 70,
    isLive: false,
    category: "IPL Cricket"
  },
  {
    title: "Sunrisers Hyderabad vs. Chennai Super Kings",
    venue: "Rajiv Gandhi International Cricket Stadium",
    location: "Hyderabad",
    date: "April 28, 2026",
    time: "7:30 PM",
    imageUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80",
    crowdDensity: 90,
    isLive: false,
    category: "IPL Cricket"
  },
  {
    title: "Royal Challengers Bangalore vs. Mumbai Indians",
    venue: "M. Chinnaswamy Stadium",
    location: "Bengaluru",
    date: "May 2, 2026",
    time: "7:30 PM",
    imageUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80",
    crowdDensity: 85,
    isLive: false,
    category: "IPL Cricket"
  },
  {
    title: "Bengaluru FC vs. Kerala Blasters",
    venue: "Sree Kanteerava Stadium",
    location: "Bengaluru",
    date: "May 5, 2026",
    time: "8:00 PM",
    imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80",
    crowdDensity: 60,
    isLive: false,
    category: "Football"
  },
  {
    title: "Chennaiyin FC vs. Mumbai City FC",
    venue: "Jawaharlal Nehru Stadium",
    location: "Chennai",
    date: "May 10, 2026",
    time: "7:30 PM",
    imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80",
    crowdDensity: 55,
    isLive: false,
    category: "Football"
  },
  {
    title: "Coldplay: Music of the Spheres",
    venue: "D.Y. Patil Stadium",
    location: "Mumbai",
    date: "May 15, 2026",
    time: "6:00 PM",
    imageUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
    crowdDensity: 100,
    isLive: false,
    category: "Concert"
  },
  {
    title: "A.R. Rahman Live in Concert",
    venue: "YMCA Grounds",
    location: "Chennai",
    date: "May 20, 2026",
    time: "7:00 PM",
    imageUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
    crowdDensity: 98,
    isLive: false,
    category: "Concert"
  },
  {
    title: "Ed Sheeran: +-=÷x Tour",
    venue: "Salt Lake Stadium",
    location: "Kolkata",
    date: "June 2, 2026",
    time: "7:30 PM",
    imageUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
    crowdDensity: 90,
    isLive: false,
    category: "Concert"
  },
  {
    title: "Delhi United FC vs. EBFC",
    venue: "Jawaharlal Nehru Stadium",
    location: "Delhi",
    date: "June 5, 2026",
    time: "7:00 PM",
    imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80",
    crowdDensity: 45,
    isLive: false,
    category: "Football"
  },
];

async function seed() {
  console.log("Deleting old events...");
  const oldEvents = await db.collection("events").get();
  const batch = db.batch();
  oldEvents.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  console.log("Clearing user events...");
  const users = await db.collection("users").get();
  for (const user of users.docs) {
    const userEvents = await db.collection("users").doc(user.id).collection("events").get();
    const userBatch = db.batch();
    userEvents.docs.forEach((doc) => {
      userBatch.delete(doc.ref);
    });
    if (userEvents.docs.length > 0) {
      await userBatch.commit();
    }
  }

  console.log("Adding new events...");
  const newBatch = db.batch();
  events.forEach((event) => {
    const ref = db.collection("events").doc();
    newBatch.set(ref, {
      ...event,
      createdAt: new Date().toISOString(),
    });
  });
  await newBatch.commit();
  console.log("Seeding complete!");
}

seed().catch(console.error);
