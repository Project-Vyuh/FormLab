/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloudIcon, PenLineIcon, CubeIcon, UndoIcon, RedoIcon, BookmarkIcon, DownloadIcon, CameraIcon, ZapIcon, LayoutIcon, WandIcon, ChevronRightIcon, SunIcon, SlidersHorizontalIcon, ChevronDownIcon, LayersIcon, Trash2Icon, PlusIcon, PersonStandingIcon, StarIcon, GitBranchIcon, ChevronUpIcon } from './icons';
import { Compare } from './ui/compare';
import { generateModelImage, generateModelFromDescription, reviseGeneratedImage, enhanceDescriptionPrompt, enhanceRevisionPrompt, upscaleImage, selectivelyEnhanceImage, reviseMaskedImage } from '../services/geminiService';
import Spinner from './Spinner';
import { getFriendlyErrorMessage } from '../lib/utils';
import { GenerationSettings, UpscaleResolution, PhotoStyle, ShotFraming, BrandStyle, AspectRatio, LightingRig, Light, LightRole, HdriMap, LightType, SceneAtmosphere, ImageProcessingSettings, LensProfile, ApertureSettings, BokehShape, ShutterSettings, SensorSize, CameraPositionSettings, FocusPlaneSettings, CameraProfile, NoiseAndGrainSettings, StudioEnvironment, ShadowSculptingSettings, StudioEnvironmentType, GradientType, TextureType, FloorMaterial, AmbientBounceSettings, AmbientOcclusionSettings, FloorSettings, StudioVignetting, Project, PanelToggles, HistoryItem, User } from '../types';
import ConfirmationModal from './ConfirmationModal';
import ResizeHandle from './ResizeHandle';
import { useDebouncedEffect } from '../hooks/useDebouncedEffect';
import {
    saveProjectState,
    loadProjectState
} from '../services/dbService';
import { uploadBase64Image, isBase64Url } from '../services/storageService';
import GlobalControls from './GlobalControls';
import CollapsibleSection from './shared/CollapsibleSection';
import OptionButton from './shared/OptionButton';
import VersionHistoryPanel from './VersionHistoryPanel';
import ProjectSelectorPanel from './ProjectSelectorPanel';
import PromptPanel from './PromptPanel';


interface CreateModelProps {
  onModelFinalized: (modelUrl: string, projectId: string) => void;
  onSaveModelInstance: (modelUrl: string) => void;
  projectList: Project[];
  currentProjectId: string | null;
  onProjectChange: (id: string) => void;
  onOpenProjectModal: (mode: 'create' | 'edit') => void;
  currentUser: User | null;
}

type GenerationModel = 'gemini-2.5-flash-image' | 'imagen-4.0-generate-001';

const generationModels: { name: string, id: GenerationModel | null, disabled?: boolean, title?: string }[] = [
    { name: 'Nano Banana', id: 'gemini-2.5-flash-image' },
    { name: 'Imagen 4', id: 'imagen-4.0-generate-001' },
    { name: 'Imagen 4 Ultra', id: null, disabled: true, title: 'Imagen 4 Ultra is not yet available in this application.' },
];

// Robust deep merge function to handle loading state from older versions
const isObject = (item: any): item is Object => {
  return (item && typeof item === 'object' && !Array.isArray(item));
};

const mergeDeep = (target: any, source: any): any => {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target) || !isObject(target[key])) {
          // If target doesn't have the key, or if the types are different (e.g., primitive vs object), just assign source.
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
};


const initialPanelToggles: PanelToggles = {
    composition: false,
    cameraAndLens: false,
    lighting: false,
    environment: false,
    imageFinishing: false,
};

const initialImageProcessing: ImageProcessingSettings = {
    exposureBias: 0,
    contrast: 'neutral',
    colorGrade: 'none',
    highlightRollOff: 'medium',
    shadowCrush: 'none',
    lift: { r: 0, g: 0, b: 0 },
    gamma: { r: 0, g: 0, b: 0 },
    gain: { r: 0, g: 0, b: 0 },
    splitToning: { highlights: { color: '#ffffff', balance: 0.5 }, shadows: { color: '#ffffff' } },
};

const initialSceneAtmosphere: SceneAtmosphere = {
    backgroundExposure: 0,
    backgroundBlur: 'none',
    vignetting: { strength: 0, shape: 'round', bias: 'center' },
    lightWrap: 'none',
    separationContrast: 'neutral',
};

const initialLightingRig: LightingRig = {
  lights: [
    { id: 'key-1', type: 'area', role: 'key', position: { angle: 315, distance: 0.7, elevation: 45 }, power: 1.0, size: 0.8, kelvin: 5600, tint: 0, saturation: 1 },
  ],
  hdri: { map: 'neutral', rotation: 0 },
};

const initialShutterSettings: ShutterSettings = {
    motionBlur: 0,
    blurAngle: 0,
    microGhosting: false,
};

const initialNoiseAndGrain: NoiseAndGrainSettings = {
    amount: 0,
    type: 'fine',
    chromaticAberration: false,
};

const initialStudioEnvironment: StudioEnvironment = { type: 'mid-gray', cycloramaCurve: 0.5 };
const initialFloorSettings: FloorSettings = { material: 'matte', glossiness: 0.1, reflectionLength: 0.2 };
const initialShadowSculpting: ShadowSculptingSettings = { flags: { left: false, right: false } };
const initialAmbientBounce: AmbientBounceSettings = { color: '#FFFFFF', strength: 0, bias: 'uniform' };
const initialAmbientOcclusion: AmbientOcclusionSettings = { intensity: 0.3, radius: 0.5 };

const initialGenerationSettings: GenerationSettings = {
    quality: 'standard',
    studioEnvironment: initialStudioEnvironment,
    floorSettings: initialFloorSettings,
    shadowSculpting: initialShadowSculpting,
    ambientBounce: initialAmbientBounce,
    ambientOcclusion: initialAmbientOcclusion,
    photoStyle: 'none',
    accessoryPrompt: '',
    shotFraming: 'full',
    posePrompt: '',
    negativePrompt: '',
    aspectRatio: '2:3',
    apertureSettings: { aperture: 5.6, bokehShape: 'round' },
    lensProfile: undefined,
    shutterSettings: initialShutterSettings,
    lightingRig: initialLightingRig,
    sceneAtmosphere: initialSceneAtmosphere,
    imageProcessing: initialImageProcessing,
    sensorSize: undefined,
    cameraPosition: { height: 1.5, tilt: 0 },
    focusPlaneSettings: { focusDistance: 0.5, faceAutofocus: true },
    cameraProfile: 'none',
    noiseAndGrain: initialNoiseAndGrain,
    digitalDarkroom: {
        frequencySeparation: false,
        shineControl: 0,
        skinToneHarmonization: false,
        lensCorrection: false,
        bodyWarpCorrection: false,
        cleanup: false,
        studioSharpening: false,
        dynamicRangeTuning: false,
    },
    panelToggles: initialPanelToggles,
};

const STYLE_PRESETS: { label: string, settings: Partial<GenerationSettings> }[] = [
    { label: "Cinematic", settings: { photoStyle: "modern", sensorSize: 'full-frame', apertureSettings: { aperture: 2.8, bokehShape: 'anamorphic' }, lightingRig: { lights: [{ id: 'key-1', type: 'spot', role: 'key', position: { angle: 135, distance: 0.9, elevation: 20 }, power: 1.5, size: 0.2, kelvin: 4800, tint: 0, saturation: 1 }], hdri: { map: 'high-contrast', rotation: 90 } } } },
    { label: "Studio", settings: { photoStyle: "modern", sensorSize: 'full-frame', apertureSettings: { aperture: 8.0, bokehShape: 'round' }, studioEnvironment: { type: 'mid-gray', cycloramaCurve: 0.7 }, lightingRig: { lights: [{ id: 'key-1', type: 'area', role: 'key', position: { angle: 315, distance: 0.7, elevation: 30 }, power: 1.0, size: 0.8, kelvin: 5600, tint: 0, saturation: 1 }, { id: 'fill-1', type: 'area', role: 'fill', position: { angle: 45, distance: 0.8, elevation: 0 }, power: -1.0, size: 1.0, kelvin: 5500, tint: 0, saturation: 1 }], hdri: { map: 'neutral', rotation: 0 } } } },
    { label: "Natural", settings: { studioEnvironment: { type: 'custom', prompt: 'outdoor, golden hour' }, sensorSize: 'medium-format', lightingRig: { lights: [], hdri: { map: 'fashion-beauty', rotation: 180 } } } },
    { label: "Edgy", settings: { photoStyle: 'modern', negativePrompt: 'soft, warm tones', sensorSize: 'medium-format', lightingRig: { lights: [{ id: 'rim-1', type: 'spot', role: 'rim', position: { angle: 0, distance: 0.9, elevation: 45 }, power: 2.0, size: 0.4, kelvin: 7500, tint: 0, saturation: 1 }], hdri: { map: 'high-contrast', rotation: 270 } } } }
];


const CreateModel: React.FC<CreateModelProps> = ({
    onModelFinalized,
    onSaveModelInstance,
    projectList,
    currentProjectId,
    onProjectChange,
    onOpenProjectModal,
    currentUser
}) => {
  // Loading & App State
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Content State
  const [modelDescription, setModelDescription] = useState('');
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [selectedModelName, setSelectedModelName] = useState<string>('Nano Banana');

  // History & Settings State
  const [generatedModelHistory, setGeneratedModelHistory] = useState<HistoryItem[]>([]);
  const [currentHistoryItemId, setCurrentHistoryItemId] = useState<string | null>(null);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(initialGenerationSettings);
  const [openSections, setOpenSections] = useState({ project: true, prompt: true, presets: true, composition: false, camera: false, lighting: false, environment: false, finishing: false, advanced: false });
  const [brandStyles, setBrandStyles] = useState<BrandStyle[]>([]);
  
  // Lighting state
  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);

  // Image Viewer State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const startPanPoint = useRef({ x: 0, y: 0 });

  // Feature Toggles & Modals
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isUpscaleMenuOpen, setIsUpscaleMenuOpen] = useState(false);
  const upscaleMenuRef = useRef<HTMLDivElement>(null);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const [isSwitchModelModalOpen, setIsSwitchModelModalOpen] = useState(false);
  const [pendingModelSwitch, setPendingModelSwitch] = useState<string | null>(null);
  const [hasSavedInstance, setHasSavedInstance] = useState(false);
  
  // Layout State
  const [leftPanelWidth, setLeftPanelWidth] = useState(384);

  // Masking State
  const [isMaskingMode, setIsMaskingMode] = useState(false);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(40);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingMask = useRef(false);

  const currentHistoryItem = useMemo(() => generatedModelHistory.find(item => item.id === currentHistoryItemId), [generatedModelHistory, currentHistoryItemId]);
  const generatedModelUrl = currentHistoryItem?.imageUrl;
  
  const compareModelUrl = useMemo(() => {
    if (!currentHistoryItem || !currentHistoryItem.parentId) return generatedModelUrl;
    return generatedModelHistory.find(item => item.id === currentHistoryItem.parentId)?.imageUrl;
  }, [currentHistoryItem, generatedModelHistory]);

  const canUndo = useMemo(() => !!currentHistoryItem?.parentId, [currentHistoryItem]);
  const canRedo = redoStack.length > 0;
  const isResultView = !!generatedModelUrl;
  
  const hasSettingsChanged = useMemo(() => {
    if (!currentHistoryItem) return false;
    return JSON.stringify(generationSettings) !== JSON.stringify(currentHistoryItem.settings);
  }, [generationSettings, currentHistoryItem]);

  const resetProjectState = useCallback(() => {
    setGeneratedModelHistory([]);
    setCurrentHistoryItemId(null);
    setRedoStack([]);
    setIsGenerating(false);
    setModelDescription('');
    setRevisionPrompt('');
    setLoadingMessage('');
    setHasSavedInstance(false);
    setIsCompareMode(false);
    setGenerationSettings(initialGenerationSettings);
  }, []);
  
  // --- Session Persistence & Project Management ---
  useDebouncedEffect(() => {
    if (!isLoaded || !currentProjectId) return;
    const projectState = { modelDescription, revisionPrompt, selectedModelName, generatedModelHistory, currentHistoryItemId, generationSettings, hasSavedInstance };
    saveProjectState(currentProjectId, projectState).catch(e => console.error("Failed to save project state:", e));
  }, [currentProjectId, modelDescription, revisionPrompt, selectedModelName, generatedModelHistory, currentHistoryItemId, generationSettings, hasSavedInstance], 500);
  
  useEffect(() => {
    setIsLoaded(true);
    try {
        const savedStyles = localStorage.getItem('formlab-brand-styles-createmodel');
        if (savedStyles) setBrandStyles(JSON.parse(savedStyles));
    } catch (err) { console.error("Failed to load brand styles", err); }
  }, []);

  useEffect(() => {
    if (!currentProjectId || !isLoaded) return;
    
    const loadProject = async () => {
        try {
            const savedState = await loadProjectState(currentProjectId);
            if (savedState) {
                // Robust deep merge to prevent crashes from old save structures
                const mergedSettings = mergeDeep(initialGenerationSettings, savedState.generationSettings || {});

                setGenerationSettings(mergedSettings);
                setGeneratedModelHistory(savedState.generatedModelHistory || []);
                setCurrentHistoryItemId(savedState.currentHistoryItemId === undefined ? null : savedState.currentHistoryItemId);
                setRedoStack([]);
                setModelDescription(savedState.modelDescription || '');
                setRevisionPrompt(savedState.revisionPrompt || '');
                setSelectedModelName(savedState.selectedModelName || 'Nano Banana');
                setHasSavedInstance(savedState.hasSavedInstance || false);
            } else {
                resetProjectState();
            }
        } catch (e) {
            console.error("Failed to load project, resetting state:", e);
            // Add a safeguard to prevent a crash loop
            if (generatedModelHistory.length > 0) {
              resetProjectState();
            }
        }
    };
    
    loadProject();
  }, [currentProjectId, resetProjectState, isLoaded]);
  
  const reset = useCallback(() => { 
    resetProjectState();
    onOpenProjectModal('create');
  }, [resetProjectState, onOpenProjectModal]);

  useEffect(() => {
    setZoom(1); setPan({ x: 0, y: 0 });
  }, [generatedModelUrl]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) setIsDownloadMenuOpen(false);
      if (upscaleMenuRef.current && !upscaleMenuRef.current.contains(event.target as Node)) setIsUpscaleMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => { setToastMessage(null); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const addHistoryItem = useCallback(async (newItem: Omit<HistoryItem, 'id' | 'parentId' | 'isStarred' | 'imageUrl'>, imageUrl: string) => {
    const newId = `rev-${Date.now()}`;

    // Upload to Firebase Storage if user is logged in and imageUrl is base64
    let finalImageUrl = imageUrl;
    if (currentUser && isBase64Url(imageUrl)) {
        try {
            finalImageUrl = await uploadBase64Image(
                imageUrl,
                currentUser.uid,
                'models',
                `model_${newId}.jpg`,
                currentProjectId || undefined
            );
            console.log('Image uploaded to Firebase Storage:', finalImageUrl);
        } catch (error) {
            console.error('Failed to upload to Firebase Storage, using base64:', error);
            // Fallback to base64 if upload fails
        }
    }

    const fullHistoryItem: HistoryItem = {
        ...newItem,
        id: newId,
        parentId: currentHistoryItemId,
        imageUrl: finalImageUrl,
        isStarred: false,
    };
    setGeneratedModelHistory(prev => [...prev, fullHistoryItem]);
    setCurrentHistoryItemId(newId);
    setRedoStack([]); // New generation creates a new branch, clearing any "redo" path.
  }, [currentHistoryItemId, currentUser, currentProjectId]);

  const restoreHistoryItem = useCallback((id: string, source: 'ui' | 'undo' | 'redo') => {
    const item = generatedModelHistory.find(h => h.id === id);
    if (!item) return;

    if (source === 'undo' && currentHistoryItem) {
        setRedoStack(prev => [currentHistoryItem.id, ...prev]);
    } else if (source === 'redo') {
        setRedoStack(prev => prev.slice(1));
    } else if (source === 'ui') {
        setRedoStack([]);
    }

    setCurrentHistoryItemId(id);
    setRevisionPrompt('');
    setGenerationSettings(item.settings);
    setSelectedModelName(item.modelName);
    setIsMaskingMode(false);
    setMaskDataUrl(null);
  }, [generatedModelHistory, currentHistoryItem]);

  const handleGenerate = async (file?: File) => {
    if (!file && !modelDescription.trim()) {
      setToastMessage('Please enter a description or upload a photo.');
      return;
    }

    setIsGenerating(true);
    setLoadingMessage(file ? 'Generating model from photo...' : 'Generating model from description...');
    if (isResultView) {
        setGeneratedModelHistory([]);
        setCurrentHistoryItemId(null);
    }
    
    try {
        const prompt = file ? "Model generated from uploaded photo" : modelDescription;
        const modelInfo = generationModels.find(m => m.name === selectedModelName);
        if (!modelInfo || !modelInfo.id) throw new Error("Invalid model selected.");

        const result = file
            ? await generateModelImage(file, generationSettings)
            : await generateModelFromDescription(modelDescription, generationSettings, modelInfo.id);
        await addHistoryItem({ prompt, settings: generationSettings, modelName: selectedModelName }, result);
    } catch (err) {
        setToastMessage(getFriendlyErrorMessage(err, 'Failed to create model'));
    } finally {
        setIsGenerating(false);
        setLoadingMessage('');
    }
  };

  const handleApplyChanges = async () => {
    if (!generatedModelUrl || isGenerating) return;
    
    const isPromptRevision = revisionPrompt.trim().length > 0;
    const isSettingsRevision = hasSettingsChanged;

    if (!isPromptRevision && !isSettingsRevision) {
        setToastMessage("Please enter a revision or change a setting to apply changes.");
        return;
    }

    setIsGenerating(true);
    setLoadingMessage('Applying changes...');
    setHasSavedInstance(false);
    try {
        const currentSettings = generationSettings;
        const isMasked = isMaskingMode && maskDataUrl;
        
        let promptForHistory: string;
        let revisionInstruction: string;

        if (isPromptRevision) {
            promptForHistory = revisionPrompt;
            revisionInstruction = revisionPrompt;
        } else {
            promptForHistory = "Applied new creative settings";
            revisionInstruction = "Re-render the image with updated artistic and technical settings. Do not change the subject's core identity or the base outfit.";
        }
        
        const result = isMasked
            ? await reviseMaskedImage(generatedModelUrl, maskDataUrl!, revisionInstruction, currentSettings)
            : await reviseGeneratedImage(generatedModelUrl, revisionInstruction, currentSettings);

        await addHistoryItem({ prompt: promptForHistory, settings: currentSettings, modelName: selectedModelName }, result);
        setRevisionPrompt('');
        if (isMaskingMode) {
            setIsMaskingMode(false);
            setMaskDataUrl(null);
        }
    } catch (err) {
        setToastMessage(getFriendlyErrorMessage(err, 'Failed to apply changes'));
    } finally {
        setIsGenerating(false);
        setLoadingMessage('');
    }
  };


  const handleSelectiveEnhance = async (target: 'face' | 'fabric' | 'accessories') => {
    if (!generatedModelUrl) return;
    setIsGenerating(true);
    setLoadingMessage(`Enhancing ${target}...`);
    setIsUpscaleMenuOpen(false);
    try {
        const result = await selectivelyEnhanceImage(generatedModelUrl, target);
        await addHistoryItem({ prompt: `Enhanced ${target}`, settings: generationSettings, modelName: selectedModelName }, result);
        setToastMessage(`${target.charAt(0).toUpperCase() + target.slice(1)} enhanced!`);
    } catch (err) {
        setToastMessage(getFriendlyErrorMessage(err, 'Enhancement failed'));
    } finally {
        setIsGenerating(false);
        setLoadingMessage('');
    }
  };
  
  const handleUpscale = async (resolution: UpscaleResolution) => {
    if (!generatedModelUrl) return;
    setIsGenerating(true);
    setLoadingMessage(`Upscaling to ${resolution}...`);
    setIsUpscaleMenuOpen(false);
    try {
        const result = await upscaleImage(generatedModelUrl, resolution);
        await addHistoryItem({ prompt: `Upscaled to ${resolution}`, settings: generationSettings, modelName: selectedModelName }, result);
        setToastMessage(`Image upscaled to ${resolution}!`);
    } catch (err) {
        setToastMessage(getFriendlyErrorMessage(err, 'Upscale failed'));
    } finally {
        setIsGenerating(false);
        setLoadingMessage('');
    }
  };

  const handleEnhancePrompt = async () => {
    const textToEnhance = isResultView ? revisionPrompt : modelDescription;
    if (!isResultView && !textToEnhance.trim()) {
        setToastMessage("Please enter a description to enhance.");
        return;
    }
    setIsEnhancing(true);
    try {
        const modelInfo = generationModels.find(m => m.name === selectedModelName);
        if (!modelInfo || !modelInfo.id) throw new Error("Invalid model selected for prompt enhancement.");

        const enhancedText = isResultView
            ? await enhanceRevisionPrompt(generatedModelUrl!, revisionPrompt, modelDescription)
            : await enhanceDescriptionPrompt(modelDescription, modelInfo.id as 'gemini-2.5-flash-image' | 'imagen-4.0-generate-001');
        
        if(isResultView) setRevisionPrompt(enhancedText);
        else setModelDescription(enhancedText);
        
        setToastMessage(textToEnhance.trim() ? "Prompt enhanced!" : "Suggestion provided!");
    } catch (err) {
        setToastMessage(getFriendlyErrorMessage(err, "Failed to enhance prompt"));
    } finally {
        setIsEnhancing(false);
    }
  };

  const handleSaveInstance = () => {
    if (generatedModelUrl) {
      onSaveModelInstance(generatedModelUrl);
      setToastMessage('Model instance saved to gallery!');
      setHasSavedInstance(true);
    }
  };

  const handleDownload = (format: 'png' | 'jpeg' | 'webp') => {
    if (!generatedModelUrl) return;
    const link = document.createElement('a');
    link.href = generatedModelUrl;
    link.download = `formlab-model-${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsDownloadMenuOpen(false);
  };

  const handleModelSelect = useCallback((newModelName: string) => {
    if (generatedModelUrl && !hasSavedInstance) {
      setPendingModelSwitch(newModelName);
      setIsSwitchModelModalOpen(true);
      return;
    }
    setSelectedModelName(newModelName);
    reset();
  }, [generatedModelUrl, hasSavedInstance, reset]);

  const handleConfirmSwitch = useCallback(() => {
    if (pendingModelSwitch) {
      setSelectedModelName(pendingModelSwitch);
      reset();
    }
    setIsSwitchModelModalOpen(false);
    setPendingModelSwitch(null);
  }, [pendingModelSwitch, reset]);

  const handleLeftDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = startWidth + (moveEvent.clientX - startX);
        setLeftPanelWidth(Math.max(280, Math.min(newWidth, 600)));
    };
    const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [leftPanelWidth]);
  
  const handleSaveBrandStyle = (name: string) => {
    const newStyle: BrandStyle = { id: `style-create-${Date.now()}`, name, settings: generationSettings };
    setBrandStyles(prev => {
        const updated = [...prev, newStyle];
        localStorage.setItem('formlab-brand-styles-createmodel', JSON.stringify(updated));
        return updated;
    });
    setToastMessage(`Brand style '${name}' saved.`);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!generatedModelUrl || isMaskingMode) return;
    e.preventDefault();
    const newZoom = zoom - e.deltaY * 0.005;
    const clampedZoom = Math.max(1, Math.min(newZoom, 5));
    setZoom(clampedZoom);

    if (clampedZoom <= 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageWrapperRef.current || isMaskingMode) return;
    e.preventDefault();
    setIsPanning(true);
    startPanPoint.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !imageWrapperRef.current || isMaskingMode) return;
    e.preventDefault();
    setPan({ x: e.clientX - startPanPoint.current.x, y: e.clientY - startPanPoint.current.y });
  };
  
  const handleMouseUpOrLeave = () => { setIsPanning(false); };
  
  const getCursor = () => {
    if (isMaskingMode) return 'crosshair';
    if (!generatedModelUrl) return 'default';
    return isPanning ? 'grabbing' : 'grab';
  };
  
  // --- Masking Logic ---
  const getBrushPos = (e: MouseEvent | TouchEvent) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { 
        x: (clientX - rect.left), 
        y: (clientY - rect.top)
    };
  }

  const drawOnMask = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingMask.current) return;
      e.preventDefault();
      const canvas = maskCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getBrushPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
  };

  const startDrawingMask = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawingMask.current = true;
      const canvas = maskCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getBrushPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
  };

  const stopDrawingMask = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!isDrawingMask.current) return;
      isDrawingMask.current = false;
      const canvas = maskCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      ctx.closePath();
      setMaskDataUrl(canvas.toDataURL());
  };

  useEffect(() => {
    const canvas = maskCanvasRef.current;
    if (isMaskingMode && canvas && imageRef.current) {
        const image = imageRef.current;
        const { naturalWidth, naturalHeight } = image;
        canvas.width = naturalWidth;
        canvas.height = naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = brushSize * (naturalWidth / image.offsetWidth); 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        canvas.addEventListener('mousedown', startDrawingMask);
        canvas.addEventListener('mousemove', drawOnMask);
        canvas.addEventListener('mouseup', stopDrawingMask);
        canvas.addEventListener('mouseleave', stopDrawingMask);

        return () => {
            canvas.removeEventListener('mousedown', startDrawingMask);
            canvas.removeEventListener('mousemove', drawOnMask);
            canvas.removeEventListener('mouseup', stopDrawingMask);
            canvas.removeEventListener('mouseleave', stopDrawingMask);
        };
    } else {
      setMaskDataUrl(null);
    }
  }, [isMaskingMode, generatedModelUrl, brushSize]);
  
  // --- New Lighting Logic ---
  const handleAddLight = (role: LightRole) => {
    const newLight: Light = {
        id: `${role}-${Date.now()}`,
        type: 'area',
        role,
        position: { angle: 0, distance: 0.7, elevation: 0 },
        power: 0, size: 0.5, kelvin: 5600, tint: 0, saturation: 1
    };
     setGenerationSettings(prev => ({
        ...prev,
        lightingRig: {
            ...prev.lightingRig,
            lights: [...prev.lightingRig.lights, newLight]
        },
    }));
    setSelectedLightId(newLight.id);
  };
  
  const updateLight = (id: string, updates: Partial<Light> | { position: Partial<Light['position']> }) => {
    setGenerationSettings(prev => ({
      ...prev,
      lightingRig: {
        ...prev.lightingRig,
        lights: prev.lightingRig.lights.map(l => {
          if (l.id === id) {
            if ('position' in updates) {
              return { ...l, position: { ...l.position, ...updates.position } };
            }
            return { ...l, ...updates };
          }
          return l;
        })
      }
    }));
  };

  const removeLight = (id: string) => {
      setGenerationSettings(prev => ({
          ...prev,
          lightingRig: {
              ...prev.lightingRig,
              lights: prev.lightingRig.lights.filter(l => l.id !== id)
          }
      }));
      if (selectedLightId === id) setSelectedLightId(null);
  };

  const handlePanelToggle = (panel: keyof PanelToggles) => {
    setGenerationSettings(gs => ({
        ...gs,
        panelToggles: {
            ...gs.panelToggles,
            [panel]: !gs.panelToggles[panel],
        }
    }));
  };
  
  const handleUndo = () => {
    if (canUndo && currentHistoryItem) {
        restoreHistoryItem(currentHistoryItem.parentId!, 'undo');
    }
  };

  const handleRedo = () => {
      if (canRedo) {
          restoreHistoryItem(redoStack[0], 'redo');
      }
  };

  const handleToggleStar = (id: string) => {
      setGeneratedModelHistory(prev => prev.map(item => item.id === id ? { ...item, isStarred: !item.isStarred } : item));
  };
  
  const handleRename = (id: string, name: string) => {
      setGeneratedModelHistory(prev => prev.map(item => item.id === id ? { ...item, name } : item));
  };
  
  const handleDeleteVersion = (id: string) => {
    setGeneratedModelHistory(prev => {
        const itemToDelete = prev.find(i => i.id === id);
        if (!itemToDelete) return prev;
        const parentId = itemToDelete.parentId;

        if (id === currentHistoryItemId) {
            setCurrentHistoryItemId(parentId);
        }

        return prev
            .filter(i => i.id !== id)
            .map(i => {
                if (i.parentId === id) {
                    return { ...i, parentId: parentId };
                }
                return i;
            });
    });
  };

  const renderLeftPanelContent = () => {
    const activePreset = STYLE_PRESETS.find(p => JSON.stringify(p.settings) === JSON.stringify(Object.keys(p.settings).reduce((acc, key) => ({ ...acc, [key]: generationSettings[key as keyof GenerationSettings] }), {})));
    const isUploadDisabled = selectedModelName === 'Imagen 4';
    
    return (
      <div className="flex-grow p-6 space-y-4 overflow-y-auto">
        <CollapsibleSection title={isResultView ? "Revision" : "Prompt"} icon={<PenLineIcon className="w-4 h-4 text-gray-400" />} isOpen={openSections.prompt} onToggle={() => setOpenSections(p => ({ ...p, prompt: !p.prompt }))}>
          <PromptPanel
            prompt={isResultView ? revisionPrompt : modelDescription}
            onPromptChange={isResultView ? setRevisionPrompt : setModelDescription}
            placeholder={isResultView ? "e.g. Add tattoos to left arm..." : "A female model in her 20s, East Asian..."}
            rows={4}
            isGenerating={isGenerating}
            showEnhanceButton={true}
            onEnhance={handleEnhancePrompt}
            isEnhancing={isEnhancing}
            enhanceButtonText={isResultView ? (revisionPrompt.trim() ? 'Enhance Revision Description' : 'Suggest Revision Description') : 'Enhance Prompt Description'}
            showUploadButton={!isResultView}
            onFileUpload={(file) => handleGenerate(file)}
            uploadDisabled={isUploadDisabled}
            uploadDisabledTooltip={isUploadDisabled ? 'Image upload is only supported by Nano Banana.' : 'Upload a reference photo'}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Style Presets" icon={<BookmarkIcon className="w-4 h-4 text-gray-400" />} isOpen={openSections.presets} onToggle={() => setOpenSections(p => ({...p, presets: !p.presets}))}>
          <div className="grid grid-cols-2 gap-2">
              {STYLE_PRESETS.map(p => <OptionButton key={p.label} onClick={() => setGenerationSettings(gs => ({...gs, ...p.settings}))} isActive={activePreset?.label === p.label} disabled={isGenerating}>{p.label}</OptionButton>)}
          </div>
          <div className="mt-4">
            <label className="text-xs text-gray-400 mb-2 block">Brand Kit</label>
            <div className="flex gap-2">
              <select onChange={(e) => { const s = brandStyles.find(bs => bs.id === e.target.value); if (s) setGenerationSettings(s.settings); }} disabled={isGenerating || brandStyles.length === 0} className="w-full text-sm p-2 bg-black/30 border border-gray-700 text-gray-200 rounded-md"><option>Load style...</option>{brandStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <button onClick={() => { const name = prompt("Style Name:"); if (name) handleSaveBrandStyle(name); }} disabled={isGenerating} className="px-3 text-sm rounded-md border border-gray-700 text-gray-300">Save</button>
            </div>
          </div>
        </CollapsibleSection>
        
        <div className="pt-4 border-t border-gray-800">
            <h2 className="text-base font-sans font-semibold text-gray-200 mb-4">
                Global Controls
            </h2>
            <div className="space-y-4">
                <GlobalControls
                    generationSettings={generationSettings}
                    onSettingsChange={setGenerationSettings}
                    isGenerating={isGenerating}
                    openSections={openSections}
                    onToggleSection={(section) => setOpenSections(p => ({ ...p, [section]: !p[section] }))}
                    selectedLightId={selectedLightId}
                    onSelectLightId={setSelectedLightId}
                    onAddLight={handleAddLight}
                    onUpdateLight={updateLight}
                    onRemoveLight={removeLight}
                    onPanelToggle={handlePanelToggle}
                />
            </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="w-full h-full flex flex-col relative bg-[#111111]">
      <div className="h-16 border-b border-gray-800 bg-[#1a1a1a] flex items-center justify-between px-6 flex-shrink-0 z-20">
          <h1 className="text-lg font-sans font-semibold text-gray-200">Create Model</h1>
          <div className="flex items-center gap-4">
              {isResultView && <button onClick={() => { if(window.confirm("Start a new project? This will clear your current model creation.")) { reset(); } }} className="text-sm text-gray-400 hover:text-white">Start Over</button>}
              <button onClick={() => onModelFinalized(generatedModelUrl!, currentProjectId!)} disabled={!generatedModelUrl} className="px-5 py-2 bg-gray-100 hover:bg-white text-gray-900 text-sm font-bold rounded-lg shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  Proceed to Styling <ChevronRightIcon className="w-4 h-4" />
              </button>
          </div>
      </div>

      <div className="flex-grow flex min-h-0">
          <div style={{ width: `${leftPanelWidth}px` }} className="bg-[#1a1a1a] border-r border-gray-800 flex flex-col flex-shrink-0 h-full">
              <ProjectSelectorPanel 
                  projects={projectList}
                  currentProjectId={currentProjectId}
                  onProjectChange={onProjectChange}
                  onEditProject={() => onOpenProjectModal('edit')}
                  onCreateProject={() => onOpenProjectModal('create')}
              />
              {renderLeftPanelContent()}
              <div className="p-6 border-t border-gray-800 mt-auto">
                 <div className="mb-4">
                    <label className="text-xs font-medium text-gray-400 mb-2 block flex items-center gap-2">
                        <CubeIcon className="w-4 h-4 text-gray-500" />
                        Generation Model
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {generationModels.map(model => (
                            <button
                                key={model.name}
                                onClick={() => !model.disabled && handleModelSelect(model.name)}
                                title={model.title}
                                disabled={isGenerating || model.disabled}
                                className={`w-full text-center text-xs font-semibold py-1.5 px-2 rounded-md transition-all duration-200 border
                                    ${selectedModelName === model.name ? 'bg-gray-100 text-gray-900 border-gray-100' : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}
                                    ${model.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                                    disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {model.name}
                            </button>
                        ))}
                    </div>
                </div>
                 <button 
                    onClick={isResultView ? handleApplyChanges : () => handleGenerate()} 
                    disabled={isGenerating || (isResultView && !revisionPrompt.trim() && !hasSettingsChanged) || (!isResultView && !modelDescription.trim()) } 
                    className="w-full py-3 bg-gray-100 hover:bg-white text-gray-900 text-sm font-bold rounded-lg disabled:opacity-50"
                  >
                    {isGenerating ? loadingMessage : 
                        isResultView ? 
                            (revisionPrompt.trim() ? (isMaskingMode ? "Apply Masked Revision" : "Apply Revision") : (hasSettingsChanged ? "Apply Settings" : "Apply Revision"))
                            : 'Generate Model'
                    }
                 </button>
              </div>
          </div>
          
          <ResizeHandle onMouseDown={handleLeftDrag} />

          <div className="flex-grow relative bg-[#0f0f0f] flex flex-col min-h-0">
              <div className="flex-shrink-0 flex items-center justify-between gap-2 p-2 bg-[#2a2a2a] border-b border-gray-700">
                  <div className="flex items-center gap-1">
                      <div className="flex items-center bg-black/30 border border-gray-700 rounded-lg p-1">
                          <button onClick={handleUndo} disabled={!canUndo || isGenerating} className="p-2 rounded-md hover:bg-white/10 disabled:opacity-30" title="Undo"><UndoIcon className="w-4 h-4 text-gray-300" /></button>
                          <button onClick={handleRedo} disabled={!canRedo || isGenerating} className="p-2 rounded-md hover:bg-white/10 disabled:opacity-30" title="Redo"><RedoIcon className="w-4 h-4 text-gray-300" /></button>
                      </div>
                      <div className="w-px h-6 bg-gray-700 mx-2"></div>
                      <button onClick={() => setIsCompareMode(!isCompareMode)} disabled={!canUndo || !isResultView} className={`p-2 rounded-md border transition-colors flex items-center gap-2 text-sm ${isCompareMode ? 'bg-blue-600/20 border-blue-500/50 text-blue-200' : 'bg-transparent border-transparent hover:bg-white/10 text-gray-300'} disabled:opacity-30`} title="Compare"><LayoutIcon className="w-4 h-4" /></button>
                      <button onClick={() => setIsMaskingMode(p => !p)} disabled={!isResultView} className={`p-2 rounded-md border transition-colors flex items-center gap-2 text-sm ${isMaskingMode ? 'bg-purple-600/20 border-purple-500/50 text-purple-200' : 'bg-transparent border-transparent hover:bg-white/10 text-gray-300'} disabled:opacity-30`} title="Masking Brush"><PenLineIcon className="w-4 h-4" /></button>
                      {isMaskingMode && (
                         <div className="flex items-center gap-2 text-xs text-gray-400 ml-2">
                             <span>Brush Size:</span>
                             <input type="range" min="10" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-24"/>
                         </div>
                      )}
                      <div ref={upscaleMenuRef} className="relative">
                          <button onClick={() => setIsUpscaleMenuOpen(p => !p)} disabled={!isResultView} className="p-2 rounded-md hover:bg-white/10 flex items-center gap-2 text-sm text-gray-300 disabled:opacity-30" title="Enhance & Upscale"><ZapIcon className="w-4 h-4 text-yellow-400" /></button>
                          {isUpscaleMenuOpen && <div className="absolute top-full left-0 mt-2 w-48 bg-[#1f1f1f] border border-gray-700 rounded-lg shadow-xl z-20"><button onClick={() => handleUpscale('2k')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10">Upscale to 2K</button><button onClick={() => handleUpscale('4k')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10">Upscale to 4K</button><div className="h-px bg-gray-700 my-1"></div><button onClick={() => handleSelectiveEnhance('face')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10">Enhance Face</button><button onClick={() => handleSelectiveEnhance('fabric')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10">Enhance Fabric</button><button onClick={() => handleSelectiveEnhance('accessories')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10">Enhance Accessories</button></div>}
                      </div>
                       <button title="Identity Lock (Coming Soon)" disabled className="p-2 rounded-md flex items-center gap-2 text-sm text-gray-300 disabled:opacity-30 cursor-not-allowed"><LayersIcon className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                      {isResultView && <div className="flex items-center gap-1 bg-black/30 border border-gray-700 rounded-lg px-2 py-1">{Math.round(zoom * 100)}%</div>}
                      <button onClick={handleSaveInstance} disabled={isGenerating || !isResultView} className="p-2 rounded-md bg-black/30 border border-gray-700 hover:bg-white/10 text-gray-300 disabled:opacity-30" title="Save to Gallery"><BookmarkIcon className="w-4 h-4" /></button>
                      <div ref={downloadMenuRef} className="relative">
                          <button onClick={() => setIsDownloadMenuOpen(p => !p)} disabled={!isResultView} className="p-2 rounded-md bg-black/30 border border-gray-700 hover:bg-white/10 text-gray-300 disabled:opacity-30" title="Download"><DownloadIcon className="w-4 h-4" /></button>
                          {isDownloadMenuOpen && <div className="absolute top-full right-0 mt-2 w-40 bg-[#1f1f1f] border border-gray-700 rounded-lg shadow-xl z-20"><button onClick={() => handleDownload('png')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10">PNG</button><button onClick={() => handleDownload('jpeg')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10">JPEG</button><button onClick={() => handleDownload('webp')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10">WEBP</button></div>}
                      </div>
                  </div>
              </div>
              <div className="flex-grow flex flex-col min-h-0">
                <div className="flex-grow w-full relative overflow-hidden flex justify-center items-center p-4 min-h-0" ref={imageContainerRef} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUpOrLeave} onMouseLeave={handleMouseUpOrLeave} style={{ cursor: getCursor() }}>
                    {isGenerating && <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center"><Spinner /><p className="mt-4 text-gray-300 font-medium">{loadingMessage}</p></div>}
                      {!isResultView ? (
                          <div className="flex flex-col items-center justify-center text-center p-8">
                            <CubeIcon className="w-16 h-16 text-gray-800 mb-4" />
                            <h2 className="text-3xl font-sans font-bold text-gray-400">Model Creation Studio</h2>
                            <p className="text-gray-600 mt-2">Use the panel on the left to generate your first model.</p>
                          </div>
                      ) : isCompareMode && canUndo ? (
                          <div className="w-full h-full relative flex items-center justify-center"><Compare firstImage={generatedModelUrl!} secondImage={compareModelUrl!} slideMode="drag" className="w-auto h-full rounded-lg" /></div> 
                      ) : (
                        <div ref={imageWrapperRef} className="relative flex items-center justify-center" style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transition: isPanning ? 'none' : 'transform 0.1s ease-out' }}>
                           <img ref={imageRef} src={generatedModelUrl!} alt="Generated Model" className="max-h-full max-w-full object-contain shadow-2xl rounded-sm block" draggable={false} />
                           {isMaskingMode && <canvas ref={maskCanvasRef} className="absolute top-0 left-0 w-full h-full z-10 pointer-events-auto" style={{ cursor: getCursor() }} />}
                        </div>
                      )}
                </div>
                {isResultView && (
                  <VersionHistoryPanel 
                    history={generatedModelHistory}
                    currentHistoryItemId={currentHistoryItemId}
                    onSelectVersion={(id) => restoreHistoryItem(id, 'ui')}
                    onDeleteVersion={handleDeleteVersion}
                    onToggleStar={handleToggleStar}
                    onRenameVersion={handleRename}
                  />
                )}
              </div>
          </div>
      </div>

      <AnimatePresence>
        {toastMessage && <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-10 right-10 bg-blue-600 text-white px-6 py-3 rounded-full shadow-xl z-[100] font-medium">{toastMessage}</motion.div>}
      </AnimatePresence>
      
      <ConfirmationModal
        isOpen={isSwitchModelModalOpen}
        onClose={() => setIsSwitchModelModalOpen(false)}
        onConfirm={handleConfirmSwitch}
        title="Switch Model?"
        message="This will discard your current creation. Are you sure you want to start over with a new model?"
        confirmText="Confirm Switch"
        confirmButtonClass="bg-gray-700 hover:bg-gray-600"
      />
    </div>
  );
};

export default CreateModel;