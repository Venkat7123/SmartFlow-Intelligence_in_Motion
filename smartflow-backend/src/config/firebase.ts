// ──────────────────────────────────────────────
//  Config: Firebase Admin SDK
//  Initialises firebase-admin using env vars so
//  no service-account JSON file is committed.
// ──────────────────────────────────────────────
import 'dotenv/config';
import * as admin from 'firebase-admin';

const serviceAccount = {
  projectId:   process.env.FIREBASE_PROJECT_ID!,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
  privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin initialized successfully.');
  } catch (error) {
    console.warn('\n⚠️  WARNING: Firebase Admin failed to initialize.');
    console.warn('⚠️  Please provide a valid FIREBASE_PRIVATE_KEY in your .env file.\n');
    console.warn(`Error returned: ${(error as Error).message}\n`);
    
    // We can initialize it empty for development so the crash stops, 
    // but DB calls will all fail until fixing the key.
    admin.initializeApp();
  }
}

const db   = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };

