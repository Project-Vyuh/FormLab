/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB2C3HxOgPrh8zFatrHCW4RdZXQlMTHhZc",
    authDomain: "formlab-42fae.firebaseapp.com",
    projectId: "formlab-42fae",
    storageBucket: "formlab-42fae.firebasestorage.app",
    messagingSenderId: "753589341990",
    appId: "1:753589341990:web:f0fbdaed9c6c4f77e6fbe7",
    measurementId: "G-6120V7NC94"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Analytics
export const analytics = getAnalytics(app);

// Initialize Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Storage and get a reference to the service
export const storage = getStorage(app);

export default app;
