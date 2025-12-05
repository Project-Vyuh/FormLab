/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloudIcon, CubeIcon, BookmarkIcon, CameraIcon, WandIcon, ChevronRightIcon, SunIcon, SlidersHorizontalIcon, ChevronDownIcon, Trash2Icon, PlusIcon, PersonStandingIcon, StarIcon, GitBranchIcon, ChevronUpIcon, Share2Icon, UserIcon, SparklesIcon, SettingsIcon, LayersIcon, DownloadIcon } from './icons';

import { generateModelImage, generateModelFromDescription, reviseGeneratedImage, enhanceDescriptionPrompt, enhanceRevisionPrompt, upscaleImage, selectivelyEnhanceImage, reviseMaskedImage } from '../services/geminiService';
import Spinner from './Spinner';
import { getFriendlyErrorMessage, cn } from "../lib/utils";
import { convertToSquare } from '../lib/imageProcessing';
import { Loader2Icon, UndoIcon, RedoIcon, PenLineIcon, ZapIcon, RotateCcwIcon } from "lucide-react";
import { GenerationSettings, UpscaleResolution, PhotoStyle, ShotFraming, AspectRatio, LightingRig, Light, LightRole, HdriMap, LightType, SceneAtmosphere, ImageProcessingSettings, LensProfile, ApertureSettings, BokehShape, ShutterSettings, SensorSize, CameraPositionSettings, FocusPlaneSettings, CameraProfile, NoiseAndGrainSettings, StudioEnvironment, ShadowSculptingSettings, StudioEnvironmentType, GradientType, TextureType, FloorMaterial, AmbientBounceSettings, AmbientOcclusionSettings, FloorSettings, StudioVignetting, Project, PanelToggles, HistoryItem, HistoryItemType, User, SelectedStylingModel, Model } from '../types';
import { createUpscaleRequest, listenToUpscaleRequest, UpscaleRequest } from '../services/firestoreService';
import ConfirmationModal from './ConfirmationModal';
import ResizeHandle from './ResizeHandle';
import { useDebouncedEffect } from '../hooks/useDebouncedEffect';
import {
  saveProjectState,
  loadProjectState
} from '../services/dbService';
import { uploadBase64Image, isBase64Url, deleteFile, isStorageUrl } from '../services/storageService';
import { deleteStylingHistory } from '../services/dbService';
import { deleteHistoryItemFromFirestore } from '../services/firestoreSync';
import { auth } from '../services/firebase';
import GlobalControls from './GlobalControls';
import CollapsibleSection from './shared/CollapsibleSection';
import OptionButton from './shared/OptionButton';
import VersionHistoryPanel from './VersionHistoryPanel';
import ProjectSelectorPanel from './ProjectSelectorPanel';
import SwitchProjectModal from './SwitchProjectModal';
import PromptPanel from './PromptPanel';
import ContextMenu from './ContextMenu';
import UserModelsModal from './UserModelsModal';
import { loadPredefinedModels, saveGlobalModel, checkModelExists, subscribeToGlobalModels } from '../services/firestoreService';


interface CreateModelProps {
  onModelFinalized: (stylingModelData: SelectedStylingModel) => void;
  onSaveModelInstance: (modelUrl: string) => void;
  projectList: Project[];
  currentProjectId: string | null;
  onOpenProjectModal: (mode: 'create' | 'edit') => void;
  currentUser: User | null;
  modelGallery: Model[];
  onSelectModel: (model: Model) => void;
  onModelAdded?: (model: Model) => void; // Callback when a new base model is created
  onModelDeleted: (model: Model) => void; // Callback when a model is deleted
  onModelUpdated?: (modelId: string) => void; // Callback when a model is updated (e.g., revision made)
  onRenameModel?: (modelId: string, newName: string) => void; // Callback when a model is renamed
  selectedHistoryItemId: string | null; // History item ID to load from gallery selection
  onHistoryItemLoaded?: () => void; // Callback when history item has been loaded
  onOpenCollectionsModal: () => void; // Callback to open collections modal
  lastExternalUpdate?: number; // Trigger to reload project state
  onDeleteProject: (projectId: string) => void;
}

type GenerationModel = 'gemini-2.5-flash-image';

const generationModels: { name: string, id: GenerationModel | null, disabled?: boolean, title?: string }[] = [
  { name: 'Nano Banana', id: 'gemini-2.5-flash-image', title: 'Fastest generation, good for quick iterations.' },
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
  contrast: 'punchy',
  colorGrade: 'commercial',
  highlightRollOff: 'soft',
  shadowCrush: 'low',
  lift: { r: 0, g: 0, b: 0 },
  gamma: { r: 0, g: 0, b: 0 },
  gain: { r: 0, g: 0, b: 0 },
  splitToning: { highlights: { color: '#ffffff', balance: 0.5 }, shadows: { color: '#ffffff' } },
};

const initialSceneAtmosphere: SceneAtmosphere = {
  backgroundExposure: 0,
  backgroundBlur: 'medium',
  vignetting: { strength: 0.3, shape: 'round', bias: 'center' },
  lightWrap: 'subtle',
  separationContrast: 'neutral',
};

const initialLightingRig: LightingRig = {
  lights: [
    { id: 'key-1', type: 'area', role: 'key', position: { angle: 315, distance: 0.8, elevation: 45 }, power: 1.2, size: 0.9, kelvin: 5400, tint: 0, saturation: 1 },
    { id: 'fill-1', type: 'area', role: 'fill', position: { angle: 45, distance: 1.0, elevation: 0 }, power: -1.5, size: 1.2, kelvin: 5600, tint: 0, saturation: 1 },
    { id: 'rim-1', type: 'spot', role: 'rim', position: { angle: 180, distance: 1.2, elevation: 60 }, power: 0.8, size: 0.3, kelvin: 6000, tint: 0, saturation: 1 },
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

const initialStudioEnvironment: StudioEnvironment = { type: 'gradient', gradientType: 'radial', color1: '#e0e0e0', color2: '#ffffff', cycloramaCurve: 0.5 };
const initialFloorSettings: FloorSettings = { material: 'matte', glossiness: 0.1, reflectionLength: 0.2 };
const initialShadowSculpting: ShadowSculptingSettings = { flags: { left: false, right: false } };
const initialAmbientBounce: AmbientBounceSettings = { color: '#FFFFFF', strength: 0, bias: 'uniform' };
const initialAmbientOcclusion: AmbientOcclusionSettings = { intensity: 0.3, radius: 0.5 };

export const initialGenerationSettings: GenerationSettings = {
  quality: 'standard',
  studioEnvironment: initialStudioEnvironment,
  floorSettings: initialFloorSettings,
  shadowSculpting: initialShadowSculpting,
  ambientBounce: initialAmbientBounce,
  ambientOcclusion: initialAmbientOcclusion,
  photoStyle: 'modern',
  accessoryPrompt: '',
  shotFraming: 'full',
  posePrompt: '',
  negativePrompt: '',
  aspectRatio: '2:3',
  apertureSettings: { aperture: 2.8, bokehShape: 'round' },
  lensProfile: '85mm',
  shutterSettings: initialShutterSettings,
  lightingRig: initialLightingRig,
  sceneAtmosphere: initialSceneAtmosphere,
  imageProcessing: initialImageProcessing,
  sensorSize: 'medium-format',
  cameraPosition: { height: 1.5, tilt: 0 },
  focusPlaneSettings: { focusDistance: 0.5, faceAutofocus: true },
  cameraProfile: 'phase-one',
  noiseAndGrain: initialNoiseAndGrain,
  digitalDarkroom: {
    frequencySeparation: true,
    shineControl: 0.3,
    skinToneHarmonization: true,
    lensCorrection: true,
    bodyWarpCorrection: true,
    cleanup: true,
    studioSharpening: true,
    dynamicRangeTuning: true,
  },
  panelToggles: initialPanelToggles,
};

const STYLE_PRESETS: { label: string, settings: Partial<GenerationSettings> }[] = [
  { label: "Cinematic", settings: { photoStyle: "modern", sensorSize: 'full-frame', apertureSettings: { aperture: 2.8, bokehShape: 'anamorphic' }, lightingRig: { lights: [{ id: 'key-1', type: 'spot', role: 'key', position: { angle: 135, distance: 0.9, elevation: 20 }, power: 1.5, size: 0.2, kelvin: 4800, tint: 0, saturation: 1 }], hdri: { map: 'high-contrast', rotation: 90 } } } },
  { label: "Studio", settings: { photoStyle: "modern", sensorSize: 'full-frame', apertureSettings: { aperture: 8.0, bokehShape: 'round' }, studioEnvironment: { type: 'mid-gray', cycloramaCurve: 0.7 }, lightingRig: { lights: [{ id: 'key-1', type: 'area', role: 'key', position: { angle: 315, distance: 0.7, elevation: 30 }, power: 1.0, size: 0.8, kelvin: 5600, tint: 0, saturation: 1 }, { id: 'fill-1', type: 'area', role: 'fill', position: { angle: 45, distance: 0.8, elevation: 0 }, power: -1.0, size: 1.0, kelvin: 5500, tint: 0, saturation: 1 }], hdri: { map: 'neutral', rotation: 0 } } } },
  { label: "Natural", settings: { studioEnvironment: { type: 'custom', prompt: 'outdoor, golden hour' }, sensorSize: 'medium-format', lightingRig: { lights: [], hdri: { map: 'fashion-beauty', rotation: 180 } } } },
  { label: "Edgy", settings: { photoStyle: 'modern', negativePrompt: 'soft, warm tones', sensorSize: 'medium-format', lightingRig: { lights: [{ id: 'rim-1', type: 'spot', role: 'rim', position: { angle: 0, distance: 0.9, elevation: 45 }, power: 2.0, size: 0.4, kelvin: 7500, tint: 0, saturation: 1 }], hdri: { map: 'high-contrast', rotation: 270 } } } }
];

// Robust deep merge function to handle loading state from older versions
const deepMerge = (target: any, source: any): any => {
  if (!source || typeof source !== 'object') return target;
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
};

/**
 * Extract background color from generation settings for image padding
 * This ensures the padding color matches the studio environment background
 */
const getBackgroundColorFromSettings = (settings: GenerationSettings): string => {
  const env = settings.studioEnvironment;

  switch (env.type) {
    case 'high-key':
      // High-key white studio
      return '#FFFFFF';
    case 'mid-gray':
      // Mid-gray studio
      return '#808080';
    case 'colored-seamless':
      // Use the specified color
      return env.color || '#FFFFFF';
    case 'gradient':
      // Use the primary gradient color for padding
      return env.color1 || '#FFFFFF';
    case 'textured':
      // For textured backgrounds, use a neutral gray
      return '#C0C0C0';
    case 'custom':
      // For custom backgrounds, use white as safe default
      return '#FFFFFF';
    case 'transparent':
      // Keep transparent for transparent backgrounds
      return 'transparent';
    default:
      // Safe default: white
      return '#FFFFFF';
  }
};

const CreateModel: React.FC<CreateModelProps> = ({
  onModelFinalized,
  onSaveModelInstance,
  projectList,
  currentProjectId,
  onProjectChange,
  onOpenProjectModal,
  currentUser,
  modelGallery,
  onSelectModel,
  onModelAdded,
  onModelDeleted,
  onModelUpdated,
  onRenameModel,
  selectedHistoryItemId,
  onHistoryItemLoaded,
  onOpenCollectionsModal,
  lastExternalUpdate,
  onDeleteProject
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
  const [pendingHistoryItemId, setPendingHistoryItemId] = useState<string | null>(null); // For gallery selection
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(initialGenerationSettings);
  const [openSections, setOpenSections] = useState({ project: true, prompt: true, presets: true, composition: false, camera: false, lighting: false, environment: false, finishing: false, advanced: false });


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

  const [isUpscaleMenuOpen, setIsUpscaleMenuOpen] = useState(false);
  const upscaleMenuRef = useRef<HTMLDivElement>(null);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);


  const [isSwitchModelModalOpen, setIsSwitchModelModalOpen] = useState(false);
  const [isSwitchProjectModalOpen, setIsSwitchProjectModalOpen] = useState(false);
  const [pendingModelSwitch, setPendingModelSwitch] = useState<string | null>(null);
  const [hasSavedInstance, setHasSavedInstance] = useState(false);

  // Layout State
  const [leftPanelWidth, setLeftPanelWidth] = useState(384);

  // Masking State
  const [isMaskingMode, setIsMaskingMode] = useState(false);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);

  // Model Templates State
  const [predefinedModels, setPredefinedModels] = useState<Model[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isTemplatesSectionOpen, setIsTemplatesSectionOpen] = useState(false);
  const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState<Model | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isUserModelsModalOpen, setIsUserModelsModalOpen] = useState(false);

  // Context Menu & Delete State
  const [contextMenuModel, setContextMenuModel] = useState<Model | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; model: Model | null }>({
    isOpen: false,
    model: null,
  });

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

  // Helper to find the root ancestor (base model) of a history item
  const findRootAncestor = useCallback((itemId: string | null): string | null => {
    if (!itemId) return null;
    let current = generatedModelHistory.find(item => item.id === itemId);
    if (!current) return null;

    // Traverse up the tree until we find a node with no parent (base model)
    while (current && current.parentId) {
      const parent = generatedModelHistory.find(item => item.id === current!.parentId);
      if (!parent) break;
      current = parent;
    }

    return current.id;
  }, [generatedModelHistory]);

  const resetProjectState = useCallback(() => {
    setGeneratedModelHistory([]);
    setCurrentHistoryItemId(null);
    setRedoStack([]);
    setIsGenerating(false);
    setModelDescription('');
    setRevisionPrompt('');
    setLoadingMessage('');
    setHasSavedInstance(false);

    setGenerationSettings(initialGenerationSettings);
  }, []);

  // --- Session Persistence & Project Management ---
  useDebouncedEffect(() => {
    if (!isLoaded || !currentProjectId) return;

    const saveState = async () => {
      // Load existing state first to preserve fields like stylingHistory
      const existingState = await loadProjectState(currentProjectId) || {};
      const projectState = {
        ...existingState,  // Preserve existing fields (stylingHistory, wardrobe, etc.)
        modelDescription,
        revisionPrompt,
        selectedModelName,
        generatedModelHistory,
        currentHistoryItemId,
        generationSettings,
        hasSavedInstance
      };
      await saveProjectState(currentProjectId, projectState);
    };

    saveState().catch(e => console.error("Failed to save project state:", e));
  }, [currentProjectId, modelDescription, revisionPrompt, selectedModelName, generatedModelHistory, currentHistoryItemId, generationSettings, hasSavedInstance], 500);



  // Watch for gallery selection from props (works for both same-project and cross-project)
  useEffect(() => {
    if (selectedHistoryItemId) {
      setPendingHistoryItemId(selectedHistoryItemId);
      // Don't call onHistoryItemLoaded here - it will be called after successfully loading
    }
  }, [selectedHistoryItemId]);

  // FAST PATH: Handle same-project model selection without reloading entire project
  useEffect(() => {
    if (!selectedHistoryItemId || !currentProjectId || !isLoaded) return;

    // Check if this history item exists in the ALREADY LOADED history
    const historyItem = generatedModelHistory.find(item => item.id === selectedHistoryItemId);

    console.log('[CreateModel] Selection Debug:', {
      selectedHistoryItemId,
      historyCount: generatedModelHistory.length,
      found: !!historyItem,
      historyIds: generatedModelHistory.map(h => h.id)
    });

    if (historyItem) {
      // FAST PATH: Project already loaded, just switch to this history item
      setCurrentHistoryItemId(selectedHistoryItemId);
      setGenerationSettings(historyItem.settings);
      setSelectedModelName(historyItem.modelName);
      setRevisionPrompt('');
      setRedoStack([]);
      setIsMaskingMode(false);
      setMaskDataUrl(null);

      // Clear the pending ID since we handled it
      setPendingHistoryItemId(null);
      // Notify parent that we've loaded the model
      onHistoryItemLoaded?.();
    }
    // If item not found, pendingHistoryItemId is already set by previous effect
    // and the project loading effect will handle it
  }, [selectedHistoryItemId, currentProjectId, isLoaded, generatedModelHistory, onHistoryItemLoaded]);

  useEffect(() => {
    if (!currentProjectId) return;

    const loadProject = async () => {
      setIsLoaded(false); // Prevent saving while loading
      try {
        const savedState = await loadProjectState(currentProjectId);
        if (savedState) {
          // Robust deep merge to prevent crashes from old save structures
          const mergedSettings = mergeDeep(initialGenerationSettings, savedState.generationSettings || {});

          setGenerationSettings(mergedSettings);
          setGeneratedModelHistory(savedState.generatedModelHistory || []);

          // Check if there's a pending history item ID from gallery selection
          if (pendingHistoryItemId) {
            // Verify the history item exists in this project
            const itemExists = savedState.generatedModelHistory?.some(item => item.id === pendingHistoryItemId);
            if (itemExists) {
              setCurrentHistoryItemId(pendingHistoryItemId);
              // Restore the history item's settings
              const historyItem = savedState.generatedModelHistory?.find(item => item.id === pendingHistoryItemId);
              if (historyItem) {
                setGenerationSettings(historyItem.settings);
                setSelectedModelName(historyItem.modelName);
              }
              // Clear the pending selection after applying it
              setPendingHistoryItemId(null);
              // Notify parent that history item has been successfully loaded
              onHistoryItemLoaded?.();
            } else {
              setCurrentHistoryItemId(savedState.currentHistoryItemId === undefined ? null : savedState.currentHistoryItemId);
              setPendingHistoryItemId(null);
              // Also notify parent if item not found (to clear selection)
              onHistoryItemLoaded?.();
            }
          } else {
            setCurrentHistoryItemId(savedState.currentHistoryItemId === undefined ? null : savedState.currentHistoryItemId);
          }

          setRedoStack([]);
          setModelDescription(savedState.modelDescription || '');
          setRevisionPrompt(savedState.revisionPrompt || '');

          // Only override selectedModelName if not loading from gallery (already set above)
          if (!pendingHistoryItemId) {
            setSelectedModelName(savedState.selectedModelName || 'Nano Banana');
          }

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
      } finally {
        setIsLoaded(true); // Enable saving after loading is complete
      }
    };

    loadProject();
  }, [currentProjectId, resetProjectState, pendingHistoryItemId, lastExternalUpdate]);

  // Load predefined models when templates section is opened
  useEffect(() => {
    const loadTemplates = async () => {
      if (isTemplatesSectionOpen && predefinedModels.length === 0 && !isLoadingTemplates) {
        setIsLoadingTemplates(true);
        try {
          const models = await loadPredefinedModels();
          setPredefinedModels(models);
        } catch (error) {
          console.error('Failed to load predefined models:', error);
          setToastMessage('Failed to load model collections');
        } finally {
          setIsLoadingTemplates(false);
        }
      }
    };
    loadTemplates();
  }, [isTemplatesSectionOpen, predefinedModels.length, isLoadingTemplates]);

  const reset = useCallback(() => {
    resetProjectState();
    onOpenProjectModal('create');
  }, [resetProjectState, onOpenProjectModal]);

  const handleStartNewModel = useCallback(() => {
    // Reset to create a new model in the current project
    setCurrentHistoryItemId(null);
    setModelDescription('');
    setRevisionPrompt('');

    setIsMaskingMode(false);
    setMaskDataUrl(null);
  }, []);

  useEffect(() => {
    setZoom(1); setPan({ x: 0, y: 0 });
  }, [generatedModelUrl]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (upscaleMenuRef.current && !upscaleMenuRef.current.contains(event.target as Node)) setIsUpscaleMenuOpen(false);
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) setIsDownloadMenuOpen(false);
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

  const addHistoryItem = useCallback(async (newItem: Omit<HistoryItem, 'id' | 'parentId' | 'isStarred' | 'imageUrl' | 'type' | 'baseModelId'>, imageUrl: string) => {
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

    // Determine type: base model (no parent) = 'model-generation', revision = 'model-revision'
    const isBaseModel = currentHistoryItemId === null;
    const historyType: HistoryItemType = isBaseModel ? 'model-generation' : 'model-revision';

    // Find the root base model ID (for revisions, trace back to root; for base models, use own ID)
    const findRootAncestor = (itemId: string | null): string => {
      if (!itemId) return newId; // This is a base model, use its own ID
      const item = generatedModelHistory.find(h => h.id === itemId);
      if (!item || !item.parentId) return itemId; // Found root
      return findRootAncestor(item.parentId); // Keep tracing
    };
    const baseModelId = findRootAncestor(currentHistoryItemId);

    const fullHistoryItem: HistoryItem = {
      ...newItem,
      id: newId,
      parentId: currentHistoryItemId,
      imageUrl: finalImageUrl,
      isStarred: false,
      type: historyType,
      baseModelId: baseModelId,
    };
    setGeneratedModelHistory(prev => [...prev, fullHistoryItem]);
    setCurrentHistoryItemId(newId);
    setRedoStack([]); // New generation creates a new branch, clearing any "redo" path.

    // If this is a base model (no parent) and we have a callback, notify App.tsx to update the gallery
    if (currentHistoryItemId === null && onModelAdded && currentProjectId) {
      const timestamp = Date.now();

      // Save to Global Library (Enterprise Sync) first to get the Firestore model ID
      let firestoreModelId: string | undefined;
      if (currentUser) {
        try {
          firestoreModelId = await saveGlobalModel(currentUser.uid, {
            url: finalImageUrl,
            name: newItem.prompt || 'Generated Model',
            projectId: currentProjectId,
            historyItemId: newId,
          });
          console.log('Model saved to Global Library with ID:', firestoreModelId);
        } catch (error) {
          console.error('Failed to save model to Global Library:', error);
        }
      }

      const newModel: Model = {
        id: firestoreModelId || `${currentProjectId}-${newId}`, // Use Firestore ID if available
        url: finalImageUrl,
        source: 'user',
        projectId: currentProjectId,
        historyItemId: newId, // Store the history item ID
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      onModelAdded(newModel);
    } else if (currentHistoryItemId !== null && onModelUpdated && currentProjectId && baseModelId) {
      // This is a revision, update the base model's timestamp
      const baseModelFullId = `${currentProjectId}-${baseModelId}`;
      onModelUpdated(baseModelFullId);
    }
  }, [currentHistoryItemId, currentUser, currentProjectId, onModelAdded, onModelUpdated]);

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

  const handleStartOver = useCallback(() => {
    // Reset to initial state
    setGeneratedModelHistory([]);
    setCurrentHistoryItemId(null);
    setRedoStack([]);
    setRevisionPrompt('');
    setModelDescription('');
    setGenerationSettings(initialGenerationSettings);
    setSelectedModelName('Nano Banana');
    setIsMaskingMode(false);
    setMaskDataUrl(null);
    setToastMessage('Started over - all changes cleared');
  }, []);

  const handleGenerate = async (file?: File) => {
    if (!file && !modelDescription.trim()) {
      setToastMessage('Please enter a description or upload a photo.');
      return;
    }

    setIsGenerating(true);
    setLoadingMessage(file ? 'Preparing reference photo...' : 'Generating model from description...');
    if (isResultView) {
      setGeneratedModelHistory([]);
      setCurrentHistoryItemId(null);
    }

    try {
      // Convert reference photo to 1:1 aspect ratio with background matching studio environment
      let processedFile = file;
      if (file) {
        try {
          setLoadingMessage('Normalizing reference photo to 1:1 aspect ratio...');
          // Extract background color from settings to ensure padding matches studio environment
          const backgroundColor = getBackgroundColorFromSettings(generationSettings);
          processedFile = await convertToSquare(file, backgroundColor);
          console.log(`✓ Converted reference photo to 1:1 with background: ${backgroundColor}`);
        } catch (error) {
          console.error('Failed to convert reference photo, using original:', error);
          processedFile = file; // Fallback to original file
        }
      }

      const prompt = file ? "Model generated from uploaded photo" : modelDescription;
      const modelInfo = generationModels.find(m => m.name === selectedModelName);
      if (!modelInfo || !modelInfo.id) throw new Error("Invalid model selected.");

      setLoadingMessage(file ? 'Generating model from photo...' : 'Generating model from description...');

      const result = processedFile
        ? await generateModelImage(processedFile, generationSettings, modelInfo.id)
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

      const modelInfo = generationModels.find(m => m.name === selectedModelName);
      if (!modelInfo || !modelInfo.id) throw new Error("Invalid model selected.");

      const result = isMasked
        ? await reviseMaskedImage(generatedModelUrl, maskDataUrl!, revisionInstruction, currentSettings)
        : await reviseGeneratedImage(generatedModelUrl, revisionInstruction, currentSettings, 'gemini-2.5-flash-image');

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
    if (!generatedModelUrl || !currentUser) return;
    setIsGenerating(true);
    setLoadingMessage(`Initiating ${resolution} upscale...`);
    setIsUpscaleMenuOpen(false);

    try {
      // 1. Upload current image to Storage (if it's a blob/data URL)
      let imageUrl = generatedModelUrl;
      if (generatedModelUrl.startsWith('data:') || generatedModelUrl.startsWith('blob:')) {
        setLoadingMessage('Uploading source image...');
        // If it's a blob URL, we need to fetch it first to get the blob/base64
        const response = await fetch(generatedModelUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        const base64Data = await base64Promise;
        imageUrl = await uploadBase64Image(base64Data, currentUser.uid, 'models', `source-for-upscale-${Date.now()}.png`, currentProjectId || undefined);
      }

      // 2. Create Upscale Request
      setLoadingMessage('Queueing upscale job...');
      const requestId = await createUpscaleRequest(currentUser.uid, imageUrl, resolution);

      // 3. Listen for completion
      setLoadingMessage(`Upscaling to ${resolution} (this may take a moment)...`);
      const unsubscribe = listenToUpscaleRequest(requestId, async (request: UpscaleRequest) => {
        if (request.status === 'completed' && request.outputUrl) {
          unsubscribe();
          await addHistoryItem({ prompt: `Upscaled to ${resolution}`, settings: generationSettings, modelName: selectedModelName }, request.outputUrl);
          setToastMessage(`Image upscaled to ${resolution}!`);
          setIsGenerating(false);
          setLoadingMessage('');
        } else if (request.status === 'failed') {
          unsubscribe();
          setToastMessage(request.error || 'Upscale failed');
          setIsGenerating(false);
          setLoadingMessage('');
        }
      });

    } catch (err) {
      console.error('Upscale error:', err);
      setToastMessage(getFriendlyErrorMessage(err, 'Upscale failed'));
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
        : await enhanceDescriptionPrompt(modelDescription, modelInfo.id as 'gemini-2.5-flash-image');

      if (isResultView) setRevisionPrompt(enhancedText);
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

  const handleDownload = useCallback(async (format: 'jpg' | 'png' | 'webp') => {
    if (!generatedModelUrl) return;

    setIsDownloadMenuOpen(false);

    try {
      console.log('Starting download for format:', format);
      console.log('Image URL:', generatedModelUrl);

      // Fetch the image as a blob to avoid CORS issues
      const response = await fetch(generatedModelUrl);
      if (!response.ok) throw new Error('Failed to fetch image');

      const blob = await response.blob();
      console.log('Image fetched, blob type:', blob.type, 'size:', blob.size);

      // Create canvas for format conversion
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      const img = new Image();
      const imageUrl = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          console.log('Image loaded, dimensions:', img.naturalWidth, 'x', img.naturalHeight);
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(imageUrl);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          reject(new Error('Failed to load image'));
        };
        img.src = imageUrl;
      });

      // Convert to desired format with maximum quality
      const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
      const quality = format === 'png' ? undefined : 1.0;

      canvas.toBlob((convertedBlob) => {
        if (!convertedBlob) {
          setToastMessage('Failed to create download file');
          return;
        }

        console.log('Blob created, type:', convertedBlob.type, 'size:', convertedBlob.size);

        // Create download link
        const url = URL.createObjectURL(convertedBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `formlab-model-${Date.now()}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('Download triggered successfully');
        setToastMessage(`Model downloaded as ${format.toUpperCase()}!`);
      }, mimeType, quality);

    } catch (err) {
      console.error('Download error:', err);
      setToastMessage('Failed to download image. Please check console for details.');
    }
  }, [generatedModelUrl]);

  // Handler: Save template from modal to user's models
  const handleSaveTemplateFromModal = useCallback(async (template: Model) => {
    if (!currentProjectId || !currentUser) return;

    setIsSavingTemplate(true);

    try {
      // Check if this template already exists in the current project's gallery
      // We check if any model has this template's ID as its sourceTemplateId
      const alreadySaved = modelGallery.some(m =>
        m.sourceTemplateId === template.id && m.projectId === currentProjectId
      );

      if (alreadySaved) {
        // Template already saved in Firestore, show accurate message
        setSelectedTemplateForPreview(null);
        setIsSavingTemplate(false);
        setToastMessage('Model already in Your Models!');
        return;
      }

      // Upload image to Firebase Storage if it's a base64 URL
      let finalImageUrl = template.url;
      if (currentUser && isBase64Url(template.url)) {
        try {
          finalImageUrl = await uploadBase64Image(
            template.url,
            currentUser.uid,
            'models',
            `template_${Date.now()}.jpg`,
            currentProjectId
          );
          console.log('[CreateModel] Uploaded template to Firebase Storage:', finalImageUrl);
        } catch (error) {
          console.error('[CreateModel] Failed to upload, using original URL:', error);
        }
      }

      // Create new history item as base model
      const newHistoryItemId = `rev-${Date.now()}`;
      const newHistoryItem: HistoryItem = {
        id: newHistoryItemId,
        parentId: null, // New base model
        imageUrl: finalImageUrl,
        prompt: `Saved from template: ${template.name || template.id}`,
        settings: initialGenerationSettings,
        modelName: 'Nano Banana',
        name: `${template.name || 'Template'} - Copy`,
        isStarred: true, // Auto-star saved templates
        type: 'model-generation',
        baseModelId: newHistoryItemId, // Self-reference for base model
        sourceTemplateId: template.id, // Track origin
      };

      // Add to history
      setGeneratedModelHistory(prev => [...prev, newHistoryItem]);
      setCurrentHistoryItemId(newHistoryItemId);

      // Load into workspace
      setGenerationSettings(initialGenerationSettings);
      setModelDescription(`Saved from template: ${template.name || template.id}`);
      setRevisionPrompt('');
      setRedoStack([]);
      setIsMaskingMode(false);
      setMaskDataUrl(null);


      // Add to model gallery
      if (onModelAdded) {
        // Save to Global Library (Enterprise Sync) first to get the Firestore model ID
        let firestoreModelId: string | undefined;
        if (currentUser) {
          try {
            firestoreModelId = await saveGlobalModel(currentUser.uid, {
              url: finalImageUrl,
              name: `${template.name || 'Template'} - Copy`,
              thumbnail: finalImageUrl,
              projectId: currentProjectId,
              historyItemId: newHistoryItemId,
              sourceTemplateId: template.id || null // Ensure it's not undefined
            });
            console.log('[CreateModel] Template model saved to Global Library with ID:', firestoreModelId);
          } catch (error) {
            console.error('[CreateModel] Failed to save template model to Global Library:', error);
          }
        }

        const timestamp = Date.now();
        const newModel: Model = {
          id: firestoreModelId || `${currentProjectId}-${newHistoryItemId}`,
          url: finalImageUrl,
          source: 'user',
          projectId: currentProjectId,
          historyItemId: newHistoryItemId,
          createdAt: timestamp,
          updatedAt: timestamp,
          sourceTemplateId: template.id, // Track origin
        };
        onModelAdded(newModel);
      }

      // Close modal and show success
      setSelectedTemplateForPreview(null);
      setToastMessage(`✓ Saved to Your Models!`);

    } catch (error) {
      console.error('[CreateModel] Failed to save template:', error);
      setToastMessage('Failed to save model');
    } finally {
      setIsSavingTemplate(false);
    }
  }, [currentProjectId, currentUser, onModelAdded, generatedModelHistory]);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, model: Model) => {
    e.preventDefault();
    setContextMenuModel(model);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuModel(null);
    setContextMenuPosition(null);
  }, []);

  const handleDeleteModelClick = useCallback(() => {
    if (contextMenuModel) {
      setDeleteConfirmModal({ isOpen: true, model: contextMenuModel });
    }
  }, [contextMenuModel]);

  const handleDeleteModel = useCallback(async () => {
    if (!deleteConfirmModal.model || !currentProjectId) return;

    const modelToDelete = deleteConfirmModal.model;

    try {
      console.log('[CreateModel] Deleting model:', modelToDelete.id);

      // 1. Delete image from Firebase Storage (only for user-uploaded models)
      if (modelToDelete.url && modelToDelete.url.includes('firebasestorage.googleapis.com')) {
        // Check if it's a user-uploaded file (not a predefined model)
        // Handle both URL-encoded and decoded paths
        const isPredefinedModel = modelToDelete.url.includes('/predefined/') ||
          modelToDelete.url.includes('predefined%2F');

        if (!isPredefinedModel) {
          try {
            await deleteFile(modelToDelete.url);
            console.log('[CreateModel] Image deleted from storage');
          } catch (error) {
            console.error('[CreateModel] Failed to delete image from storage:', error);
            // Continue with deletion even if storage deletion fails
          }
        } else {
          console.log('[CreateModel] Skipping storage deletion for predefined model reference');
        }
      }

      // 2. Remove from history if this model has a history item
      if (modelToDelete.historyItemId) {
        const historyItemToDelete = generatedModelHistory.find(h => h.id === modelToDelete.historyItemId);

        // Remove the history item
        const updatedHistory = generatedModelHistory.filter(h => h.id !== modelToDelete.historyItemId);
        setGeneratedModelHistory(updatedHistory);

        // 3. Delete styling history if it's a base model
        if (historyItemToDelete?.type === 'model-generation' && historyItemToDelete.baseModelId === historyItemToDelete.id) {
          try {
            await deleteStylingHistory(currentProjectId, historyItemToDelete.baseModelId);
            console.log('[CreateModel] Styling history deleted');
          } catch (error) {
            console.error('[CreateModel] Failed to delete styling history:', error);
          }
        }

        // 4. If this was the currently loaded model, clear workspace
        if (currentHistoryItemId === modelToDelete.historyItemId) {
          setCurrentHistoryItemId(null);
          setGenerationSettings(initialGenerationSettings);
          setModelDescription('');
          setRevisionPrompt('');
          setRedoStack([]);
          console.log('[CreateModel] Cleared workspace (deleted model was loaded)');
        }

        // 5. Save updated state to IndexedDB (will auto-sync to Firestore)
        const currentState = await loadProjectState(currentProjectId);
        if (currentState) {
          const updatedState = {
            ...currentState,
            generatedModelHistory: updatedHistory,
            currentHistoryItemId: currentHistoryItemId === modelToDelete.historyItemId ? null : currentHistoryItemId,
            updatedAt: Date.now(),
          };
          await saveProjectState(currentProjectId, updatedState);
          console.log('[CreateModel] Project state updated');
        }
      }

      // 6. Notify parent component to update modelGallery
      if (onModelDeleted) {
        onModelDeleted(modelToDelete);
      }

      // Close modal and show success
      setDeleteConfirmModal({ isOpen: false, model: null });
      setToastMessage('Model deleted successfully');

    } catch (error) {
      console.error('[CreateModel] Failed to delete model:', error);
      setToastMessage('Failed to delete model');
    }
  }, [deleteConfirmModal.model, currentProjectId, generatedModelHistory, currentHistoryItemId, onModelDeleted]);

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



  // Filter models for current project display
  const currentProjectModels = useMemo(() => {
    if (!currentProjectId) return modelGallery;
    return modelGallery.filter(model =>
      model.source === 'predefined' || model.projectId === currentProjectId
    );
  }, [modelGallery, currentProjectId]);

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
    // Don't interfere with dropdown menu clicks
    if (
      (downloadMenuRef.current && downloadMenuRef.current.contains(e.target as Node)) ||
      (upscaleMenuRef.current && upscaleMenuRef.current.contains(e.target as Node))
    ) {
      return; // Let dropdown handle its own events
    }

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
    if (isDownloadMenuOpen || isUpscaleMenuOpen) return 'default';
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

  const handleDeleteVersion = async (id: string) => {
    const itemToDelete = generatedModelHistory.find(i => i.id === id);
    if (!itemToDelete) return;

    try {
      // 1. Delete from Firebase Storage
      if (itemToDelete.imageUrl && isStorageUrl(itemToDelete.imageUrl)) {
        try {
          await deleteFile(itemToDelete.imageUrl);
          console.log('[CreateModel] Deleted storage file for:', id);
        } catch (error) {
          console.warn('[CreateModel] Storage deletion failed:', error);
          // Continue with other deletions even if storage fails
        }
      }

      // 2. Delete from Firestore
      const currentUser = auth.currentUser;
      if (currentUser && currentProjectId) {
        try {
          await deleteHistoryItemFromFirestore(currentProjectId, 'generatedModelHistory', id);
          console.log('[CreateModel] Deleted from Firestore:', id);
        } catch (error) {
          console.warn('[CreateModel] Firestore deletion failed:', error);
          // Continue with state update even if Firestore fails
        }
      }

      // 3. Update local state (triggers IndexedDB save via useEffect)
      const parentId = itemToDelete.parentId;

      if (id === currentHistoryItemId) {
        setCurrentHistoryItemId(parentId);
      }

      setGeneratedModelHistory(prev =>
        prev
          .filter(i => i.id !== id)
          .map(i => {
            if (i.parentId === id) {
              return { ...i, parentId: parentId };
            }
            return i;
          })
      );

      console.log('[CreateModel] Model version deleted successfully:', id);
    } catch (error) {
      console.error('[CreateModel] Error deleting version:', error);
      // Still remove from UI even if backend deletion fails
      setGeneratedModelHistory(prev => prev.filter(i => i.id !== id));
    }
  };

  const renderLeftPanelContent = () => {
    const activePreset = STYLE_PRESETS.find(p => JSON.stringify(p.settings) === JSON.stringify(Object.keys(p.settings).reduce((acc, key) => ({ ...acc, [key]: generationSettings[key as keyof GenerationSettings] }), {})));
    const isUploadDisabled = false;

    return (
      <div className="flex-grow p-4 space-y-3 overflow-y-auto">
        {/* Your Models Section */}
        <div className="flex-shrink-0">
          <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
            <UserIcon className="w-3.5 h-3.5" />
            Your Models
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,72px)] gap-2">
            {/* Add New Model Card */}
            <button
              onClick={handleStartNewModel}
              disabled={isGenerating}
              className="w-[72px] h-[72px] rounded-lg border border-dashed border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Create new model"
            >
              <PlusIcon className="w-6 h-6 text-gray-500 group-hover:text-gray-300 transition-colors" />
            </button>

            {/* Existing Models - Sorted by modification date, limited to 10 */}
            {currentProjectModels
              .filter(model => model.source !== 'predefined')
              .sort((a, b) => {
                const dateA = a.updatedAt || a.createdAt || 0;
                const dateB = b.updatedAt || b.createdAt || 0;
                return dateB - dateA;
              })
              .slice(0, 10)
              .map(model => {
                const isSelected = model.url === generatedModelUrl;
                return (
                  <div key={model.id}>
                    <button
                      onClick={() => onSelectModel(model)}
                      disabled={isGenerating || isSelected}
                      className={`w-[72px] h-[72px] rounded-lg overflow-hidden border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 group disabled:cursor-not-allowed ${isSelected
                        ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.15)] ring-1 ring-white/20'
                        : 'border-white/10 hover:border-white/30 opacity-80 hover:opacity-100'
                        }`}
                      aria-label={`Select model ${model.id}`}
                    >
                      <img src={model.url} alt={`Model ${model.id}`} className="w-full h-full object-cover" />
                    </button>
                  </div>
                );
              })}
          </div>
          <button
            onClick={() => setIsUserModelsModalOpen(true)}
            className="w-full mt-3 py-2 text-[11px] font-medium text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg group"
          >
            All User-Created Models <ChevronRightIcon className="w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-colors" />
          </button>
          {currentProjectModels.filter(m => m.source !== 'predefined').length === 0 && (
            <div className="text-xs text-gray-400 py-2 text-center">
              Create a model through prompt or upload photo
            </div>
          )}
        </div>

        {/* Model Templates Section */}
        <div className="flex-shrink-0 mt-3">
          <button
            onClick={() => setIsTemplatesSectionOpen(!isTemplatesSectionOpen)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-300 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <LayersIcon className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              Model Templates
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-transform ${isTemplatesSectionOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isTemplatesSectionOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="text-[11px] text-gray-400 mb-2">Ready-made models to get you started</p>

                {isLoadingTemplates ? (
                  <div className="flex items-center justify-center py-6">
                    <Spinner className="w-5 h-5" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[repeat(auto-fill,72px)] gap-2">
                      {predefinedModels.slice(0, 9).map(template => {
                        // DEBUG: Log first template check
                        if (template.id === predefinedModels[0].id) {
                          console.log('[CreateModel] Checking duplicates for project:', currentProjectId);
                          console.log('[CreateModel] Gallery size:', modelGallery.length);
                          const match = modelGallery.find(m => m.sourceTemplateId === template.id && m.projectId === currentProjectId);
                          if (match) console.log('[CreateModel] Found match:', match);
                        }

                        const isDuplicate = modelGallery.some(m =>
                          m.sourceTemplateId === template.id && m.projectId === currentProjectId
                        );

                        return (<div key={template.id} className="relative">
                          <button
                            onClick={() => !isDuplicate && setSelectedTemplateForPreview(template)}
                            disabled={isGenerating || isDuplicate}
                            className={`w-[72px] h-[72px] rounded-lg overflow-hidden border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 group disabled:cursor-not-allowed ${isDuplicate
                              ? 'border-white/5 opacity-50 grayscale'
                              : 'border-white/10 hover:border-blue-400/50'
                              }`}
                            aria-label={`Preview template: ${template.name || template.id}`}
                          >
                            <img src={template.thumbnail || template.url} alt={template.name || 'Template'} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            {isDuplicate && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                <div className="bg-green-500 rounded-full p-1">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </button>
                        </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={onOpenCollectionsModal}
                      className="w-full mt-3 py-2 text-[11px] font-medium text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg group"
                    >
                      All Model Templates <ChevronRightIcon className="w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-colors" />
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <CollapsibleSection title={isResultView ? "Revision" : "Prompt"} icon={<PenLineIcon className="w-3.5 h-3.5" />} isOpen={openSections.prompt} onToggle={() => setOpenSections(p => ({ ...p, prompt: !p.prompt }))}>
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

        <CollapsibleSection title="Style Presets" icon={<BookmarkIcon className="w-3.5 h-3.5" />} isOpen={openSections.presets} onToggle={() => setOpenSections(p => ({ ...p, presets: !p.presets }))}>
          <div className="grid grid-cols-2 gap-1.5">
            {STYLE_PRESETS.map(p => (
              <OptionButton
                key={p.label}
                onClick={() => {
                  // Toggle logic: if preset is active, reset its settings to defaults
                  if (activePreset?.label === p.label) {
                    // Reset settings that were in this preset to their initial values
                    const resetSettings: Partial<GenerationSettings> = {};
                    Object.keys(p.settings).forEach(key => {
                      const settingsKey = key as keyof GenerationSettings;
                      (resetSettings as any)[settingsKey] = initialGenerationSettings[settingsKey];
                    });
                    setGenerationSettings(gs => ({ ...gs, ...resetSettings }));
                  } else {
                    // Apply the preset settings
                    setGenerationSettings(gs => ({ ...gs, ...p.settings }));
                  }
                }}
                isActive={activePreset?.label === p.label}
                disabled={isGenerating}
              >
                {p.label}
              </OptionButton>
            ))}
          </div>
        </CollapsibleSection>

        <div className="border-t border-white/5 pt-3">
          <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-0 flex items-center gap-2">
            <SettingsIcon className="w-3.5 h-3.5 text-gray-600" />
            Global Controls
          </h2>
          <div className="space-y-1">
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
              isRevisionMode={!!currentHistoryItemId}
              selectedModelName={selectedModelName}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col relative bg-[#111111]">
      <div className="h-14 border-b border-white/5 bg-[#1a1a1a]/80 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0 z-20">
        <h1 className="text-[15px] font-medium text-white/90">Create Model</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (generatedModelUrl) {
                navigator.clipboard.writeText(window.location.href);
                setToastMessage('Link copied to clipboard!');
              }
            }}
            disabled={!generatedModelUrl}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-200 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Share model"
          >
            <Share2Icon className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (generatedModelUrl && currentProjectId && currentHistoryItemId) {
                const baseModelId = findRootAncestor(currentHistoryItemId) || currentHistoryItemId;
                const stylingModelData: SelectedStylingModel = {
                  url: generatedModelUrl,
                  name: currentHistoryItem?.name || `Model ${currentHistoryItemId.slice(-4)}`,
                  historyItemId: currentHistoryItemId,
                  baseModelId: baseModelId,
                };
                onModelFinalized(stylingModelData);
              }
            }}
            disabled={!generatedModelUrl}
            className="px-4 py-1.5 bg-white hover:bg-gray-100 text-black text-[13px] font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Proceed to Styling <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-grow flex min-h-0">
        <div style={{ width: `${leftPanelWidth}px` }} className="bg-[#1a1a1a]/80 backdrop-blur-xl border-r border-white/5 flex flex-col flex-shrink-0 h-full">
          <ProjectSelectorPanel
            projects={projectList}
            currentProjectId={currentProjectId}
            onProjectChange={onProjectChange}
            onEditProject={() => onOpenProjectModal('edit')}
            onCreateProject={() => onOpenProjectModal('create')}
            onOpenSwitchModal={() => setIsSwitchProjectModalOpen(true)}
            isCreateDisabled={false}
          />
          {renderLeftPanelContent()}
          <div className="p-4 border-t border-white/5 mt-auto bg-[#1a1a1a]/50 backdrop-blur-md">
            <div className="mb-3">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                <CubeIcon className="w-3 h-3 text-gray-600" />
                Generation Model
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {generationModels.map(model => (
                  <button
                    key={model.name}
                    onClick={() => !model.disabled && handleModelSelect(model.name)}
                    title={model.title}
                    disabled={isGenerating || model.disabled}
                    className={`w-full text-center text-[10px] font-semibold py-1.5 px-2 rounded-md transition-all duration-200 border
                                    ${selectedModelName === model.name ? 'bg-white/10 text-white border-white/20 shadow-inner' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300'}
                                    ${model.disabled ? 'opacity-30 cursor-not-allowed' : ''}
                                    disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {model.name}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={isResultView ? handleApplyChanges : () => handleGenerate()}
              disabled={isGenerating || (isResultView && !revisionPrompt.trim() && !hasSettingsChanged) || (!isResultView && !modelDescription.trim())}
              className="w-full py-3 bg-white hover:bg-gray-200 text-black text-xs font-bold rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {isGenerating ? loadingMessage :
                isResultView ?
                  (revisionPrompt.trim() && hasSettingsChanged ?
                    (isMaskingMode ? "Apply Masked Revision + Settings" : "Apply Revision + Settings") :
                    revisionPrompt.trim() ?
                      (isMaskingMode ? "Apply Masked Revision" : "Apply Revision") :
                      (hasSettingsChanged ? "Apply Settings" : "Apply Revision"))
                  : 'Generate Model'
              }
            </button>
          </div>
        </div>

        <ResizeHandle onMouseDown={handleLeftDrag} />

        <div className="flex-grow relative bg-[#0f0f0f] flex flex-col min-h-0">
          <div className="flex-shrink-0 flex items-center justify-between gap-2 p-2 bg-[#1a1a1a]/80 backdrop-blur-md border-b border-white/5 z-30">
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1">
                <button onClick={handleUndo} disabled={!canUndo || isGenerating} className="p-2 rounded-md hover:bg-white/10 disabled:opacity-30 transition-colors text-gray-400 hover:text-white" title="Undo"><UndoIcon className="w-4 h-4" /></button>
                <button onClick={handleRedo} disabled={!canRedo || isGenerating} className="p-2 rounded-md hover:bg-white/10 disabled:opacity-30 transition-colors text-gray-400 hover:text-white" title="Redo"><RedoIcon className="w-4 h-4" /></button>
              </div>
              {isResultView && (
                <button
                  onClick={() => { setZoom(1); handleStartOver(); }}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-2 py-1.5 ml-2 text-xs font-medium text-red-400 hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-900/30 disabled:opacity-30"
                  title="Start Over"
                >
                  <RotateCcwIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Start Over</span>
                </button>
              )}
              <div className="w-px h-6 bg-white/10 mx-2"></div>
              <button onClick={() => setIsMaskingMode(p => !p)} disabled={!isResultView} className={`p-2 rounded-md border transition-all flex items-center gap-2 text-sm ${isMaskingMode ? 'bg-white/5 border-white/5 text-gray-300' : 'bg-transparent border-transparent hover:bg-white/5 text-gray-400 hover:text-white'} disabled:opacity-30 focus:outline-none`} title="Masking Brush"><PenLineIcon className="w-4 h-4" /></button>
              {isMaskingMode && (
                <div className="flex items-center gap-3 text-[10px] font-medium text-gray-400 ml-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                  <span>Brush Size</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-[#318CE7] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-all hover:[&::-webkit-slider-thumb]:bg-[#318CE7]/80"
                  />
                  <span className="w-4 text-right">{brushSize}</span>
                </div>
              )}
              <div ref={upscaleMenuRef} className="relative">
                <button onClick={() => setIsUpscaleMenuOpen(p => !p)} disabled={!isResultView} className="p-2 rounded-md hover:bg-white/5 flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors focus:outline-none" title="Enhance & Upscale"><ZapIcon className="w-4 h-4 text-[#318CE7] group-hover:text-[#318CE7]/80 transition-colors" /></button>
                {isUpscaleMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl z-40 overflow-hidden py-1" style={{ cursor: 'default' }} onMouseMove={(e) => e.stopPropagation()} onMouseEnter={(e) => e.stopPropagation()}>
                    <button onClick={() => handleUpscale('2k')} className="w-full text-left px-3 py-2 text-[11px] font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2" style={{ cursor: 'pointer' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></span> Upscale to 2K
                    </button>
                    <button onClick={() => handleUpscale('4k')} className="w-full text-left px-3 py-2 text-[11px] font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2" style={{ cursor: 'pointer' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50"></span> Upscale to 4K
                    </button>
                    <div className="h-px bg-white/5 my-1 mx-2"></div>
                    <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Enhance Details</div>
                    <button onClick={() => handleSelectiveEnhance('face')} className="w-full text-left px-3 py-1.5 text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-colors pl-6" style={{ cursor: 'pointer' }}>Face & Skin</button>
                    <button onClick={() => handleSelectiveEnhance('fabric')} className="w-full text-left px-3 py-1.5 text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-colors pl-6" style={{ cursor: 'pointer' }}>Fabric & Texture</button>
                    <button onClick={() => handleSelectiveEnhance('accessories')} className="w-full text-left px-3 py-1.5 text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-colors pl-6" style={{ cursor: 'pointer' }}>Accessories</button>
                  </div>
                )}
              </div>
              <div ref={downloadMenuRef} className="relative">
                <button onClick={() => setIsDownloadMenuOpen(p => !p)} disabled={!isResultView} className="p-2 rounded-md hover:bg-white/5 flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors focus:outline-none" title="Download Image">
                  <DownloadIcon className="w-4 h-4" />
                </button>
                {isDownloadMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-44 bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl z-40 overflow-hidden py-1" style={{ cursor: 'default' }} onMouseMove={(e) => e.stopPropagation()} onMouseEnter={(e) => e.stopPropagation()}>
                    <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Download Format</div>
                    <button onClick={(e) => { console.log('PNG button clicked'); e.stopPropagation(); handleDownload('png'); }} className="w-full text-left px-3 py-2 text-[11px] font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors" style={{ cursor: 'pointer' }}>
                      PNG (.png) - Lossless
                    </button>
                    <button onClick={(e) => { console.log('JPG button clicked'); e.stopPropagation(); handleDownload('jpg'); }} className="w-full text-left px-3 py-2 text-[11px] font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors" style={{ cursor: 'pointer' }}>
                      JPEG (.jpg) - Max Quality
                    </button>
                    <button onClick={(e) => { console.log('WebP button clicked'); e.stopPropagation(); handleDownload('webp'); }} className="w-full text-left px-3 py-2 text-[11px] font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors" style={{ cursor: 'pointer' }}>
                      WebP (.webp) - Lossless
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
              {isResultView && <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-lg px-2 py-1 text-gray-400">{Math.round(zoom * 100)}%</div>}

            </div>
          </div>
          <div className="flex-grow flex flex-col min-h-0">
            <div className="flex-grow w-full relative overflow-hidden flex justify-center items-center p-4 min-h-0" ref={imageContainerRef} onWheel={handleWheel} onMouseDown={isDownloadMenuOpen || isUpscaleMenuOpen ? undefined : handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUpOrLeave} onMouseLeave={handleMouseUpOrLeave} style={{ cursor: getCursor() }}>
              {isGenerating && <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center"><Spinner /><p className="mt-4 text-gray-300 font-medium">{loadingMessage}</p></div>}
              {!isResultView ? (
                <div className="flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
                  <h2 className="text-xl font-sans font-semibold text-white mb-3">Model Creation Studio</h2>
                  <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto">Use the panel on the left to generate your first model.</p>
                </div>
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
        confirmButtonClass="bg-[#318CE7] hover:bg-[#318CE7]/90 shadow-blue-500/30"
      />

      {/* Template Preview Modal */}
      <AnimatePresence>
        {selectedTemplateForPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTemplateForPreview(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex"
            >
              {/* Main Image Area */}
              <div className="flex-1 flex items-center justify-center bg-black/40 p-8 relative">
                <img
                  src={selectedTemplateForPreview.url}
                  alt={selectedTemplateForPreview.name || 'Template'}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              </div>

              {/* Metadata Sidebar */}
              <div className="w-80 bg-white/5 border-l border-white/10 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-lg font-medium text-white/90 mb-2">
                    {selectedTemplateForPreview.name || 'Template Model'}
                  </h2>
                  {selectedTemplateForPreview.gender && (
                    <span className="inline-block px-3 py-1 bg-white/10 border border-white/5 text-gray-200 text-xs font-medium rounded-full capitalize">
                      {selectedTemplateForPreview.gender}
                    </span>
                  )}
                </div>

                {/* Metadata Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Model ID */}
                  <div>
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Model ID</h3>
                    <p className="text-sm text-gray-200 font-mono break-all bg-white/5 p-2 rounded border border-white/5">{selectedTemplateForPreview.id}</p>
                  </div>

                  {/* Gender */}
                  {selectedTemplateForPreview.gender && (
                    <div>
                      <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Gender</h3>
                      <p className="text-sm text-gray-200 capitalize">{selectedTemplateForPreview.gender}</p>
                    </div>
                  )}

                  {/* Tags */}
                  {selectedTemplateForPreview.tags && selectedTemplateForPreview.tags.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplateForPreview.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-white/5 border border-white/10 text-gray-300 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Image URL */}
                  <div>
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Image URL</h3>
                    <p className="text-[10px] text-gray-400 font-mono break-all leading-relaxed">{selectedTemplateForPreview.url}</p>
                  </div>

                  {/* Thumbnail URL (if different) */}
                  {selectedTemplateForPreview.thumbnail && selectedTemplateForPreview.thumbnail !== selectedTemplateForPreview.url && (
                    <div>
                      <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Thumbnail URL</h3>
                      <p className="text-[10px] text-gray-400 font-mono break-all leading-relaxed">{selectedTemplateForPreview.thumbnail}</p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/10 space-y-3 bg-white/5">
                  <button
                    onClick={() => handleSaveTemplateFromModal(selectedTemplateForPreview)}
                    disabled={isSavingTemplate || !currentProjectId}
                    className="w-full py-2.5 px-4 bg-white hover:bg-gray-100 text-black rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isSavingTemplate ? (
                      <>
                        <Spinner className="w-3.5 h-3.5 text-black" />
                        Saving...
                      </>
                    ) : (
                      'Save to Your Models'
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedTemplateForPreview(null)}
                    className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenuModel !== null}
        position={contextMenuPosition}
        onRenameModel={handleRename}
        onDeleteModel={handleDeleteModel}
        currentProjectId={currentProjectId || undefined}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, model: null })}
        onConfirm={handleDeleteModel}
        title="Delete Model?"
        message="Do you want to permanently delete this model? This action cannot be undone."
        confirmText="Delete Model"
      />
      <SwitchProjectModal
        isOpen={isSwitchProjectModalOpen}
        onClose={() => setIsSwitchProjectModalOpen(false)}
        projects={projectList}
        currentProjectId={currentProjectId}
        onSwitchProject={onProjectChange}
        onDeleteProject={onDeleteProject}
      />

      <UserModelsModal
        isOpen={isUserModelsModalOpen}
        onClose={() => setIsUserModelsModalOpen(false)}
        models={modelGallery.filter(model => model.source !== 'predefined')}
        onSelectModel={onSelectModel}
        currentModelUrl={generatedModelUrl}
        currentProjectId={currentProjectId}
        onRenameModel={(modelId, newName) => {
          if (onRenameModel) {
            onRenameModel(modelId, newName);
          }
        }}
        onDeleteModel={(model) => {
          onModelDeleted(model);
          setIsUserModelsModalOpen(false);
        }}
      />

    </div >
  );
};

export default CreateModel;