import React from 'react';
import { HeaderBar } from './HeaderBar';
import { MediaPanel } from './MediaPanel';
import { PreviewViewport } from './PreviewViewport';
import { InspectorPanel } from './InspectorPanel';
import { Timeline } from './Timeline';

export const AppLayout: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden antialiased">
      {/* Top Header */}
      <HeaderBar />

      {/* Middle Workspace: Left Media + Center Preview + Right Inspector */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        <MediaPanel />
        <PreviewViewport />
        <InspectorPanel />
      </main>

      {/* Bottom Timeline */}
      <Timeline />
    </div>
  );
};
