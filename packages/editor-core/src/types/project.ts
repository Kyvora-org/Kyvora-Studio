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
  proxyFilePath?: string; // Ruta de archivo proxy de baja resolución (720p/540p)
  hasProxy?: boolean;
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
  | 'pan'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'blur'
  | 'maskFeather'
  | 'maskOpacity'
  | 'chromaSimilarity'
  | 'eqGain'
  | 'reverbMix';

export type KeyframeInterpolation = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bezier' | 'hold';

export interface BezierControlPoint {
  x: number;
  y: number;
}

export interface Keyframe {
  id: string;
  property: AnimatableProperty;
  timeSeconds: number; // Relativo al inicio del clip (0 <= t <= clip.durationSeconds)
  value: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  interpolation?: KeyframeInterpolation;
  controlPointIn?: BezierControlPoint;
  controlPointOut?: BezierControlPoint;
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

// v3.0 Compositing & Blending Modes
export type BlendMode = 
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'colorDodge'
  | 'colorBurn'
  | 'hardLight'
  | 'softLight'
  | 'difference'
  | 'exclusion';

// v3.0 Color Grading Wheels & Curves
export interface ColorWheelValue {
  r: number; // -1.0 to 1.0 (0 default)
  g: number; // -1.0 to 1.0 (0 default)
  b: number; // -1.0 to 1.0 (0 default)
  y: number; // -1.0 to 1.0 (luma offset, 0 default)
}

export interface ColorWheels {
  lift: ColorWheelValue;   // Shadows
  gamma: ColorWheelValue;  // Midtones
  gain: ColorWheelValue;   // Highlights
  offset: ColorWheelValue; // Global offset
}

export interface CurvePoint {
  x: number; // 0.0 to 1.0 input
  y: number; // 0.0 to 1.0 output
}

export interface ColorCurves {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export interface SelectiveColorCorrection {
  isEnabled: boolean;
  targetHueDegrees: number;    // 0 to 360
  hueToleranceDegrees: number; // 5 to 60
  minSaturation: number;       // 0 to 1
  maxSaturation: number;       // 0 to 1
  minLuminance: number;        // 0 to 1
  maxLuminance: number;        // 0 to 1
  hueShiftDegrees: number;     // -180 to 180
  saturationAdjust: number;    // -1.0 to 1.0
  luminanceAdjust: number;     // -1.0 to 1.0
}

export interface Lut3DConfig {
  isEnabled: boolean;
  name: string;
  filePath?: string;
  cubeData?: string;
  strength: number; // 0.0 to 1.0
}

// v3.0 Shapes & Masks
export type MaskShapeType = 'rectangle' | 'ellipse' | 'polygon';

export interface MaskPoint {
  x: number; // 0 to 100 percentage
  y: number; // 0 to 100 percentage
}

export interface ClipMask {
  id: string;
  name: string;
  type: MaskShapeType;
  isEnabled: boolean;
  points: MaskPoint[];
  centerX: number;        // 0 to 100 percentage
  centerY: number;        // 0 to 100 percentage
  width: number;          // 0 to 100 percentage
  height: number;         // 0 to 100 percentage
  rotationDegrees: number;
  feather: number;        // 0 to 100 pixels
  isInverted: boolean;
  opacity: number;        // 0.0 to 1.0
}

// v3.0 Chroma Key & Green Screen
export interface ChromaKeyProperties {
  isEnabled: boolean;
  keyColorHex: string;      // e.g. '#00FF00'
  similarity: number;       // 0.0 to 1.0 (0.3 default)
  smoothness: number;       // 0.0 to 1.0 (0.1 default)
  spillSuppression: number; // 0.0 to 1.0 (0.5 default)
}

// v3.0 Motion Blur
export interface MotionBlurProperties {
  isEnabled: boolean;
  shutterAngleDegrees: number; // 0 to 360 (180 default)
  samples: number;             // 2 to 16 (4 default)
}

// v3.0 Professional Audio Suite
export type EQBandType = 'lowshelf' | 'highshelf' | 'peaking' | 'lowpass' | 'highpass';

export interface ParametricEQBand {
  id: string;
  type: EQBandType;
  frequencyHz: number; // 20 to 20000 Hz
  gainDb: number;      // -24 to +24 dB
  qFactor: number;     // 0.1 to 18.0
  isEnabled: boolean;
}

export interface AudioCompressor {
  isEnabled: boolean;
  thresholdDb: number;  // -60 to 0 dB
  ratio: number;        // 1 to 20
  attackMs: number;     // 0.1 to 200 ms
  releaseMs: number;    // 10 to 1000 ms
  makeupGainDb: number; // 0 to 24 dB
  kneeDb: number;       // 0 to 12 dB
}

export interface AudioLimiter {
  isEnabled: boolean;
  ceilingDb: number;    // -12 to 0 dBFS (-0.1 default)
  releaseMs: number;    // 1 to 500 ms
}

export interface AudioNoiseGate {
  isEnabled: boolean;
  thresholdDb: number;  // -80 to -20 dB
  reductionDb: number;  // 0 to 40 dB
}

export interface AudioReverb {
  isEnabled: boolean;
  roomSize: number;     // 0.0 to 1.0
  damping: number;      // 0.0 to 1.0
  wetGainDb: number;    // -60 to 6 dB
  dryGainDb: number;    // -60 to 6 dB
}

export interface AudioDelay {
  isEnabled: boolean;
  delayTimeMs: number;  // 1 to 2000 ms
  feedback: number;     // 0.0 to 0.95
  mix: number;          // 0.0 to 1.0
}

export interface AudioDucking {
  isEnabled: boolean;
  targetTrackId?: string; // Track whose speech triggers ducking
  thresholdDb: number;    // -40 to 0 dB
  duckingDb: number;      // -30 to 0 dB attenuation
  attackMs: number;       // 10 to 500 ms
  releaseMs: number;      // 100 to 2000 ms
}

export interface AudioEffectsSuite {
  eqBands: ParametricEQBand[];
  compressor: AudioCompressor;
  limiter: AudioLimiter;
  noiseGate: AudioNoiseGate;
  reverb: AudioReverb;
  delay: AudioDelay;
  ducking: AudioDucking;
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
  blendMode?: BlendMode;
  masks?: ClipMask[];
  chromaKey?: ChromaKeyProperties;
  colorWheels?: ColorWheels;
  colorCurves?: ColorCurves;
  selectiveColor?: SelectiveColorCorrection;
  lut3d?: Lut3DConfig;
  motionBlur?: MotionBlurProperties;
  audioSuite?: AudioEffectsSuite;
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
  colorSpace?: 'rec709' | 'srgb' | 'rec2020' | 'dci-p3';
  enableProxyEditing?: boolean;
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

export const CURRENT_SCHEMA_VERSION = '3.0.0';
