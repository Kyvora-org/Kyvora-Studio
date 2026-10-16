import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../src/store/editorStore';
import { formatTimecode, formatDuration } from '../src/utils/timecode';

describe('Editor Core - Timecode Utils', () => {
  it('formats zero seconds properly', () => {
    expect(formatTimecode(0, 30)).toBe('00:00:00:00');
    expect(formatDuration(0)).toBe('00:00');
  });

  it('formats 65.5 seconds correctly at 30fps', () => {
    // 65.5 seconds = 1 minute, 5 seconds, 15 frames
    expect(formatTimecode(65.5, 30)).toBe('00:01:05:15');
    expect(formatDuration(65.5)).toBe('01:05');
  });
});

describe('Editor Core - Zustand Store', () => {
  beforeEach(() => {
    useEditorStore.setState({
      currentTimeSeconds: 0,
      isPlaying: false,
      selectedClipId: null,
      selectedAssetId: null
    });
  });

  it('updates current time with bounds clamping', () => {
    const store = useEditorStore.getState();
    store.setCurrentTime(45.5);
    expect(useEditorStore.getState().currentTimeSeconds).toBe(45.5);

    // Negative clamping
    store.setCurrentTime(-10);
    expect(useEditorStore.getState().currentTimeSeconds).toBe(0);

    // Exceeding duration clamping (default project duration is 120)
    store.setCurrentTime(500);
    expect(useEditorStore.getState().currentTimeSeconds).toBe(120);
  });

  it('toggles playback status', () => {
    const store = useEditorStore.getState();
    expect(store.isPlaying).toBe(false);
    store.togglePlayPause();
    expect(useEditorStore.getState().isPlaying).toBe(true);
    store.togglePlayPause();
    expect(useEditorStore.getState().isPlaying).toBe(false);
  });

  it('manages undo/redo state consistently when project actions occur', () => {
    const store = useEditorStore.getState();
    expect(store.canUndo).toBe(false);
    
    store.updateProjectName('Nombre Modificado 1');
    expect(useEditorStore.getState().canUndo).toBe(true);
    expect(useEditorStore.getState().project.name).toBe('Nombre Modificado 1');

    store.undo();
    expect(useEditorStore.getState().canRedo).toBe(true);
    expect(useEditorStore.getState().project.name).not.toBe('Nombre Modificado 1');

    store.redo();
    expect(useEditorStore.getState().project.name).toBe('Nombre Modificado 1');
  });

  it('reports export as unsimulated and pending', async () => {
    const store = useEditorStore.getState();
    const exportRes = await store.exportProject();
    expect(exportRes.success).toBe(false);
    expect(exportRes.message).toContain('Fase 2');
  });
});
