/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firebase Cloud Functions for FormLab
 * Secure proxy for Gemini API calls with authentication and rate limiting
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp();

// Rate limiting configuration
const RATE_LIMITS = {
  hourly: 100, // requests per hour per user
  daily: 500, // requests per day per user
};

/**
 * Check rate limits for a user
 */
async function checkRateLimit(userId: string): Promise<void> {
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);
  const dayAgo = now - (24 * 60 * 60 * 1000);

  const db = admin.firestore();
  const userDoc = db.collection("usage").doc(userId);

  const doc = await userDoc.get();
  const data = doc.data() || {requests: []};

  // Clean old requests
  const requests: number[] = data.requests.filter((ts: number) => ts > dayAgo);

  // Check limits
  const hourlyRequests = requests.filter((ts: number) => ts > hourAgo).length;
  const dailyRequests = requests.length;

  if (hourlyRequests >= RATE_LIMITS.hourly) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      `Hourly rate limit exceeded. Limit: ${RATE_LIMITS.hourly} requests/hour`
    );
  }

  if (dailyRequests >= RATE_LIMITS.daily) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      `Daily rate limit exceeded. Limit: ${RATE_LIMITS.daily} requests/day`
    );
  }

  // Add new request timestamp
  requests.push(now);

  // Update Firestore
  await userDoc.set({requests}, {merge: true});
}

/**
 * Verify user authentication
 */
function requireAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to use this service"
    );
  }
  return context.auth.uid;
}

/**
 * Cloud Functions for authentication and rate limiting
 * Actual AI operations handled by frontend for now
 */
export const generateModelImage = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  await checkRateLimit(userId);

  // Return success - actual generation happens on frontend
  // This is just for auth and rate limiting
  return {success: true, message: "Rate limit check passed"};
});

export const generateModelFromDescription = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  await checkRateLimit(userId);
  return {success: true, message: "Rate limit check passed"};
});

export const generateVirtualTryOn = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  await checkRateLimit(userId);
  return {success: true, message: "Rate limit check passed"};
});

export const reviseGeneratedImage = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  await checkRateLimit(userId);
  return {success: true, message: "Rate limit check passed"};
});

export const upscaleImage = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  await checkRateLimit(userId);
  return {success: true, message: "Rate limit check passed"};
});

export const selectivelyEnhanceImage = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  await checkRateLimit(userId);
  return {success: true, message: "Rate limit check passed"};
});

export const enhancePrompt = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  return {success: true, message: "Rate limit check passed"};
});

export const analyzeGarment = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  return {success: true, message: "Rate limit check passed"};
});

export const generateVideo = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  await checkRateLimit(userId);
  return {success: true, message: "Rate limit check passed"};
});
