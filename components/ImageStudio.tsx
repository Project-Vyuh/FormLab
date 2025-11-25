/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Canvas from './Canvas';
import ModelGalleryPanel from './ModelGalleryPanel';
import RightPanelContent from './RightPanelContent';
import ResizeHandle from './ResizeHandle';
import ConfirmationModal from './ConfirmationModal';
import { UserIcon, ChevronRightIcon, Share2Icon } from './icons';
import WardrobeLibrary from './WardrobeLibrary';
import ProductDetailsFlyout from './ProductDetailsFlyout';
import VersionHistoryPanel from './VersionHistoryPanel';
import { Model, WardrobeItem, OutfitLayer, GenerationSettings, HistoryItem, WardrobeCategory, BrandStyle, GarmentAnalysis, Light, LightRole, SceneAtmosphere, ImageProcessingSettings, ShutterSettings, NoiseAndGrainSettings, StudioEnvironment, ShadowSculptingSettings, FloorSettings, AmbientBounceSettings, AmbientOcclusionSettings, PanelToggles, LightingRig, ApertureSettings, CameraPositionSettings, FocusPlaneSettings, Project, User, SelectedStylingModel } from '../types';
import {
  generateVirtualTryOnImage,
  generatePoseVariation,
  regenerateFrame,
  analyzeGarment,
  generateModelImage,
  reviseGeneratedImage,
  enhanceRevisionPrompt
} from '../services/geminiService';
import { getFriendlyErrorMessage } from '../lib/utils';
import { uploadFile, uploadBase64Image, isBase64Url } from '../services/storageService';
import { loadPredefinedWardrobe } from '../services/firestoreService';
import { loadUnifiedHistory, saveStylingHistory } from '../services/dbService';


// Helper to convert data URL to File
const urlToFile = async (url: string, filename: string): Promise<File> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
};

// Helper to convert Blob URL to Data URL (Base64)
const resolveImageUrl = async (url: string): Promise<string> => {
  if (url.startsWith('data:')) return url;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to convert blob URL", e);
    throw new Error("Could not process model image. Please try uploading the model again.");
  }
};

// Helper for deep copying objects
const deepCopy = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

const POSE_INSTRUCTIONS = [
  "Standing, forward-facing, full body shot",
  "Slightly turned, 3/4 view",
  "Side profile view",
  "Walking towards camera",
  "Leaning against a wall"
];

const initialImageProcessing: ImageProcessingSettings = {
  exposureBias: 0,
  contrast: 'neutral',
  colorGrade: 'none',
  highlightRollOff: 'medium',
  shadowCrush: 'none',
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
const initialShadowSculpting: ShadowSculptingSettings = { flags: { left: false, right: false } };
const initialFloorSettings: FloorSettings = { material: 'matte', glossiness: 0.1, reflectionLength: 0.2 };
const initialAmbientBounce: AmbientBounceSettings = { color: '#FFFFFF', strength: 0, bias: 'uniform' };
const initialAmbientOcclusion: AmbientOcclusionSettings = { intensity: 0.3, radius: 0.5 };

const initialPanelToggles: PanelToggles = {
  composition: false,
  cameraAndLens: false,
  lighting: false,
  environment: false,
  imageFinishing: false,
};

const initialGenerationSettings: GenerationSettings = {
  quality: 'standard',
  studioEnvironment: initialStudioEnvironment,
  floorSettings: initialFloorSettings,
  ambientBounce: initialAmbientBounce,
  ambientOcclusion: initialAmbientOcclusion,
  shadowSculpting: initialShadowSculpting,
  photoStyle: 'none',
  accessoryPrompt: '',
  shotFraming: 'full',
  posePrompt: '',
  negativePrompt: '',
  aspectRatio: '2:3',
  poseReferenceUrl: null,
  poseReferenceFile: null,
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
  panelToggles: initialPanelToggles,
};

interface ImageStudioProps {
  selectedStylingModel: SelectedStylingModel | null;
  onNavigateToVideoCreator: (imageUrl: string) => void;
  onNavigateToCreateModel: () => void;
  projectList: Project[];
  currentProjectId: string | null;
  onProjectChange: (id: string) => void;
  onOpenProjectModal: (mode: 'create' | 'edit') => void;
  currentUser: User | null;
  onCategoriesChange?: (categories: string[]) => void;
  onSaveStylingHistory: (baseModelId: string, history: HistoryItem[]) => void;
}

type GenerationModel = 'gemini-2.5-flash-image';

const generationModels: { name: string, id: GenerationModel | null, disabled?: boolean, title?: string }[] = [
  { name: 'Nano Banana', id: 'gemini-2.5-flash-image', title: 'Fastest generation, good for quick iterations.' },
  { name: 'Imagen 4 Ultra', id: null, disabled: true, title: 'Imagen 4 Ultra is not yet available.' },
];


const ImageStudio: React.FC<ImageStudioProps> = ({
  selectedStylingModel,
  onNavigateToVideoCreator,
  onNavigateToCreateModel,
  projectList,
  currentProjectId,
  onProjectChange,
  onOpenProjectModal,
  currentUser,
  onCategoriesChange,
  onSaveStylingHistory,
}) => {
  // Core State
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [outfitStack, setOutfitStack] = useState<OutfitLayer[]>([]);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(initialGenerationSettings);

  // UI Interaction State
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [hasPendingStackChanges, setHasPendingStackChanges] = useState(false);

  // Generation & History State (NEW UNIFIED SYSTEM)
  const [generatedModelHistory, setGeneratedModelHistory] = useState<HistoryItem[]>([]);
  const [currentHistoryItemId, setCurrentHistoryItemId] = useState<string | null>(null);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [selectedGenerationModel, setSelectedGenerationModel] = useState<string>('Nano Banana');

  // Loading & Feedback State
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Layout State
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(320); // Increased width for new panel
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(true);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

  const [openSections, setOpenSections] = useState({
    composition: true,
    camera: false,
    lighting: false,
    environment: false,
    finishing: false,
    advanced: false
  });

  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);

  // New Wardrobe State
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['Uncategorized', 'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Footwear', 'Accessories']);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'product' | 'category'; item: WardrobeItem | string } | null>(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<WardrobeItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<WardrobeItem | null>(null);

  // NEW: Revision Prompt State
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);

  // Notify parent when categories change
  useEffect(() => {
    if (onCategoriesChange) {
      onCategoriesChange(categories);
    }
  }, [categories, onCategoriesChange]);

  const currentHistoryItem = useMemo(() => generatedModelHistory.find(item => item.id === currentHistoryItemId), [generatedModelHistory, currentHistoryItemId]);
  const displayImageUrl = useMemo(() => currentHistoryItem?.imageUrl || modelImageUrl, [currentHistoryItem, modelImageUrl]);

  const canUndo = useMemo(() => !!currentHistoryItem?.parentId, [currentHistoryItem]);
  const canRedo = redoStack.length > 0;
  const hasPendingChanges = hasPendingStackChanges;

  // --- Initialize State ---
  useEffect(() => {
    const initializeImageStudio = async () => {
      if (selectedStylingModel && currentProjectId) {
        setModelImageUrl(selectedStylingModel.url);

        // Load unified history (Create Model + Image Studio history merged)
        const unifiedHistory = await loadUnifiedHistory(currentProjectId, selectedStylingModel.baseModelId);

        if (unifiedHistory && unifiedHistory.length > 0) {
          // Load the unified history
          setGeneratedModelHistory(unifiedHistory);

          // Try to find the specific revision selected in Create Model
          const selectedItem = unifiedHistory.find(item => item.id === selectedStylingModel.historyItemId);
          if (selectedItem) {
            // Use the selected revision
            setCurrentHistoryItemId(selectedItem.id);
            setGenerationSettings(selectedItem.settings);
          } else {
            // Fallback: Find the last try-on item, or the last item overall
            const lastTryonItem = [...unifiedHistory]
              .reverse()
              .find(item => item.type === 'try-on' || item.type === 'try-on-revision');

            if (lastTryonItem) {
              setCurrentHistoryItemId(lastTryonItem.id);
              setGenerationSettings(lastTryonItem.settings);
            } else {
              // No try-on history yet, use the last item (likely a model-generation or model-revision)
              const lastItem = unifiedHistory[unifiedHistory.length - 1];
              setCurrentHistoryItemId(lastItem.id);
              setGenerationSettings(lastItem.settings);
            }
          }
        } else {
          // No history exists yet - Create new root history item for this model
          // This happens when first entering Image Studio from a newly created model
          const baseLayer: OutfitLayer = { id: 'base-model', garment: null, isVisible: true };
          const rootHistoryItem: HistoryItem = {
            id: `hist-${Date.now()}`,
            parentId: null,
            imageUrl: selectedStylingModel.url,
            prompt: "Initial Model",
            settings: initialGenerationSettings,
            modelName: "gemini-2.5-flash-image",
            isStarred: true,
            name: selectedStylingModel.name,
            type: 'try-on',
            baseModelId: selectedStylingModel.baseModelId,
          };
          setOutfitStack([baseLayer]);
          setGeneratedModelHistory([rootHistoryItem]);
          setCurrentHistoryItemId(rootHistoryItem.id);
        }

        setRedoStack([]);
        setHasPendingStackChanges(false);
        setSelectedLayerId(null);
        setError(null);
      } else {
        // No model selected - reset to empty state
        setModelImageUrl(null);
        setOutfitStack([]);
        setGeneratedModelHistory([]);
        setCurrentHistoryItemId(null);
      }
    };

    initializeImageStudio();
  }, [selectedStylingModel, currentProjectId]);

  // --- Auto-save unified history ---
  useEffect(() => {
    const autoSave = async () => {
      if (
        selectedStylingModel &&
        currentProjectId &&
        generatedModelHistory.length > 0
      ) {
        // Save unified history (will be split into Create Model and Image Studio history by dbService)
        await saveStylingHistory(currentProjectId, selectedStylingModel.baseModelId, generatedModelHistory);
        onSaveStylingHistory(selectedStylingModel.baseModelId, generatedModelHistory);
      }
    };

    // Debounce to avoid too frequent saves
    const timeoutId = setTimeout(autoSave, 1000);
    return () => clearTimeout(timeoutId);
  }, [generatedModelHistory, selectedStylingModel, currentProjectId, onSaveStylingHistory]);

  // --- Toast & Layout Effects ---
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Local Storage Persistence + Pre-Defined Content ---
  useEffect(() => {
    const loadWardrobeData = async () => {
      try {
        // Load user wardrobe from localStorage
        const savedWardrobe = localStorage.getItem('formlab-wardrobe');
        const userWardrobe: WardrobeItem[] = savedWardrobe ? JSON.parse(savedWardrobe) : [];

        // Mark user items with source
        userWardrobe.forEach(item => {
          if (!item.source) item.source = 'user';
        });

        // Load pre-defined wardrobe
        try {
          const predefinedWardrobe = await loadPredefinedWardrobe();
          console.log(`Loaded ${predefinedWardrobe.length} pre-defined wardrobe items`);

          // Combine user wardrobe with pre-defined items
          const allWardrobe = [...userWardrobe, ...predefinedWardrobe];
          setWardrobe(allWardrobe);
        } catch (error) {
          console.error('Failed to load pre-defined wardrobe:', error);
          // Fallback to just user wardrobe
          setWardrobe(userWardrobe);
        }

        // Load other data from localStorage
        const savedCategories = localStorage.getItem('formlab-categories');
        if (savedCategories) setCategories(JSON.parse(savedCategories));
        const savedFavorites = localStorage.getItem('formlab-favorites');
        if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
        const savedRecentlyUsed = localStorage.getItem('formlab-recently-used');
        if (savedRecentlyUsed) setRecentlyUsed(JSON.parse(savedRecentlyUsed));
      } catch (e) {
        console.error("Failed to load data from localStorage", e);
      }
    };

    loadWardrobeData();
  }, []);

  useEffect(() => {
    try {
      // Only save user wardrobe items to localStorage, not pre-defined ones
      const userWardrobeOnly = wardrobe.filter(item => item.source !== 'predefined');
      localStorage.setItem('formlab-wardrobe', JSON.stringify(userWardrobeOnly));
      localStorage.setItem('formlab-categories', JSON.stringify(categories));
      localStorage.setItem('formlab-favorites', JSON.stringify(favorites));
      localStorage.setItem('formlab-recently-used', JSON.stringify(recentlyUsed));
    } catch (e) { console.error("Failed to save data to localStorage", e); }
  }, [wardrobe, categories, favorites, recentlyUsed]);

  // --- Stack Manipulation Handlers ---
  const handleAddItemToStack = useCallback((item: WardrobeItem) => {
    const newLayer: OutfitLayer = {
      id: `layer-${Date.now()}`,
      garment: item,
      isVisible: true,
    };
    setOutfitStack(prev => [...prev, newLayer]);
    setHasPendingStackChanges(true);
    setRecentlyUsed(prev => [item, ...prev.filter(i => i.id !== item.id)].slice(0, 20));
  }, []);

  const handleMoveLayerUp = useCallback((layerId: string) => {
    setOutfitStack(prevStack => {
      const index = prevStack.findIndex(l => l.id === layerId);
      if (index <= 1) return prevStack;
      const newStack = [...prevStack];
      [newStack[index - 1], newStack[index]] = [newStack[index], newStack[index - 1]];
      return newStack;
    });
    setHasPendingStackChanges(true);
  }, []);

  const handleMoveLayerDown = useCallback((layerId: string) => {
    setOutfitStack(prevStack => {
      const index = prevStack.findIndex(l => l.id === layerId);
      if (index === -1 || index >= prevStack.length - 1) return prevStack;
      const newStack = [...prevStack];
      [newStack[index + 1], newStack[index]] = [newStack[index], newStack[index + 1]];
      return newStack;
    });
    setHasPendingStackChanges(true);
  }, []);

  const handleToggleVisibility = useCallback((layerId: string) => {
    setOutfitStack(prev => prev.map(l => l.id === layerId ? { ...l, isVisible: !l.isVisible } : l));
    setHasPendingStackChanges(true);
  }, []);

  const handleRemoveLayer = useCallback((layerId: string) => {
    setOutfitStack(prev => prev.filter(l => l.id !== layerId));
    setHasPendingStackChanges(true);
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  }, [selectedLayerId]);

  const handleSelectLayer = useCallback((layerId: string | null) => {
    setSelectedLayerId(layerId);
  }, []);

  const handleQuickReplace = useCallback((category: string) => {
    setToastMessage(`Quick Replace for category "${category}" activated.`);
    setSelectedCategories([category]);
  }, []);


  const handlePanelToggle = (panel: keyof PanelToggles) => {
    setGenerationSettings(gs => ({ ...gs, panelToggles: { ...gs.panelToggles, [panel]: !gs.panelToggles[panel] } }));
  };

  const handleGenerate = useCallback(async () => {
    if (isLoading || !hasPendingStackChanges || !modelImageUrl) return;

    setIsLoading(true);
    setError(null);

    try {
      const resolvedBaseImage = await resolveImageUrl(modelImageUrl);
      const visibleGarmentLayers = outfitStack.filter(l => l.isVisible && l.garment);

      if (visibleGarmentLayers.length === 0) {
        handleStartOver();
        return;
      }

      let currentImageUrl = resolvedBaseImage;

      for (let i = 0; i < visibleGarmentLayers.length; i++) {
        const layer = visibleGarmentLayers[i];
        setLoadingMessage(`Applying layer ${i + 1} of ${visibleGarmentLayers.length}: ${layer.garment!.name}`);
        const garmentFile = await urlToFile(layer.garment!.url, layer.garment!.name);
        currentImageUrl = await generateVirtualTryOnImage(currentImageUrl, garmentFile, generationSettings);
      }

      // Upload to Firebase Storage if user is logged in and result is base64
      let finalImageUrl = currentImageUrl;
      if (currentUser && isBase64Url(currentImageUrl)) {
        try {
          finalImageUrl = await uploadBase64Image(
            currentImageUrl,
            currentUser.uid,
            'tryons',
            `tryon_${Date.now()}.jpg`,
            currentProjectId || undefined
          );
          console.log('Try-on image uploaded to Firebase Storage:', finalImageUrl);
        } catch (error) {
          console.error('Failed to upload try-on image to Firebase Storage, using base64:', error);
          // Fallback to base64 if upload fails
        }
      }

      const newHistoryItem: HistoryItem = {
        id: `hist-${Date.now()}`,
        parentId: currentHistoryItemId,
        imageUrl: finalImageUrl,
        prompt: "Applied " + visibleGarmentLayers.map(l => l.garment!.name).join(', '),
        settings: deepCopy(generationSettings),
        modelName: "gemini-2.5-flash-image",
        isStarred: false,
        type: 'try-on',
        baseModelId: selectedStylingModel!.baseModelId,
      };

      setGeneratedModelHistory(prev => [...prev, newHistoryItem]);
      setCurrentHistoryItemId(newHistoryItem.id);
      setRedoStack([]);
      setHasPendingStackChanges(false);

    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Image generation failed'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [isLoading, hasPendingStackChanges, modelImageUrl, outfitStack, generationSettings, currentHistoryItemId]);

  const handleStartOver = useCallback(() => {
    if (!modelImageUrl) return;
    const baseLayer: OutfitLayer = { id: 'base-model', garment: null, isVisible: true };
    const rootItem = generatedModelHistory.find(item => !item.parentId);
    setOutfitStack([baseLayer]);
    if (rootItem) {
      setCurrentHistoryItemId(rootItem.id);
    }
    setHasPendingStackChanges(false);
    setSelectedLayerId(null);
  }, [modelImageUrl, generatedModelHistory]);

  const handleDownloadImage = useCallback(() => {
    if (!displayImageUrl) return;
    const link = document.createElement('a');
    link.href = displayImageUrl;
    link.download = `formlab-image-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [displayImageUrl]);

  const handleCopySettings = useCallback(() => {
    try {
      navigator.clipboard.writeText(JSON.stringify(generationSettings, null, 2));
      setToastMessage('Creative settings copied to clipboard!');
    } catch (err) {
      setToastMessage('Failed to copy settings.');
      console.error('Failed to copy settings to clipboard:', err);
    }
  }, [generationSettings]);

  const handleUseAsVideoReference = useCallback(() => {
    if (!displayImageUrl) return;
    onNavigateToVideoCreator(displayImageUrl);
  }, [displayImageUrl, onNavigateToVideoCreator]);

  const handleLeftDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setLeftPanelWidth(Math.max(280, Math.min(newWidth, 500)));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [leftPanelWidth]);

  const handleRightDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightPanelWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth - (moveEvent.clientX - startX);
      setRightPanelWidth(Math.max(280, Math.min(newWidth, 450)));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [rightPanelWidth]);

  const handlePoseSelect = useCallback((poseIndex: number) => {
    setCurrentPoseIndex(poseIndex);
  }, []);

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
    setGenerationSettings(item.settings);
    // In Image Studio, we don't restore the outfit stack from history to allow applying new outfits to old images
    setHasPendingStackChanges(true); // Selecting a new base image means changes are pending
  }, [generatedModelHistory, currentHistoryItem]);

  const handleUndo = () => {
    if (canUndo && currentHistoryItem) restoreHistoryItem(currentHistoryItem.parentId!, 'undo');
  }
  const handleRedo = () => {
    if (canRedo) restoreHistoryItem(redoStack[0], 'redo');
  }

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

  const handleAddLight = (role: LightRole) => {
    const newLight: Light = {
      id: `${role}-${Date.now()}`,
      type: 'area',
      role,
      position: { angle: 0, distance: 0.7, elevation: 0 },
      power: 0, size: 0.5, kelvin: 5600, tint: 0, saturation: 1
    };
    setGenerationSettings(prev => ({ ...prev, lightingRig: { ...prev.lightingRig, lights: [...prev.lightingRig.lights, newLight] } }));
    setSelectedLightId(newLight.id);
  };

  const updateLight = (id: string, updates: Partial<Light> | { position: Partial<Light['position']> }) => {
    setGenerationSettings(prev => ({ ...prev, lightingRig: { ...prev.lightingRig, lights: prev.lightingRig.lights.map(l => { if (l.id === id) { if ('position' in updates) { return { ...l, position: { ...l.position, ...updates.position } }; } return { ...l, ...updates }; } return l; }) } }));
  };

  const removeLight = (id: string) => {
    setGenerationSettings(prev => ({ ...prev, lightingRig: { ...prev.lightingRig, lights: prev.lightingRig.lights.filter(l => l.id !== id) } }));
    if (selectedLightId === id) setSelectedLightId(null);
  };

  // --- Wardrobe Library Handlers ---
  const handleSelectProduct = (item: WardrobeItem) => {
    setSelectedProduct(item);
  }

  const handleApplyFromFlyout = (item: WardrobeItem) => {
    handleAddItemToStack(item);
    setSelectedProduct(null); // Close flyout on apply
  }

  const handleSelectForReplacement = useCallback((item: WardrobeItem) => {
    if (!selectedLayerId) {
      setToastMessage("Select a layer to replace first.");
      return;
    }
    const newLayer: OutfitLayer = {
      id: `layer-${Date.now()}`,
      garment: item,
      isVisible: true,
    };
    setOutfitStack(prev => prev.map(l => l.id === selectedLayerId ? newLayer : l));
    setHasPendingStackChanges(true);
    setSelectedProduct(null); // close flyout
  }, [selectedLayerId]);

  const handleCategoryToggle = (category: string) => {
    const catLower = category.toLowerCase();
    const isSpecialCategory = catLower === 'favorites' || catLower === 'recently used';
    setSelectedCategories(prev => {
      const isSelected = prev.includes(catLower);
      if (isSelected) return prev.filter(c => c !== catLower);
      if (isSpecialCategory) return [catLower];
      const normalCategories = prev.filter(c => c !== 'favorites' && c !== 'recently used');
      return [...normalCategories, catLower];
    });
  }

  const handleToggleFavorite = (itemId: string) => {
    setFavorites(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  };

  const handleAddProduct = useCallback(async (productData: Omit<WardrobeItem, 'id' | 'url'> & { file: File }) => {
    const { file, ...rest } = productData;
    const productId = `item-${Date.now()}`;

    // Create a temporary blob URL for immediate preview
    const tempBlobUrl = URL.createObjectURL(file);

    // Upload to Firebase Storage if user is logged in
    let productUrl = tempBlobUrl;
    if (currentUser) {
      try {
        productUrl = await uploadFile(file, currentUser.uid, 'wardrobe');
        console.log('Wardrobe item uploaded to Firebase Storage:', productUrl);

        // Revoke the temporary blob URL to free memory
        URL.revokeObjectURL(tempBlobUrl);
      } catch (error) {
        console.error('Failed to upload wardrobe item to Firebase Storage, using blob URL:', error);
        // Keep blob URL if upload fails (tempBlobUrl is already assigned to productUrl)
      }
    }

    const newProduct: WardrobeItem = { id: productId, url: productUrl, ...rest };
    setWardrobe(prev => [newProduct, ...prev]);
    setToastMessage(`'${newProduct.name}' added to library.`);
  }, [currentUser]);

  const handleCreateCategory = useCallback((name: string) => {
    if (name && name.trim()) {
      const trimmedName = name.trim();
      if (!categories.find(c => c.toLowerCase() === trimmedName.toLowerCase())) {
        setCategories(prev => [...prev, trimmedName]);
        setToastMessage(`Category "${trimmedName}" created.`);
      } else { setToastMessage(`Category "${trimmedName}" already exists.`); }
    }
  }, [categories]);

  const handleRenameCategory = useCallback((oldName: string, newName: string) => {
    if (!newName || !newName.trim() || oldName.toLowerCase() === newName.toLowerCase() || oldName === 'Uncategorized') return;
    const trimmedNewName = newName.trim();
    if (categories.find(c => c.toLowerCase() === trimmedNewName.toLowerCase())) {
      setToastMessage(`Category "${trimmedNewName}" already exists.`);
      return;
    }
    setCategories(prev => prev.map(c => (c === oldName ? trimmedNewName : c)));
    setWardrobe(prev => prev.map(item => (item.category === oldName ? { ...item, category: trimmedNewName } : item)));
    setToastMessage(`Renamed "${oldName}" to "${trimmedNewName}".`);
  }, [categories]);

  const handleDeleteCategoryRequest = (category: string) => {
    if (category === 'Uncategorized') return;
    setDeleteConfirmation({ type: 'category', item: category });
  };

  const handleDeleteProductRequest = (product: WardrobeItem) => {
    setDeleteConfirmation({ type: 'product', item: product });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmation) return;
    if (deleteConfirmation.type === 'category') {
      const categoryToDelete = deleteConfirmation.item as string;
      setWardrobe(prev => prev.map(item => item.category.toLowerCase() === categoryToDelete.toLowerCase() ? { ...item, category: 'Uncategorized' } : item));
      setCategories(prev => prev.filter(c => c.toLowerCase() !== categoryToDelete.toLowerCase()));
      setSelectedCategories(prev => prev.filter(c => c.toLowerCase() !== categoryToDelete.toLowerCase()));
      setToastMessage(`Category "${categoryToDelete}" deleted. Items moved to "Uncategorized".`);
    } else {
      const productToDelete = deleteConfirmation.item as WardrobeItem;
      setWardrobe(prev => prev.filter(item => item.id !== productToDelete.id));
      setToastMessage(`Product "${productToDelete.name}" deleted.`);
    }
    setDeleteConfirmation(null);
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setActiveFilters(prev => {
      const currentValues = prev[filterType] || [];
      const newValues = currentValues.includes(value) ? currentValues.filter(v => v !== value) : [...currentValues, value];
      if (newValues.length === 0) { const { [filterType]: _, ...rest } = prev; return rest; }
      return { ...prev, [filterType]: newValues };
    });
  };

  const handleClearFilters = () => { setActiveFilters({}); };

  const lastAppliedGarment = outfitStack.length > 1 ? outfitStack[outfitStack.length - 1].garment : null;

  const handleEnhancePosePrompt = useCallback(async () => {
    if (!displayImageUrl) return;
    setIsEnhancingPrompt(true);
    try {
      const enhancedText = await enhanceRevisionPrompt(displayImageUrl, revisionPrompt, 'A full body shot of a fashion model');
      setRevisionPrompt(enhancedText);
      setToastMessage(revisionPrompt.trim() ? "Prompt enhanced!" : "Suggestion provided!");
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Failed to enhance prompt"));
    } finally {
      setIsEnhancingPrompt(false);
    }
  }, [displayImageUrl, revisionPrompt]);

  const handlePromptRevision = useCallback(async () => {
    if (!displayImageUrl || !revisionPrompt.trim()) {
      setToastMessage("Please enter a revision prompt.");
      return;
    }
    setIsLoading(true);
    setLoadingMessage('Applying text revision...');
    setError(null);
    try {
      const result = await reviseGeneratedImage(displayImageUrl, revisionPrompt, generationSettings, 'gemini-2.5-flash-image');

      // Upload to Firebase Storage if user is logged in and result is base64
      let finalImageUrl = result;
      if (currentUser && isBase64Url(result)) {
        try {
          finalImageUrl = await uploadBase64Image(
            result,
            currentUser.uid,
            'tryons',
            `revision_${Date.now()}.jpg`,
            currentProjectId || undefined
          );
          console.log('Revision image uploaded to Firebase Storage:', finalImageUrl);
        } catch (error) {
          console.error('Failed to upload revision to Firebase Storage, using base64:', error);
          // Fallback to base64 if upload fails
        }
      }

      const newHistoryItem: HistoryItem = {
        id: `hist-${Date.now()}`,
        parentId: currentHistoryItemId,
        imageUrl: finalImageUrl,
        prompt: revisionPrompt,
        settings: deepCopy(generationSettings),
        modelName: "gemini-2.5-flash-image",
        isStarred: false,
        type: 'try-on-revision',
        baseModelId: selectedStylingModel!.baseModelId,
      };

      setGeneratedModelHistory(prev => [...prev, newHistoryItem]);
      setCurrentHistoryItemId(newHistoryItem.id);
      setRedoStack([]);
      setRevisionPrompt('');
      setToastMessage("Revision applied successfully!");

    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to apply revision'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, revisionPrompt, generationSettings, currentHistoryItemId]);

  if (!selectedStylingModel) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#1a1a1a] text-center p-4">
        <h2 className="text-xl font-sans font-semibold text-white mb-3">No Model Selected</h2>
        <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto">
          Select a model in Create Model and click "Proceed to Styling" to begin.
        </p>
        <button onClick={onNavigateToCreateModel} className="mt-8 px-6 py-2 text-xs font-medium text-white bg-[#318CE7] rounded-lg hover:bg-[#2b7bc0] transition-all shadow-lg shadow-blue-500/20">
          Go to Create Model
        </button>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <motion.div
        key="main-app"
        className="relative flex flex-col h-full bg-[#EEEEEE] dark:bg-[#1a1a1a] overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="h-14 border-b border-white/5 bg-[#1a1a1a]/80 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0 z-20">
          <h1 className="text-[15px] font-medium text-white/90">Image Studio</h1>
          <div className="flex items-center gap-3">
            <button onClick={handleStartOver} className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors">Start Over</button>
            <button
              onClick={() => {
                if (displayImageUrl) {
                  navigator.clipboard.writeText(window.location.href);
                  setToastMessage('Link copied to clipboard!');
                }
              }}
              disabled={!displayImageUrl}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-200 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Share image"
            >
              <Share2Icon className="w-4 h-4" />
            </button>
            <button onClick={handleUseAsVideoReference} disabled={!displayImageUrl} className="px-4 py-1.5 bg-white hover:bg-gray-100 text-black text-[13px] font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              Proceed to Video Generation <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-row flex-grow min-h-0">
          {!isMobileView && (
            <>
              <div style={{ width: `${leftPanelWidth}px` }} className="flex-shrink-0 h-full relative">
                <ModelGalleryPanel
                  selectedStylingModel={selectedStylingModel}
                  onNavigateToCreateModel={onNavigateToCreateModel}
                  isLoading={isLoading}
                  generationSettings={generationSettings}
                  onSettingsChange={setGenerationSettings}
                  openSections={openSections}
                  onToggleSection={(section) => setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))}
                  onPanelToggle={handlePanelToggle}
                  isGenerating={isLoading}
                  selectedLightId={selectedLightId}
                  onSelectLightId={setSelectedLightId}
                  onAddLight={handleAddLight}
                  onUpdateLight={updateLight}
                  onRemoveLight={removeLight}
                  wardrobe={wardrobe}
                  onWardrobeItemSelect={handleSelectProduct}
                  searchQuery={librarySearchQuery}
                  onSearchChange={setLibrarySearchQuery}
                  selectedCategories={selectedCategories}
                  onCategoryToggle={handleCategoryToggle}
                  favorites={favorites}
                  onToggleFavorite={handleToggleFavorite}
                  recentlyUsed={recentlyUsed}
                  filters={activeFilters}
                  onFilterChange={handleFilterChange}
                  onClearFilters={handleClearFilters}
                  onAddProduct={handleAddProduct}
                  categories={categories}
                  onCreateCategory={handleCreateCategory}
                  onRenameCategory={handleRenameCategory}
                  onDeleteCategory={handleDeleteCategoryRequest}
                  onDeleteProduct={handleDeleteProductRequest}
                  generationModels={generationModels}
                  selectedGenerationModel={selectedGenerationModel}
                  onSelectGenerationModel={setSelectedGenerationModel}
                  projectList={projectList}
                  currentProjectId={currentProjectId}
                  onProjectChange={onProjectChange}
                  onOpenProjectModal={onOpenProjectModal}
                  revisionPrompt={revisionPrompt}
                  onRevisionPromptChange={setRevisionPrompt}
                  onEnhanceRevisionPrompt={handleEnhancePosePrompt}
                  onApplyRevision={handlePromptRevision}
                  isEnhancingPrompt={isEnhancingPrompt}
                />
              </div>
              <ResizeHandle onMouseDown={handleLeftDrag} />
            </>
          )}

          <div className="flex-grow h-full flex flex-col items-center justify-center relative overflow-hidden bg-[#EEEEEE] dark:bg-[#1a1a1a]">
            <div className="w-full h-full flex flex-col">
              <div className="flex-grow relative min-h-0">
                <Canvas
                  displayImageUrl={displayImageUrl} onStartOver={handleStartOver} isLoading={isLoading}
                  loadingMessage={loadingMessage} onSelectPose={handlePoseSelect}
                  poseInstructions={POSE_INSTRUCTIONS} currentPoseIndex={currentPoseIndex} availablePoseKeys={[]}
                  aspectRatio={generationSettings.aspectRatio ?? '2:3'} onUndo={handleUndo} onRedo={handleRedo}
                  canUndo={canUndo} canRedo={canRedo} isStudioEmpty={!modelImageUrl}
                />
              </div>
              {generatedModelHistory.length > 0 && !isMobileView && (
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

          {!isMobileView && (
            <>
              <ResizeHandle onMouseDown={handleRightDrag} />
              <div style={{ width: `${rightPanelWidth}px` }} className="flex-shrink-0 h-full bg-white dark:bg-[#1a1a1a] border-l border-gray-200/60 dark:border-gray-700/60">
                <RightPanelContent
                  error={error}
                  outfitStack={outfitStack}
                  onMoveLayerUp={handleMoveLayerUp}
                  onMoveLayerDown={handleMoveLayerDown}
                  onToggleVisibility={handleToggleVisibility}
                  onRemoveLayer={handleRemoveLayer}
                  onSelectLayer={handleSelectLayer}
                  selectedLayerId={selectedLayerId}
                  onQuickReplace={handleQuickReplace}
                  modelImageUrl={modelImageUrl}
                  isLoading={isLoading}
                  onGenerate={handleGenerate}
                  hasPendingChanges={hasPendingChanges}
                  onDownloadImage={handleDownloadImage}
                  onUseAsVideoReference={handleUseAsVideoReference}
                  onCopySettings={handleCopySettings}
                />
              </div>
            </>
          )}
        </div>

        {isMobileView && (
          <RightPanelContent
            isSheet isSheetCollapsed={isSheetCollapsed} onToggleSheet={() => setIsSheetCollapsed(prev => !prev)}
            error={error} outfitStack={outfitStack} onMoveLayerUp={handleMoveLayerUp} onMoveLayerDown={handleMoveLayerDown}
            onToggleVisibility={handleToggleVisibility} onRemoveLayer={handleRemoveLayer}
            onSelectLayer={handleSelectLayer} selectedLayerId={selectedLayerId} onQuickReplace={handleQuickReplace}
            modelImageUrl={modelImageUrl}
            isLoading={isLoading}
            onGenerate={handleGenerate}
            hasPendingChanges={hasPendingChanges}
            onDownloadImage={handleDownloadImage}
            onUseAsVideoReference={handleUseAsVideoReference}
            onCopySettings={handleCopySettings}
          />
        )}
      </motion.div>

      <ProductDetailsFlyout
        item={selectedProduct} onClose={() => setSelectedProduct(null)}
        onApply={handleApplyFromFlyout} onReplace={handleSelectForReplacement}
        lastAppliedGarment={lastAppliedGarment} panelWidth={leftPanelWidth}
        isFavorite={selectedProduct ? favorites.includes(selectedProduct.id) : false}
        onToggleFavorite={handleToggleFavorite}
      />

      <ConfirmationModal
        isOpen={!!deleteConfirmation} onClose={() => setDeleteConfirmation(null)}
        onConfirm={handleConfirmDelete} title={`Delete ${deleteConfirmation?.type}`}
        message={deleteConfirmation?.type === 'category' ? `Are you sure you want to delete the "${deleteConfirmation.item}" category? All items within it will be moved to "Uncategorized".` : `Are you sure you want to delete this product? This action cannot be undone.`}
      />
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-10 right-10 bg-gray-900/95 backdrop-blur-sm text-gray-100 px-5 py-2.5 rounded-full shadow-lg z-[100] max-w-lg text-center" role="alert"
          >
            <p className="text-sm font-medium">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImageStudio;