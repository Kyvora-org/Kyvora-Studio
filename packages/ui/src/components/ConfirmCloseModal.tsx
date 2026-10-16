import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmCloseModalProps {
  isOpen: boolean;
  projectName: string;
  onSaveAndProceed: () => void;
  onDiscardAndProceed: () => void;
  onCancel: () => void;
}

export const ConfirmCloseModal: React.FC<ConfirmCloseModalProps> = ({
  isOpen,
  projectName,
  onSaveAndProceed,
  onDiscardAndProceed,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-5 text-slate-100 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-slate-100">
              ¿Deseas guardar los cambios antes de continuar?
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              El proyecto <span className="text-slate-200 font-medium">"{projectName}"</span> tiene ediciones pendientes en la línea de tiempo. Si continúas sin guardar, se perderán todos los cambios no guardados.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onDiscardAndProceed}
            className="px-3 py-1.5 rounded text-xs font-medium bg-red-950 hover:bg-red-900 border border-red-800 text-red-200 transition-colors"
          >
            Descartar cambios
          </button>
          <button
            type="button"
            onClick={onSaveAndProceed}
            className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
          >
            Guardar y continuar
          </button>
        </div>
      </div>
    </div>
  );
};
