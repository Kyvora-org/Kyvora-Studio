import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderBar } from '../src/components/HeaderBar';
import { ExportModal } from '../src/components/ExportModal';
import { defaultWebMediaRepository } from '@kyvora/editor-core';

describe('UI Package Components', () => {
  it('renders HeaderBar with Kyvora Studio brand, Settings, Save and Export buttons', () => {
    render(<HeaderBar />);
    expect(screen.getByText('Kyvora Studio')).toBeDefined();
    expect(screen.getByText('Ajustes')).toBeDefined();
    expect(screen.getByText('Guardar')).toBeDefined();
    expect(screen.getByText('Exportar')).toBeDefined();
  });

  it('renders ExportModal correctly without reference errors and binds to media repository', () => {
    render(<ExportModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText(/Exportar Video/i)).toBeDefined();
    expect(screen.getByText('Resolución')).toBeDefined();
    expect(screen.getByText('Iniciar Exportación')).toBeDefined();
    expect(defaultWebMediaRepository).toBeDefined();
    expect(typeof defaultWebMediaRepository.getMedia).toBe('function');
  });
});

