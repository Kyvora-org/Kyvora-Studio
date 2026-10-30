import React, { useState, useEffect } from 'react';
import { ExportJob, ExportQueueManager } from '@kyvora/editor-core';
import { X, Trash2, ListOrdered } from 'lucide-react';

interface ExportQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  queueManager: ExportQueueManager;
}

export const ExportQueueModal: React.FC<ExportQueueModalProps> = ({
  isOpen,
  onClose,
  queueManager
}) => {
  const [jobs, setJobs] = useState<ExportJob[]>([]);

  useEffect(() => {
    const unsubscribe = queueManager.subscribe(updatedJobs => {
      setJobs(updatedJobs);
    });
    return () => unsubscribe();
  }, [queueManager]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-2xl bg-[#0E131F] border border-slate-800 rounded-lg shadow-2xl flex flex-col max-h-[80vh] overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="h-14 border-b border-slate-800 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <ListOrdered className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-sm tracking-wide">Cola de Renderizado y Exportación</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {jobs.length} {jobs.length === 1 ? 'tarea' : 'tareas'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {jobs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              La cola de exportación está vacía. Añade tareas de renderizado desde el panel de exportación.
            </div>
          ) : (
            jobs.map(job => (
              <div
                key={job.id}
                className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-2.5 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-slate-200">{job.projectName}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 line-clamp-1">
                      {job.outputPath}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                        job.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : job.status === 'rendering'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse'
                          : job.status === 'failed'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {job.status === 'completed' ? 'Completado' : job.status === 'rendering' ? 'Renderizando' : job.status}
                    </span>

                    <button
                      onClick={() => queueManager.removeJob(job.id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition"
                      title="Eliminar de la cola"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Barra de Progreso */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        job.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${job.progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>{job.progressPercent}%</span>
                    {job.estimatedRemainingSeconds !== undefined && job.status === 'rendering' && (
                      <span>Quedan aprox. {Math.round(job.estimatedRemainingSeconds)}s</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="h-14 border-t border-slate-800 px-5 flex items-center justify-between shrink-0 bg-slate-900/40">
          <button
            onClick={() => queueManager.clearFinishedJobs()}
            className="text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Limpiar tareas finalizadas
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
