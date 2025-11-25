import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

// Initialize admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Configuration
// In production, use functions.config() or environment variables
const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL ||
    functions.config().cloud_run?.url ||
    "https://formlab-upscaler-753589341990.us-central1.run.app/upscale";

export const onUpscaleRequestCreated = functions.firestore
    .document("upscale_requests/{requestId}")
    .onCreate(async (snap, context) => {
        const requestId = context.params.requestId;
        const requestData = snap.data();

        if (!requestData) {
            console.error(`No data found for request ${requestId}`);
            return;
        }

        const { imageUrl, userId, resolution } = requestData;

        console.log(`Processing upscale request ${requestId} for user ${userId} at ${resolution}`);

        try {
            // Update status to processing
            await snap.ref.update({
                status: "processing",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Call Cloud Run Service
            // Note: In a real deployment, you might want to use Pub/Sub for async processing
            // or ensure this function has a long enough timeout.
            // For now, we'll fire and forget or wait depending on the architecture.
            // Since Cloud Functions have a timeout, it's safer to just trigger the job.

            // However, our Python service is synchronous for simplicity in this demo.
            // A better production pattern is: Cloud Function -> Pub/Sub -> Cloud Run -> Firestore

            await axios.post(CLOUD_RUN_URL, {
                requestId,
                imageUrl,
                userId,
                resolution
            });

            console.log(`Successfully triggered Cloud Run for request ${requestId}`);

        } catch (error) {
            console.error(`Error processing request ${requestId}:`, error);

            await snap.ref.update({
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });
