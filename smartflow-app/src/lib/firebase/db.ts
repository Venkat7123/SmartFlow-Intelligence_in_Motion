// This file now acts as a shim, redirecting all previously direct Firestore calls
// to our new typed Express REST API layer.
export * from '../api';

