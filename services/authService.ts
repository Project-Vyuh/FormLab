/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged as firebaseOnAuthStateChanged,
    User as FirebaseUser,
    updateProfile,
    sendEmailVerification,
} from "firebase/auth";
import { auth } from "./firebase";

export interface AuthError {
    code: string;
    message: string;
}

/**
 * Sign up a new user with email and password
 * Sends verification email and signs out the user
 */
export const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string,
    photoURL?: string
): Promise<string> => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // Update profile with display name and photo if provided
        if (displayName || photoURL) {
            await updateProfile(userCredential.user, {
                displayName: displayName || null,
                photoURL: photoURL || null,
            });
        }

        // Send verification email
        await sendEmailVerification(userCredential.user);

        // Sign out the user (they must verify email before signing in)
        await signOut(auth);

        // Return the email for display purposes
        return email;
    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            throw new Error('User already exists. Sign in?');
        }
        throw error;
    }
};

/**
 * Sign in an existing user with email and password
 */
export const signInWithEmail = async (
    email: string,
    password: string
): Promise<FirebaseUser> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error: any) {
        if (error.code === 'auth/invalid-credential' ||
            error.code === 'auth/wrong-password' ||
            error.code === 'auth/user-not-found') {
            throw new Error('Password or Email Incorrect');
        }
        throw error;
    }
};

/**
 * Sign out the current user
 */
export const signOutUser = async (): Promise<void> => {
    await signOut(auth);
};

/**
 * Listen to authentication state changes
 */
export const onAuthStateChanged = (callback: (user: FirebaseUser | null) => void) => {
    return firebaseOnAuthStateChanged(auth, callback);
};
