export type MediaType = 'video' | 'audio' | 'image';

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  durationInSeconds: number;
  filePath?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string; // Data URL o identificador relativo de miniatura
  createdAt: string;
}

// Transform Properties for Video/Image Clips
export interface TransformProperties {
  scaleX: number;
  scaleY: number;
  positionX: number;
  positionY: number;
  rotationDegrees: number;
  opacity: number; // 0.0 to 1.0
}

// Audio Properties for Audio/Video Clips
export interface AudioProperties {
  volume: number; // 0.0 to 2.0 (1.0 = 100%)
  isMuted: boolean;
  pan: number; // -1.0 (Left) to 1.0 (Right)
}

// Clip Effects (Color adjustment, filters, text overlay, transitions)
export type EffectType = 
  | 'colorAdjustment' 
  | 'grayscale' 
  | 'sepia' 
  | 'textOverlay' 
  | 'fade' 
  | 'blur' 
  | 'speed' 
  | 'customFilter';

export interface BaseEffect {
  id: string;
  type: EffectType;
  name: string;
  isEnabled: boolean;
}

export interface ColorAdjustmentEffect extends BaseEffect {
  type: 'colorAdjustment';
  brightness: number; // -1.0 to 1.0 (0 default)
  contrast: number;   // 0.0 to 2.0 (1 default)
  saturation: number; // 0.0 to 2.0 (1 default)
}

export interface GrayscaleEffect extends BaseEffect {
  type: 'grayscale';
  amount: number; // 0.0 to 1.0 (1.0 default)
}

export interface SepiaEffect extends BaseEffect {
  type: 'sepia';
  amount: number; // 0.0 to 1.0 (1.0 default)
}

export interface TextOverlayEffect extends BaseEffect {
  type: 'textOverlay';
  text: string;
  fontFamily: string;
  fontSize: number; // in pixels
  color: string;     // hex color e.g. '#ffffff'
  positionX: number; // 0 to 100 percentage
  positionY: number; // 0 to 100 percentage
}

export interface FadeEffect extends BaseEffect {
  type: 'fade';
  fadeInDurationSeconds: number;
  fadeOutDurationSeconds: number;
}

export interface BlurEffect extends BaseEffect {
  type: 'blur';
  radius: number; // Pixels
}

export interface SpeedEffect extends BaseEffect {
  type: 'speed';
  playbackSpeed: number; // e.g., 0.5, 1.0, 2.0
}

export type ClipEffect = 
  | ColorAdjustmentEffect 
  | GrayscaleEffect 
  | SepiaEffect 
  | TextOverlayEffect 
  | FadeEffect 
  | BlurEffect 
  | SpeedEffect;

export interface TimelineClip {
  id: string;
  assetId: string;
  trackId: string;
  name: string;
  startInTimelineSeconds: number;
  durationSeconds: number;
  sourceStartSeconds: number;
  color?: string;
  transform?: TransformProperties;
  audio?: AudioProperties;
  effects: ClipEffect[];
}

export type TrackType = 'video' | 'audio';

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  order: number;
  isMuted: boolean;
  isLocked: boolean;
  clips: TimelineClip[];
}

export type PreviewQuality = 'performance' | 'balanced' | 'high';

export interface ProjectSettings {
  name: string;
  width: number;
  height: number;
  frameRate: number; // 24, 25, 30, 50, 60
  timecodeFormat: 'smpte' | 'seconds';
  previewQuality: PreviewQuality;
  aspectRatioLocked: boolean;
}

export interface KyvoraProject {
  id: string;
  schemaVersion: string;
  name: string;
  settings: ProjectSettings;
  assets: MediaAsset[];
  tracks: TimelineTrack[];
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export const CURRENT_SCHEMA_VERSION = '1.1.0';
