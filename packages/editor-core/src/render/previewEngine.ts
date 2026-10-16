import { KyvoraProject, TimelineClip, MediaAsset } from '../types/project';

export interface PreviewFrameState {
  currentTimeSeconds: number;
  isPlaying: boolean;
  activeVideoClip: TimelineClip | null;
  activeMediaAsset: MediaAsset | null;
  clipOffsetSeconds: number;
}

export type PreviewListener = (state: PreviewFrameState) => void;

/**
 * Motor de Previsualización desacoplado del motor de exportación.
 * Gestiona el bucle de transporte, sincronización de audio/video y liberación estricta de memoria.
 */
export class PreviewEngine {
  private project: KyvoraProject;
  private currentTime = 0;
  private isPlaying = false;
  private animFrameId: number | null = null;
  private lastTimestamp: number | null = null;
  private listeners: Set<PreviewListener> = new Set();
  private audioContext: AudioContext | null = null;
  private activeBlobUrls: Set<string> = new Set();

  constructor(initialProject: KyvoraProject) {
    this.project = initialProject;
  }

  public updateProject(project: KyvoraProject): void {
    this.project = project;
    this.emitState();
  }

  public subscribe(listener: PreviewListener): () => void {
    this.listeners.add(listener);
    listener(this.getCurrentFrameState());
    return () => this.listeners.delete(listener);
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTimestamp = null;
    this.startLoop();
    this.emitState();
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.lastTimestamp = null;
    this.emitState();
  }

  public togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seek(targetSeconds: number): void {
    const clamped = Math.max(0, Math.min(targetSeconds, this.project.durationSeconds));
    this.currentTime = clamped;
    this.emitState();
  }

  public stepFrame(frames: number): void {
    const frameDuration = 1 / this.project.settings.frameRate;
    this.seek(this.currentTime + (frames * frameDuration));
  }

  /**
   * Registra una URL de objeto temporal para rastreo y recolección
   */
  public registerBlobUrl(url: string): void {
    this.activeBlobUrls.add(url);
  }

  /**
   * Libera todos los recursos acumulados en memoria (AudioContext, URLs Blob)
   */
  public releaseResources(): void {
    this.pause();
    if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
      for (const url of this.activeBlobUrls) {
        URL.revokeObjectURL(url);
      }
      this.activeBlobUrls.clear();
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  public destroy(): void {
    this.releaseResources();
    this.listeners.clear();
  }

  private startLoop(): void {
    if (typeof requestAnimationFrame === 'undefined') return;

    const onTick = (timestamp: number) => {
      if (!this.isPlaying) return;

      if (this.lastTimestamp === null) {
        this.lastTimestamp = timestamp;
      }

      const deltaSeconds = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      const nextTime = this.currentTime + deltaSeconds;
      if (nextTime >= this.project.durationSeconds) {
        this.currentTime = this.project.durationSeconds;
        this.pause();
      } else {
        this.currentTime = nextTime;
        this.emitState();
        this.animFrameId = requestAnimationFrame(onTick);
      }
    };

    this.animFrameId = requestAnimationFrame(onTick);
  }

  public getCurrentFrameState(): PreviewFrameState {
    let activeVideoClip: TimelineClip | null = null;
    let activeMediaAsset: MediaAsset | null = null;
    let clipOffsetSeconds = 0;

    for (const track of this.project.tracks) {
      if (track.type === 'video') {
        const found = track.clips.find(
          c => this.currentTime >= c.startInTimelineSeconds && this.currentTime < (c.startInTimelineSeconds + c.durationSeconds)
        );
        if (found) {
          activeVideoClip = found;
          activeMediaAsset = this.project.assets.find(a => a.id === found.assetId) || null;
          clipOffsetSeconds = this.currentTime - found.startInTimelineSeconds;
          break;
        }
      }
    }

    return {
      currentTimeSeconds: this.currentTime,
      isPlaying: this.isPlaying,
      activeVideoClip,
      activeMediaAsset,
      clipOffsetSeconds
    };
  }

  private emitState(): void {
    const state = this.getCurrentFrameState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
