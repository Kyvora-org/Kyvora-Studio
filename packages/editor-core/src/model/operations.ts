import { 
  KyvoraProject, 
  TimelineTrack, 
  TimelineClip, 
  MediaAsset, 
  ClipEffect 
} from '../types/project';

/**
 * Operaciones puras e inmutables sobre el estado del proyecto
 */

export function immutableUpdateProjectName(project: KyvoraProject, name: string): KyvoraProject {
  return {
    ...project,
    name,
    updatedAt: new Date().toISOString()
  };
}

export function immutableUpdateProjectDuration(project: KyvoraProject, durationSeconds: number): KyvoraProject {
  const safeDuration = Math.max(1, durationSeconds);
  return {
    ...project,
    durationSeconds: safeDuration,
    updatedAt: new Date().toISOString()
  };
}

export function immutableAddAsset(project: KyvoraProject, asset: MediaAsset): KyvoraProject {
  const existingIdx = project.assets.findIndex(
    a => a.id === asset.id || (asset.filePath && a.filePath && a.filePath === asset.filePath)
  );
  if (existingIdx !== -1) {
    // Si ya existe, actualizar metadatos preservando la lista sin duplicados
    const updatedAssets = [...project.assets];
    updatedAssets[existingIdx] = { ...updatedAssets[existingIdx], ...asset };
    return {
      ...project,
      assets: updatedAssets,
      updatedAt: new Date().toISOString()
    };
  }

  return {
    ...project,
    assets: [...project.assets, asset],
    updatedAt: new Date().toISOString()
  };
}

export function immutableRemoveAsset(project: KyvoraProject, assetId: string): KyvoraProject {
  // Remover asset y cualquier clip asociado en las pistas para mantener integridad referencial
  const updatedTracks = project.tracks.map(track => ({
    ...track,
    clips: track.clips.filter(clip => clip.assetId !== assetId)
  }));

  return {
    ...project,
    assets: project.assets.filter(a => a.id !== assetId),
    tracks: updatedTracks,
    updatedAt: new Date().toISOString()
  };
}

export function immutableAddTrack(
  project: KyvoraProject, 
  track: Omit<TimelineTrack, 'id' | 'order' | 'clips'>,
  customId?: string
): KyvoraProject {
  const newTrack: TimelineTrack = {
    ...track,
    id: customId || `track_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    order: project.tracks.length,
    clips: []
  };

  return {
    ...project,
    tracks: [...project.tracks, newTrack],
    updatedAt: new Date().toISOString()
  };
}

export function immutableRemoveTrack(project: KyvoraProject, trackId: string): KyvoraProject {
  const remainingTracks = project.tracks
    .filter(t => t.id !== trackId)
    .map((track, idx) => ({ ...track, order: idx }));

  return {
    ...project,
    tracks: remainingTracks,
    updatedAt: new Date().toISOString()
  };
}

export function immutableAddClip(
  project: KyvoraProject, 
  trackId: string, 
  clip: Omit<TimelineClip, 'id' | 'trackId'>,
  customClipId?: string
): KyvoraProject {
  const newClip: TimelineClip = {
    ...clip,
    id: customClipId || `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    trackId,
    effects: clip.effects || []
  };

  const updatedTracks = project.tracks.map(t => {
    if (t.id !== trackId) return t;
    return {
      ...t,
      clips: [...t.clips, newClip]
    };
  });

  return {
    ...project,
    tracks: updatedTracks,
    updatedAt: new Date().toISOString()
  };
}

export function immutableMoveClip(
  project: KyvoraProject,
  clipId: string,
  newTrackId: string,
  newStartSeconds: number
): KyvoraProject {
  const safeStart = Math.max(0, newStartSeconds);
  let targetClip: TimelineClip | null = null;

  // Localizar y extraer el clip de su pista original
  const cleanTracks = project.tracks.map(track => {
    const found = track.clips.find(c => c.id === clipId);
    if (found) {
      targetClip = { 
        ...found, 
        trackId: newTrackId, 
        startInTimelineSeconds: safeStart 
      };
      return {
        ...track,
        clips: track.clips.filter(c => c.id !== clipId)
      };
    }
    return track;
  });

  if (!targetClip) {
    return project; // Clip no encontrado, no alterar
  }

  // Insertar en la pista destino
  const finalTracks = cleanTracks.map(track => {
    if (track.id !== newTrackId) return track;
    return {
      ...track,
      clips: [...track.clips, targetClip!]
    };
  });

  return {
    ...project,
    tracks: finalTracks,
    updatedAt: new Date().toISOString()
  };
}

export function immutableRemoveClip(project: KyvoraProject, clipId: string): KyvoraProject {
  const updatedTracks = project.tracks.map(track => ({
    ...track,
    clips: track.clips.filter(c => c.id !== clipId)
  }));

  return {
    ...project,
    tracks: updatedTracks,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Divide un clip en una posición temporal específica de la línea de tiempo.
 * Si el punto de corte cae dentro del intervalo del clip, genera dos clips contiguos
 * recalculando sus offsets de fuente (`sourceStartSeconds`) y duraciones.
 */
export function immutableSplitClip(
  project: KyvoraProject,
  clipId: string,
  splitTimelineSeconds: number
): { project: KyvoraProject; leftClipId?: string; rightClipId?: string } {
  let splitPerformed = false;
  let leftClipId: string | undefined;
  let rightClipId: string | undefined;

  const updatedTracks = project.tracks.map(track => {
    const clipIndex = track.clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) return track;

    const clip = track.clips[clipIndex];
    const clipStart = clip.startInTimelineSeconds;
    const clipEnd = clip.startInTimelineSeconds + clip.durationSeconds;

    // El punto de corte debe estar estrictamente dentro del clip (con margen mínimo de 0.05s)
    const minThreshold = 0.05;
    if (splitTimelineSeconds <= clipStart + minThreshold || splitTimelineSeconds >= clipEnd - minThreshold) {
      return track;
    }

    const firstDuration = splitTimelineSeconds - clipStart;
    const secondDuration = clipEnd - splitTimelineSeconds;
    const secondSourceStart = clip.sourceStartSeconds + firstDuration;

    leftClipId = clip.id;
    rightClipId = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const leftClip: TimelineClip = {
      ...clip,
      durationSeconds: firstDuration
    };

    const rightClip: TimelineClip = {
      ...clip,
      id: rightClipId,
      name: `${clip.name} (Parte 2)`,
      startInTimelineSeconds: splitTimelineSeconds,
      durationSeconds: secondDuration,
      sourceStartSeconds: secondSourceStart
    };

    splitPerformed = true;
    const newClips = [...track.clips];
    newClips.splice(clipIndex, 1, leftClip, rightClip);

    return {
      ...track,
      clips: newClips
    };
  });

  if (!splitPerformed) {
    return { project };
  }

  return {
    project: {
      ...project,
      tracks: updatedTracks,
      updatedAt: new Date().toISOString()
    },
    leftClipId,
    rightClipId
  };
}

/**
 * Duplica un clip colocándolo inmediatamente después del clip original o en la posición especificada.
 */
export function immutableDuplicateClip(
  project: KyvoraProject,
  clipId: string,
  targetTrackId?: string,
  targetStartSeconds?: number
): { project: KyvoraProject; newClipId?: string } {
  let targetClip: TimelineClip | null = null;
  let sourceTrackId = '';

  for (const track of project.tracks) {
    const found = track.clips.find(c => c.id === clipId);
    if (found) {
      targetClip = found;
      sourceTrackId = track.id;
      break;
    }
  }

  if (!targetClip) {
    return { project };
  }

  const destinationTrackId = targetTrackId || sourceTrackId;
  const newClipId = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const destinationStart = targetStartSeconds !== undefined 
    ? Math.max(0, targetStartSeconds)
    : targetClip.startInTimelineSeconds + targetClip.durationSeconds;

  const duplicatedClip: TimelineClip = {
    ...targetClip,
    id: newClipId,
    trackId: destinationTrackId,
    name: `${targetClip.name} (Copia)`,
    startInTimelineSeconds: destinationStart,
    effects: targetClip.effects ? [...targetClip.effects] : []
  };

  const updatedTracks = project.tracks.map(track => {
    if (track.id !== destinationTrackId) return track;
    return {
      ...track,
      clips: [...track.clips, duplicatedClip]
    };
  });

  return {
    project: {
      ...project,
      tracks: updatedTracks,
      updatedAt: new Date().toISOString()
    },
    newClipId
  };
}

/**
 * Recorta el extremo izquierdo o derecho de un clip en la línea de tiempo
 * validando que la duración resultante no sea inferior al límite mínimo (0.1s o 1 frame)
 * ni exceda la duración disponible del medio original (evitando duraciones negativas o sobre-recorte).
 */
export function immutableTrimClip(
  project: KyvoraProject,
  clipId: string,
  edge: 'start' | 'end',
  newTimelinePositionSeconds: number,
  minDurationSeconds = 0.1
): KyvoraProject {
  const frameDuration = 1 / (project.settings?.frameRate || 30);
  const safeMinDuration = Math.max(minDurationSeconds, frameDuration);

  const updatedTracks = project.tracks.map(track => {
    const clipIndex = track.clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) return track;

    const clip = track.clips[clipIndex];
    const asset = project.assets.find(a => a.id === clip.assetId);
    const maxSourceDuration = asset?.durationInSeconds && asset.durationInSeconds > 0 
      ? asset.durationInSeconds 
      : Infinity;

    const clipEnd = clip.startInTimelineSeconds + clip.durationSeconds;

    if (edge === 'start') {
      // Recorte de inicio:
      // No puede empezar después de clipEnd - safeMinDuration
      // No puede hacer que sourceStartSeconds sea menor que 0
      const maxDeltaLeft = clip.sourceStartSeconds; // Lo máximo que podemos extender a la izquierda
      const earliestAllowedStart = Math.max(0, clip.startInTimelineSeconds - maxDeltaLeft);
      const latestAllowedStart = clipEnd - safeMinDuration;

      const clampedStart = Math.max(earliestAllowedStart, Math.min(newTimelinePositionSeconds, latestAllowedStart));
      const deltaStart = clampedStart - clip.startInTimelineSeconds;
      const newDuration = clip.durationSeconds - deltaStart;
      const newSourceStart = Math.max(0, clip.sourceStartSeconds + deltaStart);

      const modifiedClip: TimelineClip = {
        ...clip,
        startInTimelineSeconds: clampedStart,
        durationSeconds: newDuration,
        sourceStartSeconds: newSourceStart
      };

      const newClips = [...track.clips];
      newClips[clipIndex] = modifiedClip;
      return { ...track, clips: newClips };
    } else {
      // Recorte de final (edge === 'end'):
      // No puede ser menor a clip.startInTimelineSeconds + safeMinDuration
      // No puede hacer que (sourceStartSeconds + durationSeconds) exceda maxSourceDuration
      const maxAllowedDuration = maxSourceDuration !== Infinity
        ? Math.max(safeMinDuration, maxSourceDuration - clip.sourceStartSeconds)
        : Infinity;

      const minAllowedEnd = clip.startInTimelineSeconds + safeMinDuration;
      const maxAllowedEnd = maxAllowedDuration !== Infinity
        ? clip.startInTimelineSeconds + maxAllowedDuration
        : Infinity;

      const clampedEnd = Math.max(minAllowedEnd, Math.min(newTimelinePositionSeconds, maxAllowedEnd));
      const newDuration = clampedEnd - clip.startInTimelineSeconds;

      const modifiedClip: TimelineClip = {
        ...clip,
        durationSeconds: newDuration
      };

      const newClips = [...track.clips];
      newClips[clipIndex] = modifiedClip;
      return { ...track, clips: newClips };
    }
  });

  return {
    ...project,
    tracks: updatedTracks,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Calcula puntos de ajuste magnético (Snapping Points) para alinear clips
 * al cabezal de reproducción o a bordes de otros clips dentro de una tolerancia en segundos.
 */
export function findSnapTime(
  candidateTimeSeconds: number,
  snapPoints: number[],
  thresholdSeconds = 0.2
): { snappedTime: number; isSnapped: boolean } {
  let closestDist = Infinity;
  let bestPoint = candidateTimeSeconds;

  for (const pt of snapPoints) {
    const dist = Math.abs(candidateTimeSeconds - pt);
    if (dist < closestDist && dist <= thresholdSeconds) {
      closestDist = dist;
      bestPoint = pt;
    }
  }

  return {
    snappedTime: closestDist !== Infinity ? bestPoint : candidateTimeSeconds,
    isSnapped: closestDist !== Infinity
  };
}

export function immutableAddEffectToClip(
  project: KyvoraProject,
  clipId: string,
  effect: ClipEffect
): KyvoraProject {
  const updatedTracks = project.tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => {
      if (clip.id !== clipId) return clip;
      return {
        ...clip,
        effects: [...(clip.effects || []), effect]
      };
    })
  }));

  return {
    ...project,
    tracks: updatedTracks,
    updatedAt: new Date().toISOString()
  };
}

export function immutableRemoveEffectFromClip(
  project: KyvoraProject,
  clipId: string,
  effectId: string
): KyvoraProject {
  const updatedTracks = project.tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => {
      if (clip.id !== clipId) return clip;
      return {
        ...clip,
        effects: (clip.effects || []).filter(e => e.id !== effectId)
      };
    })
  }));

  return {
    ...project,
    tracks: updatedTracks,
    updatedAt: new Date().toISOString()
  };
}

export function immutableUpdateProjectSettings(
  project: KyvoraProject,
  settings: Partial<KyvoraProject['settings']>
): KyvoraProject {
  const currentSettings = project.settings || {
    name: 'Custom',
    width: 1920,
    height: 1080,
    frameRate: 60,
    timecodeFormat: 'smpte',
    previewQuality: 'balanced',
    aspectRatioLocked: true
  };

  const safeWidth = settings.width !== undefined 
    ? Math.max(64, Math.min(7680, Math.round(settings.width))) 
    : currentSettings.width;

  const safeHeight = settings.height !== undefined 
    ? Math.max(64, Math.min(7680, Math.round(settings.height))) 
    : currentSettings.height;

  const safeFps = settings.frameRate !== undefined 
    ? Math.max(1, Math.min(120, Math.round(settings.frameRate))) 
    : currentSettings.frameRate;

  const safeQuality = settings.previewQuality !== undefined 
    ? settings.previewQuality 
    : currentSettings.previewQuality;

  const safeAspectLocked = settings.aspectRatioLocked !== undefined 
    ? settings.aspectRatioLocked 
    : currentSettings.aspectRatioLocked;

  return {
    ...project,
    settings: {
      ...currentSettings,
      ...settings,
      width: safeWidth,
      height: safeHeight,
      frameRate: safeFps,
      previewQuality: safeQuality,
      aspectRatioLocked: safeAspectLocked
    },
    updatedAt: new Date().toISOString()
  };
}

export function immutableUpdateEffectInClip(
  project: KyvoraProject,
  clipId: string,
  effectId: string,
  updatedFields: Partial<ClipEffect>
): KyvoraProject {
  const updatedTracks = project.tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => {
      if (clip.id !== clipId) return clip;
      return {
        ...clip,
        effects: (clip.effects || []).map(eff => {
          if (eff.id !== effectId) return eff;
          return {
            ...eff,
            ...updatedFields
          } as ClipEffect;
        })
      };
    })
  }));

  return {
    ...project,
    tracks: updatedTracks,
    updatedAt: new Date().toISOString()
  };
}

export function immutableUpdateClipTransform(
  project: KyvoraProject,
  clipId: string,
  transform: Partial<import('../types/project').TransformProperties>
): KyvoraProject {
  const updatedTracks = project.tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => {
      if (clip.id !== clipId) return clip;
      const currentTransform = clip.transform || {
        scaleX: 1,
        scaleY: 1,
        positionX: 0,
        positionY: 0,
        rotationDegrees: 0,
        opacity: 1
      };
      return {
        ...clip,
        transform: {
          ...currentTransform,
          ...transform
        }
      };
    })
  }));

  return {
    ...project,
    tracks: updatedTracks,
    updatedAt: new Date().toISOString()
  };
}

