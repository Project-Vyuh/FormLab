/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo } from 'react';
import {
    GenerationSettings, PhotoStyle, ShotFraming, AspectRatio, LensProfile, CameraProfile,
    Light, LightRole, HdriMap, SceneAtmosphere, ImageProcessingSettings, BokehShape,
    ShutterSettings, SensorSize, NoiseAndGrainSettings, StudioEnvironment,
    StudioEnvironmentType, GradientType, TextureType, FloorMaterial,
    AmbientBounceSettings, AmbientOcclusionSettings, StudioVignetting, PanelToggles, LightingRig,
    HighKeyEnvironment, TexturedEnvironment, ColoredSeamlessEnvironment, GradientEnvironment, CustomEnvironment
} from '../types';
import CollapsibleSection from './shared/CollapsibleSection';
import OptionButton from './shared/OptionButton';
import {
    LayoutIcon, CameraIcon, SunIcon, LayersIcon, WandIcon, SlidersHorizontalIcon,
    Trash2Icon
} from './icons';
import { motion, AnimatePresence } from 'framer-motion';

const shotFramingOptions: { id: ShotFraming, label: string }[] = [{ id: 'full', label: 'Full Body' }, { id: 'medium', label: 'Medium' }, { id: 'closeup', label: 'Close-Up' }];
const aspectRatioOptions: { id: AspectRatio, label: string }[] = [{ id: '2:3', label: '2:3' }, { id: '1:1', label: '1:1' }, { id: '4:5', label: '4:5' }, { id: '9:16', label: '9:16' }, { id: '16:9', label: '16:9' }];
const lensProfileOptions: { id: LensProfile, label: string }[] = [
    { id: '24mm', label: '24mm' }, { id: '35mm', label: '35mm' }, { id: '50mm', label: '50mm' }, { id: '85mm', label: '85mm' }, { id: '135mm', label: '135mm' },
];
const cameraProfileOptions: { id: CameraProfile, label: string }[] = [
    { id: 'canon', label: 'Canon' }, { id: 'nikon', label: 'Nikon' }, { id: 'sony', label: 'Sony' }, { id: 'phase-one', label: 'Phase One' },
];
const LIGHTING_PRESETS: { label: string, rig: LightingRig, atmosphere?: Partial<SceneAtmosphere> }[] = [
    {
        label: "Rembrandt",
        rig: {
            lights: [
                { id: 'key-rembrandt', type: 'spot', role: 'key', position: { angle: 225, distance: 0.8, elevation: 45 }, power: 1.5, size: 0.3, kelvin: 4800, tint: 0, saturation: 1 }
            ],
            hdri: { map: 'none', rotation: 0 }
        },
        atmosphere: { vignetting: { strength: 0.4, shape: 'round', bias: 'center' }, backgroundExposure: -0.2 }
    },
    {
        label: "Loop",
        rig: {
            lights: [
                { id: 'key-loop', type: 'area', role: 'key', position: { angle: 215, distance: 0.7, elevation: 30 }, power: 1.0, size: 0.6, kelvin: 5500, tint: 0, saturation: 1 },
                { id: 'fill-loop', type: 'area', role: 'fill', position: { angle: 145, distance: 0.8, elevation: 0 }, power: -1.0, size: 1.0, kelvin: 5500, tint: 0, saturation: 1 }
            ],
            hdri: { map: 'neutral', rotation: 0 }
        }
    },
    {
        label: "Butterfly",
        rig: {
            lights: [
                { id: 'key-butterfly', type: 'area', role: 'key', position: { angle: 180, distance: 0.5, elevation: 60 }, power: 1.2, size: 0.8, kelvin: 5600, tint: 0, saturation: 1 }
            ],
            hdri: { map: 'fashion-beauty', rotation: 0 }
        }
    },
    {
        label: "Clamshell",
        rig: {
            lights: [
                { id: 'key-clamshell', type: 'area', role: 'key', position: { angle: 180, distance: 0.5, elevation: 45 }, power: 1.0, size: 0.7, kelvin: 5600, tint: 0, saturation: 1 },
                { id: 'fill-clamshell', type: 'area', role: 'fill', position: { angle: 180, distance: 0.8, elevation: -45 }, power: -0.5, size: 1.0, kelvin: 5600, tint: 0, saturation: 1 }
            ],
            hdri: { map: 'fashion-beauty', rotation: 20 }
        }
    },
    {
        label: "Split",
        rig: {
            lights: [
                { id: 'key-split', type: 'spot', role: 'key', position: { angle: 270, distance: 0.9, elevation: 0 }, power: 1.8, size: 0.2, kelvin: 5000, tint: 0, saturation: 1 }
            ],
            hdri: { map: 'none', rotation: 0 }
        },
        atmosphere: { vignetting: { strength: 0.8, shape: 'round', bias: 'center' }, backgroundExposure: -0.5 }
    },
    {
        label: "Flat",
        rig: {
            lights: [
                { id: 'key-flat', type: 'area', role: 'key', position: { angle: 160, distance: 0.7, elevation: 15 }, power: 0.5, size: 1, kelvin: 5600, tint: 0, saturation: 1 },
                { id: 'fill-flat', type: 'area', role: 'fill', position: { angle: 200, distance: 0.7, elevation: -15 }, power: 0.5, size: 1, kelvin: 5600, tint: 0, saturation: 1 }
            ],
            hdri: { map: 'neutral', rotation: 0 }
        }
    }
];

interface GlobalControlsProps {
    generationSettings: GenerationSettings;
    onSettingsChange: React.Dispatch<React.SetStateAction<GenerationSettings>>;
    isGenerating: boolean;
    openSections: { [key: string]: boolean };
    onToggleSection: (section: string) => void;
    selectedLightId: string | null;
    onSelectLightId: (id: string | null) => void;
    onAddLight: (role: LightRole) => void;
    onUpdateLight: (id: string, updates: Partial<Light> | { position: Partial<Light['position']> }) => void;
    onRemoveLight: (id: string) => void;
    onPanelToggle: (panel: keyof PanelToggles) => void;
    isRevisionMode?: boolean;
    selectedModelName?: string;
}

const GlobalControls: React.FC<GlobalControlsProps> = (props) => {
    const {
        generationSettings, onSettingsChange, isGenerating, openSections, onToggleSection,
        selectedLightId, onSelectLightId, onAddLight, onUpdateLight, onRemoveLight, onPanelToggle, isRevisionMode, selectedModelName
    } = props;

    const activePresetLabel = useMemo(() => {
        const currentRig = generationSettings.lightingRig;
        for (const preset of LIGHTING_PRESETS) {
            if (JSON.stringify(preset.rig) === JSON.stringify(currentRig)) {
                return preset.label;
            }
        }
        return null;
    }, [generationSettings.lightingRig]);

    const keyLight = useMemo(() => generationSettings.lightingRig.lights.find(l => l.role === 'key'), [generationSettings.lightingRig.lights]);
    const fillLight = useMemo(() => generationSettings.lightingRig.lights.find(l => l.role === 'fill'), [generationSettings.lightingRig.lights]);
    const rimLight = useMemo(() => generationSettings.lightingRig.lights.find(l => l.role === 'rim'), [generationSettings.lightingRig.lights]);


    let activeRatio: number | null = null;
    if (keyLight && fillLight) {
        const stopsDifference = keyLight.power - fillLight.power;
        const ratios = [1, 2, 4, 8];
        const closestRatio = ratios.find(r => Math.abs((r === 1 ? 0 : Math.log2(r)) - stopsDifference) < 0.05);
        if (closestRatio) {
            activeRatio = closestRatio;
        }
    }

    const handleSetFillRatio = (ratio: number) => {
        if (!keyLight || !fillLight) return;
        const stopsDifference = ratio === 1 ? 0 : Math.log2(ratio);
        const newFillPower = keyLight.power - stopsDifference;
        onUpdateLight(fillLight.id, { power: newFillPower });
    };

    const handleStudioEnvironmentChange = (type: StudioEnvironmentType) => {
        let newEnv: StudioEnvironment;
        switch (type) {
            case 'high-key': newEnv = { type: 'high-key', brightness: 1.0, reflectionStrength: 0.2, cycloramaCurve: 0.8 }; break;
            case 'mid-gray': newEnv = { type: 'mid-gray', cycloramaCurve: 0.7 }; break;
            case 'textured': newEnv = { type: 'textured', textureType: 'concrete', intensity: 0.5, roughness: 0.5, cycloramaCurve: 0.2 }; break;
            case 'colored-seamless': newEnv = { type: 'colored-seamless', color: '#B0D8FF', cycloramaCurve: 0.7 }; break;
            case 'gradient': newEnv = { type: 'gradient', gradientType: 'radial', color1: '#202030', color2: '#404050', cycloramaCurve: 0 }; break;
            case 'transparent': newEnv = { type: 'transparent' }; break;
            case 'custom': newEnv = { type: 'custom', prompt: '' }; break;
            default: newEnv = { type: 'mid-gray', cycloramaCurve: 0.5 };
        }
        onSettingsChange(gs => ({ ...gs, studioEnvironment: newEnv }));
    };

    const handleStudioEnvChange = <K extends StudioEnvironment['type']>(
        type: K,
        update: Partial<Extract<StudioEnvironment, { type: K }>>
    ) => {
        onSettingsChange(gs => {
            if (gs.studioEnvironment.type === type) {
                return {
                    ...gs,
                    studioEnvironment: { ...gs.studioEnvironment, ...update }
                };
            }
            return gs;
        });
    };

    const ColorWheelControl: React.FC<{
        label: string;
        value: { r: number, g: number, b: number };
        onChange: (newValue: { r: number, g: number, b: number }) => void;
    }> = ({ label, value, onChange }) => (
        <div>
            <h5 className="text-[11px] font-semibold text-gray-400 mb-1">{label}</h5>
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400 w-4">R</span>
                    <input type="range" min="-1" max="1" step="0.05" value={value.r} onChange={e => onChange({ ...value, r: +e.target.value })} className="w-full" disabled={isGenerating} />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-green-400 w-4">G</span>
                    <input type="range" min="-1" max="1" step="0.05" value={value.g} onChange={e => onChange({ ...value, g: +e.target.value })} className="w-full" disabled={isGenerating} />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-400 w-4">B</span>
                    <input type="range" min="-1" max="1" step="0.05" value={value.b} onChange={e => onChange({ ...value, b: +e.target.value })} className="w-full" disabled={isGenerating} />
                </div>
            </div>
        </div>
    );

    const selectedLight = generationSettings.lightingRig.lights.find(l => l.id === selectedLightId);

    return (
        <div className="space-y-3">
            <CollapsibleSection title="Composition" icon={<LayoutIcon className="w-3.5 h-3.5 text-gray-600" />} isOpen={openSections.composition} onToggle={() => onToggleSection('composition')} isToggleable={true} isPanelEnabled={generationSettings.panelToggles.composition} onPanelToggle={() => onPanelToggle('composition')} noBorder={true}>
                <div className="space-y-3">
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Framing</label>
                        <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                            {shotFramingOptions.map(option => <OptionButton key={option.id} onClick={() => onSettingsChange(gs => ({ ...gs, shotFraming: option.id }))} isActive={generationSettings.shotFraming === option.id} disabled={isGenerating}>{option.label}</OptionButton>)}
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Aspect Ratio</label>
                        <div className="grid grid-cols-5 gap-1.5 mt-0.5">
                            {aspectRatioOptions.map(option => <OptionButton key={option.id} onClick={() => onSettingsChange(gs => ({ ...gs, aspectRatio: option.id }))} isActive={generationSettings.aspectRatio === option.id} disabled={isGenerating || isRevisionMode || selectedModelName === 'Nano Banana'}>{option.label}</OptionButton>)}
                        </div>
                        {isRevisionMode && <p className="text-[10px] text-gray-500 mt-1">Aspect ratio cannot be changed during revision.</p>}
                        {!isRevisionMode && selectedModelName === 'Nano Banana' && <p className="text-[10px] text-gray-500 mt-1">Aspect ratio selection is not supported by Nano Banana.</p>}
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Camera Position</label>
                        <div className="mt-2 space-y-2">
                            <div>
                                <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Height</label><span className="text-[11px] font-mono text-gray-300 bg-black/30 px-1 py-0.5 rounded">{generationSettings.cameraPosition.height.toFixed(2)}m</span></div>
                                <input type="range" min="0" max="2.5" step="0.05" value={generationSettings.cameraPosition.height} onChange={e => onSettingsChange(gs => ({ ...gs, cameraPosition: { ...gs.cameraPosition, height: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                            </div>
                            <div>
                                <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Tilt</label><span className="text-[11px] font-mono text-gray-300 bg-black/30 px-1 py-0.5 rounded">{generationSettings.cameraPosition.tilt.toFixed(0)}°</span></div>
                                <input type="range" min="-45" max="45" step="1" value={generationSettings.cameraPosition.tilt} onChange={e => onSettingsChange(gs => ({ ...gs, cameraPosition: { ...gs.cameraPosition, tilt: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                            </div>
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Camera & Lens" icon={<CameraIcon className="w-3.5 h-3.5 text-gray-600" />} isOpen={openSections.camera} onToggle={() => onToggleSection('camera')} isToggleable={true} isPanelEnabled={generationSettings.panelToggles.cameraAndLens} onPanelToggle={() => onPanelToggle('cameraAndLens')}>
                <div className="space-y-3">
                    <p className="text-[11px] text-gray-500 -mt-2">Note: Aperture and Lens Profile settings can influence the characteristics of bokeh from the lighting setup.</p>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Lens Profile</label>
                        <div className="grid grid-cols-5 gap-1.5 mt-0.5">
                            {lensProfileOptions.map(option => <OptionButton key={option.id} onClick={() => onSettingsChange(gs => ({ ...gs, lensProfile: gs.lensProfile === option.id ? '50mm' : option.id }))} isActive={generationSettings.lensProfile === option.id} disabled={isGenerating}>{option.label}</OptionButton>)}
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Aperture</label>
                        <div className="mt-2 space-y-2">
                            <div>
                                <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">F-Stop</label><span className="text-[11px] font-mono text-gray-300 bg-black/30 px-1 py-0.5 rounded">f/{generationSettings.apertureSettings.aperture.toFixed(1)}</span></div>
                                <input type="range" min="1.2" max="22" step="0.1" value={generationSettings.apertureSettings.aperture} onChange={e => onSettingsChange(gs => ({ ...gs, apertureSettings: { ...gs.apertureSettings, aperture: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                            </div>
                            <div>
                                <label className="text-[11px] text-gray-400">Bokeh Shape</label>
                                <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                                    {(['round', 'pentagon', 'anamorphic'] as BokehShape[]).map(shape => (
                                        <OptionButton key={shape} onClick={() => onSettingsChange(gs => ({ ...gs, apertureSettings: { ...gs.apertureSettings, bokehShape: gs.apertureSettings.bokehShape === shape ? 'round' : shape } }))} isActive={generationSettings.apertureSettings.bokehShape === shape} disabled={isGenerating}>
                                            {shape.charAt(0).toUpperCase() + shape.slice(1)}
                                        </OptionButton>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Focus Plane</label>
                        <div className="mt-2 space-y-3">
                            <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
                                <input type="checkbox" checked={generationSettings.focusPlaneSettings.faceAutofocus} onChange={e => onSettingsChange(gs => ({ ...gs, focusPlaneSettings: { ...gs.focusPlaneSettings, faceAutofocus: e.target.checked } }))} className="h-4 w-4 rounded bg-black/30 border-gray-600 text-blue-500 focus:ring-blue-500" />
                                Face Autofocus
                            </label>
                            <div>
                                <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Focus Distance</label><span className="text-[11px] font-mono text-gray-300 bg-black/30 px-1 py-0.5 rounded">{generationSettings.focusPlaneSettings.focusDistance.toFixed(2)}</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={generationSettings.focusPlaneSettings.focusDistance} onChange={e => onSettingsChange(gs => ({ ...gs, focusPlaneSettings: { ...gs.focusPlaneSettings, focusDistance: +e.target.value } }))} className="w-full" disabled={isGenerating || generationSettings.focusPlaneSettings.faceAutofocus} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Shutter Simulation</label>
                        <div className="mt-2 space-y-2">
                            <div>
                                <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Motion Blur</label><span className="text-[11px] font-mono text-gray-300 bg-black/30 px-1 py-0.5 rounded">{generationSettings.shutterSettings.motionBlur.toFixed(2)}</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={generationSettings.shutterSettings.motionBlur} onChange={e => onSettingsChange(gs => ({ ...gs, shutterSettings: { ...gs.shutterSettings, motionBlur: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                            </div>
                            <div>
                                <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Blur Angle</label><span className="text-[11px] font-mono text-gray-300 bg-black/30 px-1 py-0.5 rounded">{generationSettings.shutterSettings.blurAngle.toFixed(0)}°</span></div>
                                <input type="range" min="0" max="360" step="5" value={generationSettings.shutterSettings.blurAngle} onChange={e => onSettingsChange(gs => ({ ...gs, shutterSettings: { ...gs.shutterSettings, blurAngle: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                            </div>
                            <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
                                <input type="checkbox" checked={generationSettings.shutterSettings.microGhosting} onChange={e => onSettingsChange(gs => ({ ...gs, shutterSettings: { ...gs.shutterSettings, microGhosting: e.target.checked } }))} className="h-4 w-4 rounded bg-black/30 border-gray-600 text-blue-500 focus:ring-blue-500" />
                                Micro Ghosting
                            </label>
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Lighting" icon={<SunIcon className="w-3.5 h-3.5 text-gray-600" />} isOpen={openSections.lighting} onToggle={() => onToggleSection('lighting')} isToggleable isPanelEnabled={generationSettings.panelToggles.lighting} onPanelToggle={() => onPanelToggle('lighting')}>
                <div className="space-y-3">
                    <p className="text-[11px] text-gray-500 -mt-2">Note: The position and size of lights affect shadows and specular highlights. These are also influenced by the camera's lens profile.</p>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Facial Lighting Presets</label>
                        <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                            {LIGHTING_PRESETS.map(p => <OptionButton key={p.label} onClick={() => onSettingsChange(gs => ({ ...gs, lightingRig: p.rig, sceneAtmosphere: { ...gs.sceneAtmosphere, ...p.atmosphere } }))} isActive={activePresetLabel === p.label} disabled={isGenerating}>{p.label}</OptionButton>)}
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Studio Lights</label>
                        <div className="flex gap-1.5 mt-0.5">
                            {keyLight ? (
                                <OptionButton onClick={() => onSelectLightId(keyLight.id === selectedLightId ? null : keyLight.id)} isActive={selectedLightId === keyLight.id} disabled={isGenerating}>Key</OptionButton>
                            ) : (
                                <OptionButton onClick={() => onAddLight('key')} isActive={false} disabled={isGenerating}>+ Key</OptionButton>
                            )}
                            {fillLight ? (
                                <OptionButton onClick={() => onSelectLightId(fillLight.id === selectedLightId ? null : fillLight.id)} isActive={selectedLightId === fillLight.id} disabled={isGenerating}>Fill</OptionButton>
                            ) : (
                                <OptionButton onClick={() => onAddLight('fill')} isActive={false} disabled={isGenerating}>+ Fill</OptionButton>
                            )}
                            {rimLight ? (
                                <OptionButton onClick={() => onSelectLightId(rimLight.id === selectedLightId ? null : rimLight.id)} isActive={selectedLightId === rimLight.id} disabled={isGenerating}>Rim</OptionButton>
                            ) : (
                                <OptionButton onClick={() => onAddLight('rim')} isActive={false} disabled={isGenerating}>+ Rim</OptionButton>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Fill Ratio (Key:Fill)</label>
                        {!(keyLight && fillLight) && <p className="text-xs text-gray-500 mt-1">Add both a Key and a Fill light to enable ratio controls.</p>}
                        <div className="grid grid-cols-4 gap-1.5 mt-0.5">
                            <OptionButton onClick={() => handleSetFillRatio(1)} isActive={activeRatio === 1} disabled={isGenerating || !(keyLight && fillLight)}>1:1</OptionButton>
                            <OptionButton onClick={() => handleSetFillRatio(2)} isActive={activeRatio === 2} disabled={isGenerating || !(keyLight && fillLight)}>2:1</OptionButton>
                            <OptionButton onClick={() => handleSetFillRatio(4)} isActive={activeRatio === 4} disabled={isGenerating || !(keyLight && fillLight)}>4:1</OptionButton>
                            <OptionButton onClick={() => handleSetFillRatio(8)} isActive={activeRatio === 8} disabled={isGenerating || !(keyLight && fillLight)}>8:1</OptionButton>
                        </div>
                    </div>

                    <AnimatePresence>
                        {selectedLight && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-2.5 bg-black/30 rounded-md space-y-2 border border-white/10">
                                <h5 className="text-xs font-bold text-blue-300 flex justify-between items-center">
                                    {selectedLight.role.charAt(0).toUpperCase() + selectedLight.role.slice(1)} Light Controls
                                    <button onClick={() => onRemoveLight(selectedLight.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2Icon className="w-4 h-4" /></button>
                                </h5>
                                <div>
                                    <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Angle</label><span className="text-[11px] font-mono text-gray-300">{selectedLight.position.angle}°</span></div>
                                    <input type="range" min="0" max="360" value={selectedLight.position.angle} onChange={e => onUpdateLight(selectedLight.id, { position: { angle: +e.target.value } })} className="w-full" disabled={isGenerating} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Elevation</label><span className="text-[11px] font-mono text-gray-300">{selectedLight.position.elevation}°</span></div>
                                    <input type="range" min="-90" max="90" value={selectedLight.position.elevation} onChange={e => onUpdateLight(selectedLight.id, { position: { elevation: +e.target.value } })} className="w-full" disabled={isGenerating} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Distance</label><span className="text-[11px] font-mono text-gray-300">{(selectedLight.position.distance || 0).toFixed(2)}</span></div>
                                    <input type="range" min="0" max="1.5" step="0.01" value={selectedLight.position.distance} onChange={e => onUpdateLight(selectedLight.id, { position: { distance: +e.target.value } })} className="w-full" disabled={isGenerating} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Power (EV)</label><span className="text-[11px] font-mono text-gray-300">{selectedLight.power.toFixed(1)}</span></div>
                                    <input type="range" min="-3" max="3" step="0.1" value={selectedLight.power} onChange={e => onUpdateLight(selectedLight.id, { power: +e.target.value })} className="w-full" disabled={isGenerating} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Size</label><span className="text-[11px] font-mono text-gray-300">{selectedLight.size.toFixed(2)}</span></div>
                                    <input type="range" min="0.01" max="1" step="0.01" value={selectedLight.size} onChange={e => onUpdateLight(selectedLight.id, { size: +e.target.value })} className="w-full" disabled={isGenerating} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Kelvin</label><span className="text-[11px] font-mono text-gray-300">{selectedLight.kelvin}K</span></div>
                                    <input type="range" min="2000" max="10000" step="100" value={selectedLight.kelvin} onChange={e => onUpdateLight(selectedLight.id, { kelvin: +e.target.value })} className="w-full" disabled={isGenerating} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Tint (G-M)</label><span className="text-[11px] font-mono text-gray-300">{selectedLight.tint.toFixed(2)}</span></div>
                                    <input type="range" min="-1" max="1" step="0.01" value={selectedLight.tint} onChange={e => onUpdateLight(selectedLight.id, { tint: +e.target.value })} className="w-full" disabled={isGenerating} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Saturation</label><span className="text-[11px] font-mono text-gray-300">{(selectedLight.saturation || 0).toFixed(2)}</span></div>
                                    <input type="range" min="0" max="1" step="0.01" value={selectedLight.saturation} onChange={e => onUpdateLight(selectedLight.id, { saturation: +e.target.value })} className="w-full" disabled={isGenerating} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="mt-4">
                        <label className="text-[11px] font-medium text-gray-400">HDRI Studio Dome</label>
                        <div className="grid grid-cols-4 gap-1.5 mt-0.5">
                            {(['none', 'neutral', 'high-contrast', 'fashion-beauty'] as HdriMap[]).map(map => (
                                <OptionButton key={map} onClick={() => onSettingsChange(gs => ({ ...gs, lightingRig: { ...gs.lightingRig, hdri: { ...gs.lightingRig.hdri, map } } }))} isActive={generationSettings.lightingRig.hdri.map === map} disabled={isGenerating}>
                                    {map.replace('-', ' ').charAt(0).toUpperCase() + map.replace('-', ' ').slice(1)}
                                </OptionButton>
                            ))}
                        </div>
                        <div className="mt-2">
                            <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Rotation</label><span className="text-[11px] font-mono text-gray-300 bg-black/30 px-1 py-0.5 rounded">{generationSettings.lightingRig.hdri.rotation}°</span></div>
                            <input type="range" min="0" max="360" value={generationSettings.lightingRig.hdri.rotation} onChange={e => onSettingsChange(gs => ({ ...gs, lightingRig: { ...gs.lightingRig, hdri: { ...gs.lightingRig.hdri, rotation: +e.target.value } } }))} className="w-full" disabled={isGenerating} />
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Environment" icon={<LayersIcon className="w-3.5 h-3.5 text-gray-600" />} isOpen={openSections.environment} onToggle={() => onToggleSection('environment')} isToggleable isPanelEnabled={generationSettings.panelToggles.environment} onPanelToggle={() => onPanelToggle('environment')}>
                <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                        {(['high-key', 'mid-gray', 'textured', 'colored-seamless', 'gradient', 'transparent', 'custom'] as StudioEnvironmentType[]).map(type => (
                            <OptionButton key={type} onClick={() => handleStudioEnvironmentChange(type)} isActive={generationSettings.studioEnvironment.type === type} disabled={isGenerating}>
                                {type.replace('-', ' ')}
                            </OptionButton>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={generationSettings.studioEnvironment.type}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            {generationSettings.studioEnvironment.type === 'high-key' && (
                                <div className="space-y-2 pt-3">
                                    <div>
                                        <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Brightness</label><span className="text-[11px] font-mono text-gray-300">{(generationSettings.studioEnvironment as HighKeyEnvironment).brightness.toFixed(2)}</span></div>
                                        <input type="range" min="0.5" max="1.5" step="0.05" value={(generationSettings.studioEnvironment as HighKeyEnvironment).brightness} onChange={e => handleStudioEnvChange('high-key', { brightness: +e.target.value })} className="w-full" disabled={isGenerating} />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Reflection Strength</label><span className="text-[11px] font-mono text-gray-300">{(generationSettings.studioEnvironment as HighKeyEnvironment).reflectionStrength.toFixed(2)}</span></div>
                                        <input type="range" min="0" max="1" step="0.05" value={(generationSettings.studioEnvironment as HighKeyEnvironment).reflectionStrength} onChange={e => handleStudioEnvChange('high-key', { reflectionStrength: +e.target.value })} className="w-full" disabled={isGenerating} />
                                    </div>
                                </div>
                            )}
                            {generationSettings.studioEnvironment.type === 'textured' && (
                                <div className="space-y-3 pt-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['concrete', 'plaster'] as TextureType[]).map(type => (
                                            <OptionButton key={type} onClick={() => handleStudioEnvChange('textured', { textureType: type })} isActive={(generationSettings.studioEnvironment as TexturedEnvironment).textureType === type} disabled={isGenerating}>
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                            </OptionButton>
                                        ))}
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Texture Intensity</label><span className="text-[11px] font-mono text-gray-300">{(generationSettings.studioEnvironment as TexturedEnvironment).intensity.toFixed(2)}</span></div>
                                        <input type="range" min="0" max="1" step="0.05" value={(generationSettings.studioEnvironment as TexturedEnvironment).intensity} onChange={e => handleStudioEnvChange('textured', { intensity: +e.target.value })} className="w-full" disabled={isGenerating} />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Surface Roughness</label><span className="text-[11px] font-mono text-gray-300">{(generationSettings.studioEnvironment as TexturedEnvironment).roughness.toFixed(2)}</span></div>
                                        <input type="range" min="0" max="1" step="0.05" value={(generationSettings.studioEnvironment as TexturedEnvironment).roughness} onChange={e => handleStudioEnvChange('textured', { roughness: +e.target.value })} className="w-full" disabled={isGenerating} />
                                    </div>
                                </div>
                            )}
                            {generationSettings.studioEnvironment.type === 'colored-seamless' && (
                                <div className="pt-3">
                                    <label className="text-[11px] text-gray-400">Seamless Color</label>
                                    <div className="relative mt-1">
                                        <input type="color" value={(generationSettings.studioEnvironment as ColoredSeamlessEnvironment).color} onChange={e => handleStudioEnvChange('colored-seamless', { color: e.target.value })} className="w-full h-8 p-0 border-none rounded-md cursor-pointer" style={{ appearance: 'none', WebkitAppearance: 'none' }} disabled={isGenerating} />
                                    </div>
                                </div>
                            )}
                            {generationSettings.studioEnvironment.type === 'gradient' && (
                                <div className="space-y-3 pt-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['radial', 'vertical', 'horizontal'] as GradientType[]).map(type => (
                                            <OptionButton key={type} onClick={() => handleStudioEnvChange('gradient', { gradientType: type })} isActive={(generationSettings.studioEnvironment as GradientEnvironment).gradientType === type} disabled={isGenerating}>
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                            </OptionButton>
                                        ))}
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-gray-400">Colors</label>
                                        <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                                            <input type="color" value={(generationSettings.studioEnvironment as GradientEnvironment).color1} onChange={e => handleStudioEnvChange('gradient', { color1: e.target.value })} className="w-full h-8 p-0 border-none rounded-md cursor-pointer" disabled={isGenerating} />
                                            <input type="color" value={(generationSettings.studioEnvironment as GradientEnvironment).color2} onChange={e => handleStudioEnvChange('gradient', { color2: e.target.value })} className="w-full h-8 p-0 border-none rounded-md cursor-pointer" disabled={isGenerating} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {generationSettings.studioEnvironment.type === 'custom' && (
                                <div className="pt-3">
                                    <textarea
                                        value={(generationSettings.studioEnvironment as CustomEnvironment).prompt}
                                        onChange={e => handleStudioEnvChange('custom', { prompt: e.target.value })}
                                        placeholder="e.g., A Lisbon street"
                                        rows={2}
                                        className="w-full p-2 bg-black/30 text-gray-200 border border-white/10 rounded-md text-sm"
                                    />
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {generationSettings.studioEnvironment.type !== 'transparent' && generationSettings.studioEnvironment.type !== 'custom' && (
                        <div>
                            <div className="flex justify-between items-center">
                                <label className="text-[11px] text-gray-400">Cyclorama Curve</label>
                                <span className="text-[11px] font-mono text-gray-300 bg-black/30 px-1 py-0.5 rounded">
                                    {(generationSettings.studioEnvironment as any).cycloramaCurve?.toFixed(2) ?? '0.00'}
                                </span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={(generationSettings.studioEnvironment as any).cycloramaCurve ?? 0}
                                onChange={e => onSettingsChange(gs => ({ ...gs, studioEnvironment: { ...gs.studioEnvironment, cycloramaCurve: +e.target.value } }))}
                                className="w-full" disabled={isGenerating}
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Shadow Sculpting</label>
                        <div className="flex gap-4 mt-1">
                            <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={generationSettings.shadowSculpting.flags.left}
                                    onChange={e => onSettingsChange(gs => ({ ...gs, shadowSculpting: { ...gs.shadowSculpting, flags: { ...gs.shadowSculpting.flags, left: e.target.checked } } }))}
                                    className="h-4 w-4 rounded bg-black/30 border-gray-600 text-blue-500 focus:ring-blue-500"
                                    disabled={isGenerating}
                                />
                                Left Flag (Negative Fill)
                            </label>
                            <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={generationSettings.shadowSculpting.flags.right}
                                    onChange={e => onSettingsChange(gs => ({ ...gs, shadowSculpting: { ...gs.shadowSculpting, flags: { ...gs.shadowSculpting.flags, right: e.target.checked } } }))}
                                    className="h-4 w-4 rounded bg-black/30 border-gray-600 text-blue-500 focus:ring-blue-500"
                                    disabled={isGenerating}
                                />
                                Right Flag (Negative Fill)
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Floor Material</label>
                        <div className="grid grid-cols-4 gap-1.5 mt-0.5">
                            {(['matte', 'glossy', 'concrete', 'velvet'] as FloorMaterial[]).map(mat => (
                                <OptionButton key={mat} onClick={() => onSettingsChange(gs => ({ ...gs, floorSettings: { ...gs.floorSettings, material: mat } }))} isActive={generationSettings.floorSettings.material === mat} disabled={isGenerating}>
                                    {mat.charAt(0).toUpperCase() + mat.slice(1)}
                                </OptionButton>
                            ))}
                        </div>
                    </div>

                    {generationSettings.floorSettings.material === 'glossy' && (
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] text-gray-400">Glossiness</label>
                                    <span className="text-[11px] font-mono text-gray-300 bg-black/30 px-1 py-0.5 rounded">
                                        {generationSettings.floorSettings.glossiness.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={generationSettings.floorSettings.glossiness}
                                    onChange={e => onSettingsChange(gs => ({ ...gs, floorSettings: { ...gs.floorSettings, glossiness: +e.target.value } }))}
                                    className="w-full" disabled={isGenerating}
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] text-gray-400">Reflection Length</label>
                                    <span className="text-[11px] font-mono text-gray-300 bg-black/30 px-1 py-0.5 rounded">
                                        {generationSettings.floorSettings.reflectionLength.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={generationSettings.floorSettings.reflectionLength}
                                    onChange={e => onSettingsChange(gs => ({ ...gs, floorSettings: { ...gs.floorSettings, reflectionLength: +e.target.value } }))}
                                    className="w-full" disabled={isGenerating}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Image Finishing" icon={<WandIcon className="w-3.5 h-3.5 text-gray-600" />} isOpen={openSections.finishing} onToggle={() => onToggleSection('finishing')} isToggleable isPanelEnabled={generationSettings.panelToggles.imageFinishing} onPanelToggle={() => onPanelToggle('imageFinishing')}>
                <div className="space-y-3">
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Sensor Size</label>
                        <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                            {(['full-frame', 'medium-format'] as SensorSize[]).map(size => <OptionButton key={size} onClick={() => onSettingsChange(gs => ({ ...gs, sensorSize: gs.sensorSize === size ? undefined : size }))} isActive={generationSettings.sensorSize === size} disabled={isGenerating}>{size.replace('-', ' ')}</OptionButton>)}
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Camera Profile</label>
                        <div className="grid grid-cols-4 gap-1.5 mt-0.5">
                            {cameraProfileOptions.map(p => <OptionButton key={p.id} onClick={() => onSettingsChange(gs => ({ ...gs, cameraProfile: gs.cameraProfile === p.id ? 'none' : p.id }))} isActive={generationSettings.cameraProfile === p.id} disabled={isGenerating}>{p.label}</OptionButton>)}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Exposure Bias</label><span className="text-[11px] font-mono text-gray-300">{generationSettings.imageProcessing.exposureBias.toFixed(2)}</span></div>
                        <input type="range" min="-1" max="1" step="0.05" value={generationSettings.imageProcessing.exposureBias} onChange={e => onSettingsChange(gs => ({ ...gs, imageProcessing: { ...gs.imageProcessing, exposureBias: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Contrast</label>
                        <div className="grid grid-cols-4 gap-1.5 mt-0.5">
                            {(['low', 'neutral', 'high', 'punchy'] as const).map(c => <OptionButton key={c} onClick={() => onSettingsChange(gs => ({ ...gs, imageProcessing: { ...gs.imageProcessing, contrast: c } }))} isActive={generationSettings.imageProcessing.contrast === c} disabled={isGenerating}>{c}</OptionButton>)}
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Color Grade</label>
                        <div className="grid grid-cols-4 gap-1.5 mt-0.5">
                            {(['none', 'cinematic', 'commercial', 'vintage'] as const).map(c => <OptionButton key={c} onClick={() => onSettingsChange(gs => ({ ...gs, imageProcessing: { ...gs.imageProcessing, colorGrade: c } }))} isActive={generationSettings.imageProcessing.colorGrade === c} disabled={isGenerating}>{c}</OptionButton>)}
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Highlight Roll-off</label>
                        <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                            {(['soft', 'medium', 'hard'] as const).map(c => <OptionButton key={c} onClick={() => onSettingsChange(gs => ({ ...gs, imageProcessing: { ...gs.imageProcessing, highlightRollOff: c } }))} isActive={generationSettings.imageProcessing.highlightRollOff === c} disabled={isGenerating}>{c}</OptionButton>)}
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-gray-400">Shadow Crush</label>
                        <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                            {(['none', 'low', 'medium'] as const).map(c => <OptionButton key={c} onClick={() => onSettingsChange(gs => ({ ...gs, imageProcessing: { ...gs.imageProcessing, shadowCrush: c } }))} isActive={generationSettings.imageProcessing.shadowCrush === c} disabled={isGenerating}>{c}</OptionButton>)}
                        </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-3">
                        <h4 className="text-xs font-semibold text-gray-300">Atmosphere & Effects</h4>
                        <div>
                            <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Background Exposure</label><span className="text-[11px] font-mono text-gray-300">{generationSettings.sceneAtmosphere.backgroundExposure.toFixed(2)}</span></div>
                            <input type="range" min="-1" max="1" step="0.05" value={generationSettings.sceneAtmosphere.backgroundExposure} onChange={e => onSettingsChange(gs => ({ ...gs, sceneAtmosphere: { ...gs.sceneAtmosphere, backgroundExposure: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium text-gray-400">Background Blur</label>
                            <div className="grid grid-cols-4 gap-1.5 mt-0.5">
                                {(['none', 'low', 'medium', 'high'] as const).map(c => <OptionButton key={c} onClick={() => onSettingsChange(gs => ({ ...gs, sceneAtmosphere: { ...gs.sceneAtmosphere, backgroundBlur: c } }))} isActive={generationSettings.sceneAtmosphere.backgroundBlur === c} disabled={isGenerating}>{c}</OptionButton>)}
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-medium text-gray-400">Light Wrap</label>
                            <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                                {(['none', 'subtle', 'strong'] as const).map(c => <OptionButton key={c} onClick={() => onSettingsChange(gs => ({ ...gs, sceneAtmosphere: { ...gs.sceneAtmosphere, lightWrap: c } }))} isActive={generationSettings.sceneAtmosphere.lightWrap === c} disabled={isGenerating}>{c}</OptionButton>)}
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-medium text-gray-400">Separation Contrast</label>
                            <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                                {(['soft', 'neutral', 'sharp'] as const).map(c => <OptionButton key={c} onClick={() => onSettingsChange(gs => ({ ...gs, sceneAtmosphere: { ...gs.sceneAtmosphere, separationContrast: c } }))} isActive={generationSettings.sceneAtmosphere.separationContrast === c} disabled={isGenerating}>{c}</OptionButton>)}
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Vignette Strength</label><span className="text-[11px] font-mono text-gray-300">{generationSettings.sceneAtmosphere.vignetting.strength.toFixed(2)}</span></div>
                            <input type="range" min="0" max="1" step="0.05" value={generationSettings.sceneAtmosphere.vignetting.strength} onChange={e => onSettingsChange(gs => ({ ...gs, sceneAtmosphere: { ...gs.sceneAtmosphere, vignetting: { ...gs.sceneAtmosphere.vignetting, strength: +e.target.value } } }))} className="w-full" disabled={isGenerating} />
                        </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-3">
                        <h4 className="text-xs font-semibold text-gray-300">Noise & Grain</h4>
                        <div>
                            <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Grain Amount</label><span className="text-[11px] font-mono text-gray-300">{generationSettings.noiseAndGrain.amount.toFixed(2)}</span></div>
                            <input type="range" min="0" max="1" step="0.05" value={generationSettings.noiseAndGrain.amount} onChange={e => onSettingsChange(gs => ({ ...gs, noiseAndGrain: { ...gs.noiseAndGrain, amount: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium text-gray-400">Grain Type</label>
                            <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                                {(['fine', 'medium', 'coarse'] as const).map(c => <OptionButton key={c} onClick={() => onSettingsChange(gs => ({ ...gs, noiseAndGrain: { ...gs.noiseAndGrain, type: c } }))} isActive={generationSettings.noiseAndGrain.type === c} disabled={isGenerating}>{c}</OptionButton>)}
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
                            <input type="checkbox" checked={generationSettings.noiseAndGrain.chromaticAberration} onChange={e => onSettingsChange(gs => ({ ...gs, noiseAndGrain: { ...gs.noiseAndGrain, chromaticAberration: e.target.checked } }))} className="h-4 w-4 rounded bg-black/30 border-gray-600 text-blue-500 focus:ring-blue-500" />
                            Chromatic Aberration
                        </label>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-3">
                        <h4 className="text-xs font-semibold text-gray-300">Ambient Bounce</h4>
                        <div className="flex items-center gap-3">
                            <input type="color" value={generationSettings.ambientBounce.color} onChange={e => onSettingsChange(gs => ({ ...gs, ambientBounce: { ...gs.ambientBounce, color: e.target.value } }))} className="w-8 h-8 p-0 border-none rounded-md cursor-pointer" disabled={isGenerating} />
                            <div className="flex-grow">
                                <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Strength</label><span className="text-[11px] font-mono text-gray-300">{generationSettings.ambientBounce.strength.toFixed(2)}</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={generationSettings.ambientBounce.strength} onChange={e => onSettingsChange(gs => ({ ...gs, ambientBounce: { ...gs.ambientBounce, strength: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                            </div>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {(['uniform', 'left', 'right', 'top', 'bottom'] as const).map(c => <OptionButton key={c} onClick={() => onSettingsChange(gs => ({ ...gs, ambientBounce: { ...gs.ambientBounce, bias: c } }))} isActive={generationSettings.ambientBounce.bias === c} disabled={isGenerating}>{c}</OptionButton>)}
                        </div>
                    </div>
                    <div className="pt-2 border-t border-white/5 space-y-3">
                        <h4 className="text-xs font-semibold text-gray-300">Ambient Occlusion</h4>
                        <div>
                            <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Intensity</label><span className="text-[11px] font-mono text-gray-300">{generationSettings.ambientOcclusion.intensity.toFixed(2)}</span></div>
                            <input type="range" min="0" max="1" step="0.05" value={generationSettings.ambientOcclusion.intensity} onChange={e => onSettingsChange(gs => ({ ...gs, ambientOcclusion: { ...gs.ambientOcclusion, intensity: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                        </div>
                        <div>
                            <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Radius</label><span className="text-[11px] font-mono text-gray-300">{generationSettings.ambientOcclusion.radius.toFixed(2)}</span></div>
                            <input type="range" min="0" max="1" step="0.05" value={generationSettings.ambientOcclusion.radius} onChange={e => onSettingsChange(gs => ({ ...gs, ambientOcclusion: { ...gs.ambientOcclusion, radius: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                        </div>
                    </div>
                    <div className="pt-2 border-t border-white/5 space-y-3">
                        <h4 className="text-xs font-semibold text-gray-300">Editing & Retouching (Digital Darkroom)</h4>
                        <div className="p-2.5 bg-black/20 rounded-md space-y-3 border border-white/5">
                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Skin & Surface</h5>
                            <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer"><input type="checkbox" checked={!!generationSettings.digitalDarkroom?.frequencySeparation} onChange={e => onSettingsChange(gs => ({ ...gs, digitalDarkroom: { ...gs.digitalDarkroom, frequencySeparation: e.target.checked } }))} className="h-4 w-4 rounded" />Frequency Separation</label>
                            <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer"><input type="checkbox" checked={!!generationSettings.digitalDarkroom?.skinToneHarmonization} onChange={e => onSettingsChange(gs => ({ ...gs, digitalDarkroom: { ...gs.digitalDarkroom, skinToneHarmonization: e.target.checked } }))} className="h-4 w-4 rounded" />Skin Tone Harmonization</label>
                            <div>
                                <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Shine Control</label><span className="text-[11px] font-mono text-gray-300">{(generationSettings.digitalDarkroom?.shineControl || 0).toFixed(2)}</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={generationSettings.digitalDarkroom?.shineControl || 0} onChange={e => onSettingsChange(gs => ({ ...gs, digitalDarkroom: { ...gs.digitalDarkroom, shineControl: +e.target.value } }))} className="w-full" disabled={isGenerating} />
                            </div>
                        </div>
                        <div className="p-2.5 bg-black/20 rounded-md space-y-3 border border-white/5">
                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Geometry & Cleanup</h5>
                            <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer"><input type="checkbox" checked={!!generationSettings.digitalDarkroom?.lensCorrection} onChange={e => onSettingsChange(gs => ({ ...gs, digitalDarkroom: { ...gs.digitalDarkroom, lensCorrection: e.target.checked } }))} className="h-4 w-4 rounded" />Lens Correction</label>
                            <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer"><input type="checkbox" checked={!!generationSettings.digitalDarkroom?.bodyWarpCorrection} onChange={e => onSettingsChange(gs => ({ ...gs, digitalDarkroom: { ...gs.digitalDarkroom, bodyWarpCorrection: e.target.checked } }))} className="h-4 w-4 rounded" />Body Warp Correction</label>
                            <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer"><input type="checkbox" checked={!!generationSettings.digitalDarkroom?.cleanup} onChange={e => onSettingsChange(gs => ({ ...gs, digitalDarkroom: { ...gs.digitalDarkroom, cleanup: e.target.checked } }))} className="h-4 w-4 rounded" />Cleanup (Dust, Flyaways)</label>
                        </div>
                        <div className="p-2.5 bg-black/20 rounded-md space-y-3 border border-white/5">
                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Render Finishing</h5>
                            <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer"><input type="checkbox" checked={!!generationSettings.digitalDarkroom?.studioSharpening} onChange={e => onSettingsChange(gs => ({ ...gs, digitalDarkroom: { ...gs.digitalDarkroom, studioSharpening: e.target.checked } }))} className="h-4 w-4 rounded" />Studio Sharpening</label>
                            <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer"><input type="checkbox" checked={!!generationSettings.digitalDarkroom?.dynamicRangeTuning} onChange={e => onSettingsChange(gs => ({ ...gs, digitalDarkroom: { ...gs.digitalDarkroom, dynamicRangeTuning: e.target.checked } }))} className="h-4 w-4 rounded" />Dynamic Range Tuning</label>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-3">
                        <h4 className="text-xs font-semibold text-gray-300">Advanced Color Grading</h4>
                        <ColorWheelControl label="Lift (Shadows)" value={generationSettings.imageProcessing.lift || { r: 0, g: 0, b: 0 }} onChange={v => onSettingsChange(gs => ({ ...gs, imageProcessing: { ...gs.imageProcessing, lift: v } }))} />
                        <ColorWheelControl label="Gamma (Midtones)" value={generationSettings.imageProcessing.gamma || { r: 0, g: 0, b: 0 }} onChange={v => onSettingsChange(gs => ({ ...gs, imageProcessing: { ...gs.imageProcessing, gamma: v } }))} />
                        <ColorWheelControl label="Gain (Highlights)" value={generationSettings.imageProcessing.gain || { r: 0, g: 0, b: 0 }} onChange={v => onSettingsChange(gs => ({ ...gs, imageProcessing: { ...gs.imageProcessing, gain: v } }))} />
                    </div>
                    <div className="pt-2 border-t border-white/5 space-y-3">
                        <h4 className="text-xs font-semibold text-gray-300">Split Toning</h4>
                        <div>
                            <label className="text-[11px] text-gray-400">Highlights / Shadows</label>
                            <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                                <input type="color" value={generationSettings.imageProcessing.splitToning?.highlights.color || '#ffffff'} onChange={e => onSettingsChange(gs => ({ ...gs, imageProcessing: { ...gs.imageProcessing, splitToning: { ...gs.imageProcessing.splitToning!, highlights: { ...gs.imageProcessing.splitToning!.highlights, color: e.target.value } } } }))} className="w-full h-8 p-0 border-none rounded-md cursor-pointer" disabled={isGenerating} />
                                <input type="color" value={generationSettings.imageProcessing.splitToning?.shadows.color || '#ffffff'} onChange={e => onSettingsChange(gs => ({ ...gs, imageProcessing: { ...gs.imageProcessing, splitToning: { ...gs.imageProcessing.splitToning!, shadows: { ...gs.imageProcessing.splitToning!.shadows, color: e.target.value } } } }))} className="w-full h-8 p-0 border-none rounded-md cursor-pointer" disabled={isGenerating} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-center"><label className="text-[11px] text-gray-400">Balance</label><span className="text-[11px] font-mono text-gray-300">{(generationSettings.imageProcessing.splitToning?.highlights.balance || 0.5).toFixed(2)}</span></div>
                            <input type="range" min="0" max="1" step="0.05" value={generationSettings.imageProcessing.splitToning?.highlights.balance || 0.5} onChange={e => onSettingsChange(gs => ({ ...gs, imageProcessing: { ...gs.imageProcessing, splitToning: { ...gs.imageProcessing.splitToning!, highlights: { ...gs.imageProcessing.splitToning!.highlights, balance: +e.target.value } } } }))} className="w-full" disabled={isGenerating} />
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Advanced" icon={<SlidersHorizontalIcon className="w-3.5 h-3.5 text-gray-600" />} isOpen={openSections.advanced} onToggle={() => onToggleSection('advanced')}>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={generationSettings.useEnhancedTryOn ?? true}
                                onChange={(e) => onSettingsChange(gs => ({
                                    ...gs,
                                    useEnhancedTryOn: e.target.checked
                                }))}
                                className="h-4 w-4 rounded bg-black/30 border-gray-600 text-blue-500 focus:ring-blue-500"
                            />
                            <span>Enhanced Detail Preservation</span>
                        </label>
                        <p className="text-[10px] text-gray-500 ml-6">
                            Analyzes garments to preserve exact colors, patterns, and details during virtual try-on
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] text-gray-400">Negative Prompt</label>
                        <textarea value={generationSettings.negativePrompt} onChange={(e) => onSettingsChange(gs => ({ ...gs, negativePrompt: e.target.value }))} placeholder="e.g. blurry, text, watermark" rows={2} className="w-full p-3 bg-black/20 text-gray-200 border border-white/10 rounded-lg text-xs placeholder-gray-600 focus:border-white/20 focus:bg-black/30 focus:ring-0 outline-none transition-all resize-none" />
                    </div>
                </div>
            </CollapsibleSection>
        </div>
    );
};

export default GlobalControls;