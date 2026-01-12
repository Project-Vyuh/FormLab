/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Model {
  id: string;
  url: string;
  source?: 'user' | 'predefined'; // Source of the model
  thumbnail?: string; // Preview image
  gender?: 'male' | 'female' | 'non-binary'; // For pre-defined models
  tags?: string[]; // For filtering
  name?: string; // Display name
  projectId?: string; // Associated project ID for user-created models
  historyItemId?: string; // History item ID for loading version history
  createdAt?: number; // Timestamp of creation
  updatedAt?: number; // Timestamp of last modification
  sourceTemplateId?: string; // ID of the template this model was created from
}

export interface CompositeSubject {
  id: string;
  url: string;
  name: string;
}

export interface BrandLogo {
  id: string;
  url: string; // Firebase Storage URL
  name: string;
  createdAt: number;
  projectId?: string; // Optional: associate with project
}

// Logo branding configuration (project-level)
export interface LogoBrandingConfig {
  selectedLogoId: string | null;
  mode: 'position' | 'watermark' | null;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;
  watermarkStyle: 'tiled' | 'center'; // For watermark mode
  size: 'small' | 'medium' | 'large';
  opacity: number; // 40-100
  offsetX: number; // -20 to +20 (percentage of image width)
  offsetY: number; // -20 to +20 (percentage of image height)
}

export type WardrobeCategory = string;

export interface WardrobeItem {
  id: string;
  sku: string;
  name: string;
  url: string; // main image
  images?: { front: string; back?: string; detail?: string };
  colorways?: string[]; // hex codes
  category: WardrobeCategory;
  subcategory: string;
  color: string;
  fabric: string;
  print: string;
  fit: 'oversized' | 'cropped' | 'slim' | 'relaxed' | 'tailored';
  season: string; // e.g., 'SS25', 'FW24'
  gender: 'menswear' | 'womenswear' | 'unisex';
  priceTier: 'basic' | 'premium' | 'luxury';
  tags: {
    styling: string[]; // 'streetwear', 'old money'
    campaign: string[]; // 'Lookbook 01'
  };
  notes?: string;
  source?: 'user' | 'predefined' | 'user-global'; // Source of the wardrobe item
}


export interface OutfitLayer {
  id: string; // Unique ID for this layer instance for reordering
  garment: WardrobeItem | null; // null represents the base model layer
  isVisible: boolean;
  // Future properties for adjustments: tuck, roll, etc. can be added here
}

export interface Snapshot {
  id: string;
  imageUrl: string;
  outfit: OutfitLayer[];
  outfitIndex: number;
}

export type ImageQuality = 'standard' | 'hd' | 'fast';

export type PhotoStyle = 'none' | 'vintage' | 'modern' | 'dreamy';
export type ShotFraming = 'full' | 'medium' | 'closeup';
export type AspectRatio = '1:1' | '3:2' | '2:3' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
export type LensProfile = '24mm' | '35mm' | '50mm' | '85mm' | '135mm';
export type SensorSize = 'full-frame' | 'medium-format';

// --- Aperture Simulation Types ---
export type BokehShape = 'round' | 'pentagon' | 'anamorphic';

export interface ApertureSettings {
  aperture: number; // f-stop, e.g., 1.4, 2.8, 8.0
  bokehShape: BokehShape;
}
// --- End Aperture Simulation Types ---

// --- Shutter Simulation Types ---
export interface ShutterSettings {
  motionBlur: number; // 0 (none) to 1 (strong)
  blurAngle: number; // 0 to 360 degrees
  microGhosting: boolean;
}
// --- End Shutter Simulation Types ---

// --- Camera Position Types ---
export interface CameraPositionSettings {
  height: number; // in meters, e.g., 1.5 is eye level
  tilt: number; // in degrees, e.g., -15 is tilted down
}
// --- End Camera Position Types ---

// --- Focus Plane Control Types ---
export interface FocusPlaneSettings {
  focusDistance: number; // 0 (foreground) to 1 (background)
  faceAutofocus: boolean;
}
// --- End Focus Plane Control Types ---

export type CameraProfile = 'none' | 'canon' | 'nikon' | 'sony' | 'phase-one';

// --- Noise & Grain Types ---
export interface NoiseAndGrainSettings {
  amount: number; // 0 (none) to 1 (heavy)
  type: 'fine' | 'medium' | 'coarse';
  chromaticAberration: boolean;
}
// --- End Noise & Grain Types ---


// --- Advanced Lighting System Types ---
export type LightType = 'area' | 'spot' | 'point';
export type LightRole = 'key' | 'fill' | 'rim' | 'custom';
export type HdriMap = 'none' | 'neutral' | 'high-contrast' | 'fashion-beauty';

export interface Light {
  id: string;
  type: LightType;
  role: LightRole;
  position: {
    angle: number; // 0-360 degrees, 0 is top
    distance: number; // 0-1, center to edge
    elevation: number; // -90 (below) to 90 (above)
  };
  power: number; // EV (stops)
  size: number; // 0 to 1 (small/hard to large/soft)
  kelvin: number; // Color temperature
  tint: number; // -1 (green) to 1 (magenta)
  saturation: number; // 0 (desaturated) to 1 (vibrant)
}

export interface LightingRig {
  lights: Light[];
  hdri: {
    map: HdriMap;
    rotation: number; // 0 to 360 degrees
  };
}
// --- End Lighting System Types ---

// --- Studio Environment Types ---
export type StudioEnvironmentType = 'high-key' | 'mid-gray' | 'textured' | 'colored-seamless' | 'gradient' | 'transparent' | 'custom';
export type TextureType = 'concrete' | 'plaster';
export type GradientType = 'radial' | 'vertical' | 'horizontal';
export type FloorMaterial = 'matte' | 'glossy' | 'concrete' | 'velvet';

export interface FloorSettings {
  material: FloorMaterial;
  glossiness: number; // 0 to 1
  reflectionLength: number; // 0 to 1
}

export interface EnvironmentBase {
  cycloramaCurve: number; // 0 (sharp corner) to 1 (fully curved)
}

export interface HighKeyEnvironment extends EnvironmentBase {
  type: 'high-key';
  brightness: number; // 0 to 1
  reflectionStrength: number; // 0 to 1
}

export interface MidGrayEnvironment extends EnvironmentBase {
  type: 'mid-gray';
}

export interface TexturedEnvironment extends EnvironmentBase {
  type: 'textured';
  textureType: TextureType;
  intensity: number; // 0 to 1
  roughness: number; // 0 to 1
}

export interface ColoredSeamlessEnvironment extends EnvironmentBase {
  type: 'colored-seamless';
  color: string; // hex code
}

export interface GradientEnvironment extends EnvironmentBase {
  type: 'gradient';
  gradientType: GradientType;
  color1: string; // hex code
  color2: string; // hex code
}

export interface CustomEnvironment {
  type: 'custom';
  prompt: string;
}

export interface TransparentEnvironment {
  type: 'transparent';
}

export type StudioEnvironment = HighKeyEnvironment | MidGrayEnvironment | TexturedEnvironment | ColoredSeamlessEnvironment | GradientEnvironment | CustomEnvironment | TransparentEnvironment;

export interface ShadowSculptingSettings {
  flags: {
    left: boolean;
    right: boolean;
  };
}
// --- End Studio Environment Types ---

// --- Scene & Atmosphere Types ---
export interface StudioVignetting {
  strength: number; // 0 to 1
  shape: 'round' | 'linear';
  bias: 'center' | 'top' | 'bottom' | 'sides';
}
export interface SceneAtmosphere {
  backgroundExposure: number; // -1 (dark) to 1 (bright)
  backgroundBlur: 'none' | 'low' | 'medium' | 'high';
  vignetting: StudioVignetting;
  lightWrap: 'none' | 'subtle' | 'strong';
  separationContrast: 'soft' | 'neutral' | 'sharp';
}
// --- End Scene & Atmosphere Types ---

// --- Image Processing & Grading Types ---
export interface ColorWheelSettings {
  r: number; // -1 to 1
  g: number; // -1 to 1
  b: number; // -1 to 1
}

export interface SplitToningSettings {
  highlights: {
    color: string; // hex
    balance: number; // 0 to 1
  };
  shadows: {
    color: string; // hex
  };
}

export interface ImageProcessingSettings {
  exposureBias: number; // -1 to 1
  contrast: 'low' | 'neutral' | 'high' | 'punchy';
  colorGrade: 'none' | 'cinematic' | 'commercial' | 'vintage';
  highlightRollOff: 'soft' | 'medium' | 'hard';
  shadowCrush: 'none' | 'low' | 'medium';
  lift?: ColorWheelSettings;
  gamma?: ColorWheelSettings;
  gain?: ColorWheelSettings;
  splitToning?: SplitToningSettings;
}
// --- End Image Processing & Grading Types ---

// --- Ambient Light & Occlusion Types ---
export interface AmbientBounceSettings {
  color: string; // hex
  strength: number; // 0 to 1
  bias: 'uniform' | 'left' | 'right' | 'top' | 'bottom';
}
export interface AmbientOcclusionSettings {
  intensity: number; // 0 to 1
  radius: number; // 0 to 1
}
// --- End Ambient Light & Occlusion Types ---

// --- Digital Darkroom Types ---
export interface DigitalDarkroomSettings {
  // Skin & Surface
  frequencySeparation?: boolean;
  shineControl?: number; // 0 to 1
  skinToneHarmonization?: boolean;
  // Geometry & Cleanup
  lensCorrection?: boolean;
  bodyWarpCorrection?: boolean;
  cleanup?: boolean; // dust, flyaways, etc.
  // Render Finishing
  studioSharpening?: boolean;
  dynamicRangeTuning?: boolean;
}
// --- End Digital Darkroom Types ---

export interface PanelToggles {
  composition: boolean;
  cameraAndLens: boolean;
  lighting: boolean;
  environment: boolean;
  imageFinishing: boolean;
}

export interface GenerationSettings {
  quality: ImageQuality;
  studioEnvironment: StudioEnvironment;
  floorSettings: FloorSettings;
  shadowSculpting: ShadowSculptingSettings;
  ambientBounce: AmbientBounceSettings;
  ambientOcclusion: AmbientOcclusionSettings;
  photoStyle?: PhotoStyle;
  accessoryPrompt?: string;
  shotFraming?: ShotFraming;
  posePrompt?: string;
  negativePrompt?: string;
  aspectRatio?: AspectRatio;
  poseReferenceUrl?: string | null;
  poseReferenceFile?: File | null;
  apertureSettings: ApertureSettings;
  lensProfile?: LensProfile;
  shutterSettings: ShutterSettings;
  lightingRig: LightingRig;
  sceneAtmosphere: SceneAtmosphere;
  imageProcessing: ImageProcessingSettings;
  sensorSize?: SensorSize;
  cameraPosition: CameraPositionSettings;
  focusPlaneSettings: FocusPlaneSettings;
  cameraProfile?: CameraProfile;
  noiseAndGrain: NoiseAndGrainSettings;
  digitalDarkroom?: DigitalDarkroomSettings;
  panelToggles: PanelToggles;
  useEnhancedTryOn?: boolean; // Enable enhanced garment detail preservation
  imageSize?: '1K' | '2K' | '4K'; // Gemini 3 Pro specific resolution setting
  googleSearchGrounding?: boolean; // Grounding with Google Search
  thinkingMode?: boolean; // Enable deep reasoning (internal optimization)
  isCompositeMode?: boolean; // Multi-model composite generation mode
  compositeSubjects?: { id: string; storageUrl: string; name: string }[]; // Reference models for composites
  compositePrompt?: string; // Specific prompt for the multi-model composition
}

export type HistoryItemType = 'model-generation' | 'model-revision' | 'try-on' | 'try-on-revision' | 'composite-generation';

export interface HistoryItem {
  id: string;
  parentId: string | null;
  imageUrl: string;
  prompt: string;
  settings: GenerationSettings;
  modelName: string;
  name?: string; // User-defined name
  isStarred: boolean;
  type: HistoryItemType; // Type of history item: model-generation, model-revision, try-on, try-on-revision
  baseModelId: string; // References the root base model (consistent across Create Model and Image Studio)
  sourceTemplateId?: string; // ID of the template this history item was created from
  outfitGarmentIds?: string[]; // IDs of garments in the outfit stack (for Image Studio) - simplified for Firestore serialization
  thoughts?: string; // Model's thinking process (internal)
  projectId?: string; // Associated project ID for filtering
}

export interface GarmentAnalysis {
  palette: string[];
  category: string;
  material: string;
  // Enhanced detail analysis for improved try-on accuracy
  colors?: {
    primary: string[];
    secondary: string[];
    exact_description: string;
  };
  patterns?: {
    type: string;
    description: string;
    scale: string;
    placement: string;
  };
  textures?: {
    fabric_type: string;
    finish: string;
    surface_details: string;
    weight?: string;
  };
  construction?: {
    details: string[];
    embellishments: string[];
    silhouette: string;
  };
  distinctive_features?: string[];
  volumetric_features?: {
    ruffles?: boolean;
    pleats?: boolean;
    gathering?: boolean;
    structure?: string;
  };
  layering?: {
    has_layers: boolean;
    description?: string;
  };
  accessories?: string[];
  is_multi_piece?: boolean;
  pieces?: string[];
}

export interface BrandStyle {
  id: string;
  name: string;
  settings: GenerationSettings;
}

// --- Video Creator Types ---
export type VideoGenerationMode = 'image-to-video' | 'image-to-image' | 'multi-reference' | 'extend-video';
export type VideoAspectRatio = '16:9' | '9:16';
export type VideoResolution = '720p' | '1080p';
export type CameraMotion = 'none' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down' | 'zoom-in' | 'zoom-out';
export type CinematicStyle = 'none' | 'timelapse' | 'slow-motion' | 'hyperlapse' | 'black-and-white';
export type VideoModel = 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview';
export type VideoExportFormat = 'mp4' | 'mov' | 'gif';

export interface VideoGenerationSettings {
  mode: VideoGenerationMode;
  prompt: string;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  cameraMotion: CameraMotion;
  cinematicStyle: CinematicStyle;
  negativePrompt: string;
  model: VideoModel;
  exportFormat: VideoExportFormat;
}

export type UpscaleResolution = '2k' | '4k';

// --- Project Management & Notifications ---
export interface ClientDetails {
  name: string;
  email: string;
  phone: string;
  location: string;
}

export interface SelectedStylingModel {
  url: string;
  name: string;
  historyItemId: string;
  baseModelId: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  organization: string;
  clientDetails?: ClientDetails;
  createdAt: string;
  deadline?: string;
  tags: string[];
  status: 'Draft' | 'In Progress' | 'In Review' | 'On Hold' | 'Completed';
  selectedForStyling?: string | null; // History item ID selected for Image Studio
  stylingHistory?: Record<string, HistoryItem[]>; // Try-on history indexed by baseModelId
  updatedAt?: string;
  logoBranding?: LogoBrandingConfig; // Logo branding configuration
}

export interface Notification {
  id: string;
  message: string;
  projectId: string;
  type: 'deadline-approaching' | 'deadline-past-due';
  createdAt: Date;
}

// --- User Authentication ---
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// --- Firestore Sync ---
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'conflict';

export type MergeStrategy = 'prefer-local' | 'prefer-remote' | 'smart';

export interface Conflict {
  field: string;
  local: any;
  remote: any;
  timestamp: number;
}

export interface SyncQueueItem {
  id: string;
  projectId: string;
  operation: 'save' | 'delete' | 'update';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface ProjectState {
  id: string;
  modelDescription?: string;
  revisionPrompt?: string;
  selectedModelName?: string;
  generatedModelHistory?: HistoryItem[];
  currentHistoryItemId?: string | null;
  generationSettings?: GenerationSettings;
  hasSavedInstance?: boolean;
  stylingHistory?: { [baseModelId: string]: HistoryItem[] };
  wardrobe?: WardrobeItem[];
  updatedAt?: number;
  syncVersion?: number;
}
