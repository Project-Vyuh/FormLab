/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gemini API Client - Frontend wrapper for Cloud Functions
 * Replaces direct Gemini API calls with secure Firebase Cloud Functions
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { GenerationSettings, VideoGenerationSettings, UpscaleResolution, GarmentAnalysis } from "../types";

// Get Firebase Functions instance
const functions = getFunctions();

/**
 * Convert File to base64 string
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Extract base64 data without data URL prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert data URL to base64 string (remove data URL prefix)
 */
function dataUrlToBase64(dataUrl: string): string {
  if (dataUrl.startsWith("data:")) {
    return dataUrl.split(",")[1];
  }
  return dataUrl;
}

/**
 * Convert URL (data URL or blob URL) to base64
 */
async function urlToBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) {
    return dataUrlToBase64(url);
  }

  // Fetch blob URL and convert to base64
  const response = await fetch(url);
  const blob = await response.blob();
  const file = new File([blob], "image.jpg", { type: blob.type });
  return await fileToBase64(file);
}

/**
 * Generate model image from uploaded photo
 */
export async function generateModelImage(
  userImage: File,
  settings: GenerationSettings
): Promise<string> {
  const generateFn = httpsCallable(functions, "generateModelImage");

  const fileData = await fileToBase64(userImage);

  const result = await generateFn({
    fileData,
    fileName: userImage.name,
    settings,
  });

  return (result.data as { imageUrl: string }).imageUrl;
}

/**
 * Generate model from text description
 */
export async function generateModelFromDescription(
  description: string,
  settings: GenerationSettings,
  model: string
): Promise<string> {
  const generateFn = httpsCallable(functions, "generateModelFromDescription");

  const result = await generateFn({
    description,
    settings,
    model,
  });

  return (result.data as { imageUrl: string }).imageUrl;
}

/**
 * Generate virtual try-on image
 */
export async function generateVirtualTryOnImage(
  modelImageUrl: string,
  garmentImage: File,
  settings: GenerationSettings
): Promise<string> {
  const tryOnFn = httpsCallable(functions, "generateVirtualTryOn");

  const modelImageData = await urlToBase64(modelImageUrl);
  const garmentImageData = await fileToBase64(garmentImage);

  const result = await tryOnFn({
    modelImageData,
    garmentImageData,
    settings,
  });

  return (result.data as { imageUrl: string }).imageUrl;
}

/**
 * Revise generated image with prompt
 */
export async function reviseGeneratedImage(
  baseImageUrl: string,
  revisionPrompt: string,
  settings: GenerationSettings
): Promise<string> {
  const reviseFn = httpsCallable(functions, "reviseGeneratedImage");

  const baseImageData = await urlToBase64(baseImageUrl);

  const result = await reviseFn({
    baseImageData,
    revisionPrompt,
    settings,
  });

  return (result.data as { imageUrl: string }).imageUrl;
}

/**
 * Revise image with mask
 */
export async function reviseMaskedImage(
  baseImageUrl: string,
  maskDataUrl: string,
  revisionPrompt: string,
  settings: GenerationSettings
): Promise<string> {
  // For masked revision, we can use the same endpoint with additional mask data
  const reviseFn = httpsCallable(functions, "reviseGeneratedImage");

  const baseImageData = await urlToBase64(baseImageUrl);
  const maskData = dataUrlToBase64(maskDataUrl);

  const result = await reviseFn({
    baseImageData,
    maskData,
    revisionPrompt,
    settings,
  });

  return (result.data as { imageUrl: string }).imageUrl;
}

/**
 * Upscale image
 */
export async function upscaleImage(
  baseImageUrl: string,
  resolution: UpscaleResolution
): Promise<string> {
  const upscaleFn = httpsCallable(functions, "upscaleImage");

  const baseImageData = await urlToBase64(baseImageUrl);

  const result = await upscaleFn({
    baseImageData,
    resolution,
  });

  return (result.data as { imageUrl: string }).imageUrl;
}

/**
 * Selectively enhance parts of image
 */
export async function selectivelyEnhanceImage(
  baseImageUrl: string,
  target: "face" | "fabric" | "accessories"
): Promise<string> {
  const enhanceFn = httpsCallable(functions, "selectivelyEnhanceImage");

  const baseImageData = await urlToBase64(baseImageUrl);

  const result = await enhanceFn({
    baseImageData,
    target,
  });

  return (result.data as { imageUrl: string }).imageUrl;
}

/**
 * Enhance description prompt
 */
export async function enhanceDescriptionPrompt(
  userInput: string,
  targetModel: "gemini-2.5-flash-image"
): Promise<string> {
  const enhanceFn = httpsCallable(functions, "enhancePrompt");

  const result = await enhanceFn({
    userInput,
    targetModel,
  });

  return (result.data as { enhancedPrompt: string }).enhancedPrompt;
}

/**
 * Enhance revision prompt
 */
export async function enhanceRevisionPrompt(
  baseImageUrl: string,
  userInput: string,
  originalDescription?: string
): Promise<string> {
  const enhanceFn = httpsCallable(functions, "enhancePrompt");

  const result = await enhanceFn({
    userInput,
    targetModel: "gemini-2.5-flash-image",
    baseImageUrl,
    originalDescription,
  });

  return (result.data as { enhancedPrompt: string }).enhancedPrompt;
}

/**
 * Generate pose variation
 */
export async function generatePoseVariation(
  tryOnImageUrl: string,
  poseInstruction: string,
  settings: GenerationSettings
): Promise<string> {
  return reviseGeneratedImage(tryOnImageUrl, poseInstruction, settings);
}

/**
 * Regenerate frame (same as revise with generic prompt)
 */
export async function regenerateFrame(
  baseImageUrl: string,
  settings: GenerationSettings
): Promise<string> {
  return reviseGeneratedImage(
    baseImageUrl,
    "Regenerate this image with slightly different variations while keeping the core subject and style.",
    settings
  );
}

/**
 * Analyze garment
 */
export async function analyzeGarment(garmentImage: File): Promise<GarmentAnalysis> {
  const analyzeFn = httpsCallable(functions, "analyzeGarment");

  const garmentImageData = await fileToBase64(garmentImage);

  const result = await analyzeFn({
    garmentImageData,
  });

  const analysisText = (result.data as { analysis: string }).analysis;

  try {
    return JSON.parse(analysisText);
  } catch {
    // If parsing fails, return a default structure
    return {
      palette: [],
      category: "Unknown",
      material: "Unknown",
    };
  }
}

/**
 * Generate video from image
 */
export async function generateVideoFromImage(
  referenceImageUrl: string,
  settings: VideoGenerationSettings
): Promise<string> {
  const videoFn = httpsCallable(functions, "generateVideo");

  const referenceImageData = await urlToBase64(referenceImageUrl);

  const result = await videoFn({
    referenceImageData,
    settings,
  });

  const { videoData, mimeType } = result.data as { videoData: string; mimeType: string };

  // Convert base64 video data to blob URL
  const binaryString = atob(videoData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Virtual try-on with pose reference
 */
export async function generateVirtualTryOnWithPoseReference(
  modelImageUrl: string,
  garmentImage: File,
  poseReferenceImageUrl: string,
  settings: GenerationSettings
): Promise<string> {
  // For now, use standard try-on (pose reference can be added to Cloud Function later)
  return generateVirtualTryOnImage(modelImageUrl, garmentImage, settings);
}
