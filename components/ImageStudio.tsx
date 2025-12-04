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
import {
  Share2Icon, ChevronRightIcon, UndoIcon, RedoIcon, ZapIcon, DownloadIcon,
  LayoutIcon, CameraIcon, SunIcon, LayersIcon, WandIcon, SlidersHorizontalIcon,
  Trash2Icon, PlusIcon, UserIcon, PenLineIcon, CubeIcon, RotateCcwIcon
} from './icons';
import WardrobeLibrary from './WardrobeLibrary';
import VersionHistoryPanel from './VersionHistoryPanel';
import ProductDetailsModal from './ProductDetailsModal';
import { Model, WardrobeItem, OutfitLayer, GenerationSettings, HistoryItem, WardrobeCategory, BrandStyle, GarmentAnalysis, Light, LightRole, SceneAtmosphere, ImageProcessingSettings, ShutterSettings, NoiseAndGrainSettings, StudioEnvironment, ShadowSculptingSettings, FloorSettings, AmbientBounceSettings, AmbientOcclusionSettings, PanelToggles, LightingRig, ApertureSettings, CameraPositionSettings, FocusPlaneSettings, Project, User, SelectedStylingModel } from '../types';
import {
  generateVirtualTryOnImage,
  generatePoseVariation,
  regenerateFrame,
  analyzeGarment,
  analyzeGarmentDetailed,
  generateModelImage,
  reviseGeneratedImage,
  enhanceRevisionPrompt
} from '../services/geminiService';
import { getFriendlyErrorMessage } from '../lib/utils';
import { uploadFile, uploadBase64Image, isBase64Url, deleteFile, isStorageUrl } from '../services/storageService';
import { convertToSquare } from '../lib/imageProcessing';
import { loadPredefinedWardrobe, getGlobalWardrobeItems, saveGlobalWardrobeItem, deleteGlobalWardrobeItem, subscribeToGlobalWardrobe, checkWardrobeItemExists } from '../services/firestoreService';
import { deleteHistoryItemFromFirestore, subscribeToStylingHistory, loadHistoryItems } from '../services/firestoreSync';
import { createUpscaleRequest, listenToUpscaleRequest, UpscaleRequest } from '../services/firestoreService';
import { auth } from '../services/firebase';
import { loadUnifiedHistory, saveStylingHistory } from '../services/dbService';
import { getCurrentUserId } from '../services/authService';


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

// Helper to generate cache key from garment URL
const getCacheKey = (url: string): string => {
  return url.split('/').pop() || url; // Use filename or full URL
};

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
  useEnhancedTryOn: true, // Enhanced garment detail preservation enabled by default
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
];

/**
 * Extract background color from generation settings for image padding
 * This ensures the padding color matches the studio environment background
 */
const getBackgroundColorFromSettings = (settings: GenerationSettings): string => {
  const env = settings.studioEnvironment;

  switch (env.type) {
    case 'high-key':
      return '#FFFFFF';
    case 'mid-gray':
      return '#808080';
    case 'colored-seamless':
      return env.color || '#FFFFFF';
    case 'gradient':
      return env.color1 || '#FFFFFF';
    case 'textured':
      return '#C0C0C0';
    case 'custom':
      return '#FFFFFF';
    case 'transparent':
      return 'transparent';
    default:
      return '#FFFFFF';
  }
};

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
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<WardrobeItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<WardrobeItem | null>(null);

  // Enhanced Try-On: Garment Analysis Cache
  const [garmentAnalysisCache, setGarmentAnalysisCache] = useState<Map<string, GarmentAnalysis>>(new Map());

  // NEW: Revision Prompt State
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [isUpscaleMenuOpen, setIsUpscaleMenuOpen] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const upscaleMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Canvas Zoom State
  const [zoom, setZoom] = useState(1);

  // Track initial settings to detect changes
  const [initialSettings, setInitialSettings] = useState<GenerationSettings>(initialGenerationSettings);

  // Calculate current history item and display URL (must be before handlers that use it)
  const currentHistoryItem = useMemo(() => generatedModelHistory.find(item => item.id === currentHistoryItemId), [generatedModelHistory, currentHistoryItemId]);
  const displayImageUrl = useMemo(() => currentHistoryItem?.imageUrl || modelImageUrl, [currentHistoryItem, modelImageUrl]);

  // Detect settings changes by deep comparison
  const hasSettingsChanged = useMemo(() => {
    return JSON.stringify(generationSettings) !== JSON.stringify(initialSettings);
  }, [generationSettings, initialSettings]);

  // Derive the model to display in "Your Selected Model" and use for Outfit Stack base
  const displayModel: SelectedStylingModel | null = useMemo(() => {
    if (!selectedStylingModel) return null;
    if (currentHistoryItem) {
      // Use history item name, or generate a fallback like "Version X" if missing
      // We avoid falling back to selectedStylingModel.name to prevent confusion
      const versionNumber = currentHistoryItem.id.split('-')[1] || 'Unknown';
      const fallbackName = `Version ${versionNumber.slice(-4)}`;

      return {
        url: currentHistoryItem.imageUrl,
        name: currentHistoryItem.name || fallbackName,
        historyItemId: currentHistoryItem.id,
        baseModelId: selectedStylingModel.baseModelId
      };
    }
    return selectedStylingModel;
  }, [selectedStylingModel, currentHistoryItem]);

  // Detect outfit changes (more than just base model)
  const hasOutfitChanged = useMemo(() => {
    return hasPendingStackChanges;
  }, [hasPendingStackChanges]);

  // Dynamic button label logic
  const applyButtonLabel = useMemo(() => {
    const hasRevision = revisionPrompt.trim().length > 0;
    const hasSettings = hasSettingsChanged;
    const hasOutfit = hasOutfitChanged;

    if (hasRevision && hasSettings && hasOutfit) return 'Apply Revision + Settings + Outfit';
    if (hasRevision && hasSettings) return 'Apply Revision + Settings';
    if (hasRevision && hasOutfit) return 'Apply Revision + Outfit';
    if (hasRevision) return 'Apply Revision';
    if (hasSettings && hasOutfit) return 'Apply Settings + Outfit';
    if (hasSettings) return 'Apply Settings';
    if (hasOutfit) return 'Apply Outfit';
    return 'Apply Settings';
  }, [revisionPrompt, hasSettingsChanged, hasOutfitChanged]);

  // Button should be enabled if any changes exist
  const canApply = useMemo(() => {
    return revisionPrompt.trim().length > 0 || hasSettingsChanged || hasOutfitChanged;
  }, [revisionPrompt, hasSettingsChanged, hasOutfitChanged]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (upscaleMenuRef.current && !upscaleMenuRef.current.contains(event.target as Node)) {
        setIsUpscaleMenuOpen(false);
      }
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpscale = useCallback(async (resolution: '2k' | '4k') => {
    if (!displayImageUrl || !currentUser || !currentProjectId) return;
    setIsUpscaleMenuOpen(false);
    setIsLoading(true);
    setLoadingMessage(`Upscaling to ${resolution.toUpperCase()}...`);

    try {
      // Create the upscale request in Firestore
      const requestId = await createUpscaleRequest(currentUser.uid, displayImageUrl, resolution);
      console.log('Upscale request created:', requestId);

      // Listen for updates
      const unsubscribe = listenToUpscaleRequest(requestId, async (request: UpscaleRequest) => {
        if (request.status === 'completed' && request.outputUrl) {
          // Upscale successful!
          unsubscribe(); // Stop listening

          // Add to history
          const garmentIds = outfitStack.filter(l => l.isVisible && l.garment).map(l => l.garment!.id);
          const newHistoryItem: HistoryItem = {
            id: `hist-${Date.now()}`,
            parentId: currentHistoryItemId,
            imageUrl: request.outputUrl,
            prompt: `Upscaled to ${resolution.toUpperCase()}`,
            settings: deepCopy(generationSettings),
            modelName: "Nano Banana",
            isStarred: false,
            type: 'try-on-revision', // Treat as a revision
            baseModelId: selectedStylingModel!.baseModelId,
            outfitGarmentIds: garmentIds,
          };

          setGeneratedModelHistory(prev => [...prev, newHistoryItem]);
          setCurrentHistoryItemId(newHistoryItem.id);
          setRedoStack([]);

          setIsLoading(false);
          setLoadingMessage('');
          setToastMessage(`Image upscaled to ${resolution.toUpperCase()}!`);
        } else if (request.status === 'failed') {
          unsubscribe();
          setIsLoading(false);
          setLoadingMessage('');
          setError(request.error || 'Upscale failed');
        }
      });

    } catch (err) {
      setIsLoading(false);
      setLoadingMessage('');
      setError(getFriendlyErrorMessage(err, "Failed to upscale image"));
    }
  }, [displayImageUrl, currentUser, currentProjectId, currentHistoryItemId, generationSettings, selectedStylingModel]);

  const handleDownload = useCallback(async (format: 'png' | 'jpg' | 'webp') => {
    if (!displayImageUrl) return;
    setIsDownloadMenuOpen(false);

    try {
      // Create a temporary image to draw on canvas
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = displayImageUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.drawImage(img, 0, 0);

      const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
      const quality = format === 'png' ? undefined : 1.0;

      canvas.toBlob((blob) => {
        if (!blob) {
          setToastMessage('Failed to create download file');
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `formlab-studio-${Date.now()}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setToastMessage(`Image downloaded as ${format.toUpperCase()}!`);
      }, mimeType, quality);

    } catch (err) {
      console.error('Download error:', err);
      setToastMessage('Failed to download image.');
    }
  }, [displayImageUrl]);

  const handleSelectiveEnhance = (type: string) => {
    setIsUpscaleMenuOpen(false);
    setToastMessage(`Enhancing ${type}... (Coming Soon)`);
  };

  // Notify parent when categories change
  useEffect(() => {
    if (onCategoriesChange) {
      onCategoriesChange(categories);
    }
  }, [categories, onCategoriesChange]);

  const canUndo = useMemo(() => !!currentHistoryItem?.parentId, [currentHistoryItem]);
  const canRedo = redoStack.length > 0;
  const hasPendingChanges = hasPendingStackChanges;

  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);

  // --- Initialize State ---
  useEffect(() => {
    const initializeImageStudio = async () => {
      if (selectedStylingModel && currentProjectId) {
        setModelImageUrl(selectedStylingModel.url);

        // Always initialize outfit stack with base layer
        const baseLayer: OutfitLayer = { id: 'base-model', garment: null, isVisible: true };
        setOutfitStack([baseLayer]);

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
            setInitialSettings(selectedItem.settings);
          } else {
            // Fallback: Find the last try-on item, or the last item overall
            const lastTryonItem = [...unifiedHistory]
              .reverse()
              .find(item => item.type === 'try-on' || item.type === 'try-on-revision');

            if (lastTryonItem) {
              setCurrentHistoryItemId(lastTryonItem.id);
              setGenerationSettings(lastTryonItem.settings);
              setInitialSettings(lastTryonItem.settings);
            } else {
              // No try-on history yet, use the last item (likely a model-generation or model-revision)
              const lastItem = unifiedHistory[unifiedHistory.length - 1];
              setCurrentHistoryItemId(lastItem.id);
              setGenerationSettings(lastItem.settings);
              setInitialSettings(lastItem.settings);
            }
          }
        }

        // ROBUST FETCH: Explicitly fetch styling history from Firestore for this model
        // This ensures we have the data even if loadProjectFromFirestore missed it (e.g. missing stylingModelIds)
        try {
          console.log('[ImageStudio] Explicitly fetching styling history for:', selectedStylingModel.baseModelId);
          const directStylingHistory = await loadHistoryItems(currentProjectId, selectedStylingModel.baseModelId);

          if (directStylingHistory && directStylingHistory.length > 0) {
            console.log(`[ImageStudio] Fetched ${directStylingHistory.length} styling items directly`);

            setGeneratedModelHistory(prev => {
              // Merge with existing history (deduplicate by ID)
              const existingIds = new Set(prev.map(item => item.id));
              const newItems = directStylingHistory.filter(item => !existingIds.has(item.id));

              if (newItems.length === 0) return prev;

              const merged = [...prev, ...newItems].sort((a, b) => {
                const aTime = parseInt(a.id.split('-').pop() || '0');
                const bTime = parseInt(b.id.split('-').pop() || '0');
                return aTime - bTime;
              });

              return merged;
            });

            // If we didn't have a current item before (or it was a fallback), try to find a better one now
            if (!currentHistoryItemId || currentHistoryItemId.startsWith('hist-')) {
              const lastTryonItem = directStylingHistory[directStylingHistory.length - 1];
              if (lastTryonItem) {
                // Only switch if we don't have a specific user selection
                // For now, we'll keep the logic simple and not auto-switch to avoid jumping
                // unless we are in the "initial" state
              }
            }
          }
        } catch (err) {
          console.warn('[ImageStudio] Failed to directly fetch styling history:', err);
        }

        if (generatedModelHistory.length === 0 && (!unifiedHistory || unifiedHistory.length === 0)) {
          // No history exists yet - Create new root history item for this model
          // This happens when first entering Image Studio from a newly created model
          const rootHistoryItem: HistoryItem = {
            id: `hist-${Date.now()}`,
            parentId: null,
            imageUrl: selectedStylingModel.url,
            prompt: "Initial Model",
            settings: initialGenerationSettings,
            modelName: "Nano Banana",
            isStarred: true,
            name: selectedStylingModel.name,
            type: 'try-on',
            baseModelId: selectedStylingModel.baseModelId,
            outfitGarmentIds: [], // Base model has no garments
          };
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

  // --- Real-time Styling History Sync (Enterprise Sync) ---
  useEffect(() => {
    if (!selectedStylingModel || !currentProjectId) return;

    console.log('[ImageStudio] Subscribing to styling history for baseModelId:', selectedStylingModel.baseModelId);

    // Subscribe to real-time updates from Firestore
    const unsubscribe = subscribeToStylingHistory(
      currentProjectId,
      selectedStylingModel.baseModelId,
      (stylingHistoryItems) => {
        console.log(`[ImageStudio] Received ${stylingHistoryItems.length} styling history items from Firestore`);

        // Merge with existing Create Model history (from generatedModelHistory)
        // Only update if we received styling items (try-on, try-on-revision)
        if (stylingHistoryItems.length > 0) {
          setGeneratedModelHistory(prev => {
            // Get Create Model history items (model-generation, model-revision)
            const createModelItems = prev.filter(item =>
              item.type === 'model-generation' || item.type === 'model-revision'
            );

            // Merge with styling history and sort by timestamp
            const merged = [...createModelItems, ...stylingHistoryItems].sort((a, b) => {
              const aTime = parseInt(a.id.split('-').pop() || '0');
              const bTime = parseInt(b.id.split('-').pop() || '0');
              return aTime - bTime;
            });

            console.log(`[ImageStudio] Updated history: ${merged.length} total items`);
            return merged;
          });
        }
      }
    );

    return () => {
      console.log('[ImageStudio] Unsubscribing from styling history');
      unsubscribe();
    };
  }, [selectedStylingModel, currentProjectId]);

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

  // --- Global Wardrobe Loading (Enterprise Sync) ---
  // --- Local Storage Loading ---
  useEffect(() => {
    const savedCategories = localStorage.getItem('formlab-categories');
    if (savedCategories) setCategories(JSON.parse(savedCategories));
    const savedFavorites = localStorage.getItem('formlab-favorites');
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    const savedRecentlyUsed = localStorage.getItem('formlab-recently-used');
    if (savedRecentlyUsed) setRecentlyUsed(JSON.parse(savedRecentlyUsed));
  }, []);

  // --- Global Wardrobe Subscription (Enterprise Sync) ---
  useEffect(() => {
    const userId = getCurrentUserId();
    if (!userId || !currentProjectId) {
      // Fallback to localStorage if not logged in (legacy support)
      const savedWardrobe = localStorage.getItem('formlab-wardrobe');
      if (savedWardrobe) {
        const userWardrobe = JSON.parse(savedWardrobe);
        userWardrobe.forEach((item: any) => { if (!item.source) item.source = 'user'; });

        // Load pre-defined wardrobe
        loadPredefinedWardrobe().then(predefined => {
          setWardrobe([...userWardrobe, ...predefined]);
        }).catch(err => {
          console.error('Failed to load pre-defined wardrobe:', err);
          setWardrobe(userWardrobe);
        });
      } else {
        loadPredefinedWardrobe().then(predefined => {
          setWardrobe(predefined);
        });
      }
      return;
    }

    console.log('Subscribing to global wardrobe for user:', userId, 'project:', currentProjectId);

    // Subscribe to user wardrobe items
    const unsubscribe = subscribeToGlobalWardrobe(userId, currentProjectId, async (globalItems) => {
      const userWardrobe = globalItems.map(item => ({
        id: item.id,
        url: item.url,
        name: item.name,
        category: item.category as WardrobeCategory,
        source: 'user',
        createdAt: new Date(item.createdAt).getTime(),
        // Default values for required WardrobeItem fields
        sku: '',
        subcategory: 'Custom',
        color: 'N/A',
        fabric: 'N/A',
        print: 'N/A',
        fit: 'relaxed',
        season: 'N/A',
        gender: 'unisex',
        priceTier: 'basic',
        tags: { styling: [], campaign: [] }
      } as WardrobeItem));

      try {
        const predefinedWardrobe = await loadPredefinedWardrobe();
        setWardrobe([...userWardrobe, ...predefinedWardrobe]);
      } catch (error) {
        console.error('Failed to load pre-defined wardrobe:', error);
        setWardrobe(userWardrobe);
      }
    });

    return () => unsubscribe();
  }, [currentUser, currentProjectId]);

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

        // Enhanced Try-On: Use cached analysis if available, or analyze garment
        let garmentAnalysis: GarmentAnalysis | undefined;
        if (generationSettings.useEnhancedTryOn !== false) {
          const cacheKey = getCacheKey(layer.garment!.url);
          garmentAnalysis = garmentAnalysisCache.get(cacheKey);

          if (!garmentAnalysis) {
            setLoadingMessage(`Analyzing garment details: ${layer.garment!.name}...`);
            garmentAnalysis = await analyzeGarmentDetailed(garmentFile);
            // Cache for reuse
            setGarmentAnalysisCache(prev => new Map(prev).set(cacheKey, garmentAnalysis!));
            console.log(`✓ Analyzed and cached: ${layer.garment!.name}`);
          } else {
            console.log(`✓ Using cached analysis: ${layer.garment!.name}`);
          }
          setLoadingMessage(`Applying layer ${i + 1} of ${visibleGarmentLayers.length}: ${layer.garment!.name}`);
        }

        currentImageUrl = await generateVirtualTryOnImage(currentImageUrl, garmentFile, generationSettings, garmentAnalysis);
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

      const garmentIds = visibleGarmentLayers.map(l => l.garment!.id);
      const newHistoryItem: HistoryItem = {
        id: `hist-${Date.now()}`,
        parentId: currentHistoryItemId,
        imageUrl: finalImageUrl,
        prompt: "Applied " + visibleGarmentLayers.map(l => l.garment!.name).join(', '),
        settings: deepCopy(generationSettings),
        modelName: "Nano Banana",
        isStarred: false,
        type: 'try-on',
        baseModelId: selectedStylingModel!.baseModelId,
        outfitGarmentIds: garmentIds,
      };
      console.log('[ImageStudio] Saving outfit stack to history:', outfitStack);
      console.log('[ImageStudio] Saving garment IDs:', garmentIds);

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

    // Restore outfit stack from garment IDs
    console.log('[ImageStudio] Restoring history item:', id, 'outfitGarmentIds:', item.outfitGarmentIds);
    if (item.outfitGarmentIds && item.outfitGarmentIds.length > 0) {
      // Reconstruct outfit stack from garment IDs by finding garments in wardrobe
      const reconstructedStack: OutfitLayer[] = [
        { id: 'base-model', garment: null, isVisible: true },
      ];

      item.outfitGarmentIds.forEach((garmentId, index) => {
        const garment = wardrobe.find(g => g.id === garmentId);
        if (garment) {
          reconstructedStack.push({
            id: `layer-${Date.now()}-${index}`,
            garment: garment,
            isVisible: true,
          });
        } else {
          console.warn('[ImageStudio] Garment not found in wardrobe:', garmentId);
        }
      });

      console.log('[ImageStudio] Reconstructed outfit stack:', reconstructedStack);
      setOutfitStack(reconstructedStack);
    } else {
      console.log('[ImageStudio] No outfit in history, resetting to base');
      const baseLayer: OutfitLayer = { id: 'base-model', garment: null, isVisible: true };
      setOutfitStack([baseLayer]);
    }

    setHasPendingStackChanges(false);
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

  const handleDeleteVersion = async (id: string) => {
    const itemToDelete = generatedModelHistory.find(i => i.id === id);
    if (!itemToDelete) return;

    try {
      // 1. Delete from Firebase Storage
      if (itemToDelete.imageUrl && isStorageUrl(itemToDelete.imageUrl)) {
        try {
          await deleteFile(itemToDelete.imageUrl);
          console.log('[ImageStudio] Deleted storage file for:', id);
        } catch (error) {
          console.warn('[ImageStudio] Storage deletion failed:', error);
          // Continue with other deletions even if storage fails
        }
      }

      // 2. Delete from Firestore
      const currentUser = auth.currentUser;
      if (currentUser && currentProjectId) {
        try {
          // Determine collection path based on item type
          let collectionPath: string;
          if (itemToDelete.type === 'try-on' || itemToDelete.type === 'try-on-revision') {
            // Styling history - need baseModelId
            const baseModelId = itemToDelete.baseModelId || selectedStylingModel?.baseModelId;
            if (baseModelId) {
              collectionPath = `stylingHistory/${baseModelId}`;
            } else {
              console.warn('[ImageStudio] Cannot delete from Firestore - no baseModelId for styling history item');
              collectionPath = 'generatedModelHistory'; // fallback
            }
          } else {
            // Create Model history
            collectionPath = 'generatedModelHistory';
          }

          await deleteHistoryItemFromFirestore(currentProjectId, collectionPath, id);
          console.log('[ImageStudio] Deleted from Firestore:', id);
        } catch (error) {
          console.warn('[ImageStudio] Firestore deletion failed:', error);
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

      console.log('[ImageStudio] Model version deleted successfully:', id);
    } catch (error) {
      console.error('[ImageStudio] Error deleting version:', error);
      // Still remove from UI even if backend deletion fails
      setGeneratedModelHistory(prev => prev.filter(i => i.id !== id));
    }
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

    // Generate unique ID using timestamp and random string
    const productId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Check for duplicates if user is logged in
    if (currentUser) {
      const exists = await checkWardrobeItemExists(currentUser.uid, productId);
      if (exists) {
        setToastMessage('This item already exists in your wardrobe.');
        return;
      }
    }

    // Convert to 1:1 aspect ratio with background matching studio environment (preserves original resolution)
    let processedFile = file;
    try {
      const backgroundColor = getBackgroundColorFromSettings(generationSettings);
      processedFile = await convertToSquare(file, backgroundColor);
      console.log(`✓ Converted wardrobe item to 1:1 aspect ratio with background: ${backgroundColor}`);
    } catch (error) {
      console.error('Failed to convert to square, using original:', error);
      // Fallback to original file if conversion fails
    }

    // Create a temporary blob URL for immediate preview
    const tempBlobUrl = URL.createObjectURL(processedFile);

    // Upload to Firebase Storage if user is logged in
    let productUrl = tempBlobUrl;
    if (currentUser) {
      try {
        productUrl = await uploadFile(processedFile, currentUser.uid, 'wardrobe');
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

    // Save to Global Library (Enterprise Sync) - ALWAYS include projectId
    if (currentUser && currentProjectId) {
      try {
        await saveGlobalWardrobeItem(currentUser.uid, {
          url: productUrl,
          name: newProduct.name,
          category: newProduct.category,
          projectId: currentProjectId // Always include projectId
        });
        console.log('[ImageStudio] Wardrobe item saved to Global Library with projectId:', currentProjectId);
      } catch (err) {
        console.error('Failed to save wardrobe item to Global Library:', err);
        setToastMessage('Item added locally but failed to sync. Please check your connection.');
      }
    } else if (currentUser && !currentProjectId) {
      console.warn('[ImageStudio] No projectId available, wardrobe item not saved to Firestore');
      setToastMessage('Item added locally. Please select a project to enable sync.');
    }
  }, [currentUser, currentProjectId, generationSettings]);

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

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;

    if (deleteConfirmation.type === 'category') {
      const categoryToDelete = deleteConfirmation.item as string;
      setWardrobe(prev => prev.map(item => item.category.toLowerCase() === categoryToDelete.toLowerCase() ? { ...item, category: 'Uncategorized' } : item));
      setCategories(prev => prev.filter(c => c.toLowerCase() !== categoryToDelete.toLowerCase()));
      setSelectedCategories(prev => prev.filter(c => c.toLowerCase() !== categoryToDelete.toLowerCase()));
      setToastMessage(`Category "${categoryToDelete}" deleted. Items moved to "Uncategorized".`);
    } else {
      // Product deletion
      const productToDelete = deleteConfirmation.item as WardrobeItem;

      try {
        console.log('[ImageStudio] Deleting wardrobe product:', productToDelete.id);

        // 1. Delete from Firebase Storage (user-uploaded only)
        if (productToDelete.source === 'user' && productToDelete.url && isStorageUrl(productToDelete.url)) {
          try {
            await deleteFile(productToDelete.url);
            console.log('[ImageStudio] Deleted storage file for product:', productToDelete.id);
          } catch (error) {
            console.warn('[ImageStudio] Storage deletion failed:', error);
            // Continue with other deletions
          }
        }

        // 2. Delete from global wardrobe in Firestore (if user-created and saved globally)
        const currentUser = auth.currentUser;
        if (currentUser && (productToDelete.source === 'user-global' || productToDelete.source === 'user')) {
          try {
            await deleteGlobalWardrobeItem(currentUser.uid, productToDelete.id);
            console.log('[ImageStudio] Deleted from global wardrobe:', productToDelete.id);
          } catch (error) {
            console.warn('[ImageStudio] Global wardrobe deletion failed:', error);
            // Continue with other deletions
          }
        }

        // 3. Update state (triggers IndexedDB save via useEffect)
        setWardrobe(prev => prev.filter(item => item.id !== productToDelete.id));
        setToastMessage(`Product "${productToDelete.name}" deleted.`);

        console.log('[ImageStudio] Product deletion completed:', productToDelete.id);
      } catch (error) {
        console.error('[ImageStudio] Error deleting product:', error);
        setToastMessage(`Failed to delete product "${productToDelete.name}". Please try again.`);
      }
    }

    setDeleteConfirmation(null);
  };


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
      // Construct dynamic outfit instruction based on stack
      let outfitInstruction: string | undefined;
      const visibleGarments = outfitStack.filter(l => l.isVisible && l.garment);

      if (visibleGarments.length > 0) {
        const garmentNames = visibleGarments.map(l => l.garment!.name).join(', ');
        outfitInstruction = `PRESERVE the current outfit (${garmentNames}) exactly as it appears in the image. Do NOT revert to base underwear. The model is ALREADY wearing the correct clothing.`;
      }

      const result = await reviseGeneratedImage(displayImageUrl, revisionPrompt, generationSettings, 'gemini-2.5-flash-image', outfitInstruction);

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

      const garmentIds = outfitStack.filter(l => l.isVisible && l.garment).map(l => l.garment!.id);
      const newHistoryItem: HistoryItem = {
        id: `hist-${Date.now()}`,
        parentId: currentHistoryItemId,
        imageUrl: finalImageUrl,
        prompt: revisionPrompt,
        settings: deepCopy(generationSettings),
        modelName: "Nano Banana",
        isStarred: false,
        type: 'try-on-revision',
        baseModelId: selectedStylingModel!.baseModelId,
        outfitGarmentIds: garmentIds,
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

  // Unified handler that intelligently applies changes based on what the user has modified
  const handleApplyChanges = useCallback(async () => {
    if (!displayImageUrl || isLoading) return;

    const hasRevision = revisionPrompt.trim().length > 0;
    const hasSettings = hasSettingsChanged;
    const hasOutfit = hasOutfitChanged;

    // Must have at least one type of change
    if (!hasRevision && !hasSettings && !hasOutfit) {
      setToastMessage("No changes to apply.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let currentImageUrl = displayImageUrl;
      let promptForHistory = '';

      // Step 1: Apply outfit changes first if they exist
      if (hasOutfit) {
        setLoadingMessage('Applying outfit changes...');
        const resolvedBaseImage = await resolveImageUrl(modelImageUrl || displayImageUrl);
        const visibleGarmentLayers = outfitStack.filter(l => l.isVisible && l.garment);

        if (visibleGarmentLayers.length > 0) {
          for (let i = 0; i < visibleGarmentLayers.length; i++) {
            const layer = visibleGarmentLayers[i];
            setLoadingMessage(`Applying layer ${i + 1} of ${visibleGarmentLayers.length}...`);
            const garmentFile = await urlToFile(layer.garment!.url, layer.garment!.name);

            // Enhanced Try-On: Use cached analysis if available, or analyze garment
            let garmentAnalysis: GarmentAnalysis | undefined;
            if (generationSettings.useEnhancedTryOn !== false) {
              const cacheKey = getCacheKey(layer.garment!.url);
              garmentAnalysis = garmentAnalysisCache.get(cacheKey);

              if (!garmentAnalysis) {
                setLoadingMessage(`Analyzing garment details: ${layer.garment!.name}...`);
                garmentAnalysis = await analyzeGarmentDetailed(garmentFile);
                // Cache for reuse
                setGarmentAnalysisCache(prev => new Map(prev).set(cacheKey, garmentAnalysis!));
                console.log(`✓ Analyzed and cached: ${layer.garment!.name}`);
              } else {
                console.log(`✓ Using cached analysis: ${layer.garment!.name}`);
              }
              setLoadingMessage(`Applying layer ${i + 1} of ${visibleGarmentLayers.length}...`);
            }

            currentImageUrl = await generateVirtualTryOnImage(currentImageUrl, garmentFile, generationSettings, garmentAnalysis);
          }
          promptForHistory += `Applied ${visibleGarmentLayers.map(l => l.garment!.name).join(', ')}`;
        }
      }

      // Step 2: Apply revision and/or settings changes
      // OPTIMIZATION: If we just applied an outfit, the settings were ALREADY applied in Step 1 (generateVirtualTryOnImage takes settings).
      // We only need to run Step 2 if there is an explicit text revision, or if we didn't apply an outfit (settings-only change).

      if (hasRevision || (hasSettings && !hasOutfit)) {
        let revisionInstruction: string;

        if (hasRevision) {
          setLoadingMessage('Applying revision...');
          revisionInstruction = revisionPrompt;
          promptForHistory = hasOutfit ? `${promptForHistory} + ${revisionPrompt}` : revisionPrompt;
        } else {
          // Settings-only change (no outfit change happened in Step 1)
          setLoadingMessage('Applying creative settings...');
          revisionInstruction = "RE-RENDER this image with the updated technical and creative specifications provided in the prompt. Apply ALL lighting changes (key light, fill light, rim light, HDRI), ALL camera settings (lens, aperture, sensor, position), ALL environment settings (background, floor, atmosphere), and ALL post-processing settings (color grading, contrast, film grain, retouching). Maintain the subject's exact identity, facial features, body proportions, pose, and outfit - ONLY update the lighting, camera perspective, depth of field, background, and post-processing/grading. Do NOT change what the model looks like or what they're wearing - ONLY change how the scene is photographed and processed.";
          promptForHistory = 'Applied creative settings';
        }

        // Apply revision/settings to current image (which may already have outfit applied)

        // Construct dynamic outfit instruction based on stack
        let outfitInstruction: string | undefined;
        const visibleGarments = outfitStack.filter(l => l.isVisible && l.garment);

        if (visibleGarments.length > 0) {
          const garmentNames = visibleGarments.map(l => l.garment!.name).join(', ');
          outfitInstruction = `PRESERVE the current outfit (${garmentNames}) exactly as it appears in the image. Do NOT revert to base underwear. The model is ALREADY wearing the correct clothing.`;
        }

        currentImageUrl = await reviseGeneratedImage(
          currentImageUrl,
          revisionInstruction,
          generationSettings,
          'gemini-2.5-flash-image',
          outfitInstruction
        );
      }

      // Upload to Firebase Storage if user is logged in and result is base64
      let finalImageUrl = currentImageUrl;
      if (currentUser && isBase64Url(currentImageUrl)) {
        try {
          setLoadingMessage('Saving image...');
          finalImageUrl = await uploadBase64Image(
            currentImageUrl,
            currentUser.uid,
            'tryons',
            `combined_${Date.now()}.jpg`,
            currentProjectId || undefined
          );
          console.log('Combined changes image uploaded to Firebase Storage:', finalImageUrl);
        } catch (error) {
          console.error('Failed to upload to Firebase Storage, using base64:', error);
        }
      }

      // Create history item
      const garmentIds = outfitStack.filter(l => l.isVisible && l.garment).map(l => l.garment!.id);
      console.log('[ImageStudio] Creating history item with outfit stack:', outfitStack);
      console.log('[ImageStudio] Saving garment IDs:', garmentIds);
      const newHistoryItem: HistoryItem = {
        id: `hist-${Date.now()}`,
        parentId: currentHistoryItemId,
        imageUrl: finalImageUrl,
        prompt: promptForHistory,
        settings: deepCopy(generationSettings),
        modelName: "Nano Banana",
        isStarred: false,
        type: 'try-on-revision',
        baseModelId: selectedStylingModel!.baseModelId,
        outfitGarmentIds: garmentIds,
      };
      console.log('[ImageStudio] History item created:', newHistoryItem.id, 'outfitGarmentIds:', newHistoryItem.outfitGarmentIds);

      setGeneratedModelHistory(prev => [...prev, newHistoryItem]);
      setCurrentHistoryItemId(newHistoryItem.id);
      setRedoStack([]);

      // Reset change tracking
      setRevisionPrompt('');
      setInitialSettings(generationSettings);

      // CRITICAL: Do NOT reset the outfit stack here.
      // We want to preserve the stack so subsequent revisions know what the model is wearing.
      // We only reset the pending flag so the "Apply" button knows the current stack is "saved" in the image.
      setHasPendingStackChanges(false);

      setToastMessage("Changes applied successfully!");

    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to apply changes'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, revisionPrompt, hasSettingsChanged, hasOutfitChanged, outfitStack, modelImageUrl, generationSettings, currentUser, currentProjectId, currentHistoryItemId, selectedStylingModel]);

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
        className="relative flex flex-col h-full bg-[#111111] overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="h-14 border-b border-white/5 bg-[#1a1a1a]/80 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0 z-20">
          <h1 className="text-[15px] font-medium text-white/90">Image Studio</h1>
          <div className="flex items-center gap-3">
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
                  selectedStylingModel={displayModel}
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
                  onApplyRevision={handleApplyChanges}
                  isEnhancingPrompt={isEnhancingPrompt}
                  hasSettingsChanged={hasSettingsChanged}
                  hasOutfitChanged={hasOutfitChanged}
                  applyButtonLabel={applyButtonLabel}
                  canApply={canApply}
                />
              </div>
              <ResizeHandle onMouseDown={handleLeftDrag} />
            </>
          )}

          <div className="flex-grow h-full flex flex-col items-center justify-center relative overflow-hidden bg-[#0f0f0f]">
            <div className="w-full h-full flex flex-col">
              {/* Toolbar Controls */}
              <div className="flex-shrink-0 flex items-center justify-between gap-2 p-2 bg-[#1a1a1a]/80 backdrop-blur-md border-b border-white/5 z-30">
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1">
                    <button onClick={handleUndo} disabled={!canUndo || isLoading} className="p-2 rounded-md hover:bg-white/10 disabled:opacity-30 transition-colors text-gray-400 hover:text-white" title="Undo"><UndoIcon className="w-4 h-4" /></button>
                    <button onClick={handleRedo} disabled={!canRedo || isLoading} className="p-2 rounded-md hover:bg-white/10 disabled:opacity-30 transition-colors text-gray-400 hover:text-white" title="Redo"><RedoIcon className="w-4 h-4" /></button>
                  </div>
                  {displayImageUrl && (
                    <button
                      onClick={() => { setZoom(1); handleStartOver(); }}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-2 py-1.5 ml-2 text-xs font-medium text-red-400 hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-900/30 disabled:opacity-30"
                      title="Start Over"
                    >
                      <RotateCcwIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Start Over</span>
                    </button>
                  )}
                  <div className="w-px h-6 bg-white/10 mx-2"></div>

                  {/* Upscale Menu */}
                  <div ref={upscaleMenuRef} className="relative">
                    <button onClick={() => setIsUpscaleMenuOpen(p => !p)} disabled={!displayImageUrl} className="p-2 rounded-md hover:bg-white/5 flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors focus:outline-none" title="Enhance & Upscale"><ZapIcon className="w-4 h-4 text-[#318CE7] group-hover:text-[#318CE7]/80 transition-colors" /></button>
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

                  {/* Download Menu */}
                  <div ref={downloadMenuRef} className="relative">
                    <button onClick={() => setIsDownloadMenuOpen(p => !p)} disabled={!displayImageUrl} className="p-2 rounded-md hover:bg-white/5 flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors focus:outline-none" title="Download Image">
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                    {isDownloadMenuOpen && (
                      <div className="absolute top-full left-0 mt-2 w-44 bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl z-40 overflow-hidden py-1" style={{ cursor: 'default' }} onMouseMove={(e) => e.stopPropagation()} onMouseEnter={(e) => e.stopPropagation()}>
                        <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Download Format</div>
                        <button onClick={(e) => { e.stopPropagation(); handleDownload('png'); }} className="w-full text-left px-3 py-2 text-[11px] font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors" style={{ cursor: 'pointer' }}>
                          PNG (.png) - Lossless
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDownload('jpg'); }} className="w-full text-left px-3 py-2 text-[11px] font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors" style={{ cursor: 'pointer' }}>
                          JPEG (.jpg) - Max Quality
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDownload('webp'); }} className="w-full text-left px-3 py-2 text-[11px] font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors" style={{ cursor: 'pointer' }}>
                          WebP (.webp) - Lossless
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Zoom Display */}
                <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                  <div className="flex items-center gap-1 bg-white/5 border border-gray-700/50 rounded-lg px-2 py-1">
                    {Math.round(zoom * 100)}%
                  </div>
                </div>
              </div>

              <div className="flex-grow relative min-h-0">
                <Canvas
                  displayImageUrl={displayImageUrl} isLoading={isLoading}
                  loadingMessage={loadingMessage} onSelectPose={handlePoseSelect}
                  poseInstructions={POSE_INSTRUCTIONS} currentPoseIndex={currentPoseIndex} availablePoseKeys={[]}
                  aspectRatio={generationSettings.aspectRatio ?? '2:3'}
                  isStudioEmpty={!modelImageUrl} zoom={zoom} setZoom={setZoom}
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
              <div style={{ width: `${rightPanelWidth}px` }} className="flex-shrink-0 h-full bg-[#1a1a1a] border-l border-white/5">
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
                  modelImageUrl={displayImageUrl}
                  baseModelName={displayModel?.name}
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
            modelImageUrl={displayImageUrl}
            baseModelName={displayModel?.name}
            isLoading={isLoading}
            onGenerate={handleGenerate}
            hasPendingChanges={hasPendingChanges}
            onDownloadImage={handleDownloadImage}
            onUseAsVideoReference={handleUseAsVideoReference}
            onCopySettings={handleCopySettings}
          />
        )}
      </motion.div>

      <ProductDetailsModal
        item={selectedProduct} onClose={() => setSelectedProduct(null)}
        onApply={handleApplyFromFlyout} onReplace={handleSelectForReplacement}
        lastAppliedGarment={lastAppliedGarment}
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