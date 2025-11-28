/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface UserSettings {
    theme: 'light' | 'dark' | 'system';
    defaultModelId?: string;
    defaultAspectRatio?: string;
    uiPreferences: {
        sidebarCollapsed: boolean;
        showGrid: boolean;
        [key: string]: any;
    };
    updatedAt: string;
}

const DEFAULT_SETTINGS: UserSettings = {
    theme: 'dark',
    uiPreferences: {
        sidebarCollapsed: false,
        showGrid: true,
    },
    updatedAt: new Date().toISOString(),
};

/**
 * Save user settings
 */
export async function saveUserSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
    try {
        const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');

        // Check if settings exist first to determine merge strategy
        const docSnap = await getDoc(settingsRef);

        if (docSnap.exists()) {
            await updateDoc(settingsRef, {
                ...settings,
                updatedAt: new Date().toISOString(),
            });
        } else {
            await setDoc(settingsRef, {
                ...DEFAULT_SETTINGS,
                ...settings,
                updatedAt: new Date().toISOString(),
            });
        }

        console.log('User settings saved');
    } catch (error) {
        console.error('Error saving user settings:', error);
        throw error;
    }
}

/**
 * Get user settings
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
    try {
        const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
        const docSnap = await getDoc(settingsRef);

        if (docSnap.exists()) {
            return docSnap.data() as UserSettings;
        }

        // Return defaults if no settings found
        return DEFAULT_SETTINGS;
    } catch (error) {
        console.error('Error loading user settings:', error);
        return DEFAULT_SETTINGS;
    }
}
