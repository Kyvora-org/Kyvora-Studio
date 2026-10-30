/**
 * KYVORA STUDIO v3.0 - CMX 3600 EDL Interchange Engine
 *
 * Implements professional CMX 3600 Edit Decision List (EDL) export and import.
 * Supports Video (V), Audio (A / A2), Cuts (C) and Dissolves (D).
 */

import { KyvoraProject, TimelineTrack, TimelineClip, MediaAsset } from '../types/project.js';
import { formatTimecode } from '../utils/timecode.js';

export interface EdlEvent {
  eventNumber: number;
  reelName: string;
  trackType: 'V' | 'A' | 'A2' | 'AA';
  editType: 'C' | 'D' | 'W';
  transitionFrames?: number;
  sourceInTimecode: string;
  sourceOutTimecode: string;
  timelineInTimecode: string;
  timelineOutTimecode: string;
  clipName?: string;
  sourceFile?: string;
}

/**
 * Converts SMPTE timecode (HH:MM:SS:FF or HH:MM:SS;FF) to seconds.
 */
export function timecodeToSeconds(tc: string, fps = 30): number {
  if (!tc || typeof tc !== 'string') return 0;
  const parts = tc.replace(';', ':').split(':').map(Number);
  if (parts.length < 4 || parts.some(isNaN)) return 0;
  const [hours, minutes, seconds, frames] = parts;
  return hours * 3600 + minutes * 60 + seconds + (frames / fps);
}

/**
 * Exports a KyvoraProject timeline to industry-standard CMX 3600 EDL format.
 */
export function exportToEdl(project: KyvoraProject): string {
  const fps = project.settings.frameRate || 30;
  const lines: string[] = [];

  lines.push(`TITLE: ${project.name || 'Kyvora Project'}`);
  lines.push('FCM: NON-DROP FRAME');
  lines.push('');

  let eventCounter = 1;

  // Process video and audio tracks
  for (const track of project.tracks) {
    if (track.type !== 'video' && track.type !== 'audio') continue;

    const trackCode = track.type === 'video' ? 'V' : 'A';
    const sortedClips = [...track.clips].sort((a, b) => a.startInTimelineSeconds - b.startInTimelineSeconds);

    for (const clip of sortedClips) {
      const eventNumStr = String(eventCounter).padStart(3, '0');
      const reel = 'AX'.padEnd(8, ' ');
      const trk = trackCode.padEnd(5, ' ');
      const editType = 'C'.padEnd(8, ' '); // Cut

      const srcIn = formatTimecode(clip.sourceStartSeconds, fps);
      const srcOut = formatTimecode(clip.sourceStartSeconds + clip.durationSeconds, fps);
      const dstIn = formatTimecode(clip.startInTimelineSeconds, fps);
      const dstOut = formatTimecode(clip.startInTimelineSeconds + clip.durationSeconds, fps);

      lines.push(`${eventNumStr}  ${reel} ${trk} ${editType} ${srcIn} ${srcOut} ${dstIn} ${dstOut}`);
      lines.push(`* FROM CLIP NAME: ${clip.name}`);
      const asset = project.assets.find(a => a.id === clip.assetId);
      if (asset) {
        lines.push(`* SOURCE FILE: ${asset.filePath}`);
      }
      lines.push('');

      eventCounter++;
    }
  }

  return lines.join('\n');
}

/**
 * Parses a CMX 3600 EDL string and generates a valid KyvoraProject timeline.
 */
export function importFromEdl(edlText: string, projectName = 'Imported EDL', defaultFps = 30): KyvoraProject {
  const lines = edlText.split(/\r?\n/);
  const events: EdlEvent[] = [];
  let currentEvent: Partial<EdlEvent> | null = null;
  let detectedFps = defaultFps;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect FCM
    if (trimmed.startsWith('FCM:')) {
      if (trimmed.includes('DROP FRAME') && !trimmed.includes('NON-DROP')) {
        detectedFps = 29.97;
      }
      continue;
    }

    // Match EDL Event Line: e.g. "001  AX       V     C        00:00:00:00 00:00:05:00 00:00:00:00 00:00:05:00"
    const eventRegex = /^(\d{3,4})\s+([A-Za-z0-9_-]+)\s+([A-Za-z0-9]+)\s+([A-Za-z0-9]+)\s+(?:(\d+)\s+)?(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})/;
    const match = trimmed.match(eventRegex);

    if (match) {
      if (currentEvent && currentEvent.eventNumber) {
        events.push(currentEvent as EdlEvent);
      }

      currentEvent = {
        eventNumber: parseInt(match[1], 10),
        reelName: match[2],
        trackType: match[3].startsWith('V') ? 'V' : 'A',
        editType: match[4].startsWith('D') ? 'D' : 'C',
        sourceInTimecode: match[6],
        sourceOutTimecode: match[7],
        timelineInTimecode: match[8],
        timelineOutTimecode: match[9]
      };
      continue;
    }

    // Clip name comment: "* FROM CLIP NAME: ..."
    if (currentEvent && trimmed.startsWith('* FROM CLIP NAME:')) {
      currentEvent.clipName = trimmed.replace('* FROM CLIP NAME:', '').trim();
    } else if (currentEvent && trimmed.startsWith('* SOURCE FILE:')) {
      currentEvent.sourceFile = trimmed.replace('* SOURCE FILE:', '').trim();
    }
  }

  if (currentEvent && currentEvent.eventNumber) {
    events.push(currentEvent as EdlEvent);
  }

  // Build Kyvora Tracks and Assets
  const videoTrack: TimelineTrack = {
    id: 'track-v1',
    name: 'Video 1',
    type: 'video',
    order: 0,
    isMuted: false,
    isLocked: false,
    isVisible: true,
    clips: []
  };

  const audioTrack: TimelineTrack = {
    id: 'track-a1',
    name: 'Audio 1',
    type: 'audio',
    order: 1,
    isMuted: false,
    isLocked: false,
    isVisible: true,
    clips: []
  };

  const assets: MediaAsset[] = [];
  const assetMap = new Map<string, string>();

  let maxDuration = 0;

  for (const ev of events) {
    const startInTimeline = timecodeToSeconds(ev.timelineInTimecode, detectedFps);
    const endInTimeline = timecodeToSeconds(ev.timelineOutTimecode, detectedFps);
    const duration = Math.max(0.1, endInTimeline - startInTimeline);
    const sourceStart = timecodeToSeconds(ev.sourceInTimecode, detectedFps);

    const clipName = ev.clipName || `Event_${ev.eventNumber}`;
    const filePath = ev.sourceFile || `${clipName}.mov`;

    let assetId = assetMap.get(filePath);
    if (!assetId) {
      assetId = `asset-edl-${assets.length + 1}`;
      assetMap.set(filePath, assetId);
      assets.push({
        id: assetId,
        name: clipName,
        filePath: filePath,
        fileSize: 0,
        type: ev.trackType === 'V' ? 'video' : 'audio',
        durationInSeconds: sourceStart + duration + 10,
        createdAt: new Date().toISOString()
      });
    }

    const clip: TimelineClip = {
      id: `clip-edl-${ev.eventNumber}`,
      assetId,
      trackId: ev.trackType === 'V' ? videoTrack.id : audioTrack.id,
      name: clipName,
      startInTimelineSeconds: startInTimeline,
      durationSeconds: duration,
      sourceStartSeconds: sourceStart,
      effects: [],
      transitions: [],
      keyframes: []
    };

    if (ev.trackType === 'V') {
      videoTrack.clips.push(clip);
    } else {
      audioTrack.clips.push(clip);
    }

    if (startInTimeline + duration > maxDuration) {
      maxDuration = startInTimeline + duration;
    }
  }

  return {
    id: `project-edl-${Date.now()}`,
    schemaVersion: '3.0.0',
    name: projectName,
    settings: {
      name: projectName,
      width: 1920,
      height: 1080,
      frameRate: detectedFps,
      timecodeFormat: 'smpte',
      previewQuality: 'balanced',
      aspectRatioLocked: true
    },
    assets,
    tracks: [videoTrack, audioTrack],
    durationSeconds: maxDuration,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
