/**
 * KYVORA STUDIO v3.0 - FCP / Premiere Pro XML Interchange Engine
 *
 * Implements Apple Final Cut Pro 7 / Adobe Premiere Pro xmeml XML interchange.
 * Supports cross-NLE project migration (export and import).
 */

import { KyvoraProject, TimelineTrack, MediaAsset } from '../types/project.js';
import { timeToFrame, frameToTime } from '../utils/timecode.js';

/**
 * Escapes special XML characters.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Exports a KyvoraProject to Apple FCP / Premiere Pro compatible XML (xmeml v5).
 */
export function exportToFcpXml(project: KyvoraProject): string {
  const fps = Math.round(project.settings.frameRate || 30);
  const totalFrames = timeToFrame(project.durationSeconds, fps);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence id="sequence-1">
    <name>${escapeXml(project.name)}</name>
    <duration>${totalFrames}</duration>
    <rate>
      <timebase>${fps}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${project.settings.width}</width>
            <height>${project.settings.height}</height>
            <rate>
              <timebase>${fps}</timebase>
            </rate>
          </samplecharacteristics>
        </format>
`;

  // Video tracks
  const videoTracks = project.tracks.filter(t => t.type === 'video');
  for (const track of videoTracks) {
    xml += `        <track>\n`;
    for (const clip of track.clips) {
      const asset = project.assets.find(a => a.id === clip.assetId);
      const startFrame = timeToFrame(clip.startInTimelineSeconds, fps);
      const endFrame = timeToFrame(clip.startInTimelineSeconds + clip.durationSeconds, fps);
      const inFrame = timeToFrame(clip.sourceStartSeconds, fps);
      const outFrame = timeToFrame(clip.sourceStartSeconds + clip.durationSeconds, fps);

      xml += `          <clipitem id="${escapeXml(clip.id)}">
            <name>${escapeXml(clip.name)}</name>
            <duration>${endFrame - startFrame}</duration>
            <rate>
              <timebase>${fps}</timebase>
            </rate>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>${inFrame}</in>
            <out>${outFrame}</out>
            <file id="${escapeXml(asset?.id || 'file-' + clip.id)}">
              <name>${escapeXml(asset?.name || clip.name)}</name>
              <pathurl>${escapeXml(asset?.filePath || '')}</pathurl>
              <rate>
                <timebase>${fps}</timebase>
              </rate>
            </file>
          </clipitem>\n`;
    }
    xml += `        </track>\n`;
  }

  xml += `      </video>
      <audio>
`;

  // Audio tracks
  const audioTracks = project.tracks.filter(t => t.type === 'audio');
  for (const track of audioTracks) {
    xml += `        <track>\n`;
    for (const clip of track.clips) {
      const asset = project.assets.find(a => a.id === clip.assetId);
      const startFrame = timeToFrame(clip.startInTimelineSeconds, fps);
      const endFrame = timeToFrame(clip.startInTimelineSeconds + clip.durationSeconds, fps);
      const inFrame = timeToFrame(clip.sourceStartSeconds, fps);
      const outFrame = timeToFrame(clip.sourceStartSeconds + clip.durationSeconds, fps);

      xml += `          <clipitem id="${escapeXml(clip.id)}">
            <name>${escapeXml(clip.name)}</name>
            <duration>${endFrame - startFrame}</duration>
            <rate>
              <timebase>${fps}</timebase>
            </rate>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>${inFrame}</in>
            <out>${outFrame}</out>
            <file id="${escapeXml(asset?.id || 'file-' + clip.id)}">
              <name>${escapeXml(asset?.name || clip.name)}</name>
              <pathurl>${escapeXml(asset?.filePath || '')}</pathurl>
            </file>
          </clipitem>\n`;
    }
    xml += `        </track>\n`;
  }

  xml += `      </audio>
    </media>
  </sequence>
</xmeml>`;

  return xml;
}

/**
 * Parses an FCP XML string into a KyvoraProject.
 */
export function importFromFcpXml(xmlString: string, defaultName = 'Imported XML'): KyvoraProject {
  const fpsMatch = xmlString.match(/<timebase>(\d+)<\/timebase>/);
  const fps = fpsMatch ? parseInt(fpsMatch[1], 10) : 30;

  const widthMatch = xmlString.match(/<width>(\d+)<\/width>/);
  const heightMatch = xmlString.match(/<height>(\d+)<\/height>/);
  const width = widthMatch ? parseInt(widthMatch[1], 10) : 1920;
  const height = heightMatch ? parseInt(heightMatch[1], 10) : 1080;

  const seqNameMatch = xmlString.match(/<sequence[^>]*>\s*<name>([^<]+)<\/name>/);
  const name = seqNameMatch ? seqNameMatch[1] : defaultName;

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

  // Clipitem regex parser
  const clipRegex = /<clipitem\s+id="([^"]+)">([\s\S]*?)<\/clipitem>/g;
  let match: RegExpExecArray | null;

  while ((match = clipRegex.exec(xmlString)) !== null) {
    const clipId = match[1];
    const clipBody = match[2];

    const clipName = (clipBody.match(/<name>([^<]+)<\/name>/)?.[1] || 'Clip').trim();
    const startFrame = parseInt(clipBody.match(/<start>(-?\d+)<\/start>/)?.[1] || '0', 10);
    const endFrame = parseInt(clipBody.match(/<end>(-?\d+)<\/end>/)?.[1] || '0', 10);
    const inFrame = parseInt(clipBody.match(/<in>(-?\d+)<\/in>/)?.[1] || '0', 10);
    const pathUrl = (clipBody.match(/<pathurl>([^<]+)<\/pathurl>/)?.[1] || '').trim();

    if (startFrame < 0 || endFrame <= startFrame) continue;

    const startSeconds = frameToTime(startFrame, fps);
    const durationSeconds = frameToTime(endFrame - startFrame, fps);
    const sourceStartSeconds = frameToTime(Math.max(0, inFrame), fps);

    let assetId = assetMap.get(pathUrl || clipName);
    if (!assetId) {
      assetId = `asset-xml-${assets.length + 1}`;
      assetMap.set(pathUrl || clipName, assetId);
      assets.push({
        id: assetId,
        name: clipName,
        filePath: pathUrl || clipName,
        fileSize: 0,
        type: pathUrl.endsWith('.wav') || pathUrl.endsWith('.mp3') ? 'audio' : 'video',
        durationInSeconds: sourceStartSeconds + durationSeconds + 10,
        createdAt: new Date().toISOString()
      });
    }

    const isAudio = pathUrl.endsWith('.wav') || pathUrl.endsWith('.mp3') || clipName.toLowerCase().includes('audio');
    const targetTrack = isAudio ? audioTrack : videoTrack;

    targetTrack.clips.push({
      id: clipId,
      assetId,
      trackId: targetTrack.id,
      name: clipName,
      startInTimelineSeconds: startSeconds,
      durationSeconds: durationSeconds,
      sourceStartSeconds: sourceStartSeconds,
      effects: [],
      transitions: [],
      keyframes: []
    });

    if (startSeconds + durationSeconds > maxDuration) {
      maxDuration = startSeconds + durationSeconds;
    }
  }

  return {
    id: `project-xml-${Date.now()}`,
    schemaVersion: '3.0.0',
    name,
    settings: {
      name,
      width,
      height,
      frameRate: fps,
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
