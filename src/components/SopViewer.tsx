import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { SOPDocument, SOPVersion, UserRole } from '../types';
import {
  FileText,
  Upload,
  Download,
  History,
  Search,
  CheckCircle2,
  Calendar,
  UserCheck,
  ChevronRight,
  BookOpen,
  Sparkles,
  FileCode,
  Shield,
  Layers
} from 'lucide-react';

interface SopViewerProps {
  sopDocument: SOPDocument;
  currentRole: UserRole;
  onOpenUploadModal: () => void;
  onSwitchVersion: (version: string) => void;
}

export const SopViewer: React.FC<SopViewerProps> = ({
  sopDocument,
  currentRole,
  onOpenUploadModal,
  onSwitchVersion
}) => {
  const [selectedVersionTag, setSelectedVersionTag] = useState<string>(
    sopDocument.activeVersion
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);

  // Find currently selected SOP version object
  const activeSop: SOPVersion = useMemo(() => {
    const found = sopDocument.history.find((v) => v.version === selectedVersionTag);
    if (found) return found;
    return (
      sopDocument.history[0] || {
        version: 'v2.4',
        title: 'AppSec Application Criticality Standard',
        content: '# Standard Operating Procedure',
        uploadedBy: 'AppSec Lead',
        uploadedAt: new Date().toISOString(),
        changeSummary: 'Default SOP Version'
      }
    );
  }, [sopDocument, selectedVersionTag]);

  const isCurrentActiveVersion = activeSop.version === sopDocument.activeVersion;

  // Determine if content is HTML (from uploaded DOCX) or Markdown
  const isHtmlContent = useMemo(() => {
    const content = activeSop.content || '';
    return /^\s*<[\s\S]*>/.test(content) || content.includes('<p>') || content.includes('<h1>') || content.includes('<h2>') || content.includes('<table>') || content.includes('<div>');
  }, [activeSop.content]);

  // Inject heading IDs for smooth TOC navigation
  const processedHtmlContent = useMemo(() => {
    if (!isHtmlContent) return activeSop.content;
    let html = activeSop.content;
    let index = 1;
    html = html.replace(/<h([1-6])([^>]*)>(.*?)<\/h\1>/gi, (match, level, attrs, text) => {
      const cleanText = text.replace(/<[^>]+>/g, '').trim();
      const id = `heading-${index}-${cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      index++;
      if (attrs.includes('id=')) return match;
      return `<h${level} id="${id}" ${attrs}>${text}</h${level}>`;
    });
    return html;
  }, [activeSop.content, isHtmlContent]);

  // Download active SOP docx file
  const handleDownloadSOP = () => {
    let formattedBody = activeSop.content;
    
    if (!isHtmlContent) {
      // Convert markdown lines into simple HTML structure for Word
      formattedBody = activeSop.content
        .split('\n')
        .map((line) => {
          if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
          if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
          if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
          if (line.startsWith('---')) return `<hr/>`;
          if (line.trim() === '') return `<br/>`;
          return `<p>${line}</p>`;
        })
        .join('\n');
    }

    const htmlHeader = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${activeSop.title}</title>
<style>
@page { size: 8.5in 11in; margin: 1in; }
body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; margin: 0; }
h1 { font-size: 20pt; color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-top: 24pt; margin-bottom: 12pt; }
h2 { font-size: 15pt; color: #1e1b4b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 18pt; margin-bottom: 10pt; }
h3 { font-size: 12pt; font-weight: bold; color: #334155; margin-top: 14pt; margin-bottom: 6pt; }
p { margin-bottom: 8pt; text-align: left; line-height: 1.5; }
table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
th, td { border: 1px solid #cbd5e1; padding: 6pt 8pt; text-align: left; font-size: 10pt; }
th { background-color: #f1f5f9; font-weight: bold; }
ul, ol { margin-bottom: 8pt; padding-left: 20pt; }
blockquote { border-left: 4px solid #6366f1; background-color: #f8fafc; padding: 8pt 12pt; margin: 10pt 0; }
</style>
</head><body>`;

    const htmlFooter = `</body></html>`;
    const docxContent = htmlHeader + formattedBody + htmlFooter;

    const blob = new Blob([docxContent], { type: 'application/msword;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const downloadFileName = activeSop.fileName
      ? activeSop.fileName.replace(/\.md$/i, '.docx')
      : `AppSec_Criticality_SOP_${activeSop.version}.docx`;
    a.download = downloadFileName.endsWith('.docx') ? downloadFileName : `${downloadFileName}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Dynamic Table of contents anchors extracted from document headers
  const tocItems = useMemo(() => {
    const content = activeSop.content || '';
    const items: { id: string; label: string }[] = [];

    if (isHtmlContent) {
      const headingRegex = /<h[123][^>]*>(.*?)<\/h[123]>/gi;
      let match;
      let index = 1;
      while ((match = headingRegex.exec(content)) !== null) {
        const rawText = match[1].replace(/<[^>]+>/g, '').trim();
        if (rawText && rawText.length > 2) {
          const id = `heading-${index}-${rawText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          items.push({ id, label: rawText });
          index++;
        }
      }
    } else {
      const lines = content.split('\n');
      let index = 1;
      for (const line of lines) {
        if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
          const rawText = line.replace(/^#+\s*/, '').trim();
          if (rawText) {
            const id = `heading-${index}-${rawText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            items.push({ id, label: rawText });
            index++;
          }
        }
      }
    }

    if (items.length === 0) {
      return [
        { id: 'heading-1-executive-overview', label: '1. Executive Overview & Purpose' },
        { id: 'heading-2-roles-and-responsibilities', label: '2. Roles & Responsibilities' },
        { id: 'heading-3-criticality-tiers', label: '3. Criticality Tiers' },
        { id: 'heading-4-scoring-algorithm', label: '4. Scoring Algorithm' }
      ];
    }

    return items;
  }, [activeSop.content, isHtmlContent]);

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>{isCurrentActiveVersion ? 'Effective Standard (Latest)' : 'Archival SOP Version'}</span>
              </span>
              <span className="font-mono text-xs bg-slate-800 text-indigo-300 px-2 py-0.5 rounded border border-slate-700">
                {activeSop.version}
              </span>
              {activeSop.fileName && (
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <FileCode className="w-3 h-3 text-slate-500" />
                  <span>{activeSop.fileName}</span>
                </span>
              )}
            </div>

            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              {activeSop.title}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Published by {activeSop.uploadedBy}</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Published {new Date(activeSop.uploadedAt).toLocaleDateString()}</span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
            
            {/* Version Switcher Dropdown */}
            <div className="relative">
              <select
                value={activeSop.version}
                onChange={(e) => {
                  setSelectedVersionTag(e.target.value);
                  onSwitchVersion(e.target.value);
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-medium border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              >
                {sopDocument.history.map((v, idx) => (
                  <option key={`${v.version}-${idx}`} value={v.version}>
                    {v.version} {v.version === sopDocument.activeVersion ? '(Current)' : '(Archived)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Download SOP Button */}
            <button
              onClick={handleDownloadSOP}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="Download Word (.docx) SOP Document"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Download .DOCX</span>
            </button>

            {/* Upload Latest SOP Button for Admins */}
            {(currentRole === 'SUPER_ADMIN' || currentRole === 'APPSEC_ADMIN') ? (
              <button
                onClick={onOpenUploadModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer"
                title="Upload new SOP document file"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Latest SOP</span>
              </button>
            ) : (
              <span className="px-3 py-1.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>Read-Only SOP</span>
              </span>
            )}

          </div>

        </div>

        {/* Change Summary Banner */}
        {activeSop.changeSummary && (
          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-300 flex items-start gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-300 mr-1.5">Revision Notes ({activeSop.version}):</span>
              <span>{activeSop.changeSummary}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Reader Layout: Left TOC Sidebar + Right Reader Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sticky Table of Contents Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs sticky top-20 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Table of Contents</span>
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                SOP Guide
              </span>
            </div>

            {/* Search Box in SOP */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter SOP text..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Section Links */}
            <ul className="space-y-1 text-xs font-medium text-slate-600">
              {tocItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block py-1.5 px-2 rounded-md hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between group"
                  >
                    <span className="truncate">{item.label}</span>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all" />
                  </a>
                </li>
              ))}
            </ul>

            {/* SOP Governance Info Card */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 space-y-1 mt-4">
              <div className="font-semibold text-slate-800 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span>AppSec Governance Standard</span>
              </div>
              <p>
                All applications in the database must comply with the security criteria and assessment schedules outlined in this SOP document.
              </p>
            </div>
          </div>
        </div>

        {/* Right Reader Canvas */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            
            {/* Document Body (HTML from Word DOCX or Markdown) */}
            {isHtmlContent ? (
              <div
                className="word-doc-canvas prose prose-slate max-w-none text-slate-800 font-sans leading-relaxed
                  [&_p]:mb-3 [&_p]:text-slate-800 [&_p]:leading-relaxed [&_p]:text-sm sm:[&_p]:text-base
                  [&_h1]:text-2xl sm:[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:border-b [&_h1]:border-slate-200 [&_h1]:pb-2 [&_h1]:mt-6 [&_h1]:mb-4 [&_h1]:tracking-tight
                  [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:border-b [&_h2]:border-slate-100 [&_h2]:pb-1.5 [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:tracking-tight
                  [&_h3]:text-lg sm:[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-5 [&_h3]:mb-2
                  [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-slate-800 [&_h4]:mt-4 [&_h4]:mb-2
                  [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-xs sm:[&_table]:text-sm [&_table]:shadow-2xs
                  [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-2.5 [&_th]:font-semibold [&_th]:text-slate-900 [&_th]:text-left
                  [&_td]:border [&_td]:border-slate-200 [&_td]:p-2.5 [&_td]:text-slate-700
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ul]:space-y-1
                  [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_ol]:space-y-1
                  [&_li]:text-slate-800
                  [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-500 [&_blockquote]:bg-slate-50 [&_blockquote]:p-3.5 [&_blockquote]:my-4 [&_blockquote]:rounded-r-lg
                  [&_strong]:font-semibold [&_strong]:text-slate-900
                  [&_em]:italic
                  [&_u]:underline
                  [&_a]:text-indigo-600 [&_a]:underline hover:[&_a]:text-indigo-800"
                dangerouslySetInnerHTML={{ __html: processedHtmlContent }}
              />
            ) : (
              <div className="markdown-body prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => (
                      <h1
                        className="text-2xl font-extrabold text-slate-900 border-b border-slate-200 pb-3 mb-4 tracking-tight"
                        {...props}
                      />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2
                        className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mt-8 mb-3 tracking-tight flex items-center gap-2 text-indigo-950"
                        {...props}
                      />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="text-sm font-bold text-slate-800 mt-5 mb-2" {...props} />
                    ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-4">
                        <table
                          className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden"
                          {...props}
                        />
                      </div>
                    ),
                    th: ({ node, ...props }) => (
                      <th className="bg-slate-100 text-slate-800 font-bold p-2.5 border-b border-slate-200" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="p-2.5 border-b border-slate-100 font-mono text-xs text-slate-700" {...props} />
                    ),
                    code: ({ node, ...props }) => (
                      <code
                        className="bg-slate-100 text-indigo-800 font-mono text-xs px-1.5 py-0.5 rounded border border-slate-200"
                        {...props}
                      />
                    ),
                    blockquote: ({ node, ...props }) => (
                      <blockquote
                        className="border-l-4 border-indigo-500 bg-indigo-50/50 p-3 my-3 text-indigo-950 italic text-xs rounded-r-lg"
                        {...props}
                      />
                    )
                  }}
                >
                  {activeSop.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Document Footer Endnote */}
            <div className="pt-6 border-t border-slate-200 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>AppSec & IT Operations Governance • Confidential Internal Standard</span>
              <span className="font-mono">{activeSop.version} Effective Standard</span>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
