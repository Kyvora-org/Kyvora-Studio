export type MediaType = 'video' | 'audio' | 'image' | 'text';

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  durationInSeconds: number;
  filePath?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  codecName?: string;
  audioChannels?: number;
  sampleRate?: number;
  thumbnailUrl?: string; // Data URL o identificador de miniatura en caché
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
  gainDb?: number; // -24 dB to +24 dB (0 dB default)
  isMuted: boolean;
  pan: number; // -1.0 (Left) to 1.0 (Right)
  fadeInDurationSeconds?: number;
  fadeOutDurationSeconds?: number;
  isNormalized?: boolean;
  detachedAudioSourceClipId?: string;
}

// Speed Properties
export interface SpeedProperties {
  playbackSpeed: number; // e.g. 0.25, 0.5, 1.0, 1.5, 2.0, 4.0
  isReversed: boolean;
  pitchCorrection: boolean;
}

// Clip Effects (Extended Professional NLE Suite)
export type EffectType = 
  | 'colorAdjustment' 
  | 'colorGrading'
  | 'grayscale' 
  | 'sepia' 
  | 'textOverlay' 
  | 'fade' 
  | 'blur' 
  | 'motionBlur'
  | 'glow'
  | 'bloom'
  | 'vignette'
  | 'chromaticAberration'
  | 'distortion'
  | 'filmGrain'
  | 'pixelate'
  | 'glitch'
  | 'rgbSplit'
  | 'sharpen'
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

export interface ColorGradingEffect extends BaseEffect {
  type: 'colorGrading';
  brightness: number;   // -1.0 to 1.0 (0 default)
  contrast: number;     // 0.0 to 2.0 (1 default)
  saturation: number;   // 0.0 to 2.0 (1 default)
  temperature: number;  // -1.0 (cool/blue) to 1.0 (warm/orange)
  exposure: number;     // -2.0 to +2.0 EV
  shadows: number;      // -1.0 to 1.0
  highlights: number;   // -1.0 to 1.0
}

export interface GrayscaleEffect extends BaseEffect {
  type: 'grayscale';
  amount: number; // 0.0 to 1.0 (1.0 default)
}

export interface SepiaEffect extends BaseEffect {
  type: 'sepia';
  amount: number; // 0.0 to 1.0 (1.0 default)
}

export interface BlurEffect extends BaseEffect {
  type: 'blur';
  radius: number; // Pixels 0 - 50
  blurType?: 'gaussian' | 'box';
}

export interface MotionBlurEffect extends BaseEffect {
  type: 'motionBlur';
  amount: number; // 0 - 100
  angleDegrees: number; // 0 - 360
}

export interface GlowEffect extends BaseEffect {
  type: 'glow';
  intensity: number; // 0.0 to 2.0
  radius: number;    // 0 to 50
  color: string;     // Hex e.g. '#0066FF'
}

export interface BloomEffect extends BaseEffect {
  type: 'bloom';
  threshold: number; // 0.0 to 1.0
  intensity: number; // 0.0 to 3.0
  radius: number;    // 0 to 40
}

export interface VignetteEffect extends BaseEffect {
  type: 'vignette';
  radius: number;    // 0.1 to 1.0
  softness: number;  // 0.0 to 1.0
  intensity: number; // 0.0 to 1.0
}

export interface ChromaticAberrationEffect extends BaseEffect {
  type: 'chromaticAberration';
  offset: number; // 0 to 20 pixels
  angle: number;  // 0 to 360 degrees
}

export interface DistortionEffect extends BaseEffect {
  type: 'distortion';
  amount: number; // -1.0 (barrel) to 1.0 (pincushion)
}

export interface FilmGrainEffect extends BaseEffect {
  type: 'filmGrain';
  intensity: number; // 0.0 to 1.0
  roughness: number; // 0.0 to 1.0
}

export interface PixelateEffect extends BaseEffect {
  type: 'pixelate';
  pixelSize: number; // 2 to 64 pixels
}

export interface GlitchEffect extends BaseEffect {
  type: 'glitch';
  intensity: number;   // 0.0 to 1.0
  speed: number;       // 0.1 to 5.0
  sliceAmount: number; // 2 to 30
}

export interface RgbSplitEffect extends BaseEffect {
  type: 'rgbSplit';
  shiftX: number; // -30 to 30 pixels
  shiftY: number; // -30 to 30 pixels
}

export interface SharpenEffect extends BaseEffect {
  type: 'sharpen';
  amount: number; // 0.0 to 3.0
}

export interface TextOverlayEffect extends BaseEffect {
  type: 'textOverlay';
  text: string;
  fontFamily: string;
  fontSize: number;  // in pixels
  color: string;     // hex color e.g. '#ffffff'
  positionX: number; // 0 to 100 percentage
  positionY: number; // 0 to 100 percentage
  backgroundColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
}

export interface FadeEffect extends BaseEffect {
  type: 'fade';
  fadeInDurationSeconds: number;
  fadeOutDurationSeconds: number;
}

export interface SpeedEffect extends BaseEffect {
  type: 'speed';
  playbackSpeed: number; // e.g., 0.5, 1.0, 2.0
  isReversed?: boolean;
  pitchCorrection?: boolean;
}

export type ClipEffect = 
  | ColorAdjustmentEffect 
  | ColorGradingEffect
  | GrayscaleEffect 
  | SepiaEffect 
  | BlurEffect
  | MotionBlurEffect
  | GlowEffect
  | BloomEffect
  | VignetteEffect
  | ChromaticAberrationEffect
  | DistortionEffect
  | FilmGrainEffect
  | PixelateEffect
  | GlitchEffect
  | RgbSplitEffect
  | SharpenEffect
  | TextOverlayEffect 
  | FadeEffect 
  | SpeedEffect;

// Transitions System
export type TransitionType = 
  | 'fade' 
  | 'crossDissolve' 
  | 'dipToBlack' 
  | 'dipToWhite' 
  | 'zoomIn' 
  | 'zoomOut' 
  | 'slideLeft' 
  | 'slideRight' 
  | 'slideUp' 
  | 'slideDown' 
  | 'push' 
  | 'wipe' 
  | 'blurTransition' 
  | 'glitchTransition' 
  | 'flashTransition' 
  | 'spinTransition' 
  | 'rgbTransition';

export interface ClipTransition {
  id: string;
  type: TransitionType;
  durationSeconds: number;
  position: 'start' | 'end'; // In o Out
}

// Keyframes System
export type AnimatableProperty = 
  | 'positionX' 
  | 'positionY' 
  | 'scaleX' 
  | 'scaleY' 
  | 'rotationDegrees' 
  | 'opacity' 
  | 'volume'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'blur';

export interface Keyframe {
  id: string;
  property: AnimatableProperty;
  timeSeconds: number; // Relativo al inicio del clip (0 <= t <= clip.durationSeconds)
  value: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

// Title and Text Templates
export type TitleTemplate = 
  | 'custom'
  | 'lowerThird'
  | 'cinematic'
  | 'subtitle'
  | 'cyberpunk'
  | 'minimal'
  | 'boldIntro';

export interface TitleProperties {
  text: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  backgroundColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  alignment: 'left' | 'center' | 'right';
  animationIn: 'none' | 'fade' | 'slideUp' | 'zoomIn' | 'typewriter';
  animationOut: 'none' | 'fade' | 'slideDown' | 'zoomOut';
  template: TitleTemplate;
}

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
  speed?: SpeedProperties;
  titleProperties?: TitleProperties;
  effects: ClipEffect[];
  transitions?: ClipTransition[];
  keyframes?: Keyframe[];
  isLocked?: boolean;
}

export type TrackType = 'video' | 'audio' | 'text' | 'overlay';

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  order: number;
  isMuted: boolean;
  isLocked: boolean;
  isVisible?: boolean; // Show/Hide track
  isSolo?: boolean;
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

export const CURRENT_SCHEMA_VERSION = '2.0.0';
