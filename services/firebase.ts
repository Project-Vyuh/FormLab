/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { isLocalMode } from './runtimeConfig';

// Your web app's Firebase configuration
const firebaseConfig = isLocalMode ? {
    apiKey: 'local-mode', authDomain: 'localhost', projectId: 'formlab-local',
    storageBucket: 'formlab-local.invalid', messagingSenderId: '0', appId: 'local-mode',
} : {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!isLocalMode && Object.entries(firebaseConfig).some(([key, value]) => key !== 'measurementId' && !value)) {
    throw new Error('Firebase mode requires all VITE_FIREBASE_* values in .env.local');
}

// Initialize Firebase
const app = isLocalMode ? null : initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = (app ? getAuth(app) : null) as ReturnType<typeof getAuth>;

// Initialize Analytics
export const analytics = !isLocalMode && typeof window !== 'undefined' ? getAnalytics(app) : null;

// Initialize Firestore and get a reference to the service
export const db = (app ? getFirestore(app) : null) as ReturnType<typeof getFirestore>;

// Initialize Firebase Storage and get a reference to the service
export const storage = (app ? getStorage(app) : null) as ReturnType<typeof getStorage>;

export default app;
