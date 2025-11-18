/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

export interface UserData {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    createdAt: Timestamp;
    lastLogin: Timestamp;
    emailVerified: boolean;
    authProvider: "email" | "google";
}

/**
 * Create a new user document in Firestore
 */
export async function createUserDocument(
    uid: string,
    userData: {
        email: string | null;
        displayName: string | null;
        photoURL: string | null;
        authProvider: "email" | "google";
        emailVerified?: boolean;
    }
): Promise<void> {
    try {
        const userRef = doc(db, "users", uid);

        await setDoc(userRef, {
            uid,
            email: userData.email,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            authProvider: userData.authProvider,
            emailVerified: userData.emailVerified || false,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
        });

        console.log("User document created successfully");
    } catch (error) {
        console.error("Error creating user document:", error);
        throw new Error("Failed to create user document");
    }
}

/**
 * Get user document from Firestore
 */
export async function getUserDocument(uid: string): Promise<UserData | null> {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            return userSnap.data() as UserData;
        } else {
            console.log("No user document found");
            return null;
        }
    } catch (error) {
        console.error("Error getting user document:", error);
        throw new Error("Failed to get user document");
    }
}

/**
 * Update user document in Firestore
 */
export async function updateUserDocument(
    uid: string,
    updates: Partial<Omit<UserData, "uid" | "createdAt">>
): Promise<void> {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
            ...updates,
            lastLogin: serverTimestamp(),
        });

        console.log("User document updated successfully");
    } catch (error) {
        console.error("Error updating user document:", error);
        throw new Error("Failed to update user document");
    }
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(uid: string): Promise<void> {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
            lastLogin: serverTimestamp(),
        });

        console.log("Last login updated successfully");
    } catch (error) {
        console.error("Error updating last login:", error);
        throw new Error("Failed to update last login");
    }
}

/**
 * Check if user document exists in Firestore
 */
export async function checkUserExists(uid: string): Promise<boolean> {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        return userSnap.exists();
    } catch (error) {
        console.error("Error checking user existence:", error);
        return false;
    }
}
