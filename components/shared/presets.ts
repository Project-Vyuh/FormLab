
import { GenerationSettings } from '../../types';

export const STYLE_PRESETS: { label: string, settings: Partial<GenerationSettings> }[] = [
    {
        label: "Cinematic",
        settings: {
            photoStyle: "modern",
            sensorSize: 'full-frame',
            apertureSettings: { aperture: 2.8, bokehShape: 'anamorphic' },
            lightingRig: {
                lights: [
                    { id: 'key-1', type: 'spot', role: 'key', position: { angle: 135, distance: 0.9, elevation: 20 }, power: 1.5, size: 0.2, kelvin: 4800, tint: 0, saturation: 1 }
                ],
                hdri: { map: 'high-contrast', rotation: 90 }
            }
        }
    },
    {
        label: "Studio",
        settings: {
            studioEnvironment: {
                type: 'high-key',
                brightness: 1.0,
                reflectionStrength: 0,
                cycloramaCurve: 1.0
            },
            panelToggles: {
                composition: false,
                cameraAndLens: false,
                lighting: false,
                environment: true, // CRITICAL: Enable environment panel so the prompt is used
                imageFinishing: false
            }
        }
    },
    {
        label: "Natural",
        settings: {
            studioEnvironment: { type: 'custom', prompt: 'outdoor, golden hour' },
            sensorSize: 'medium-format',
            lightingRig: {
                lights: [],
                hdri: { map: 'fashion-beauty', rotation: 180 }
            }
        }
    },
    {
        label: "Edgy",
        settings: {
            photoStyle: 'modern',
            negativePrompt: 'soft, warm tones',
            sensorSize: 'medium-format',
            lightingRig: {
                lights: [
                    { id: 'rim-1', type: 'spot', role: 'rim', position: { angle: 0, distance: 0.9, elevation: 45 }, power: 2.0, size: 0.4, kelvin: 7500, tint: 0, saturation: 1 }
                ],
                hdri: { map: 'high-contrast', rotation: 270 }
            }
        }
    }
];
