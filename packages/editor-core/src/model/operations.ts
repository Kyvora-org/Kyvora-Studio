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

export function immutableToggleTrackVisibility(project: KyvoraProject, trackId: string): KyvoraProject {
  return {
    ...project,
    tracks: project.tracks.map(t => {
      if (t.id !== trackId) return t;
      return { ...t, isVisible: t.isVisible === undefined ? false : !t.isVisible };
    }),
    updatedAt: new Date().toISOString()
  };
}

export function immutableToggleTrackLock(project: KyvoraProject, trackId: string): KyvoraProject {
  return {
    ...project,
    tracks: project.tracks.map(t => {
      if (t.id !== trackId) return t;
      return { ...t, isLocked: !t.isLocked };
    }),
    updatedAt: new Date().toISOString()
  };
}

export function immutableToggleTrackMute(project: KyvoraProject, trackId: string): KyvoraProject {
  return {
    ...project,
    tracks: project.tracks.map(t => {
      if (t.id !== trackId) return t;
      return { ...t, isMuted: !t.isMuted };
    }),
    updatedAt: new Date().toISOString()
  };
}

export function immutableUpdateClipAudio(
  project: KyvoraProject,
  clipId: string,
  audio: Partial<import('../types/project').AudioProperties>
): KyvoraProject {
  return {
    ...project,
    tracks: project.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== clipId) return clip;
        const currentAudio = clip.audio || {
          volume: 1.0,
          isMuted: false,
          pan: 0,
          gainDb: 0,
          fadeInDurationSeconds: 0,
          fadeOutDurationSeconds: 0,
          isNormalized: false
        };
        return {
          ...clip,
          audio: {
            ...currentAudio,
            ...audio
          }
        };
      })
    })),
    updatedAt: new Date().toISOString()
  };
}

export function immutableUpdateClipSpeed(
  project: KyvoraProject,
  clipId: string,
  speed: Partial<import('../types/project').SpeedProperties>
): KyvoraProject {
  return {
    ...project,
    tracks: project.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== clipId) return clip;
        const currentSpeed = clip.speed || {
          playbackSpeed: 1.0,
          isReversed: false,
          pitchCorrection: true
        };
        return {
          ...clip,
          speed: {
            ...currentSpeed,
            ...speed
          }
        };
      })
    })),
    updatedAt: new Date().toISOString()
  };
}

export function immutableAddTransitionToClip(
  project: KyvoraProject,
  clipId: string,
  transition: import('../types/project').ClipTransition
): KyvoraProject {
  return {
    ...project,
    tracks: project.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== clipId) return clip;
        const existing = (clip.transitions || []).filter(
          t => t.position !== transition.position
        );
        return {
          ...clip,
          transitions: [...existing, transition]
        };
      })
    })),
    updatedAt: new Date().toISOString()
  };
}

export function immutableRemoveTransitionFromClip(
  project: KyvoraProject,
  clipId: string,
  transitionId: string
): KyvoraProject {
  return {
    ...project,
    tracks: project.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== clipId) return clip;
        return {
          ...clip,
          transitions: (clip.transitions || []).filter(t => t.id !== transitionId)
        };
      })
    })),
    updatedAt: new Date().toISOString()
  };
}

export function immutableAddKeyframeToClip(
  project: KyvoraProject,
  clipId: string,
  keyframe: import('../types/project').Keyframe
): KyvoraProject {
  return {
    ...project,
    tracks: project.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== clipId) return clip;
        const existing = (clip.keyframes || []).filter(
          kf => !(kf.property === keyframe.property && Math.abs(kf.timeSeconds - keyframe.timeSeconds) < 0.05)
        );
        const sorted = [...existing, keyframe].sort((a, b) => a.timeSeconds - b.timeSeconds);
        return {
          ...clip,
          keyframes: sorted
        };
      })
    })),
    updatedAt: new Date().toISOString()
  };
}

export function immutableRemoveKeyframeFromClip(
  project: KyvoraProject,
  clipId: string,
  keyframeId: string
): KyvoraProject {
  return {
    ...project,
    tracks: project.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== clipId) return clip;
        return {
          ...clip,
          keyframes: (clip.keyframes || []).filter(kf => kf.id !== keyframeId)
        };
      })
    })),
    updatedAt: new Date().toISOString()
  };
}

export function immutableUpdateTitleProperties(
  project: KyvoraProject,
  clipId: string,
  titleProps: Partial<import('../types/project').TitleProperties>
): KyvoraProject {
  return {
    ...project,
    tracks: project.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== clipId) return clip;
        const currentProps = clip.titleProperties || {
          text: 'Título de Kyvora',
          fontFamily: 'Inter, sans-serif',
          fontSize: 48,
          textColor: '#FFFFFF',
          alignment: 'center',
          animationIn: 'fade',
          animationOut: 'fade',
          template: 'custom'
        };
        return {
          ...clip,
          titleProperties: {
            ...currentProps,
            ...titleProps
          }
        };
      })
    })),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Separa el canal de audio de un clip de vídeo, creando una pista de audio dedicada
 * y silenciando el clip original de vídeo.
 */
export function immutableSeparateAudioFromVideo(
  project: KyvoraProject,
  clipId: string
): { project: KyvoraProject; audioClipId?: string } {
  let foundClip: TimelineClip | null = null;
  for (const track of project.tracks) {
    const c = track.clips.find(item => item.id === clipId);
    if (c) {
      foundClip = c;
      break;
    }
  }

  if (!foundClip) {
    return { project };
  }

  const asset = project.assets.find(a => a.id === foundClip?.assetId);
  if (!asset || asset.type !== 'video') {
    return { project }; // Solo clips de video pueden separar su audio
  }

  // Buscar o crear pista de audio
  let targetAudioTrack = project.tracks.find(t => t.type === 'audio');
  let currentProject = project;

  if (!targetAudioTrack) {
    const newTrackId = `track_audio_${Date.now()}`;
    currentProject = immutableAddTrack(currentProject, {
      name: 'Audio Separado',
      type: 'audio',
      isMuted: false,
      isLocked: false,
      isVisible: true
    }, newTrackId);
    targetAudioTrack = currentProject.tracks.find(t => t.id === newTrackId);
  }

  const audioClipId = `clip_audio_sep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const audioClip: TimelineClip = {
    id: audioClipId,
    assetId: foundClip.assetId,
    trackId: targetAudioTrack!.id,
    name: `${foundClip.name} (Audio)`,
    startInTimelineSeconds: foundClip.startInTimelineSeconds,
    durationSeconds: foundClip.durationSeconds,
    sourceStartSeconds: foundClip.sourceStartSeconds,
    color: '#0066FF',
    audio: {
      volume: foundClip.audio?.volume ?? 1.0,
      gainDb: foundClip.audio?.gainDb ?? 0,
      isMuted: false,
      pan: foundClip.audio?.pan ?? 0,
      detachedAudioSourceClipId: foundClip.id
    },
    effects: []
  };

  // Silenciar el video original
  const projectWithMutedVideo = immutableUpdateClipAudio(currentProject, clipId, {
    isMuted: true,
    volume: 0
  });

  // Agregar el clip de audio a la pista de audio
  const finalProject = {
    ...projectWithMutedVideo,
    tracks: projectWithMutedVideo.tracks.map(t => {
      if (t.id !== targetAudioTrack!.id) return t;
      return {
        ...t,
        clips: [...t.clips, audioClip]
      };
    }),
    updatedAt: new Date().toISOString()
  };

  return { project: finalProject, audioClipId };
}

/**
 * Une dos clips contiguos en la línea de tiempo si pertenecen al mismo recurso original.
 */
export function immutableJoinClips(
  project: KyvoraProject,
  firstClipId: string,
  secondClipId: string
): { project: KyvoraProject; joinedClipId?: string } {
  let trackIndex = -1;
  let firstIdx = -1;
  let secondIdx = -1;

  for (let i = 0; i < project.tracks.length; i++) {
    const t = project.tracks[i];
    const f = t.clips.findIndex(c => c.id === firstClipId);
    const s = t.clips.findIndex(c => c.id === secondClipId);
    if (f !== -1 && s !== -1) {
      trackIndex = i;
      firstIdx = f;
      secondIdx = s;
      break;
    }
  }

  if (trackIndex === -1) return { project };

  const track = project.tracks[trackIndex];
  const c1 = track.clips[firstIdx];
  const c2 = track.clips[secondIdx];

  // Comprobar que pertenezcan al mismo activo
  if (c1.assetId !== c2.assetId) return { project };

  // Comprobar que sean contiguos temporalmente (margen 0.05s)
  const isContiguous = Math.abs((c1.startInTimelineSeconds + c1.durationSeconds) - c2.startInTimelineSeconds) < 0.05;
  if (!isContiguous) return { project };

  const joinedClip: TimelineClip = {
    ...c1,
    durationSeconds: c1.durationSeconds + c2.durationSeconds
  };

  const newClips = track.clips.filter(c => c.id !== firstClipId && c.id !== secondClipId);
  newClips.push(joinedClip);
  newClips.sort((a, b) => a.startInTimelineSeconds - b.startInTimelineSeconds);

  return {
    project: {
      ...project,
      tracks: project.tracks.map((t, idx) => idx === trackIndex ? { ...t, clips: newClips } : t),
      updatedAt: new Date().toISOString()
    },
    joinedClipId: c1.id
  };
}

/**
 * Interpola propiedades animadas de un clip en base a sus keyframes.
 */
export function interpolateClipPropertyAtTime(
  clip: TimelineClip,
  property: import('../types/project').AnimatableProperty,
  relativeTimeSeconds: number
): number | null {
  if (!clip.keyframes || clip.keyframes.length === 0) return null;

  const matchingKeyframes = clip.keyframes
    .filter(kf => kf.property === property)
    .sort((a, b) => a.timeSeconds - b.timeSeconds);

  if (matchingKeyframes.length === 0) return null;
  if (matchingKeyframes.length === 1) return matchingKeyframes[0].value;

  if (relativeTimeSeconds <= matchingKeyframes[0].timeSeconds) {
    return matchingKeyframes[0].value;
  }

  const lastKf = matchingKeyframes[matchingKeyframes.length - 1];
  if (relativeTimeSeconds >= lastKf.timeSeconds) {
    return lastKf.value;
  }

  for (let i = 0; i < matchingKeyframes.length - 1; i++) {
    const kf1 = matchingKeyframes[i];
    const kf2 = matchingKeyframes[i + 1];

    if (relativeTimeSeconds >= kf1.timeSeconds && relativeTimeSeconds <= kf2.timeSeconds) {
      const duration = kf2.timeSeconds - kf1.timeSeconds;
      if (duration <= 0) return kf1.value;

      let progress = (relativeTimeSeconds - kf1.timeSeconds) / duration;

      if (kf2.easing === 'easeInOut') {
        progress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      } else if (kf2.easing === 'easeIn') {
        progress = progress * progress;
      } else if (kf2.easing === 'easeOut') {
        progress = 1 - (1 - progress) * (1 - progress);
      }

      return kf1.value + (kf2.value - kf1.value) * progress;
    }
  }

  return matchingKeyframes[0].value;
}


