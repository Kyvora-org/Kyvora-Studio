import { describe, it, expect } from 'vitest';
import {
  exportToEdl,
  importFromEdl,
  exportToFcpXml,
  importFromFcpXml,
  timecodeToSeconds,
  createNewProject,
  immutableAddClip
} from '../src/index';

describe('KYVORA STUDIO v3.0 - NLE Timeline Interchange (EDL & XML)', () => {
  describe('CMX 3600 EDL Export & Import', () => {
    it('convierte timecode SMPTE a segundos con precisión de fotograma', () => {
      expect(timecodeToSeconds('00:00:01:00', 30)).toBe(1.0);
      expect(timecodeToSeconds('00:01:00:00', 30)).toBe(60.0);
      expect(timecodeToSeconds('01:00:00:00', 30)).toBe(3600.0);
      expect(timecodeToSeconds('00:00:00:15', 30)).toBe(0.5);
    });

    it('exporta e importa timeline en formato CMX 3600 sin pérdida de sincronización', () => {
      let proj = createNewProject({ name: 'Proyecto Documental' });
      proj.assets.push({
        id: 'asset-1',
        name: 'entrevista_director.mp4',
        type: 'video',
        filePath: 'C:/videos/entrevista.mp4',
        durationInSeconds: 30,
        createdAt: new Date().toISOString()
      });

      proj = immutableAddClip(proj, proj.tracks[0].id, {
        assetId: 'asset-1',
        name: 'Toma 1 Director',
        startInTimelineSeconds: 2.0,
        durationSeconds: 5.0,
        sourceStartSeconds: 1.0,
        effects: []
      }, 'clip-1');

      const edlText = exportToEdl(proj);
      expect(edlText).toContain('TITLE: Proyecto Documental');
      expect(edlText).toContain('FCM: NON-DROP FRAME');
      expect(edlText).toContain('001  AX       V     C');
      expect(edlText).toContain('* FROM CLIP NAME: Toma 1 Director');

      // Importar EDL
      const imported = importFromEdl(edlText, 'Re-imported EDL', 30);
      expect(imported.name).toBe('Re-imported EDL');
      const vTrack = imported.tracks.find(t => t.type === 'video');
      expect(vTrack).toBeDefined();
      expect(vTrack?.clips.length).toBe(1);
      expect(vTrack?.clips[0].startInTimelineSeconds).toBeCloseTo(2.0, 1);
      expect(vTrack?.clips[0].durationSeconds).toBeCloseTo(5.0, 1);
      expect(vTrack?.clips[0].sourceStartSeconds).toBeCloseTo(1.0, 1);
    });
  });

  describe('Apple Final Cut Pro / Adobe Premiere XML Export & Import', () => {
    it('exporta timeline a xmeml XML compatible con Final Cut Pro y Premiere', () => {
      let proj = createNewProject({ name: 'Edición Comercial' });
      proj.assets.push({
        id: 'asset-cam2',
        name: 'producto_hero.mov',
        type: 'video',
        filePath: 'D:/Assets/hero.mov',
        durationInSeconds: 15,
        createdAt: new Date().toISOString()
      });

      proj = immutableAddClip(proj, proj.tracks[0].id, {
        assetId: 'asset-cam2',
        name: 'Hero Shot',
        startInTimelineSeconds: 0,
        durationSeconds: 4.0,
        sourceStartSeconds: 0,
        effects: []
      }, 'clip-hero');

      const xml = exportToFcpXml(proj);
      expect(xml).toContain('<xmeml version="5">');
      expect(xml).toContain('<sequence id="sequence-1">');
      expect(xml).toContain('<name>Edición Comercial</name>');
      expect(xml).toContain('<clipitem id="clip-hero">');
      expect(xml).toContain('<name>Hero Shot</name>');

      // Importar XML
      const imported = importFromFcpXml(xml, 'Imported from XML');
      expect(imported.name).toBe('Edición Comercial');
      const videoTrack = imported.tracks.find(t => t.type === 'video');
      expect(videoTrack?.clips.length).toBe(1);
      expect(videoTrack?.clips[0].durationSeconds).toBeCloseTo(4.0, 1);
    });
  });
});
