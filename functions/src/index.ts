/** Retired compatibility endpoints. Deploy only to disable a previously deployed legacy API. */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();
const retired = functions.https.onCall(() => {
  throw new functions.https.HttpsError('failed-precondition', 'Legacy AI endpoint retired. Use the FormLab generation API.');
});
export const generateModelImage = retired;
export const generateModelFromDescription = retired;
export const generateVirtualTryOn = retired;
export const reviseGeneratedImage = retired;
export const upscaleImage = retired;
export const selectivelyEnhanceImage = retired;
export const enhancePrompt = retired;
export const analyzeGarment = retired;
export const generateVideo = retired;
export * from './upscaleTrigger';
