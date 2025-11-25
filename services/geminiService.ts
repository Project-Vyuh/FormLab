/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { GenerationSettings, VideoGenerationSettings, AspectRatio, GarmentAnalysis, UpscaleResolution, Light, LightingRig, SceneAtmosphere, ImageProcessingSettings, LensProfile, ApertureSettings, BokehShape, ShutterSettings, SensorSize, CameraPositionSettings, FocusPlaneSettings, CameraProfile, NoiseAndGrainSettings, StudioEnvironment, ShadowSculptingSettings, FloorSettings, AmbientBounceSettings, AmbientOcclusionSettings, DigitalDarkroomSettings, ShotFraming } from "../types";
import { storage } from "./firebase";
import { ref, getBlob } from "firebase/storage";

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
    // If already a data URL, return as-is
    if (url.startsWith('data:')) {
        return url;
    }

    try {
        let blob: Blob;

        // Check if this is a Firebase Storage URL
        if (url.includes('firebasestorage.googleapis.com')) {
            console.log('Detected Firebase Storage URL, using SDK to bypass CORS');

            // Extract the storage path from the URL
            // URL format: https://firebasestorage.googleapis.com/v0/b/bucket/o/path?alt=media&token=...
            // We need to extract just the path part (between /o/ and ?)
            const urlObj = new URL(url);
            const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(?:\?|$)/);

            if (pathMatch && pathMatch[1]) {
                // Decode the URL-encoded path
                const storagePath = decodeURIComponent(pathMatch[1]);
                console.log('Extracted storage path:', storagePath);

                try {
                    // Use Firebase Storage SDK to get the blob (bypasses CORS)
                    const storageRef = ref(storage, storagePath);
                    blob = await getBlob(storageRef);
                    console.log('Successfully fetched blob from Firebase Storage SDK');
                } catch (storageError) {
                    console.error('Firebase Storage SDK error:', storageError);
                    throw storageError;
                }
            } else {
                console.error('Failed to extract storage path from URL:', url);
                throw new Error('Invalid Firebase Storage URL format');
            }
        } else {
            // For non-Firebase URLs (blob URLs, etc.), use regular fetch
            console.log('Non-Firebase URL, using regular fetch');
            const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            blob = await response.blob();
        }

        // Convert blob to data URL
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
    // Convert any URL type to data URL first
    const dataUrl = await urlToDataUrl(url);
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

const getAngleDescription = (angle: number): string => {
    const directions = [
        { dir: "from the back", start: 337.5, end: 360 },
        { dir: "from the back", start: 0, end: 22.5 },
        { dir: "from the back-right", start: 22.5, end: 67.5 },
        { dir: "from the right", start: 67.5, end: 112.5 },
        { dir: "from the front-right", start: 112.5, end: 157.5 },
        { dir: "from the front", start: 157.5, end: 202.5 },
        { dir: "from the front-left", start: 202.5, end: 247.5 },
        { dir: "from the left", start: 247.5, end: 292.5 },
        { dir: "from the back-left", start: 292.5, end: 337.5 }
    ];
    for (const d of directions) {
        if (angle >= d.start && angle < d.end) return d.dir;
    }
    return "from the front";
};

const getElevationDescription = (elevation: number): string => {
    if (elevation > 60) return "from high above";
    if (elevation > 25) return "from above";
    if (elevation > 10) return "from slightly above";
    if (elevation < -60) return "from low below";
    if (elevation < -25) return "from below";
    if (elevation < -10) return "from slightly below";
    return "at eye-level";
};

const getShadowPrompt = (lightingRig: LightingRig): string => {
    const { lights, hdri } = lightingRig;

    if (lights.length === 0) {
        if (hdri.map !== 'none') {
            return ' The scene should have very soft, ambient, omnidirectional shadows with no clear primary direction, consistent with being lit by a large dome.';
        }
        return ' The scene should be evenly lit with minimal shadows.';
    }

    // Find the dominant light (highest power)
    const dominantLight = [...lights].sort((a, b) => b.power - a.power)[0];
    if (!dominantLight) return '';

    // 1. Shadow Direction
    const shadowAngle = (dominantLight.position.angle + 180) % 360;
    const shadowDirection = getAngleDescription(shadowAngle).replace('from the', 'towards the');

    // 2. Shadow Softness (based on apparent size: size / distance)
    const { size, position: { distance } } = dominantLight;
    const apparentSize = size / (distance + 0.1); // Add 0.1 to avoid division by zero
    let shadowSoftness: string;

    if (apparentSize > 5) shadowSoftness = 'very soft and diffuse edges with a gradual shadow transition';
    else if (apparentSize > 2) shadowSoftness = 'soft, feathered edges with wrap-around illumination';
    else if (apparentSize > 0.5) shadowSoftness = 'defined, semi-sharp edges';
    else shadowSoftness = 'sharp, crisp edges with high contrast falloff';


    // 3. Shadow Darkness (from dominant light power and presence of fill/hdri)
    let shadowDarkness: string;
    const hasFill = lights.some(l => l.role === 'fill' && l.power > -2.0) || hdri.map !== 'none';
    const power = dominantLight.power;

    if (power > 1.5) {
        shadowDarkness = hasFill ? 'prominent but with visible detail in the shadows' : 'deep and dramatic';
    } else if (power > 0.5) {
        shadowDarkness = hasFill ? 'of medium intensity' : 'distinct and dark';
    } else {
        shadowDarkness = hasFill ? 'subtle and light' : 'of medium intensity';
    }

    // 4. Contact Shadow
    const contactShadow = ' A clear contact shadow should ground the model to the floor.';

    return ` The primary shadow is cast ${shadowDirection}. The shadow has ${shadowSoftness} and is ${shadowDarkness}.${contactShadow}`;
};

const getSemanticLightDescription = (light: Light): string => {
    const { role, position, power, size, kelvin, tint, saturation } = light;
    const { angle, distance, elevation } = position;

    let styleDescription = '';
    const angleDesc = getAngleDescription(angle);
    const elevationDesc = getElevationDescription(elevation);

    if (role === 'key') {
        const isHigh = elevation > 25;
        const isFrontal = angle >= 160 && angle <= 200;
        const isLoopAngle = (angle >= 135 && angle < 160) || (angle > 200 && angle <= 225);
        const isRembrandtAngle = (angle >= 115 && angle < 135) || (angle > 225 && angle <= 245);
        const isSplitAngle = (angle >= 80 && angle <= 115) || (angle >= 245 && angle <= 280);

        if (isHigh && isFrontal) {
            styleDescription = `a classic "Butterfly" key light, positioned ${angleDesc} and ${elevationDesc}`;
        } else if (isHigh && isLoopAngle) {
            styleDescription = `a "Loop" style key light, placed ${angleDesc} and ${elevationDesc}`;
        } else if (isHigh && isRembrandtAngle) {
            styleDescription = `a dramatic "Rembrandt" key light, positioned ${angleDesc} and ${elevationDesc} to create a triangle of light on the cheek`;
        } else if (isSplitAngle) {
            styleDescription = `a "Split" key light, positioned directly at 90 degrees to the side and ${elevationDesc}, lighting exactly half the face`;
        } else {
            styleDescription = `a key light positioned ${angleDesc} and ${elevationDesc}`;
        }
    } else {
        styleDescription = `a ${role} light positioned ${angleDesc} and ${elevationDesc}`;
    }

    let intentDescription = '';
    if (role === 'key') {
        if (power > 1.5) {
            intentDescription = size < 0.3 ? 'which is a hard, punchy light creating dramatic contrast' : 'which is a strong, bright light that wraps the subject';
        } else if (power >= -0.5) {
            intentDescription = size > 0.7 ? 'which is a soft, diffused light for a gentle, flattering look' : 'which is a standard light with balanced intensity';
        } else {
            intentDescription = 'which is a very subtle light providing minimal directional definition';
        }
    } else if (role === 'fill') {
        if (power > -0.5) {
            intentDescription = 'which is a bright fill light that significantly opens up the shadows';
        } else if (power > -2.0) {
            intentDescription = 'which is a gentle ambient fill light that softens shadows';
        } else {
            intentDescription = 'which is a very subtle fill that leaves shadows deep for a low-key effect';
        }
    } else if (role === 'rim') {
        if (power > 1.5) {
            intentDescription = 'a bright, specular highlight that creates a strong glowing edge';
        } else if (power > 0.5) {
            intentDescription = 'a distinct rim light to create separation from the background';
        } else {
            intentDescription = 'a soft, subtle rim light for just a hint of separation';
        }
    }

    let colorDescription = `and has a color temperature of ${kelvin}K`;

    if (saturation < 0.3) {
        colorDescription += `, making the light pale and desaturated`;
    } else if (saturation > 0.8) {
        colorDescription += `, making the light rich and vibrant`;
    }

    if (tint > 0.2) {
        colorDescription += `, with a noticeable magenta tint to correct for greens`;
    } else if (tint > 0.05) {
        colorDescription += `, with a subtle magenta tint`;
    } else if (tint < -0.2) {
        colorDescription += `, with a noticeable green tint to correct for magentas`;
    } else if (tint < -0.05) {
        colorDescription += `, with a subtle green tint`;
    }

    return ` A ${styleDescription}, ${intentDescription}, ${colorDescription}.`;
};

const getSpecularHighlightPrompt = (lightingRig: LightingRig, accessoryPrompt?: string): string => {
    const { lights } = lightingRig;
    let highlightPrompt = '';

    const keyLight = lights.find(l => l.role === 'key');
    const dominantLight = keyLight || [...lights].sort((a, b) => b.power - a.power)[0];

    if (!dominantLight) {
        highlightPrompt += ' The specular highlights should be very soft and diffused, matching the ambient light.';
    } else {
        const { size, power, position: { distance } } = dominantLight;
        const apparentSize = size / (distance + 0.1);
        let quality = '';

        if (apparentSize < 0.5) quality += 'sharp and crisp';
        else if (apparentSize < 2) quality += 'defined but with soft edges';
        else quality += 'broad and diffused';

        if (power > 1.5) quality += ', and be bright and intense';
        else if (power < -0.5) quality += ', and be very subtle and muted';
        else quality += ', and be of a natural intensity';

        highlightPrompt += ` The primary specular highlights should be ${quality}.`;
    }

    highlightPrompt += ' Realistically render these highlights on the skin, especially on the high points of the face (forehead, cheekbones, nose, and chin) to create a sense of dimension and a healthy glow.';
    highlightPrompt += ' The base athletic wear must have a matte finish with minimal, subtle highlights, consistent with a non-shiny fabric like cotton.';

    if (accessoryPrompt) {
        const lowerAccessoryPrompt = accessoryPrompt.toLowerCase();
        if (/\b(gold|silver|metal|metallic|chrome|jewelry|earrings|necklace|bracelet|sequins)\b/.test(lowerAccessoryPrompt)) {
            highlightPrompt += ' For any metallic or sequined accessories mentioned, render sharp, concentrated glints of light.';
        }
        if (/\b(leather|vinyl|patent|pvc|latex)\b/.test(lowerAccessoryPrompt)) {
            highlightPrompt += ' For any leather or glossy surfaces, render broad, high-contrast sheens.';
        }
        if (/\b(silk|satin)\b/.test(lowerAccessoryPrompt)) {
            highlightPrompt += ' For any silk or satin fabrics, render anisotropic highlights that follow the drape of the cloth.';
        }
    }

    return ` **Specular Highlights:**${highlightPrompt}`;
};

const getFloorPrompt = (settings: FloorSettings): string => {
    let prompt = ' **Floor Details:**';

    const materialMap = {
        'matte': 'a neutral, non-reflective matte surface',
        'glossy': 'a glossy white plexiglass surface',
        'concrete': 'a raw concrete floor with subtle texture',
        'velvet': 'a black velvet floor that absorbs light and deepens shadows',
    };
    prompt += ` The floor is ${materialMap[settings.material]}.`;

    if (settings.material === 'glossy') {
        if (settings.glossiness > 0.7) prompt += ` It is highly glossy, creating sharp, mirror-like specular reflections.`;
        else if (settings.glossiness > 0.3) prompt += ` It has a semi-gloss finish, creating soft, defined reflections.`;
        else prompt += ` It has a low-gloss sheen, with very subtle reflections.`;

        if (settings.reflectionLength > 0.7) prompt += ` The reflections are long and stretched.`;
        else if (settings.reflectionLength > 0.3) prompt += ` The reflections are of a medium length.`;
        else prompt += ` The reflections are short and contained near the subject.`;
    }
    return prompt;
};

const getStudioEnvironmentPrompt = (environment: StudioEnvironment, sculpting: ShadowSculptingSettings, floor: FloorSettings): string => {
    let prompt = ' **Studio Environment:**';

    switch (environment.type) {
        case 'high-key':
            prompt += ` The scene is a professional high-key white studio environment. The seamless background is exposed to be pure white (brightness ${environment.brightness.toFixed(2)}).`;
            if (environment.reflectionStrength > 0.1) prompt += ` Faint, soft floor reflections are visible under the model's feet (strength ${environment.reflectionStrength.toFixed(2)}).`;
            break;
        case 'mid-gray':
            prompt += ' The scene is a professional studio with a perfectly neutral, 18% gray seamless background, ensuring accurate color and exposure.';
            break;
        case 'textured':
            prompt += ` The background is a seamless ${environment.textureType} wall. The texture has an intensity of ${environment.intensity.toFixed(2)} and a surface roughness of ${environment.roughness.toFixed(2)}, which should affect shadow crispness.`;
            break;
        case 'colored-seamless':
            prompt += ` The background is a seamless paper roll of a specific color: ${environment.color}. The material is perfectly matte.`;
            break;
        case 'gradient':
            prompt += ` The background is an illuminated wall with a smooth ${environment.gradientType} gradient, transitioning from ${environment.color1} to ${environment.color2}.`;
            break;
        case 'transparent':
            prompt += ' The background MUST be perfectly transparent (alpha channel). The output must be a PNG file.';
            break;
        case 'custom':
            prompt += ` The background is: "${environment.prompt}".`;
            break;
    }

    if (environment.type !== 'transparent' && environment.type !== 'custom' && environment.cycloramaCurve > 0.1) {
        prompt += ` The wall curves seamlessly into the floor with a radius of ${environment.cycloramaCurve.toFixed(2)}, creating an infinity cyc wall effect.`;
    }

    if (floor) {
        prompt += getFloorPrompt(floor);
    }

    if (sculpting.flags.left) {
        prompt += " A large black flag is placed just off-camera to the left, carving a sharp shadow along the model's left side (negative fill) and increasing contrast.";
    }
    if (sculpting.flags.right) {
        prompt += " A large black flag is placed just off-camera to the right, carving a sharp shadow along the model's right side (negative fill) and increasing contrast.";
    }

    return prompt;
};


const getAtmospherePrompt = (atmosphere: SceneAtmosphere): string => {
    if (!atmosphere) return '';
    let prompt = ' **Scene Atmosphere:**';
    let hasInstruction = false;

    if (atmosphere.backgroundExposure > 0.5) { prompt += ' The background is brightly overexposed, creating a high-key feel.'; hasInstruction = true; }
    else if (atmosphere.backgroundExposure < -0.5) { prompt += ' The background is dark and underexposed, creating a low-key feel.'; hasInstruction = true; }

    if (atmosphere.backgroundBlur === 'low') { prompt += ' There is a subtle blur on the background.'; hasInstruction = true; }
    else if (atmosphere.backgroundBlur === 'medium') { prompt += ' There is a medium, noticeable background blur.'; hasInstruction = true; }
    else if (atmosphere.backgroundBlur === 'high') { prompt += ' There is a strong, creamy background blur (bokeh).'; hasInstruction = true; }

    if (atmosphere.vignetting.strength > 0.05) {
        const strengthDesc = atmosphere.vignetting.strength > 0.6 ? 'strong, dramatic' : 'subtle';
        const shapeDesc = atmosphere.vignetting.shape === 'linear' ? 'linear' : 'round';
        let biasDesc = '';
        switch (atmosphere.vignetting.bias) {
            case 'top': biasDesc = ' biased towards the top of the frame'; break;
            case 'bottom': biasDesc = ' biased towards the bottom of the frame'; break;
            case 'sides': biasDesc = ' biased towards the sides of the frame'; break;
        }
        prompt += ` Add a ${strengthDesc} ${shapeDesc} vignette to darken the edges of the frame${biasDesc}.`;
        hasInstruction = true;
    }

    if (atmosphere.lightWrap === 'subtle') { prompt += ' There is a subtle light wrap from the background illuminating the subject\'s edges.'; hasInstruction = true; }
    else if (atmosphere.lightWrap === 'strong') { prompt += ' A noticeable light wrap from the background creates a glowing halo effect on the subject\'s silhouette.'; hasInstruction = true; }

    if (atmosphere.separationContrast === 'soft') { prompt += ' Create soft, feathered edges between the subject and background for a blended, dreamy look.'; hasInstruction = true; }
    else if (atmosphere.separationContrast === 'sharp') { prompt += ' Create very high contrast between the subject\'s edges and the background for a sharp, \'cut-out\' look.'; hasInstruction = true; }

    return hasInstruction ? prompt : '';
};

const getAmbientBouncePrompt = (settings: AmbientBounceSettings): string => {
    if (settings.strength < 0.1) return '';
    let prompt = ' **Ambient Bounce Light:**';

    if (settings.strength > 0.7) prompt += ' The scene is filled with a strong ambient bounce light';
    else if (settings.strength > 0.3) prompt += ' The scene has a noticeable ambient bounce light';
    else prompt += ' The scene has a subtle ambient bounce light';

    let biasDesc = '';
    if (settings.bias !== 'uniform') {
        biasDesc = ` primarily coming from the ${settings.bias}`;
    }

    prompt += ` with a color tint of ${settings.color}${biasDesc}, which should realistically influence skin tones and shadow colors.`;
    return prompt;
};

const getAmbientOcclusionPrompt = (settings: AmbientOcclusionSettings): string => {
    if (settings.intensity < 0.1) return '';
    let prompt = ' **Ambient Occlusion:**';

    if (settings.intensity > 0.7) prompt += ' Render strong, soft ambient occlusion';
    else if (settings.intensity > 0.3) prompt += ' Render noticeable, soft ambient occlusion';
    else prompt += ' Render subtle, soft ambient occlusion';

    prompt += ' especially in contact areas like under the feet, between limbs, and within clothing folds to add depth and realism.';

    if (settings.radius > 0.7) prompt += ' The occlusion effect should have a wide radius.';
    else if (settings.radius < 0.3) prompt += ' The occlusion effect should have a tight, narrow radius.';

    return prompt;
};


const getImageProcessingPrompt = (settings: ImageProcessingSettings): string => {
    if (!settings) return '';
    let prompt = ' **Final Image Processing & Grading:**';
    let hasInstruction = false;

    if (settings.exposureBias > 0.2) {
        prompt += ` The overall exposure should be brightened slightly (around +${settings.exposureBias.toFixed(1)} stops).`;
        hasInstruction = true;
    } else if (settings.exposureBias < -0.2) {
        prompt += ` The overall exposure should be darkened slightly (around ${settings.exposureBias.toFixed(1)} stops).`;
        hasInstruction = true;
    }

    if (settings.contrast !== 'neutral') {
        const contrastMap: Record<ImageProcessingSettings['contrast'], string> = {
            low: 'very soft, low contrast with muted tones',
            neutral: '',
            high: 'high contrast with deep blacks and bright whites',
            punchy: 'very high, punchy contrast for a dramatic, crisp look'
        };
        prompt += ` The image has ${contrastMap[settings.contrast]}.`;
        hasInstruction = true;
    }

    if (settings.colorGrade !== 'none') {
        const gradeMap: Record<ImageProcessingSettings['colorGrade'], string> = {
            none: '',
            cinematic: 'Apply a cinematic color grade with teal and orange tones in the shadows and highlights.',
            commercial: 'Apply a clean, commercial color grade with vibrant, true-to-life colors and high saturation.',
            vintage: 'Apply a vintage film color grade with warm, faded tones and slightly desaturated colors.'
        };
        prompt += ` ${gradeMap[settings.colorGrade]}`;
        hasInstruction = true;
    }

    if (settings.highlightRollOff !== 'medium') {
        const rollOffMap: Record<ImageProcessingSettings['highlightRollOff'], string> = {
            soft: 'Ensure a very soft, gentle roll-off in the highlights to preserve all detail, creating a film-like look.',
            medium: '',
            hard: 'Allow highlights to be sharp and potentially clip slightly for a high-energy, digital look.'
        };
        prompt += ` ${rollOffMap[settings.highlightRollOff]}`;
        hasInstruction = true;
    }

    if (settings.shadowCrush !== 'none') {
        const crushMap: Record<ImageProcessingSettings['shadowCrush'], string> = {
            none: '',
            low: 'Slightly crush the blacks to increase contrast, while preserving most shadow detail.',
            medium: 'Heavily crush the blacks for deep, rich shadows and a very contrasted, moody aesthetic.'
        };
        prompt += ` ${crushMap[settings.shadowCrush]}`;
        hasInstruction = true;
    }

    if (settings.lift && (settings.lift.r !== 0 || settings.lift.g !== 0 || settings.lift.b !== 0)) {
        prompt += ` Tint the shadows (lift) with an RGB shift of (${settings.lift.r.toFixed(2)}, ${settings.lift.g.toFixed(2)}, ${settings.lift.b.toFixed(2)}).`;
        hasInstruction = true;
    }
    if (settings.gamma && (settings.gamma.r !== 0 || settings.gamma.g !== 0 || settings.gamma.b !== 0)) {
        prompt += ` Adjust the midtones (gamma) with an RGB shift of (${settings.gamma.r.toFixed(2)}, ${settings.gamma.g.toFixed(2)}, ${settings.gamma.b.toFixed(2)}).`;
        hasInstruction = true;
    }
    if (settings.gain && (settings.gain.r !== 0 || settings.gain.g !== 0 || settings.gain.b !== 0)) {
        prompt += ` Tint the highlights (gain) with an RGB shift of (${settings.gain.r.toFixed(2)}, ${settings.gain.g.toFixed(2)}, ${settings.gain.b.toFixed(2)}).`;
        hasInstruction = true;
    }
    if (settings.splitToning && (settings.splitToning.highlights.color !== '#ffffff' || settings.splitToning.shadows.color !== '#ffffff')) {
        prompt += ` Apply split toning: tint highlights towards ${settings.splitToning.highlights.color} and shadows towards ${settings.splitToning.shadows.color}, with a balance of ${settings.splitToning.highlights.balance.toFixed(2)}.`;
        hasInstruction = true;
    }

    return hasInstruction ? prompt : '';
};

const getLensProfilePrompt = (lensProfile?: LensProfile): string => {
    if (!lensProfile) return '';
    const descriptions: Record<LensProfile, string> = {
        '24mm': "The image should have the distinct look of a wide-angle 24mm lens, creating a sense of dynamic space and slight perspective exaggeration/distortion on the limbs.",
        '35mm': "The image should be captured with the feel of a 35mm lens, popular for lifestyle and editorial photography, offering a natural field of view with minimal distortion.",
        '50mm': "The image should reflect the perspective of a 50mm lens, which closely mimics human vision with neutral, natural proportions and no noticeable distortion.",
        '85mm': "The image has the flattering look of a classic 85mm portrait lens. This includes significant background compression, which makes the background appear closer and more blurred, and slight facial feature compression for a pleasing effect.",
        '135mm': "The image should be captured with the intense compression of a 135mm telephoto lens, creating an ultra-flattering look with a very shallow depth of field and heavily compressed facial features and background."
    };
    const desc = descriptions[lensProfile];
    return desc ? ` **Lens & Perspective:** ${desc}` : '';
};

const getSensorSizePrompt = (sensorSize?: SensorSize): string => {
    if (!sensorSize) return '';
    const descriptions: Record<SensorSize, string> = {
        'full-frame': "The image has the character of a full-frame sensor, with natural microcontrast, fine grain, and a standard professional look.",
        'medium-format': "The image has the distinct, high-end character of a medium format sensor. This includes extremely smooth tonal transitions, a very wide dynamic range with exceptionally gentle highlight roll-off, a polished three-dimensional quality, and an absence of digital noise."
    };
    const desc = descriptions[sensorSize];
    return desc ? ` **Sensor Character:** ${desc}` : '';
};

const getCameraPositionPrompt = (settings: CameraPositionSettings): string => {
    if (!settings) return '';
    const { height, tilt } = settings;
    let prompt = ' **Camera Position:**';
    let hasInstruction = false;

    // Describe height
    if (height > 2.0) {
        prompt += ` The camera is positioned at a very high angle, looking down on the subject.`;
        hasInstruction = true;
    } else if (height > 1.7) {
        prompt += ` The camera is positioned slightly above eye-level.`;
        hasInstruction = true;
    } else if (height < 0.5) {
        prompt += ` The camera is positioned at a very low angle, close to the ground, creating a worm's-eye view.`;
        hasInstruction = true;
    } else if (height < 1.3) {
        prompt += ` The camera is positioned at a low angle, around hip level.`;
        hasInstruction = true;
    }

    // Describe tilt
    if (tilt > 20) {
        prompt += ` The camera is tilted up significantly, creating a dramatic perspective.`;
        hasInstruction = true;
    } else if (tilt > 5) {
        prompt += ` The camera is tilted up slightly.`;
        hasInstruction = true;
    } else if (tilt < -20) {
        prompt += ` The camera is tilted down significantly, creating a bird's-eye perspective.`;
        hasInstruction = true;
    } else if (tilt < -5) {
        prompt += ` The camera is tilted down slightly.`;
        hasInstruction = true;
    }

    return hasInstruction ? prompt : '';
};

const getFocusPlanePrompt = (settings: FocusPlaneSettings): string => {
    if (!settings) return '';
    let prompt = ' **Focus & Sharpness:**';

    if (settings.faceAutofocus) {
        prompt += ` The camera's focus is critically sharp on the model's eyes and face. A very subtle and natural sharpness falloff occurs away from the face, creating a realistic depth.`;
    } else {
        if (settings.focusDistance < 0.3) {
            prompt += ` The focus plane is set very close to the camera, rendering foreground elements or clothing texture with maximum sharpness. The face and background will have a subtle, natural sharpness falloff.`;
        } else if (settings.focusDistance > 0.7) {
            prompt += ` The focus plane is set far away on the background, rendering background elements with more clarity. The model will have a softer, slightly out-of-focus appearance.`;
        } else {
            prompt += ` The focus plane is set on the model's torso, keeping the main body sharp while the face and background have a very gentle sharpness falloff.`;
        }
    }

    prompt += ' Adaptive sharpening should be applied only to the in-focus areas to enhance detail without creating an artificial look.';
    return prompt;
};

const getCameraProfilePrompt = (cameraProfile?: CameraProfile): string => {
    if (!cameraProfile || cameraProfile === 'none') return '';
    const descriptions: Record<Exclude<CameraProfile, 'none'>, string> = {
        'canon': "The image should emulate the renowned Canon color science, known for its pleasing, warm skin tones and vibrant yet natural color reproduction.",
        'nikon': "The image should reflect the Nikon look, characterized by a cooler, more neutral color palette with crisp details and high contrast.",
        'sony': "The image should have the clean, sharp, and modern aesthetic of a Sony camera, with a focus on digital clarity and accurate colors.",
        'phase-one': "The image should emulate the ultra-high-end Phase One medium format look. This implies a specific color science with incredibly rich, deep, and accurate colors, painterly tonal transitions, and a 3D-like microcontrast that separates it from standard full-frame cameras."
    };
    const desc = descriptions[cameraProfile as Exclude<CameraProfile, 'none'>];
    return desc ? ` **Camera Profile:** ${desc}` : '';
};


const getAperturePrompt = (settings: ApertureSettings): string => {
    if (!settings) return '';
    let prompt = ' **Aperture & Depth of Field:**';
    let hasInstruction = false;

    if (settings.aperture < 2.0) {
        prompt += ` The image is shot with a very wide aperture (around f/${settings.aperture.toFixed(1)}). Focus strictly on the eyes, with ears and background slightly soft.`;
        hasInstruction = true;
    } else if (settings.aperture < 4.0) {
        prompt += ` The image is shot with a wide aperture (around f/${settings.aperture.toFixed(1)}), creating a noticeable shallow depth of field with good subject separation.`;
        hasInstruction = true;
    } else if (settings.aperture < 8.0) {
        prompt += ` The image is shot with a medium aperture (around f/${settings.aperture.toFixed(1)}), keeping the entire subject sharp from nose to ears, with a softly blurred background.`;
        hasInstruction = true;
    } else {
        prompt += ` The image is shot with a narrow aperture (around f/${settings.aperture.toFixed(1)}), resulting in a deep depth of field where the subject and most of the scene are in sharp focus.`;
        hasInstruction = true;
    }

    if (settings.bokehShape !== 'round') {
        const shapeMap: Record<BokehShape, string> = {
            round: '',
            pentagon: 'The bokeh highlights have a distinct pentagonal shape.',
            anamorphic: 'The bokeh highlights are stretched into vertical ovals, creating a cinematic anamorphic look.'
        };
        prompt += ` ${shapeMap[settings.bokehShape]}`;
        hasInstruction = true;
    }

    return hasInstruction ? prompt : '';
};

const getShutterPrompt = (settings: ShutterSettings): string => {
    if (!settings || settings.motionBlur < 0.1) return '';

    let prompt = ' **Shutter & Motion:**';
    let hasInstruction = false;

    if (settings.motionBlur > 0.7) {
        prompt += ` The image has a strong and artistic motion blur, simulating a slow shutter speed.`;
        hasInstruction = true;
    } else if (settings.motionBlur >= 0.1) {
        prompt += ` The image has a subtle motion blur, as if captured with a slightly slow shutter speed to imply movement.`;
        hasInstruction = true;
    }

    if (hasInstruction) {
        const angle = settings.blurAngle;
        if (angle > 337.5 || angle <= 22.5) prompt += ` The blur is primarily horizontal.`;
        else if (angle > 22.5 && angle <= 67.5) prompt += ` The blur is diagonal from bottom-left to top-right.`;
        else if (angle > 67.5 && angle <= 112.5) prompt += ` The blur is vertical.`;
        else if (angle > 112.5 && angle <= 157.5) prompt += ` The blur is diagonal from bottom-right to top-left.`;
        else if (angle > 157.5 && angle <= 202.5) prompt += ` The blur is horizontal.`;
        else if (angle > 202.5 && angle <= 247.5) prompt += ` The blur is diagonal from top-right to bottom-left.`;
        else if (angle > 247.5 && angle <= 292.5) prompt += ` The blur is vertical.`;
        else if (angle > 292.5 && angle <= 337.5) prompt += ` The blur is diagonal from top-left to bottom-right.`;
    }

    if (settings.microGhosting) {
        prompt += ` Include subtle micro-ghosting within the blur for a more realistic long-exposure effect.`;
        hasInstruction = true;
    }

    return hasInstruction ? prompt : '';
};

const getNoiseAndGrainPrompt = (settings: NoiseAndGrainSettings): string => {
    if (!settings || settings.amount < 0.05) return '';

    let prompt = ' **Film Grain & Texture:**';
    let hasInstruction = false;

    const amountDesc = settings.amount > 0.7 ? 'a heavy' : settings.amount > 0.4 ? 'a medium' : 'a subtle';
    const typeDesc = settings.type;
    prompt += ` The image has ${amountDesc}, ${typeDesc} film grain, adding a realistic, organic texture.`;
    hasInstruction = true;

    if (settings.chromaticAberration) {
        prompt += ` Introduce very subtle chromatic aberration (color fringing) on the edges of high-contrast areas for added realism.`;
        hasInstruction = true;
    }

    return hasInstruction ? prompt : '';
};

const getDigitalDarkroomPrompt = (settings?: DigitalDarkroomSettings): string => {
    if (!settings) return '';
    const parts: string[] = [];

    if (settings.frequencySeparation) parts.push('Apply high-end frequency separation to retouch skin, ensuring texture is preserved while smoothing color and tone.');
    if (settings.shineControl && settings.shineControl > 0) parts.push(`Subtly reduce oily shine and specular highlights on the skin by ${Math.round(settings.shineControl * 100)}%.`);
    if (settings.skinToneHarmonization) parts.push('Harmonize and unify skin tones across the face and body for a smooth, consistent complexion.');
    if (settings.lensCorrection) parts.push('Apply lens correction to fix any minor distortion or chromatic aberration.');
    if (settings.bodyWarpCorrection) parts.push('Subtly correct any unnatural-looking AI-generated body proportions or warps for a more realistic human form.');
    if (settings.cleanup) parts.push('Perform a final cleanup pass, removing any stray dust spots, flyaway hairs, or imperfections on the background.');
    if (settings.studioSharpening) parts.push('Apply a final pass of studio-level, non-destructive sharpening to enhance details without creating halos.');
    if (settings.dynamicRangeTuning) parts.push('Fine-tune the dynamic range to ensure rich detail is visible in both the deep shadows and bright highlights.');

    if (parts.length === 0) return '';
    return ` **Digital Retouching:** ${parts.join(' ')}`;
};


const getVirtualExifPrompt = (settings: GenerationSettings): string => {
    const { lensProfile, apertureSettings, shutterSettings, noiseAndGrain } = settings;
    let exif = ' **Virtual Camera Settings:**';
    let hasData = false;

    if (lensProfile) {
        exif += ` Lens: ${lensProfile}`;
        hasData = true;
    }
    if (apertureSettings) {
        exif += `, Aperture: f/${apertureSettings.aperture.toFixed(1)}`;
        hasData = true;
    }
    if (shutterSettings && shutterSettings.motionBlur > 0.1) {
        exif += `, Shutter: 1/${Math.round(1 / (shutterSettings.motionBlur * 0.5 + 0.01))}s`; // Approximate shutter speed
        hasData = true;
    } else {
        exif += `, Shutter: 1/125s`;
        hasData = true;
    }
    if (noiseAndGrain && noiseAndGrain.amount > 0.05) {
        const iso = noiseAndGrain.amount > 0.7 ? 1600 : noiseAndGrain.amount > 0.4 ? 800 : 400;
        exif += `, ISO: ${iso}`;
        hasData = true;
    } else {
        exif += `, ISO: 100`;
        hasData = true;
    }

    return hasData ? exif + '.' : '';
};


const getLightingPrompt = (lightingRig: GenerationSettings['lightingRig'], accessoryPrompt?: string): string => {
    let lightingPrompt = ' The scene has a professional studio lighting setup.';

    const { hdri } = lightingRig;
    if (hdri.map !== 'none') {
        let hdriDesc = '';
        switch (hdri.map) {
            case 'neutral': hdriDesc = 'a neutral, evenly lit studio HDRI dome'; break;
            case 'high-contrast': hdriDesc = 'a high-contrast studio HDRI with strong highlights'; break;
            case 'fashion-beauty': hdriDesc = 'a fashion and beauty studio HDRI with soft, flattering light'; break;
        }
        lightingPrompt += ` The ambient illumination is provided by ${hdriDesc}, rotated to ${hdri.rotation} degrees.`;
    }

    if (lightingRig.lights.length > 0) {
        lightingPrompt += ' It uses the following individual lights:';
        lightingRig.lights.forEach((light: Light) => {
            lightingPrompt += getSemanticLightDescription(light);
        });
    }

    const shadowPrompt = getShadowPrompt(lightingRig);
    const specularPrompt = getSpecularHighlightPrompt(lightingRig, accessoryPrompt);

    return lightingPrompt + shadowPrompt + specularPrompt;
};


export const getGenerationPromptSuffix = (settings: GenerationSettings, options?: { exclude?: Array<keyof GenerationSettings> }): string => {
    let suffix = '';
    const {
        quality, studioEnvironment, floorSettings, shadowSculpting, ambientBounce, ambientOcclusion, photoStyle, accessoryPrompt,
        shotFraming, posePrompt, negativePrompt, aspectRatio, apertureSettings, lensProfile, shutterSettings, lightingRig, sceneAtmosphere, imageProcessing, sensorSize, cameraPosition, focusPlaneSettings, cameraProfile, noiseAndGrain, digitalDarkroom, panelToggles
    } = settings;

    const exclude = options?.exclude || [];

    // --- Process untoggled settings first ---
    if (photoStyle && photoStyle !== 'none' && !exclude.includes('photoStyle')) {
        switch (photoStyle) {
            case 'vintage': suffix += ' The photo has a vintage film aesthetic, with grainy texture and warm tones.'; break;
            case 'modern': suffix += ' The photo has a modern, crisp, high-fashion aesthetic with sharp focus and high contrast.'; break;
            case 'dreamy': suffix += ' The photo has a dreamy, ethereal aesthetic with soft focus and a pastel color palette.'; break;
        }
    }
    if (accessoryPrompt && !exclude.includes('accessoryPrompt')) {
        suffix += ` The model is also wearing or holding: "${accessoryPrompt}".`;
    }
    if (posePrompt && !exclude.includes('posePrompt')) { // Legacy pose prompt from ImageStudio
        suffix += ` The model's pose and expression must be: "${posePrompt}".`;
    }

    // --- Process toggled panel settings ---

    if (panelToggles.composition) {
        // shotFraming, aspectRatio, and cameraPosition are now handled in the main prompt structure
    }

    if (panelToggles.cameraAndLens) {
        if (lensProfile && !exclude.includes('lensProfile' as any)) suffix += getLensProfilePrompt(lensProfile);
        if (apertureSettings && !exclude.includes('apertureSettings' as any)) suffix += getAperturePrompt(apertureSettings);
        if (focusPlaneSettings && !exclude.includes('focusPlaneSettings' as any)) suffix += getFocusPlanePrompt(focusPlaneSettings);
        if (shutterSettings && !exclude.includes('shutterSettings' as any)) suffix += getShutterPrompt(shutterSettings);

        const virtualExif = getVirtualExifPrompt(settings);
        if (virtualExif) suffix += virtualExif;
    }

    if (panelToggles.lighting && lightingRig && !exclude.includes('lightingRig' as any)) {
        suffix += getLightingPrompt(lightingRig, accessoryPrompt);
    }

    if (panelToggles.environment && studioEnvironment && !exclude.includes('studioEnvironment' as any)) {
        suffix += getStudioEnvironmentPrompt(studioEnvironment, shadowSculpting, floorSettings);
    }

    if (panelToggles.imageFinishing) {
        if (sensorSize && !exclude.includes('sensorSize' as any)) suffix += getSensorSizePrompt(sensorSize);
        if (cameraProfile && !exclude.includes('cameraProfile' as any)) suffix += getCameraProfilePrompt(cameraProfile);
        if (noiseAndGrain && !exclude.includes('noiseAndGrain' as any)) suffix += getNoiseAndGrainPrompt(noiseAndGrain);
        if (imageProcessing && !exclude.includes('imageProcessing' as any)) suffix += getImageProcessingPrompt(imageProcessing);
        if (digitalDarkroom && !exclude.includes('digitalDarkroom' as any)) suffix += getDigitalDarkroomPrompt(digitalDarkroom);
        if (ambientBounce && !exclude.includes('ambientBounce' as any)) suffix += getAmbientBouncePrompt(ambientBounce);
        if (ambientOcclusion && !exclude.includes('ambientOcclusion' as any)) suffix += getAmbientOcclusionPrompt(ambientOcclusion);
        if (sceneAtmosphere && !exclude.includes('sceneAtmosphere' as any)) suffix += getAtmospherePrompt(sceneAtmosphere);
    }

    // --- Process remaining untoggled settings ---
    if (negativePrompt && !exclude.includes('negativePrompt')) {
        suffix += ` CRUCIAL: Ensure the image does NOT contain the following elements: "${negativePrompt}".`;
    }
    if (quality && !exclude.includes('quality')) {
        switch (quality) {
            case 'hd':
                suffix += ' The final image must be high-resolution and photorealistic, with fine details.';
                break;
            case 'fast':
                suffix += ' Generate the image quickly. Minor imperfections are acceptable for speed.';
                break;
        }
    }
    return suffix;
};


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
        const errorMessage = `Image generation stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        throw new Error(errorMessage);
    }
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image. ` + (textFeedback ? `The model responded with text: "${textFeedback}"` : "This can happen due to safety filters or if the request is too complex. Please try a different image.");
    throw new Error(errorMessage);
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const REALISM_TOKENS = "8k resolution, raw photo, cinematic lighting, sharp focus, Fujifilm GFX 100, Kodak Portra 400, hyper-detailed skin texture, visible pores, vellus hair, subsurface scattering, natural complexion imperfections, slight skin unevenness, realistic eyes, moist lips, no airbrushing, highly detailed, micro-details, peach fuzz, natural skin oils, imperfect skin texture, Phase One XF IQ4, Profoto studio lighting";
const ANATOMY_TOKENS = "perfectly rendered hands, anatomically correct fingers, symmetrical facial features, natural eyes with corneal reflections, realistic muscle definition, natural posture, micro-expressions";
const QA_NEGATIVE_PROMPT = "mannequin, plastic skin, waxy skin, doll-like, artificial, CGI, 3d render, illustration, cartoon, anime, drawing, painting, bad anatomy, disfigured, extra limbs, fused fingers, blurry, low quality, jpeg artifacts, watermark, text, logo, oversmoothed, airbrushed, makeup heavy, distorted face, bad hands, bad feet, shoes, socks, footwear, pants, leggings (unless specified), dead eyes, blank stare, stiff pose";

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
        // Ambiguous/Unknown: Provide both options
        outfitDescription = "EITHER a minimal, skin-tight, solid heather grey athletic crop top and matching tight boy shorts (if female) OR a minimal, skin-tight, solid heather grey athletic tank top and matching tight boxer briefs (if male)";
    }

    return `The model MUST be wearing a specific base outfit: ${outfitDescription}. The outfit must be simple, unbranded, and form-fitting to clearly show the model's physique for virtual try-on. The model must be barefoot. NO other clothing, shoes, or accessories are allowed unless explicitly specified in the user prompt.`;
};

const getFramingPrompt = (framing: ShotFraming | undefined): string => {
    if (!framing || framing === 'full') {
        return "FULL BODY SHOT (Head to Toe). The entire model from the top of the head to the soles of the feet MUST be visible. Do not crop the head or feet. The model should be centered in the frame with a small amount of headroom and footroom.";
    }

    const framingMap: Record<ShotFraming, string> = {
        'full': "FULL BODY SHOT (Head to Toe). The entire model from the top of the head to the soles of the feet MUST be visible. Do not crop the head or feet.",
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

export const generateModelImage = async (userImage: File, settings: GenerationSettings, model: string): Promise<string> => {
    const userImagePart = await fileToPart(userImage);

    // Prioritize Global Controls
    const lightingPrompt = getLightingPrompt(settings.lightingRig, settings.accessoryPrompt);
    const environmentPrompt = getStudioEnvironmentPrompt(settings.studioEnvironment, settings.shadowSculpting, settings.floorSettings);
    const cameraPrompt = getGenerationPromptSuffix(settings, { exclude: ['lightingRig', 'studioEnvironment', 'floorSettings', 'shadowSculpting'] });

    const framingPrompt = getFramingPrompt(settings.shotFraming);
    const outfitRule = getOutfitPrompt("female"); // Default to female if no description provided for image upload
    const posePrompt = getPoseAndExpressionPrompt(settings);

    const prompt = `[ROLE]
You are a world-class professional fashion photographer and digital artist, renowned for creating ultra-realistic, high-end studio portraits. You are using a Phase One XF IQ4 150MP camera system.

[TASK]
Generate a RAW, Hyper-Realistic Photo of a model based on the reference image and the following strict technical specifications.

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
- Identity: Match the face, hair, and ethnicity of the reference photo.
- Skin Details: ${REALISM_TOKENS}
- Anatomy: ${ANATOMY_TOKENS}

[NEGATIVE CONSTRAINTS]
${QA_NEGATIVE_PROMPT}
Do not generate: cropped head, cropped feet, missing limbs, extra limbs, distorted face, bad hands, bad feet, cartoonish style, illustration style, low resolution, blurry, artifacts, watermark, text, signature, shoes (unless specified), socks (unless specified).`;

    const response = await ai.models.generateContent({
        model: model || 'gemini-2.5-flash-image',
        contents: { parts: [userImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
            safetySettings: SAFETY_SETTINGS,
        },
    });
    return handleApiResponse(response);
};

export const generateModelFromDescription = async (description: string, settings: GenerationSettings, model: string): Promise<string> => {
    // Prioritize Global Controls
    const lightingPrompt = getLightingPrompt(settings.lightingRig, settings.accessoryPrompt);
    const environmentPrompt = getStudioEnvironmentPrompt(settings.studioEnvironment, settings.shadowSculpting, settings.floorSettings);
    const cameraPrompt = getGenerationPromptSuffix(settings, { exclude: ['lightingRig', 'studioEnvironment', 'floorSettings', 'shadowSculpting'] });

    const framingPrompt = getFramingPrompt(settings.shotFraming);
    const outfitRule = getOutfitPrompt(description);
    const posePrompt = getPoseAndExpressionPrompt(settings);

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

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: structuredPrompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
            safetySettings: SAFETY_SETTINGS,
        },
    });

    return handleApiResponse(response);
};

export const generateModelWithGarment = async (modelImage: File, garmentImage: File, poseReferenceImage: File | null, prompt: string, settings: GenerationSettings, model: string): Promise<string> => {
    const modelImagePart = await fileToPart(modelImage);
    const garmentImagePart = await fileToPart(garmentImage);
    const poseReferenceImagePart = poseReferenceImage ? await fileToPart(poseReferenceImage) : undefined;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [modelImagePart, garmentImagePart, poseReferenceImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};


export const upscaleImage = async (baseImageUrl: string, resolution: UpscaleResolution): Promise<string> => {
    const model = 'gemini-2.5-flash-image';
    const baseImagePart = await dataUrlToPart(baseImageUrl);

    const prompt = `You are a high-end image restoration and upscaling AI.
**Input:** A digital fashion model image.
**Task:** Upscale and refine the image to simulate a ${resolution} resolution.

**Directives:**
1.  **Fidelity:** Strictly preserve the model's identity, the outfit (neutral athletic wear), the pose, and the background. Do NOT change the content.
2.  **Refinement:** Sharpen details, enhance texture realism (skin, fabric), and remove any artifacts or noise.
3.  **Resolution:** The output must be incredibly crisp and high-definition, suitable for large format display (${resolution}).

Return ONLY the upscaled image.` + getOutfitPrompt("female");

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [baseImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    return handleApiResponse(response);
};

export const selectivelyEnhanceImage = async (baseImageUrl: string, enhancementTarget: 'face' | 'fabric' | 'accessories'): Promise<string> => {
    const model = 'gemini-2.5-flash-image';
    const baseImagePart = await dataUrlToPart(baseImageUrl);
    const prompt = `You are a high-end image restoration AI.
    **Input:** A digital fashion model image.
    **Task:** Sharpen and enhance ONLY the ${enhancementTarget} in the image.
    
    **Directives:**
    1.  **Fidelity:** Strictly preserve the model's identity, pose, background, and base outfit (neutral athletic wear).
    2.  **Targeted Refinement:** Focus all enhancement efforts on the ${enhancementTarget}, improving texture, clarity, and realism. Do NOT alter other parts of the image.
    
    Return ONLY the enhanced image.` + getOutfitPrompt("female");

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [baseImagePart, { text: prompt }] },
        config: { responseModalities: [Modality.IMAGE] },
    });
    return handleApiResponse(response);
};

export const enhanceDescriptionPrompt = async (userInput: string, targetModel: 'gemini-2.5-flash-image'): Promise<string> => {
    const model = 'gemini-2.5-flash';

    const metaPrompt = `You are a Creative Director for a high-end fashion brand. You are creating a "Base Model" or "Digital Mannequin" description for virtual try-ons.
    
User Input: "${userInput}"

Your Task: Expand this into a detailed, vivid prompt that establishes a unique brand identity.
Focus on these elements:
1.  **Facial Features:** (e.g., high cheekbones, almond eyes, strong jawline, freckles).
2.  **Skin & Complexion:** (e.g., deep mahogany tone, porcelain with cool undertones, sun-kissed, vitiligo).
3.  **Hair:** (e.g., platinum buzz cut, voluminous afro, sleek bob, pastel streaks).
4.  **Identity Accessories:** (e.g., septum piercing, gold hoop earrings, tortoise-shell glasses, tattoos).
5.  **Vibe:** (e.g., edgy, ethereal, athletic, minimalist).

**CRITICAL CONSTRAINTS:** 
1. Do **NOT** describe the clothing or outfit. The model MUST remain in neutral athletic wear (tank top/leggings) to serve as a base for future clothing application. Focus ONLY on the model's physical attributes and accessories.
2. The description MUST explicitly specify that this is a **full-body image** (head to toe).

**Output:** Return ONLY the enhanced prompt text.`;

    const response = await ai.models.generateContent({
        model,
        contents: metaPrompt,
    });

    return response.text.trim();
};

export const enhanceRevisionPrompt = async (baseImageUrl: string, userInput: string, originalDescription?: string): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const baseImagePart = await dataUrlToPart(baseImageUrl);
    const textPart = { text: '' };
    let promptText: string;

    if (!userInput.trim()) {
        promptText = `You are a Stylist and Brand Consultant.
Analyze the provided image.${originalDescription ? ` The original intent was: "${originalDescription}".` : ''}

Your Goal: Suggest a single, high-impact enhancement regarding brand identity (hair, makeup, tattoos, accessories).
Focus on: 
- Changing hair style or color.
- Adding distinctive features (tattoos, freckles, specific makeup).
- Adding accessories (jewelry, eyewear).
- Adjusting lighting or mood.

**CRITICAL:** 
1. Do NOT suggest changing the clothing/outfit. The model is wearing a neutral base layer for virtual try-on.
2. Ensure the revision prompts for a **full-body shot** to maintain the original framing.

Output: Return ONLY the suggested revision prompt (e.g., "Add a small geometric tattoo on the left forearm and change hair to a messy bun, full body shot").`;
        textPart.text = promptText;
    } else {
        promptText = `You are an AI Prompt Engineer for fashion.
User Revision Request: "${userInput}"
Context: Use the provided image as reference.

Your Task: Enhance the user's request with more descriptive, artistic vocabulary.
- If they ask for jewelry, describe the metal and style.
- If they ask for tattoos, describe the style (line-work, traditional, watercolor).
- If they ask for hair change, describe the texture and cut.

**CRITICAL:** 
1. Do NOT add descriptions of clothing (tops, pants, dresses) unless the user explicitly asked to change the base layer.
2. Ensure the enhanced prompt explicitly requests to maintain the **full-body framing** of the model.

Output: Return ONLY the enhanced prompt.`;
        textPart.text = promptText;
    }

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [baseImagePart, textPart] },
    });

    return response.text.trim();
};

export const generateVirtualTryOnImage = async (modelImageUrl: string, garmentImage: File, settings: GenerationSettings): Promise<string> => {
    const model = 'gemini-2.5-flash-image';
    const modelImagePart = await dataUrlToPart(modelImageUrl);
    const garmentImagePart = await fileToPart(garmentImage);

    const promptSuffix = getGenerationPromptSuffix(settings, { exclude: ['studioEnvironment' as any] });

    const backgroundInstruction = getStudioEnvironmentPrompt(settings.studioEnvironment, settings.shadowSculpting, settings.floorSettings);


    const prompt = `You are a professional fashion design AI.
**Inputs:**
1.  **Model Image:** (The first image) Use this person as the model. Preserve their identity, pose, and body type.
2.  **Garment Image:** (The second image) This is the clothing to be worn.

**Task:** Generate a high-quality photorealistic image of the Model wearing the Garment.

**Directives:**
1.  **Wardrobe:** The model must be wearing the garment from the second image. The fit should be natural and realistic, respecting the model's pose.
2.  **Environment:** ${backgroundInstruction}
3.  **Safety:** The model must be fully clothed. This is a professional e-commerce image suitable for a general audience.
4.  **Style:** ${promptSuffix}

**Output:** Return ONLY the generated image.`;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const generateVirtualTryOnWithPoseReference = async (
    modelImageUrl: string,
    garmentImage: File,
    poseReferenceImage: File,
    settings: GenerationSettings
): Promise<string> => {
    const model = 'gemini-2.5-flash-image';
    const modelImagePart = await dataUrlToPart(modelImageUrl);
    const garmentImagePart = await fileToPart(garmentImage);
    const poseReferenceImagePart = await fileToPart(poseReferenceImage);

    const promptSuffix = getGenerationPromptSuffix(settings, { exclude: ['studioEnvironment' as any, 'posePrompt'] });

    const backgroundInstruction = getStudioEnvironmentPrompt(settings.studioEnvironment, settings.shadowSculpting, settings.floorSettings);

    const prompt = `You are a professional fashion AI.
**Inputs:**
1.  **Model Image:** (First image) Subject identity.
2.  **Garment Image:** (Second image) Clothing to wear.
3.  **Pose Reference:** (Third image) Target pose.

**Task:** Generate a new image of the Model wearing the Garment in the Target Pose.

**Directives:**
1.  **Subject:** Use the Model's identity.
2.  **Attire:** Wear the Garment.
3.  **Pose:** Match the Pose Reference exactly.
4.  **Setting:** ${backgroundInstruction}
5.  **Safety:** Ensure the model is fully clothed.

${promptSuffix}`

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [modelImagePart, garmentImagePart, poseReferenceImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const generatePoseVariation = async (tryOnImageUrl: string, poseInstruction: string, settings: GenerationSettings): Promise<string> => {
    const model = 'gemini-2.5-flash-image';
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

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [tryOnImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const reviseGeneratedImage = async (baseImageUrl: string, revisionPrompt: string, settings: GenerationSettings, model: string): Promise<string> => {
    const baseImagePart = await dataUrlToPart(baseImageUrl);
    const promptSuffix = getGenerationPromptSuffix(settings);

    const outfitRule = getOutfitPrompt(revisionPrompt);
    const framingPrompt = getFramingPrompt(settings.shotFraming);

    const prompt = `[ROLE]
You are a specialized AI Fashion Editor & Retoucher.

[TASK]
Edit the provided image based on the User Request, while maintaining Hyper-Realistic quality.

[USER REQUEST]
"${revisionPrompt}"

[TECHNICAL SPECIFICATIONS]
- Framing: ${framingPrompt}
- Camera Position: ${getCameraPositionPrompt(settings.cameraPosition)}

[SUBJECT SPECIFICATIONS]
- Identity: Maintain the model's identity and professional style.
- Skin Details: ${REALISM_TOKENS}
- Anatomy: ${ANATOMY_TOKENS}

[STRICT WARDROBE CONSTRAINTS]
- Item: Neutral, form-fitting boxer briefs or boy shorts.
- Material: ${outfitRule}
- Rule: DO NOT change the outfit unless the user's request is *explicitly* about changing the clothing itself.

[STYLE & ENVIRONMENT]
${promptSuffix}

[NEGATIVE CONSTRAINTS]
${QA_NEGATIVE_PROMPT}`;

    const response = await ai.models.generateContent({
        model: model || 'gemini-2.5-flash-image',
        contents: { parts: [baseImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    return handleApiResponse(response);
};

export const reviseMaskedImage = async (baseImageUrl: string, maskDataUrl: string, revisionPrompt: string, settings: GenerationSettings): Promise<string> => {
    const model = 'gemini-2.5-flash-image';
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

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [baseImagePart, maskImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    return handleApiResponse(response);
};

export const regenerateFrame = async (baseImageUrl: string, settings: GenerationSettings): Promise<string> => {
    const model = 'gemini-2.5-flash-image';
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

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [baseImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const analyzeGarment = async (garmentImage: File): Promise<GarmentAnalysis> => {
    const model = 'gemini-2.5-flash';
    const garmentImagePart = await fileToPart(garmentImage);
    const prompt = "Analyze the clothing item in this image. Return a JSON object with: palette (3 hex codes), category (e.g. 'Summer Dress'), and material (e.g. 'Cotton').";

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [garmentImagePart, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    palette: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "An array of 3 dominant hex color codes from the garment.",
                    },
                    category: {
                        type: Type.STRING,
                        description: "A descriptive category for the garment.",
                    },
                    material: {
                        type: Type.STRING,
                        description: "The primary material of the garment.",
                    },
                },
                required: ["palette", "category", "material"],
            },
        },
    });

    try {
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Failed to parse garment analysis JSON:", e);
        throw new Error("Could not analyze the garment.");
    }
};

export const generateVideoFromImage = async (referenceImageUrl: string, settings: VideoGenerationSettings): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const { mimeType, data } = dataUrlToParts(referenceImageUrl);

    let operation = await ai.models.generateVideos({
        model: settings.model,
        prompt: settings.prompt,
        image: {
            imageBytes: data,
            mimeType: mimeType,
        },
        config: {
            numberOfVideos: 1,
            resolution: settings.resolution,
            aspectRatio: settings.aspectRatio,
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message}`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation completed, but no download link was found.");
    }

    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY!}`);
    if (!videoResponse.ok) {
        throw new Error(`Failed to download the generated video.`);
    }
    const videoBlob = await videoResponse.blob();

    return URL.createObjectURL(videoBlob);
};