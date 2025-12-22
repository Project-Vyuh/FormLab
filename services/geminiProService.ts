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
    analyzeGarmentDetailed, // Re-use analysis from main service as it is model-agnostic
    generateDetailedGarmentDescription, // Helper function (assumed exported or needs to be duplicated if not)
} from "./geminiService";

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

const handleApiResponse = (response: GenerateContentResponse): string => {
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        throw new Error(errorMessage);
    }

    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
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

const FEMALE_BODY_TOKENS = "feminine physique, hourglass figure, soft curves, elegant posture, delicate yet defined features, aesthetic proportions";
const MALE_BODY_TOKENS = "masculine physique, broad shoulders, V-taper, athletic build, defined musculature, strong jawline";

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const getOutfitPrompt = (genderInput: string): string => {
    const lowerInput = genderInput.toLowerCase();
    const isFemale = lowerInput === 'female' || lowerInput.includes('woman') || lowerInput.includes('girl') || lowerInput.includes('lady') || lowerInput.includes('she');
    const isMale = lowerInput === 'male' || lowerInput.includes('man') || lowerInput.includes('boy') || lowerInput.includes('guy') || lowerInput.includes('he');

    let outfitDescription = "";
    if (isFemale) {
        outfitDescription = "a minimal, skin-tight, solid heather grey athletic crop top and matching tight boy shorts (underwear style)";
    } else if (isMale) {
        outfitDescription = "a minimal, skin-tight, solid heather grey athletic tank top and matching tight boxer briefs (underwear style)";
    } else {
        outfitDescription = "EITHER a minimal, skin-tight, solid heather grey athletic crop top and matching tight boy shorts (if female) OR a minimal, skin-tight, solid heather grey athletic tank top and matching tight boxer briefs (if male)";
    }

    return `The model MUST be wearing a specific base outfit: ${outfitDescription}. The outfit must be simple, unbranded, and form-fitting to clearly show the model's physique for virtual try-on. The model must be barefoot. NO other clothing, shoes, or accessories are allowed unless explicitly specified in the user prompt.`;
};

const getGenderedBodyPrompt = (genderInput: string): string => {
    const lowerInput = genderInput.toLowerCase();
    const isFemale = lowerInput === 'female' || lowerInput.includes('woman') || lowerInput.includes('girl') || lowerInput.includes('lady') || lowerInput.includes('she');
    const isMale = lowerInput === 'male' || lowerInput.includes('man') || lowerInput.includes('boy') || lowerInput.includes('guy') || lowerInput.includes('he');

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
        "walking confidently towards the camera",
        "standing with weight on one leg, slight hip tilt",
        "leaning casually against an invisible wall",
        "mid-stride, capturing motion",
        "three-quarter turn, looking over the shoulder",
        "hands in pockets (if applicable), relaxed stance",
        "dynamic fashion pose, angular limbs"
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

export const generateModelImagePro = async (userImage: File, settings: GenerationSettings): Promise<string> => {
    const userImagePart = await fileToPart(userImage);

    const promptSuffix = getGenerationPromptSuffix(settings);
    const framingPrompt = getFramingPrompt(settings.shotFraming);
    const outfitRule = getOutfitPrompt("female");
    const bodyTypePrompt = getGenderedBodyPrompt("female"); // Default to female for image uploads if unknown, or rely on reference. But usually "female" prompt is safe baseline for parsing.
    const posePrompt = getPoseAndExpressionPrompt(settings);

    // Check if environment is toggled. If NOT, force the high-end studio white background default.
    let finalPromptSuffix = promptSuffix;
    if (!settings.panelToggles.environment) {
        finalPromptSuffix += " [DEFAULT ENVIRONMENT] Professional High-End Fashion Studio. Pure WHITE seamless background. Soft, evenly diffused studio lighting. No shadows on background. Clean, commercial look.";
    }

    const prompt = `[ROLE]
You are a world-class professional fashion photographer and digital artist using a Phase One XF IQ4 150MP camera system.

[TASK]
Generate a RAW, Hyper-Realistic Photo of a model based on the reference image.

[SUBJECT SPECIFICATIONS - HIGHEST PRIORITY]
- Identity: Match the face, hair, and ethnicity of the reference photo.
- Body Type: ${bodyTypePrompt} (Adapt to match reference image if different)
- Skin Details: ${REALISM_TOKENS}
- Anatomy: ${ANATOMY_TOKENS}
CRITICAL: The Subject Specifications take precedence over any default outfit or style rules if they conflict on body type or gender.

[STRICT OUTFIT RULE]
${outfitRule}
CRITICAL: The outfit MUST be the minimal base layer described above (Heather Grey). DO NOT generate fashion clothes unless EXPLICITLY requested.

[STRICT FRAMING RULE]
${framingPrompt}

[REFERENCE IMAGE INSTRUCTIONS]
The reference image is preprocessed to 1:1.
1. SUBJECT EXTRACTION: Extract the person from the reference.
2. BACKGROUND: Use the settings provided below. If none, provide a clean white studio background.
3. FACE & BODY: Match the reference photo's facial features and body proportions with FORENSIC ACCURACY.
4. HAIR: Match exact color, style, and texture.

[DYNAMIC POSE & EXPRESSION]
${posePrompt}

[GLOBAL CONTROLS & SETTINGS]
${finalPromptSuffix}

[TECHNICAL SPECIFICATIONS]
- Aspect Ratio: ${settings.aspectRatio}
- Constraint: Ensure the subject fits completely within the ${settings.aspectRatio} frame.

[NEGATIVE CONSTRAINTS]
${QA_NEGATIVE_PROMPT}
Do not generate: cropped head, cropped feet, missing limbs, extra limbs, distorted face, bad hands, bad feet, cartoonish style, illustration style, low resolution, blurry, artifacts, watermark, text, signature, shoes (unless specified), socks (unless specified).`;

    // Construct generation config
    const generationConfig: any = {
        responseModalities: [Modality.IMAGE],
        safetySettings: SAFETY_SETTINGS,
    };

    // Add image size if specified (Nano Banana Pro specific)
    if (settings.imageSize) {
        generationConfig.imageConfig = {
            ...(generationConfig.imageConfig || {}),
            imageSize: settings.imageSize
        };
    }

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [userImagePart, { text: prompt }] },
        config: generationConfig,
    });
    return handleApiResponse(response);
};

export const generateModelFromDescriptionPro = async (description: string, settings: GenerationSettings): Promise<string> => {
    const promptSuffix = getGenerationPromptSuffix(settings);
    const framingPrompt = getFramingPrompt(settings.shotFraming);
    const outfitRule = getOutfitPrompt(description);
    const bodyTypePrompt = getGenderedBodyPrompt(description);
    const posePrompt = getPoseAndExpressionPrompt(settings);

    // Check if environment is toggled. If NOT, force the high-end studio white background default.
    let finalPromptSuffix = promptSuffix;
    if (!settings.panelToggles.environment) {
        finalPromptSuffix += " [DEFAULT ENVIRONMENT] Professional High-End Fashion Studio. Pure WHITE seamless background. Soft, evenly diffused studio lighting. No shadows on background. Clean, commercial look.";
    }

    const structuredPrompt = `[ROLE]
You are a world-class professional fashion photographer and digital artist using a Phase One XF IQ4 150MP camera system.

[TASK]
Generate a RAW, Hyper-Realistic Photo of a model based on the description.

[SUBJECT SPECIFICATIONS - HIGHEST PRIORITY]
- Appearance Description: ${description}
- Aesthetic Instruction: Pay strict attention to all adjectives in the description (e.g., beautiful, gorgeous, fierce, elegant). Translate these qualities into the model's features, symmetry, and presence.
- Body Type Hint: ${bodyTypePrompt}
- Skin Details: ${REALISM_TOKENS}
- Anatomy: ${ANATOMY_TOKENS}
CRITICAL: The Subject Specifications take precedence over any default outfit or style rules if they conflict on body type or gender.

[STRICT OUTFIT RULE]
${outfitRule}
CRITICAL: The outfit MUST be the minimal base layer described above (Heather Grey). DO NOT generate fashion clothes (dresses, suits, coats) unless EXPLICITLY requested in the "Appearance" description below. If the description is just about the person (e.g. "blonde woman"), use the base outfit.

[STRICT FRAMING RULE]
${framingPrompt}

[DYNAMIC POSE & EXPRESSION]
${posePrompt}

[GLOBAL CONTROLS & SETTINGS]
${finalPromptSuffix}

[TECHNICAL SPECIFICATIONS]
- Aspect Ratio: ${settings.aspectRatio}
- Constraint: Ensure the subject fits completely within the ${settings.aspectRatio} frame.

[NEGATIVE CONSTRAINTS]
${QA_NEGATIVE_PROMPT}
Do not generate: cropped head, cropped feet, missing limbs, extra limbs, distorted face, bad hands, bad feet, cartoonish style, illustration style, low resolution, blurry, artifacts, watermark, text, signature, shoes (unless specified), socks (unless specified).`;

    // Construct generation config
    const generationConfig: any = {
        responseModalities: [Modality.IMAGE],
        safetySettings: SAFETY_SETTINGS,
    };

    // Add image size if specified (Nano Banana Pro specific)
    if (settings.imageSize) {
        generationConfig.imageConfig = {
            ...(generationConfig.imageConfig || {}),
            imageSize: settings.imageSize
        };
    }

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [{ text: structuredPrompt }] },
        config: generationConfig,
    });

    return handleApiResponse(response);
};

export const reviseGeneratedImagePro = async (
    baseImageUrl: string,
    revisionInstruction: string,
    settings: GenerationSettings
): Promise<string> => {
    const baseImagePart = await dataUrlToPart(baseImageUrl);
    const promptSuffix = getGenerationPromptSuffix(settings);

    const prompt = `[ROLE]
You are a professional Retoucher and Fashion Editor.

[TASK]
Edit the provided image according to the User Instruction and Global Settings.

[USER INSTRUCTION]
"${revisionInstruction}"

[GLOBAL SETTINGS & STYLE]
${promptSuffix}

[CONSTRAINTS]
1. IDENTITY PRESERVATION: Do NOT change the model's facial features or body shape unless explicitly asked.
2. OUTFIT PRESERVATION: Do NOT change the distinctive base outfit (crop top/shorts or tank/briefs) unless explicitly asked.
3. REALISM: Maintain photo-realistic texture and lighting.
4. FRAMING: Maintain the same framing (e.g. full body).

[NEGATIVE CONSTRAINTS]
${QA_NEGATIVE_PROMPT}`;

    // Construct generation config
    const generationConfig: any = {
        responseModalities: [Modality.IMAGE],
        safetySettings: SAFETY_SETTINGS,
    };

    // Add image size if specified (Nano Banana Pro specific)
    if (settings.imageSize) {
        generationConfig.imageConfig = {
            ...(generationConfig.imageConfig || {}),
            imageSize: settings.imageSize
        };
    }

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [baseImagePart, { text: prompt }] },
        config: generationConfig,
    });
    return handleApiResponse(response);
};
