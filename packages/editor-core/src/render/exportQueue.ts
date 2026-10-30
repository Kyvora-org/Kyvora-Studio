/**
 * KYVORA STUDIO v3.0 - Multi-Job Export Queue
 *
 * Implements a batch render queue allowing editors to line up multiple export jobs,
 * monitor progress, handle failures gracefully, and execute renders sequentially.
 */

import { ExportSettings } from './renderPlan.js';

export type JobStatus = 'queued' | 'rendering' | 'completed' | 'failed' | 'cancelled';

export interface ExportJob {
  id: string;
  projectName: string;
  config: ExportSettings;
  status: JobStatus;
  progressPercent: number;
  currentFps?: number;
  estimatedRemainingSeconds?: number;
  errorMessage?: string;
  outputPath: string;
  startedAt?: string;
  completedAt?: string;
}

export class ExportQueueManager {
  private jobs: ExportJob[] = [];
  private activeJobId: string | null = null;
  private listeners: ((jobs: ExportJob[]) => void)[] = [];

  public addJob(projectName: string, config: ExportSettings): ExportJob {
    const job: ExportJob = {
      id: 'job-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      projectName,
      config,
      status: 'queued',
      progressPercent: 0,
      outputPath: config.outputPath
    };

    this.jobs.push(job);
    this.notify();
    return job;
  }

  public getJobs(): ExportJob[] {
    return [...this.jobs];
  }

  public getJob(id: string): ExportJob | undefined {
    return this.jobs.find(j => j.id === id);
  }

  public getNextQueuedJob(): ExportJob | undefined {
    return this.jobs.find(j => j.status === 'queued');
  }

  public updateJobProgress(
    id: string,
    progress: number,
    fps?: number,
    remainingSeconds?: number
  ): void {
    const job = this.jobs.find(j => j.id === id);
    if (!job) return;

    job.status = 'rendering';
    job.progressPercent = Math.max(0, Math.min(100, progress));
    if (fps !== undefined) job.currentFps = fps;
    if (remainingSeconds !== undefined) job.estimatedRemainingSeconds = remainingSeconds;
    if (!job.startedAt) job.startedAt = new Date().toISOString();

    this.notify();
  }

  public completeJob(id: string): void {
    const job = this.jobs.find(j => j.id === id);
    if (!job) return;

    job.status = 'completed';
    job.progressPercent = 100;
    job.completedAt = new Date().toISOString();
    if (this.activeJobId === id) this.activeJobId = null;

    this.notify();
  }

  public failJob(id: string, error: string): void {
    const job = this.jobs.find(j => j.id === id);
    if (!job) return;

    job.status = 'failed';
    job.errorMessage = error;
    job.completedAt = new Date().toISOString();
    if (this.activeJobId === id) this.activeJobId = null;

    this.notify();
  }

  public cancelJob(id: string): void {
    const job = this.jobs.find(j => j.id === id);
    if (!job) return;

    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    if (this.activeJobId === id) this.activeJobId = null;

    this.notify();
  }

  public removeJob(id: string): void {
    this.jobs = this.jobs.filter(j => j.id !== id);
    if (this.activeJobId === id) this.activeJobId = null;
    this.notify();
  }

  public clearFinishedJobs(): void {
    this.jobs = this.jobs.filter(j => j.status === 'queued' || j.status === 'rendering');
    this.notify();
  }

  public subscribe(listener: (jobs: ExportJob[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.jobs]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener([...this.jobs]);
      } catch (err) {
        console.error('ExportQueue listener error:', err);
      }
    }
  }
}
