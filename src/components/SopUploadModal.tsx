import React, { useState } from 'react';
import mammoth from 'mammoth';
import { SOPVersion, UserRole } from '../types';
import {
  X,
  Upload,
  FileText,
  FileUp,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react';

interface SopUploadModalProps {
  isOpen: boolean;
  currentVersion: string;
  onClose: () => void;
  onUpload: (newVersion: SOPVersion) => void;
  currentRole: UserRole;
}

export const SopUploadModal: React.FC<SopUploadModalProps> = ({
  isOpen,
  currentVersion,
  onClose,
  onUpload,
  currentRole
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'editor'>('upload');
  const [version, setVersion] = useState('v2.5');
  const [title, setTitle] = useState('AppSec Application Criticality Standard Operating Procedure');
  const [changeSummary, setChangeSummary] = useState(
    'Updated SOP with latest RTO/RPO expectations, IT team viewer guidelines, and annual re-assessment schedule.'
  );
  const [uploadedBy, setUploadedBy] = useState('AppSec Governance Team');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  // Handle file drop or input
  const handleFile = async (file: File) => {
    if (!file) return;
    setFileName(file.name);

    const isDocx = file.name.endsWith('.docx') || file.name.endsWith('.doc') || file.type.includes('wordprocessingml') || file.type.includes('msword');

    if (isDocx) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        // Convert DOCX to rich HTML preserving headings, paragraphs, lists, tables, bold, and alignments
        const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
        
        if (htmlResult.value && htmlResult.value.trim().length > 0) {
          setContent(htmlResult.value);
          setActiveTab('editor'); // Switch to editor view to preview
        } else {
          const rawTextResult = await mammoth.extractRawText({ arrayBuffer });
          if (rawTextResult.value) {
            setContent(rawTextResult.value);
            setActiveTab('editor');
          }
        }
      } catch (err) {
        console.error('Error parsing DOCX file with mammoth:', err);
        // Fallback to text reader
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (text) {
            setContent(text);
            setActiveTab('editor');
          }
        };
        reader.readAsText(file);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          setContent(text);
          setActiveTab('editor'); // Switch to editor view to preview
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      alert('SOP document content cannot be empty. Please upload a file or write markdown content.');
      return;
    }

    const newSopVersion: SOPVersion = {
      version: version.trim() || `v${(parseFloat(currentVersion.replace('v', '')) + 0.1).toFixed(1)}`,
      title: title.trim(),
      content: content.trim(),
      uploadedBy: uploadedBy.trim(),
      uploadedAt: new Date().toISOString(),
      changeSummary: changeSummary.trim(),
      fileName: fileName || `AppSec_Criticality_SOP_${version.trim()}.docx`
    };

    onUpload(newSopVersion);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto flex flex-col my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md">
              <FileUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Upload Latest AppSec SOP Document</h2>
              <p className="text-xs text-slate-400">
                Publish updated Standard Operating Procedure for Application Criticality & IT SLAs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="px-6 pt-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'upload'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Option 1: Upload File (.docx, .doc, .md, .txt)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`pb-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'editor'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Option 2: Direct Markdown Editor</span>
            {content.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-slate-700 text-xs">
          
          {/* Version Metadata Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                New Version Tag *
              </label>
              <input
                type="text"
                required
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g. v2.5"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Uploaded By *
              </label>
              <input
                type="text"
                required
                value={uploadedBy}
                onChange={(e) => setUploadedBy(e.target.value)}
                placeholder="e.g. Sarah Jenkins (AppSec Lead)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Document Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Revision Summary / Release Notes *
            </label>
            <input
              type="text"
              required
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="e.g. Updated Section 3 with PCI-DSS 4.0 mapping and modified RTO targets."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Option 1: File Drop Zone */}
          {activeTab === 'upload' && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100/80'
              }`}
            >
              <div className="max-w-xs mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    Drag and drop your SOP document here
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Supports Word (\`.docx\`, \`.doc\`), Markdown (\`.md\`), or Plain Text (\`.txt\`)
                  </p>
                </div>

                <div className="pt-2">
                  <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-sm transition-colors">
                    <FileUp className="w-3.5 h-3.5" />
                    <span>Browse Files</span>
                    <input
                      type="file"
                      accept=".docx,.doc,.md,.txt,.markdown,.json"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {fileName && (
                  <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-mono text-xs flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Selected: {fileName} ({content.length} characters)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Option 2: Direct Markdown Content Editor */}
          {activeTab === 'editor' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-semibold text-slate-800">
                  SOP Document Markdown Content *
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {content.length} characters
                </span>
              </div>
              <textarea
                rows={12}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Application Criticality Assessment SOP&#10;&#10;## 1. Overview..."
                className="w-full p-3 bg-slate-900 text-slate-100 font-mono text-xs rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
              />
            </div>
          )}

          {/* Governance Notice */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Publishing Governance:</span>
              <span>
                Saving this upload will mark version <strong className="font-mono">{version}</strong> as the current effective SOP for all AppSec and IT Team viewers. Previous versions will remain preserved in the Version History archive.
              </span>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-md flex items-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Publish & Activate New SOP ({version})</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
