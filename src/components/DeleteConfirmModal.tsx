import React from 'react';
import { Application } from '../types';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  app: Application | null;
  onClose: () => void;
  onConfirm: (app: Application) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  app,
  onClose,
  onConfirm
}) => {
  if (!app) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">
            Confirm Deletion of Application Record
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Are you sure you want to delete <span className="font-bold text-slate-800">{app.name}</span> ({app.code})?
          </p>
        </div>

        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
          <span className="font-semibold block">Warning for AppSec Governance:</span>
          <span>
            This action will remove the record from the active inventory and log a deletion entry in the system Audit Trail.
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(app);
              onClose();
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Confirm AppSec Delete</span>
          </button>
        </div>

      </div>
    </div>
  );
};
