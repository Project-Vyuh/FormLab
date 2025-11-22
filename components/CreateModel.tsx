/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloudIcon, PenLineIcon, CubeIcon, UndoIcon, RedoIcon, BookmarkIcon, DownloadIcon, CameraIcon, ZapIcon, LayoutIcon, WandIcon, ChevronRightIcon, SunIcon, SlidersHorizontalIcon, ChevronDownIcon, LayersIcon, Trash2Icon, PlusIcon, PersonStandingIcon, StarIcon, GitBranchIcon, ChevronUpIcon, Share2Icon, UserIcon, SparklesIcon } from './icons';
import { Compare } from './ui/compare';
import { generateModelImage, generateModelFromDescription, reviseGeneratedImage, enhanceDescriptionPrompt, enhanceRevisionPrompt, upscaleImage, selectivelyEnhanceImage, reviseMaskedImage } from '../services/geminiService';
import Spinner from './Spinner';
import { getFriendlyErrorMessage } from '../lib/utils';
import { GenerationSettings, UpscaleResolution, PhotoStyle, ShotFraming, BrandStyle, AspectRatio, LightingRig, Light, LightRole, HdriMap, LightType, SceneAtmosphere, ImageProcessingSettings, LensProfile, ApertureSettings, BokehShape, ShutterSettings, SensorSize, CameraPositionSettings, FocusPlaneSettings, CameraProfile, NoiseAndGrainSettings, StudioEnvironment, ShadowSculptingSettings, StudioEnvironmentType, GradientType, TextureType, FloorMaterial, AmbientBounceSettings, AmbientOcclusionSettings, FloorSettings, StudioVignetting, Project, PanelToggles, HistoryItem, HistoryItemType, User, SelectedStylingModel, Model } from '../types';
import ConfirmationModal from './ConfirmationModal';
import ResizeHandle from './ResizeHandle';
import { useDebouncedEffect } from '../hooks/useDebouncedEffect';
import {
  saveProjectState,
  loadProjectState
} from '../services/dbService';
import { uploadBase64Image, isBase64Url, deleteFile } from '../services/storageService';
import { deleteStylingHistory } from '../services/dbService';
import GlobalControls from './GlobalControls';
import CollapsibleSection from './shared/CollapsibleSection';
import OptionButton from './shared/OptionButton';
import VersionHistoryPanel from './VersionHistoryPanel';
import ProjectSelectorPanel from './ProjectSelectorPanel';
import SwitchProjectModal from './SwitchProjectModal';
import PromptPanel from './PromptPanel';
import ContextMenu from './ContextMenu';
import { loadPredefinedModels } from '../services/firestoreService';


interface CreateModelProps {
  onModelFinalized: (stylingModelData: SelectedStylingModel) => void;
  onSaveModelInstance: (modelUrl: string) => void;
  projectList: Project[];
  currentProjectId: string | null;
  onProjectChange: (id: string) => void;
  onOpenProjectModal: (mode: 'create' | 'edit') => void;
  currentUser: User | null;
  modelGallery: Model[];
  onSelectModel: (model: Model) => void;
  onModelAdded?: (model: Model) => void; // Callback when a new base model is created
  onModelDeleted?: (model: Model) => void; // Callback when a model is deleted
  selectedHistoryItemId?: string | null; // History item to load from gallery selection
  onHistoryItemLoaded?: () => void; // Callback when history item has been loaded
  onOpenCollectionsModal: () => void; // Callback to open collections modal
  lastExternalUpdate?: number; // Trigger to reload project state
  onDeleteProject: (projectId: string) => void;
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

export const initialGenerationSettings: GenerationSettings = {
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
  lensProfile: '50mm',
  shutterSettings: initialShutterSettings,
  lightingRig: initialLightingRig,
  sceneAtmosphere: initialSceneAtmosphere,
  imageProcessing: initialImageProcessing,
  sensorSize: 'full-frame',
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
  currentUser,
  modelGallery,
  onSelectModel,
  onModelAdded,
  onModelDeleted,
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
    setIsCompareMode(false);
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

  useEffect(() => {
    setIsLoaded(true);
    try {
      const savedStyles = localStorage.getItem('formlab-brand-styles-createmodel');
      if (savedStyles) setBrandStyles(JSON.parse(savedStyles));
    } catch (err) { console.error("Failed to load brand styles", err); }
  }, []);

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

    if (historyItem) {
      // FAST PATH: Project already loaded, just switch to this history item
      setCurrentHistoryItemId(selectedHistoryItemId);
      setGenerationSettings(historyItem.settings);
      setSelectedModelName(historyItem.modelName);
      setRevisionPrompt('');
      setRedoStack([]);
      setIsMaskingMode(false);
      setMaskDataUrl(null);
      setIsCompareMode(false);
      // Clear the pending ID since we handled it
      setPendingHistoryItemId(null);
      // Notify parent that we've loaded the model
      onHistoryItemLoaded?.();
    }
    // If item not found, pendingHistoryItemId is already set by previous effect
    // and the project loading effect will handle it
  }, [selectedHistoryItemId, currentProjectId, isLoaded, generatedModelHistory, onHistoryItemLoaded]);

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
      }
    };

    loadProject();
  }, [currentProjectId, resetProjectState, isLoaded, pendingHistoryItemId, lastExternalUpdate]);

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
    setIsCompareMode(false);
    setIsMaskingMode(false);
    setMaskDataUrl(null);
  }, []);

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
      const newModel: Model = {
        id: `${currentProjectId}-${newId}`,
        url: finalImageUrl,
        source: 'user',
        projectId: currentProjectId,
        historyItemId: newId, // Store the history item ID
      };
      onModelAdded(newModel);
    }
  }, [currentHistoryItemId, currentUser, currentProjectId, onModelAdded]);

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

  // Handler: Save template from modal to user's models
  const handleSaveTemplateFromModal = useCallback(async (template: Model) => {
    if (!currentProjectId) return;

    setIsSavingTemplate(true);

    // Check if this template is already saved in the current project
    const existingTemplate = generatedModelHistory.find(
      item => item.imageUrl === template.url &&
        item.parentId === null &&
        item.prompt?.includes('Saved from template')
    );

    if (existingTemplate) {
      // Template already saved, just load it instead of creating duplicate
      setCurrentHistoryItemId(existingTemplate.id);
      setGenerationSettings(existingTemplate.settings);
      setSelectedModelName(existingTemplate.modelName);
      setModelDescription(existingTemplate.prompt || '');
      setRevisionPrompt('');
      setRedoStack([]);
      setIsMaskingMode(false);
      setMaskDataUrl(null);
      setIsCompareMode(false);
      setSelectedTemplateForPreview(null);
      setIsSavingTemplate(false);
      setToastMessage('Collection already in Your Models!');
      return;
    }

    try {
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
      setIsCompareMode(false);

      // Add to model gallery
      if (onModelAdded) {
        const newModel: Model = {
          id: `${currentProjectId}-${newHistoryItemId}`,
          url: finalImageUrl,
          source: 'user',
          projectId: currentProjectId,
          historyItemId: newHistoryItemId,
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
      <div className="flex-grow p-4 space-y-3 overflow-y-auto">
        {/* Your Models Section */}
        <div className="flex-shrink-0">
          <h2 className="text-sm font-sans font-semibold text-gray-200 flex items-center gap-2 mb-2">
            <UserIcon className="w-4 h-4" />
            Your Models
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,72px)] gap-2">
            {/* Add New Model Card */}
            <button
              onClick={handleStartNewModel}
              disabled={isGenerating}
              className="w-[72px] h-[72px] rounded-md border border-dashed border-gray-600 hover:border-gray-400 transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Create new model"
            >
              <PlusIcon className="w-8 h-8 text-gray-500 group-hover:text-gray-300 transition-colors" />
            </button>

            {/* Existing Models */}
            {modelGallery
              .filter(model => model.source !== 'predefined')
              .map(model => {
                const isSelected = model.url === generatedModelUrl;
                return (
                  <div key={model.id}>
                    <button
                      onClick={() => onSelectModel(model)}
                      onContextMenu={(e) => handleContextMenu(e, model)}
                      disabled={isGenerating || isSelected}
                      className={`w-[72px] h-[72px] rounded-md overflow-hidden border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 group disabled:cursor-not-allowed ${isSelected
                        ? 'border-gray-100 shadow-md'
                        : 'border-gray-700 hover:border-gray-500'
                        }`}
                      aria-label={`Select model ${model.id}`}
                    >
                      <img src={model.url} alt={`Model ${model.id}`} className="w-full h-full object-cover" />
                    </button>
                  </div>
                );
              })}
          </div>
          {modelGallery.length === 0 && (
            <div className="text-xs text-gray-400 py-2 text-center">
              Create a model through prompt or upload photo
            </div>
          )}
        </div>

        {/* Model Templates Section */}
        <div className="flex-shrink-0 mt-3">
          <button
            onClick={() => setIsTemplatesSectionOpen(!isTemplatesSectionOpen)}
            className="w-full flex items-center justify-between text-sm font-sans font-semibold text-gray-200 mb-2 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <LayersIcon className="w-4 h-4 text-blue-400" />
              Model Templates
            </div>
            <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isTemplatesSectionOpen ? 'rotate-180' : ''}`} />
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
                      {predefinedModels.slice(0, 9).map(template => (
                        <div key={template.id} className="relative">
                          <button
                            onClick={() => setSelectedTemplateForPreview(template)}
                            disabled={isGenerating}
                            className="w-[72px] h-[72px] rounded-md overflow-hidden border border-gray-700 hover:border-blue-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 group disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Preview template: ${template.name || template.id}`}
                          >
                            <img src={template.thumbnail || template.url} alt={template.name || 'Template'} className="w-full h-full object-cover" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={onOpenCollectionsModal}
                      className="w-full mt-2 py-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1 border border-blue-500/30 rounded-md hover:bg-blue-500/10"
                    >
                      All Model Templates <ChevronRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <CollapsibleSection title={isResultView ? "Revision" : "Prompt"} icon={<PenLineIcon className="w-3.5 h-3.5 text-gray-400" />} isOpen={openSections.prompt} onToggle={() => setOpenSections(p => ({ ...p, prompt: !p.prompt }))}>
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

        <CollapsibleSection title="Style Presets" icon={<BookmarkIcon className="w-3.5 h-3.5 text-gray-400" />} isOpen={openSections.presets} onToggle={() => setOpenSections(p => ({ ...p, presets: !p.presets }))}>
          <div className="grid grid-cols-2 gap-1.5">
            {STYLE_PRESETS.map(p => <OptionButton key={p.label} onClick={() => setGenerationSettings(gs => ({ ...gs, ...p.settings }))} isActive={activePreset?.label === p.label} disabled={isGenerating}>{p.label}</OptionButton>)}
          </div>
          <div className="mt-3">
            <label className="text-[11px] text-gray-400 mb-1.5 block">Brand Kit</label>
            <div className="flex gap-1.5">
              <select onChange={(e) => { const s = brandStyles.find(bs => bs.id === e.target.value); if (s) setGenerationSettings(s.settings); }} disabled={isGenerating || brandStyles.length === 0} className="w-full text-xs p-1.5 bg-black/30 border border-gray-700 text-gray-200 rounded"><option>Load style...</option>{brandStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <button onClick={() => { const name = prompt("Style Name:"); if (name) handleSaveBrandStyle(name); }} disabled={isGenerating} className="px-2.5 text-xs rounded border border-gray-700 text-gray-300">Save</button>
            </div>
          </div>
        </CollapsibleSection>

        <div className="border-t border-gray-800 pt-3">
          <h2 className="text-sm font-sans font-semibold text-gray-200 mb-3">
            Global Controls
          </h2>
          <div className="space-y-3">
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
      <div className="h-14 border-b border-white/5 bg-[#1a1a1a]/80 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0 z-20">
        <h1 className="text-[15px] font-medium text-white/90">Create Model</h1>
        <div className="flex items-center gap-3">
          {isResultView && <button onClick={() => { if (window.confirm("Start a new project? This will clear your current model creation.")) { reset(); } }} className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors">Start Over</button>}
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
        <div style={{ width: `${leftPanelWidth}px` }} className="bg-[#1a1a1a] border-r border-gray-800 flex flex-col flex-shrink-0 h-full">
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
          <div className="p-4 border-t border-gray-800 mt-auto">
            <div className="mb-3">
              <label className="text-[11px] font-medium text-gray-400 mb-1.5 block flex items-center gap-1.5">
                <CubeIcon className="w-3.5 h-3.5 text-gray-500" />
                Generation Model
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {generationModels.map(model => (
                  <button
                    key={model.name}
                    onClick={() => !model.disabled && handleModelSelect(model.name)}
                    title={model.title}
                    disabled={isGenerating || model.disabled}
                    className={`w-full text-center text-[11px] font-semibold py-1 px-1.5 rounded transition-all duration-200 border
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
              disabled={isGenerating || (isResultView && !revisionPrompt.trim() && !hasSettingsChanged) || (!isResultView && !modelDescription.trim())}
              className="w-full py-2.5 bg-gray-100 hover:bg-white text-gray-900 text-xs font-bold rounded-md disabled:opacity-50"
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
          <div className="flex-shrink-0 flex items-center justify-between gap-2 p-2 bg-[#1a1a1a]/80 backdrop-blur-md border-b border-white/5">
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1">
                <button onClick={handleUndo} disabled={!canUndo || isGenerating} className="p-2 rounded-md hover:bg-white/10 disabled:opacity-30 transition-colors text-gray-400 hover:text-white" title="Undo"><UndoIcon className="w-4 h-4" /></button>
                <button onClick={handleRedo} disabled={!canRedo || isGenerating} className="p-2 rounded-md hover:bg-white/10 disabled:opacity-30 transition-colors text-gray-400 hover:text-white" title="Redo"><RedoIcon className="w-4 h-4" /></button>
              </div>
              <div className="w-px h-6 bg-white/10 mx-2"></div>
              <button onClick={() => setIsCompareMode(!isCompareMode)} disabled={!canUndo || !isResultView} className={`p-2 rounded-md border transition-all flex items-center gap-2 text-sm ${isCompareMode ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-transparent border-transparent hover:bg-white/5 text-gray-400 hover:text-white'} disabled:opacity-30`} title="Compare"><LayoutIcon className="w-4 h-4" /></button>
              <button onClick={() => setIsMaskingMode(p => !p)} disabled={!isResultView} className={`p-2 rounded-md border transition-all flex items-center gap-2 text-sm ${isMaskingMode ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'bg-transparent border-transparent hover:bg-white/5 text-gray-400 hover:text-white'} disabled:opacity-30`} title="Masking Brush"><PenLineIcon className="w-4 h-4" /></button>
              {isMaskingMode && (
                <div className="flex items-center gap-2 text-xs text-gray-400 ml-2">
                  <span>Brush Size:</span>
                  <input type="range" min="10" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-24 accent-purple-500" />
                </div>
              )}
              <div ref={upscaleMenuRef} className="relative">
                <button onClick={() => setIsUpscaleMenuOpen(p => !p)} disabled={!isResultView} className="p-2 rounded-md hover:bg-white/5 flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors" title="Enhance & Upscale"><ZapIcon className="w-4 h-4 text-yellow-400/80" /></button>
                {isUpscaleMenuOpen && <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden"><button onClick={() => handleUpscale('2k')} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors">Upscale to 2K</button><button onClick={() => handleUpscale('4k')} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors">Upscale to 4K</button><div className="h-px bg-white/10 my-1"></div><button onClick={() => handleSelectiveEnhance('face')} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors">Enhance Face</button><button onClick={() => handleSelectiveEnhance('fabric')} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors">Enhance Fabric</button><button onClick={() => handleSelectiveEnhance('accessories')} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors">Enhance Accessories</button></div>}
              </div>
              <button title="Identity Lock (Coming Soon)" disabled className="p-2 rounded-md flex items-center gap-2 text-sm text-gray-500 disabled:opacity-30 cursor-not-allowed"><LayersIcon className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
              {isResultView && <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-lg px-2 py-1 text-gray-400">{Math.round(zoom * 100)}%</div>}
              <div ref={downloadMenuRef} className="relative">
                <button onClick={() => setIsDownloadMenuOpen(p => !p)} disabled={!isResultView} className="p-2 rounded-md bg-white/5 border border-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-30 transition-colors" title="Download"><DownloadIcon className="w-4 h-4" /></button>
                {isDownloadMenuOpen && <div className="absolute top-full right-0 mt-2 w-40 bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden"><button onClick={() => handleDownload('png')} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors">PNG</button><button onClick={() => handleDownload('jpeg')} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors">JPEG</button><button onClick={() => handleDownload('webp')} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors">WEBP</button></div>}
              </div>
            </div>
          </div>
          <div className="flex-grow flex flex-col min-h-0">
            <div className="flex-grow w-full relative overflow-hidden flex justify-center items-center p-4 min-h-0" ref={imageContainerRef} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUpOrLeave} onMouseLeave={handleMouseUpOrLeave} style={{ cursor: getCursor() }}>
              {isGenerating && <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center"><Spinner /><p className="mt-4 text-gray-300 font-medium">{loadingMessage}</p></div>}
              {!isResultView ? (
                <div className="flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
                  <h2 className="text-xl font-sans font-semibold text-white mb-3">Model Creation Studio</h2>
                  <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto">Use the panel on the left to generate your first model.</p>
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
        onClose={handleCloseContextMenu}
        onDelete={handleDeleteModelClick}
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
      {/* Switch Project Modal */}
      <SwitchProjectModal
        isOpen={isSwitchProjectModalOpen}
        onClose={() => setIsSwitchProjectModalOpen(false)}
        projects={projectList}
        currentProjectId={currentProjectId}
        onSwitchProject={onProjectChange}
        onDeleteProject={onDeleteProject}
      />

    </div>
  );
};

export default CreateModel;