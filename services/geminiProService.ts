/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, GenerateContentResponse, Modality, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { GenerationSettings, GarmentAnalysis, ShotFraming } from "../types";
import { storage } from "./firebase";
import { ref, getBlob } from "firebase/storage";
import {
    getGenerationPromptSuffix,
    getStudioEnvironmentPrompt,
    getLightingPrompt,
    getCameraPositionPrompt,
    buildEnhancedTryOnPrompt,
    buildBasicTryOnPrompt,
    analyzeGarmentDetailed, // Re-use analysis from main service as it is model-agnostic
    generateDetailedGarmentDescription, // Helper function
    // Re-export model-agnostic functions
    upscaleImage,
    selectivelyEnhanceImage,
} from "./geminiService";

// Re-export model-agnostic functions for convenience
export { upscaleImage, selectivelyEnhanceImage, analyzeGarmentDetailed, generateDetailedGarmentDescription };

export interface GenerationResult {
    imageUrl: string;
    thoughts?: string;
}

// Helper for file to part conversion (duplicated to avoid circular dependency issues if not exported)
const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    return { mimeType: mimeMatch[1], data: arr[1] };
}

// Convert any URL (data URL, blob URL, or Firebase Storage URL) to base64 data URL
const urlToDataUrl = async (url: string): Promise<string> => {
    if (url.startsWith('data:')) return url;

    try {
        let blob: Blob;
        if (url.includes('firebasestorage.googleapis.com')) {
            const urlObj = new URL(url);
            const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(?:\?|$)/);
            if (pathMatch && pathMatch[1]) {
                const storagePath = decodeURIComponent(pathMatch[1]);
                const storageRef = ref(storage, storagePath);
                blob = await getBlob(storageRef);
            } else {
                throw new Error('Invalid Firebase Storage URL format');
            }
        } else {
            const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            blob = await response.blob();
        }

        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Failed to fetch and convert URL to data URL:', error);
        throw new Error('Failed to load image from URL');
    }
}

const dataUrlToPart = async (url: string) => {
    const dataUrl = await urlToDataUrl(url);
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

const applyProFeatures = (config: any, settings: GenerationSettings) => {
    const tools: any[] = [];

    // Nano Banana Pro features should be ENABLED by default if not explicitly set
    const googleSearchGrounding = settings.googleSearchGrounding ?? true;
    const thinkingMode = settings.thinkingMode ?? true;
    const imageSize = settings.imageSize || '1K';

    console.log('[GeminiProService] Applying Pro Features:', {
        googleSearchGrounding,
        thinkingMode,
        imageSize
    });

    // Ensure responseModalities exists
    if (!config.responseModalities) {
        config.responseModalities = [Modality.IMAGE];
    }

    // Grounding with Google Search
    if (googleSearchGrounding) {
        console.log('[GeminiProService] Enabling Google Search Grounding');
        tools.push({ google_search: {} });
        if (!config.responseModalities.includes(Modality.TEXT)) {
            config.responseModalities.push(Modality.TEXT);
        }
    }

    // Thinking Mode (Internal reasoning)
    if (thinkingMode) {
        console.log('[GeminiProService] Enabling Thinking Mode (TEXT modality)');
        if (!config.responseModalities.includes(Modality.TEXT)) {
            config.responseModalities.push(Modality.TEXT);
        }
    }

    // Image Size (Resolution) and Aspect Ratio - Nano Banana Pro Specific
    const imageConfig: any = { ...(config.imageConfig || {}) };

    if (imageSize) {
        console.log(`[GeminiProService] Setting Resolution: ${imageSize}`);
        imageConfig.imageSize = imageSize;
    }

    if (settings.aspectRatio) {
        console.log(`[GeminiProService] Setting Aspect Ratio: ${settings.aspectRatio}`);
        imageConfig.aspectRatio = settings.aspectRatio;
    }

    if (Object.keys(imageConfig).length > 0) {
        config.imageConfig = imageConfig;
    }

    return tools.length > 0 ? tools : undefined;
};

const handleApiResponse = (response: GenerateContentResponse): GenerationResult => {
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        throw new Error(errorMessage);
    }

    let imageUrl: string | undefined;
    let thoughts: string | undefined;

    for (const candidate of response.candidates ?? []) {
        // Capture thoughts (TEXT modality)
        const textParts = candidate.content?.parts?.filter(part => part.text);
        if (textParts && textParts.length > 0) {
            thoughts = textParts.map(p => p.text).join('\n\n');
            console.log('[GeminiProService] SUCCESS: Captured reasoning/thoughts (Length:', thoughts.length, ')');
        }

        // Capture image (IMAGE modality)
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            imageUrl = `data:${mimeType};base64,${data}`;
        }
    }

    if (imageUrl) {
        return { imageUrl, thoughts };
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        throw new Error(`Image generation stopped unexpectedly. Reason: ${finishReason}`);
    }
    const textFeedback = response.text?.trim();
    throw new Error(`The AI model did not return an image. ` + (textFeedback ? `Response: "${textFeedback}"` : "Please try again."));
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
const MODEL_NAME = 'gemini-3-pro-image-preview'; // Nano Banana Pro

const REALISM_TOKENS = "8k resolution, raw photo, cinematic lighting, sharp focus, Fujifilm GFX 100, Kodak Portra 400, hyper-detailed skin texture, visible pores, vellus hair, subsurface scattering, natural complexion imperfections, slight skin unevenness, realistic eyes, moist lips, no airbrushing, highly detailed, micro-details, peach fuzz, natural skin oils, imperfect skin texture, Phase One XF IQ4, Profoto studio lighting";
const ANATOMY_TOKENS = "perfectly rendered hands, anatomically correct fingers, symmetrical facial features, natural eyes with corneal reflections, realistic muscle definition, natural posture, micro-expressions";
const QA_NEGATIVE_PROMPT = "mannequin, plastic skin, waxy skin, doll-like, artificial, CGI, 3d render, illustration, cartoon, anime, drawing, painting, bad anatomy, disfigured, extra limbs, fused fingers, blurry, low quality, jpeg artifacts, watermark, text, logo, oversmoothed, airbrushed, makeup heavy, distorted face, bad hands, bad feet, shoes, socks, footwear, pants, leggings (unless specified), dead eyes, blank stare, stiff pose";

const FEMALE_BODY_TOKENS = "feminine physique, hourglass figure, soft continuous curves, visual flow from shoulders to hips, lower visual center of mass, sloping shoulders, tapered limbs, smooth transitions, non-angular features, elegant stature, curvature over linearity, soft muscle definition";
const MALE_BODY_TOKENS = "masculine physique, broad shoulders, V-taper, athletic build, defined musculature, strong jawline";

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const getOutfitPrompt = (genderInput: string): string => {
    const lowerInput = genderInput.toLowerCase();
    // Regex for strict word boundary detection to avoid "male" matching inside "female"
    const isFemale = /\b(female|woman|girl|lady|she|her|hers)\b/i.test(lowerInput);
    // Ensure we don't accidentally match "male" if the string is just "female" (unlikely with word boundaries but safe)
    const isMale = /\b(male|man|boy|guy|he|him|his)\b/i.test(lowerInput) && !isFemale;

    let outfitDescription = "";
    if (isFemale) {
        outfitDescription = "a minimal, skin-tight, solid heather grey athletic crop top and matching tight boy shorts (underwear style)";
    } else if (isMale) {
        outfitDescription = "a minimal, skin-tight, solid heather grey athletic tank top and matching tight boxer briefs (underwear style)";
    } else {
        outfitDescription = "EITHER a minimal, skin-tight, solid heather grey athletic crop top and matching tight boy shorts (if female) OR a minimal, skin-tight, solid heather grey athletic tank top and matching tight boxer briefs (if male)";
    }

    return `The model MUST be wearing a specific base outfit: ${outfitDescription}. The outfit must be simple, unbranded, and form-fitting to clearly show the model's physique for virtual try-on. The model must be barefoot. NO other clothing, shoes, or accessories are allowed unless explicitly specified in the user prompt. Ensure the outfit does not distort the natural body flow.`;
};

const getGenderedBodyPrompt = (genderInput: string): string => {
    const lowerInput = genderInput.toLowerCase();
    // Regex for strict word boundary detection
    const isFemale = /\b(female|woman|girl|lady|she|her|hers)\b/i.test(lowerInput);
    const isMale = /\b(male|man|boy|guy|he|him|his)\b/i.test(lowerInput) && !isFemale;

    if (isFemale) return FEMALE_BODY_TOKENS;
    if (isMale) return MALE_BODY_TOKENS;
    return "";
};

const getFramingPrompt = (framing: ShotFraming | undefined): string => {
    if (!framing || framing === 'full') {
        return "FULL BODY SHOT (Head to Toe). FRONT CAMERA ANGLE. Direct eye contact with the lens. The model must be facing the camera for a professional photoshoot. The entire model from the top of the head to the soles of the feet MUST be visible. Do not crop the head or feet. The model should be centered in the frame with a small amount of headroom and footroom.";
    }

    const framingMap: Record<ShotFraming, string> = {
        'full': "FULL BODY SHOT (Head to Toe). FRONT CAMERA ANGLE. Direct eye contact. Professional photoshoot composition. The entire model from the top of the head to the soles of the feet MUST be visible. Do not crop the head or feet.",
        'medium': "MEDIUM SHOT (Waist Up). The frame should capture the model from the waist up to the top of the head.",
        'closeup': "CLOSE-UP SHOT (Face and Shoulders). The frame should focus tightly on the model's face and shoulders."
    };

    return framingMap[framing];
};

const getPoseAndExpressionPrompt = (settings: GenerationSettings): string => {
    if (settings.posePrompt && settings.posePrompt.trim().length > 0) {
        return `**Pose & Expression:** ${settings.posePrompt}. Ensure the expression is natural and engaging.`;
    }

    const dynamicPoses = [
        "walking confidently directly towards the camera",
        "standing straight with weight on one leg, slight hip tilt, facing forward",
        "standing tall, arms relaxed by sides, facing camera",
        "mid-stride walking towards camera, capturing motion",
        "strong fashion stance, facing forward",
        "hands in pockets (if applicable), relaxed stance, facing camera",
        "high fashion symmetric pose, facing camera"
    ];

    const expressions = [
        "confident and fierce",
        "soft smile, approachable",
        "neutral but intense fashion gaze",
        "slight smirk, knowing look",
        "calm and serene"
    ];

    const randomPose = dynamicPoses[Math.floor(Math.random() * dynamicPoses.length)];
    const randomExpression = expressions[Math.floor(Math.random() * expressions.length)];

    return `**Dynamic Pose:** ${randomPose}. **Expression:** ${randomExpression}. The model should look alive, with engaging eyes and natural micro-expressions. Avoid stiff, robotic, or mannequin-like poses.`;
};

// --- Main Generation Functions for Gemini 3 Pro ---

export const generateModelImagePro = async (userImages: File[], settings: GenerationSettings): Promise<GenerationResult> => {
    const imageParts = await Promise.all(userImages.map(fileToPart));

    // Use the EXACT same prompt construction as Nano Banana (geminiService.ts generateModelImage)
    // Conditionally apply Global Controls based on panel toggles
    const lightingPrompt = settings.panelToggles.lighting
        ? getLightingPrompt(settings.lightingRig, settings.accessoryPrompt)
        : '';
    const environmentPrompt = settings.panelToggles.environment
        ? getStudioEnvironmentPrompt(settings.studioEnvironment, settings.shadowSculpting, settings.floorSettings)
        : '';
    const cameraPrompt = getGenerationPromptSuffix(settings, { exclude: ['lightingRig', 'studioEnvironment', 'floorSettings', 'shadowSculpting'] });

    const framingPrompt = getFramingPrompt(settings.shotFraming);
    const outfitRule = getOutfitPrompt("female"); // Default to female if no description provided for image upload
    const posePrompt = getPoseAndExpressionPrompt(settings);

    // ENHANCED prompt structure for MULTI-IMAGE identity preservation
    const prompt = `[ROLE]
You are a world-class professional fashion photographer and digital artist, renowned for creating ultra-realistic, high-end studio portraits. You are using a Phase One XF IQ4 150MP camera system.

[TASK]
Generate a RAW, Hyper-Realistic Photo of a model based on the ${imageParts.length} provided reference images and the following strict technical specifications.

[STRICT OUTFIT RULE]
${outfitRule}

[STRICT FRAMING RULE]
${framingPrompt}

[CRITICAL: MULTI-IMAGE IDENTITY PRESERVATION (HIGHEST PRIORITY)]
You have been provided with ${imageParts.length} reference images of the same subject. 
**IMPORTANT INSTRUCTIONS**:

1. INTEGRATED IDENTITY ANALYSIS:
   - Carefully analyze ALL provided reference images to build a comprehensive 3D understanding of the subject's identity.
   - Cross-reference features across different angles, lighting conditions, and expressions to ensure 100% forensic accuracy.
   - If there are variations in the user's appearance across images, prioritize the most consistent features to maintain a coherent identity.

2. SUBJECT EXTRACTION & POSITIONING:
   - The actual person/model is the subject. Preserve their exact facial features, body proportions, and build.
   - Frame the subject according to the shot type specified in [STRICT FRAMING RULE].
   - The subject should appear as if photographed directly in the studio environment.

3. BACKGROUND RENDERING:
   - The ENTIRE output must use the studio background specified in [STUDIO SETUP & GLOBAL CONTROLS].
   - Extend the background seamlessly to all edges of the output frame.
   - NO padding artifacts, black/white bars, or borders should appear.

4. FORENSIC FACIAL & BODY ACCURACY:
   - Match the subject's facial features with EXTREME precision based on the set of images:
     * Exact eye shape, color, spacing, and habitual expression.
     * Precise nose structure (bridge, tip, nostrils) from multiple angles.
     * Accurate mouth shape, lip fullness, and natural resting state.
     * Identical face shape, jawline, and unique facial architecture.
     * Exact skin tone, texture, and permanent features (freckles, moles, scars).
   - Preserve exact body proportions and build:
     * Same height-to-width ratio, shoulder width, and posture.
     * Matching limb proportions and athleticism.
   - Maintain the same hair:
     * Exact color, texture, volume, and hairline.

CRITICAL: The output must show a seamless studio photograph. The subject's identity must be indistinguishable from the person in the reference images.

[DYNAMIC POSE & EXPRESSION]
${posePrompt}

[STUDIO SETUP & GLOBAL CONTROLS]
${lightingPrompt}
${environmentPrompt}
${cameraPrompt}

[TECHNICAL SPECIFICATIONS]
- Aspect Ratio: ${settings.aspectRatio}
- Constraint: Ensure the subject fits completely within the ${settings.aspectRatio} frame.

[SUBJECT SPECIFICATIONS]
- Identity: Match the subject across all ${imageParts.length} reference photos with forensic accuracy.
- Skin Details: ${REALISM_TOKENS}
- Anatomy: ${ANATOMY_TOKENS}

[NEGATIVE CONSTRAINTS]
${QA_NEGATIVE_PROMPT}
Do not generate: cropped head, cropped feet, missing limbs, extra limbs, distorted face, bad hands, bad feet, cartoonish style, illustration style, low resolution, blurry, artifacts, watermark, text, signature, shoes (unless specified), socks (unless specified), black borders, identity mismatch.`;

    // Construct generation config - SAME as Nano Banana
    const generationConfig: any = {
        responseModalities: [Modality.IMAGE],
        safetySettings: SAFETY_SETTINGS,
    };

    const tools = applyProFeatures(generationConfig, settings);

    console.log(`[GeminiProService] Sending generateContent request with ${imageParts.length} reference images (Pro)...`);
    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [...imageParts, { text: prompt }] },
        config: generationConfig,
        tools: tools,
    } as any);
    return handleApiResponse(response);
};

export const generateModelFromDescriptionPro = async (description: string, settings: GenerationSettings): Promise<GenerationResult> => {
    // Use the EXACT same prompt construction as Nano Banana (geminiService.ts generateModelFromDescription)
    // Conditionally apply Global Controls based on panel toggles
    const lightingPrompt = settings.panelToggles.lighting
        ? getLightingPrompt(settings.lightingRig, settings.accessoryPrompt)
        : '';
    const environmentPrompt = settings.panelToggles.environment
        ? getStudioEnvironmentPrompt(settings.studioEnvironment, settings.shadowSculpting, settings.floorSettings)
        : '';
    const cameraPrompt = getGenerationPromptSuffix(settings, { exclude: ['lightingRig', 'studioEnvironment', 'floorSettings', 'shadowSculpting'] });

    const framingPrompt = getFramingPrompt(settings.shotFraming);
    const outfitRule = getOutfitPrompt(description);
    const posePrompt = getPoseAndExpressionPrompt(settings);

    // EXACT prompt structure from Nano Banana - no modifications
    const structuredPrompt = `[ROLE]
You are a world-class professional fashion photographer and digital artist, renowned for creating ultra-realistic, high-end studio portraits. You are using a Phase One XF IQ4 150MP camera system.

[TASK]
Generate a RAW, Hyper-Realistic Photo of a model based on the description and the following strict technical specifications.

[STRICT OUTFIT RULE]
${outfitRule}

[STRICT FRAMING RULE]
${framingPrompt}

[DYNAMIC POSE & EXPRESSION]
${posePrompt}

[STUDIO SETUP & GLOBAL CONTROLS]
${lightingPrompt}
${environmentPrompt}
${cameraPrompt}

[TECHNICAL SPECIFICATIONS]
- Aspect Ratio: ${settings.aspectRatio}
- Constraint: Ensure the subject fits completely within the ${settings.aspectRatio} frame.

[SUBJECT SPECIFICATIONS]
- Appearance: ${description}
- Skin Details: ${REALISM_TOKENS}
- Anatomy: ${ANATOMY_TOKENS}

[NEGATIVE CONSTRAINTS]
${QA_NEGATIVE_PROMPT}
Do not generate: cropped head, cropped feet, missing limbs, extra limbs, distorted face, bad hands, bad feet, cartoonish style, illustration style, low resolution, blurry, artifacts, watermark, text, signature, shoes (unless specified), socks (unless specified).`;

    // Construct generation config - SAME as Nano Banana
    const generationConfig: any = {
        responseModalities: [Modality.IMAGE],
        safetySettings: SAFETY_SETTINGS,
    };

    // Only add image size if explicitly specified by user (not a default)
    const tools = applyProFeatures(generationConfig, settings);

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [{ text: structuredPrompt }] },
        config: generationConfig,
        tools: tools,
    } as any);

    return handleApiResponse(response);
};

export const reviseGeneratedImagePro = async (
    baseImageUrl: string,
    revisionInstruction: string,
    settings: GenerationSettings,
    outfitInstruction?: string
): Promise<GenerationResult> => {
    const baseImagePart = await dataUrlToPart(baseImageUrl);
    const promptSuffix = getGenerationPromptSuffix(settings);

    // Use the EXACT same prompt structure as Nano Banana (geminiService.ts reviseGeneratedImage)
    const outfitRule = outfitInstruction || getOutfitPrompt(revisionInstruction);
    const framingPrompt = getFramingPrompt(settings.shotFraming);

    const prompt = `[ROLE]
You are a specialized AI Fashion Editor & Retoucher.

[TASK]
Edit the provided image based on the User Request, while maintaining Hyper-Realistic quality.

[USER REQUEST]
"${revisionInstruction}"

[TECHNICAL SPECIFICATIONS]
- Framing: ${framingPrompt}
- Camera Position: ${getCameraPositionPrompt(settings.cameraPosition)}

[SUBJECT SPECIFICATIONS]
- Identity: Maintain the model's identity and professional style.
- Skin Details: ${REALISM_TOKENS}
- Anatomy: ${ANATOMY_TOKENS}

[STRICT WARDROBE CONSTRAINTS]
${outfitInstruction ? `- Rule: ${outfitInstruction}` : `- Item: Neutral, form-fitting boxer briefs or boy shorts.
- Material: ${outfitRule}
- Rule: DO NOT change the outfit unless the user's request is *explicitly* about changing the clothing itself.`}

[STYLE & ENVIRONMENT]
${promptSuffix}

[NEGATIVE CONSTRAINTS]
${QA_NEGATIVE_PROMPT}`;

    // Construct generation config - SAME as Nano Banana
    const generationConfig: any = {
        responseModalities: [Modality.IMAGE],
        safetySettings: SAFETY_SETTINGS,
    };

    // Only add image size if explicitly specified by user (not a default)
    const tools = applyProFeatures(generationConfig, settings);

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [baseImagePart, { text: prompt }] },
        config: generationConfig,
        tools: tools,
    } as any);
    return handleApiResponse(response);
};

// --- Virtual Try-On Functions for Gemini 3 Pro ---

export const generateVirtualTryOnImagePro = async (
    modelImageUrl: string,
    garmentImage: File,
    settings: GenerationSettings,
    garmentAnalysis?: GarmentAnalysis
): Promise<GenerationResult> => {
    const modelImagePart = await dataUrlToPart(modelImageUrl);
    const garmentImagePart = await fileToPart(garmentImage);

    const promptSuffix = getGenerationPromptSuffix(settings, { exclude: ['studioEnvironment' as any] });

    // CRITICAL: Check if environment panel is enabled. If not, preserve original background.
    let backgroundInstruction = '';
    if (settings.panelToggles?.environment) {
        backgroundInstruction = getStudioEnvironmentPrompt(settings.studioEnvironment, settings.shadowSculpting, settings.floorSettings);
    } else {
        backgroundInstruction = " **Background Preservation:** The background MUST remain EXACTLY as it is in the Model Image. Do NOT replace, blur, or alter the background in any way. The subject should be integrated naturally into this existing environment.";
    }

    let prompt: string;

    // Use enhanced prompt if enabled and analysis is provided
    if (settings.useEnhancedTryOn !== false && garmentAnalysis) {
        const garmentDescription = generateDetailedGarmentDescription(garmentAnalysis);
        prompt = buildEnhancedTryOnPrompt(garmentDescription, settings, backgroundInstruction, promptSuffix);
    } else {
        // NATIVE PRO MODE (No external analysis)
        // Gemini 3 Pro has superior visual reasoning. We instruct it to look at the garment image directly.
        const garmentDescription = "The garment shown in the second image. PRESERVE its exact texture, material, construction, and details with forensic accuracy.";
        prompt = buildEnhancedTryOnPrompt(garmentDescription, settings, backgroundInstruction, promptSuffix);
    }

    // Construct generation config
    const generationConfig: any = {
        responseModalities: [Modality.IMAGE],
        safetySettings: SAFETY_SETTINGS,
    };

    // Add image size if specified (Nano Banana Pro specific)
    const tools = applyProFeatures(generationConfig, settings);

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
        config: generationConfig,
        tools: tools,
    } as any);
    return handleApiResponse(response);
};

export const generateVirtualTryOnWithPoseReferencePro = async (
    modelImageUrl: string,
    garmentImage: File,
    poseReferenceImage: File,
    settings: GenerationSettings
): Promise<GenerationResult> => {
    const modelImagePart = await dataUrlToPart(modelImageUrl);
    const garmentImagePart = await fileToPart(garmentImage);
    const poseReferenceImagePart = await fileToPart(poseReferenceImage);

    const promptSuffix = getGenerationPromptSuffix(settings, { exclude: ['studioEnvironment' as any, 'posePrompt'] });

    // CRITICAL: Check if environment panel is enabled. If not, preserve original background.
    let backgroundInstruction = '';
    if (settings.panelToggles?.environment) {
        backgroundInstruction = getStudioEnvironmentPrompt(settings.studioEnvironment, settings.shadowSculpting, settings.floorSettings);
    } else {
        backgroundInstruction = " **Background Preservation:** The background MUST remain EXACTLY as it is in the Model Image. Do NOT replace, blur, or alter the background in any way. The subject should be integrated naturally into this existing environment.";
    }

    const prompt = `You are a professional fashion AI.
**Inputs:**
1.  **Model Image:** (First image) Subject identity.
2.  **Garment Image:** (Second image) Clothing to wear.
3.  **Pose Reference:** (Third image) Target pose.

**Task:** Generate a new image of the Model wearing the Garment in the Target Pose.

**Technical Specifications:**
- **Aspect Ratio:** ${settings.aspectRatio}
- **Constraint:** Ensure the final image maintains the ${settings.aspectRatio} aspect ratio of the input model image. The subject must fit completely within this frame.

**Directives:**
1.  **Subject:** Use the Model's identity.
2.  **Attire:** Wear the Garment.
3.  **Pose:** Match the Pose Reference exactly.
4.  **Setting:** ${backgroundInstruction}
5.  **Safety:** Ensure the model is fully clothed.

${promptSuffix}`;

    // Construct generation config
    const generationConfig: any = {
        responseModalities: [Modality.IMAGE],
        safetySettings: SAFETY_SETTINGS,
    };

    // Add image size if specified (Nano Banana Pro specific)
    const tools = applyProFeatures(generationConfig, settings);

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [modelImagePart, garmentImagePart, poseReferenceImagePart, { text: prompt }] },
        config: generationConfig,
        tools: tools,
    } as any);
    return handleApiResponse(response);
};

export const generatePoseVariationPro = async (
    tryOnImageUrl: string,
    poseInstruction: string,
    settings: GenerationSettings
): Promise<GenerationResult> => {
    const tryOnImagePart = await dataUrlToPart(tryOnImageUrl);
    const promptSuffix = getGenerationPromptSuffix(settings, { exclude: ['studioEnvironment' as any, 'posePrompt'] });

    const backgroundInstruction = getStudioEnvironmentPrompt(settings.studioEnvironment, settings.shadowSculpting, settings.floorSettings);

    const prompt = `You are an expert fashion photographer AI.
**Input:** A reference image of a model.
**Task:** Regenerate this image with the model in a new pose.

**New Pose:** "${poseInstruction}"

**Instructions:**
1.  **Consistency:** Keep the same model identity and the same clothing.
2.  **Setting:** ${backgroundInstruction}
3.  **Quality:** Photorealistic fashion shot.

${promptSuffix}`;

    // Construct generation config
    const generationConfig: any = {
        responseModalities: [Modality.IMAGE],
        safetySettings: SAFETY_SETTINGS,
    };

    // Add image size if specified (Nano Banana Pro specific)
    const tools = applyProFeatures(generationConfig, settings);

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [tryOnImagePart, { text: prompt }] },
        config: generationConfig,
        tools: tools,
    } as any);
    return handleApiResponse(response);
};

export const reviseMaskedImagePro = async (
    baseImageUrl: string,
    maskDataUrl: string,
    revisionPrompt: string,
    settings: GenerationSettings
): Promise<GenerationResult> => {
    const baseImagePart = await dataUrlToPart(baseImageUrl);
    const maskImagePart = await dataUrlToPart(maskDataUrl);

    const prompt = `You are a specialized AI fashion editor performing a masked inpainting task.
    **Inputs:**
    1. **Base Image:** The source image to be edited.
    2. **Mask Image:** A black and white image where the white area indicates the region to be modified.
    
    **User Request:** "${revisionPrompt}"

    **Instructions:**
    1.  Apply the user's request ONLY within the white area defined by the Mask Image.
    2.  The rest of the image (the black area in the mask) MUST remain completely unchanged.
    3.  Seamlessly blend the changes into the base image.
    4.  **CRITICAL CLOTHING RULE:** Preserve the existing neutral, form-fitting athletic wear. DO NOT change the outfit unless the user's request is *explicitly* about changing the clothing itself.
    5.  Maintain the model's overall identity and the professional style of the photograph.
    6.  The output MUST remain a full-body shot. Do not crop.

    Return ONLY the final, edited image.` + getOutfitPrompt(revisionPrompt);

    // Construct generation config
    const generationConfig: any = {
        responseModalities: [Modality.IMAGE],
        safetySettings: SAFETY_SETTINGS,
    };

    // Add image size if specified (Nano Banana Pro specific)
    const tools = applyProFeatures(generationConfig, settings);

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [baseImagePart, maskImagePart, { text: prompt }] },
        config: generationConfig,
        tools: tools,
    } as any);

    return handleApiResponse(response);
};

export const regenerateFramePro = async (
    baseImageUrl: string,
    settings: GenerationSettings
): Promise<GenerationResult> => {
    const baseImagePart = await dataUrlToPart(baseImageUrl);
    const { aspectRatio } = settings;
    const promptSuffix = getGenerationPromptSuffix(settings, { exclude: ['aspectRatio' as any, 'shotFraming'] });

    const prompt = `You are an expert AI photo compositor.
**Task:** Resize/Reframe the provided image to a strict **${aspectRatio}** aspect ratio.

**Instructions:**
1.  **Aspect Ratio:** The output MUST be ${aspectRatio}.
2.  **Content:** Preserve the model, outfit, and background logic.
3.  **Fill:** If expanding the frame, generate a seamless background extension that matches the original scene.
4.  **Style:** ${promptSuffix}

Return ONLY the final image.` + getOutfitPrompt("female");

    // Construct generation config
    const generationConfig: any = {
        responseModalities: [Modality.IMAGE],
        safetySettings: SAFETY_SETTINGS,
    };

    const tools = applyProFeatures(generationConfig, settings);

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [baseImagePart, { text: prompt }] },
        config: generationConfig,
        tools: tools,
    } as any);
    return handleApiResponse(response);
};
