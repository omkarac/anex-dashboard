'use client';

import { useState, useRef } from 'react';
import { FileText, FileSpreadsheet, Layers, Image, File, Plus, X, ExternalLink, GripVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AssetFile } from '@/lib/schemas/asset-file';
import { addAssetFile, removeAssetFile, updateAssetFileTitle, reorderAssetFiles } from '@/lib/actions/asset-files';

// ─── File type detection ──────────────────────────────────────────────────────

type FileTypeConfig = {
  stripe: string;
  cardBg: string;
  foldBg: string;
  iconBg: string;
  iconColor: string;
  Icon: LucideIcon;
  label: string;
};

function getFileTypeConfig(url: string): FileTypeConfig {
  const lower = url.toLowerCase();

  if (lower.includes(':p:') || lower.endsWith('.pptx') || lower.endsWith('.ppt')) {
    return {
      stripe: 'bg-orange-400', cardBg: 'bg-orange-50/40', foldBg: 'bg-orange-100',
      iconBg: 'bg-orange-100', iconColor: 'text-orange-600', Icon: Layers, label: 'PPT',
    };
  }
  if (lower.includes(':x:') || lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    return {
      stripe: 'bg-emerald-400', cardBg: 'bg-emerald-50/40', foldBg: 'bg-emerald-100',
      iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', Icon: FileSpreadsheet, label: 'XLS',
    };
  }
  if (lower.includes(':w:') || lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return {
      stripe: 'bg-blue-400', cardBg: 'bg-blue-50/40', foldBg: 'bg-blue-100',
      iconBg: 'bg-blue-100', iconColor: 'text-blue-600', Icon: FileText, label: 'DOC',
    };
  }
  if (lower.endsWith('.pdf')) {
    return {
      stripe: 'bg-rose-400', cardBg: 'bg-rose-50/40', foldBg: 'bg-rose-100',
      iconBg: 'bg-rose-100', iconColor: 'text-rose-600', Icon: FileText, label: 'PDF',
    };
  }
  if (lower.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
    return {
      stripe: 'bg-violet-400', cardBg: 'bg-violet-50/40', foldBg: 'bg-violet-100',
      iconBg: 'bg-violet-100', iconColor: 'text-violet-600', Icon: Image, label: 'IMG',
    };
  }
  return {
    stripe: 'bg-slate-300', cardBg: 'bg-slate-50/60', foldBg: 'bg-slate-100',
    iconBg: 'bg-slate-100', iconColor: 'text-slate-500', Icon: File, label: 'FILE',
  };
}

// ─── File card ────────────────────────────────────────────────────────────────

function FileCard({
  file,
  onRemove,
  onRename,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  file: AssetFile;
  onRemove: () => void;
  onRename: (title: string) => void;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const cfg = getFileTypeConfig(file.url);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.title);

  function commitRename() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== file.title) onRename(trimmed);
    else setDraft(file.title);
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={[
        'relative group flex flex-col rounded-md border transition-all duration-150 overflow-hidden cursor-grab active:cursor-grabbing select-none',
        cfg.cardBg,
        isDragOver
          ? 'border-indigo-400 shadow-md ring-1 ring-indigo-300 scale-[1.02]'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
      ].join(' ')}
      style={{ borderTopRightRadius: 0 }}
    >
      {/* Folded corner */}
      <div
        className={`absolute top-0 right-0 w-5 h-5 border-l border-b ${cfg.foldBg}`}
        style={{ borderBottomLeftRadius: 3, borderColor: '#e2e8f0' }}
      />

      {/* Top colour stripe */}
      <div className={`h-[3px] ${cfg.stripe} shrink-0`} />

      <div className="flex flex-col gap-2 p-3 pt-2.5 flex-1">
        {/* Drag handle + type label */}
        <div className="flex items-center justify-between">
          <GripVertical className="w-3 h-3 text-slate-300 group-hover:text-slate-400 shrink-0" />
          <span className={`text-[9px] font-bold tracking-wider px-1 py-0.5 rounded ${cfg.iconBg} ${cfg.iconColor}`}>
            {cfg.label}
          </span>
        </div>

        {/* Icon */}
        <div className={`w-9 h-9 rounded-md ${cfg.iconBg} flex items-center justify-center mx-auto`}>
          <cfg.Icon className={`w-4.5 h-4.5 ${cfg.iconColor}`} strokeWidth={1.5} />
        </div>

        {/* Title */}
        <div className="flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setEditing(false); setDraft(file.title); }
              }}
              className="w-full text-[11px] bg-white/80 border border-indigo-300 rounded px-1 py-0.5 outline-none text-slate-800"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className="text-[11px] font-medium text-slate-700 line-clamp-2 leading-tight cursor-text hover:text-slate-900 text-center"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
              title="Double-click to rename"
            >
              {file.title || 'Untitled'}
            </p>
          )}
        </div>

        {/* Open link */}
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-1 text-[10px] text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          Open
        </a>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded bg-white/80 border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center"
        title="Remove file"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

// ─── Add file form ────────────────────────────────────────────────────────────

function AddFileForm({ assetId, onAdded }: { assetId: string; onAdded: (file: AssetFile) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => urlRef.current?.focus(), 50);
  }

  function handleClose() {
    setOpen(false);
    setUrl('');
    setTitle('');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    const res = await addAssetFile(assetId, url.trim(), title.trim() || undefined);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    onAdded(res.data);
    handleClose();
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 w-full justify-center rounded-md border border-dashed border-slate-300 py-2.5 text-xs text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add file
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-indigo-200 bg-indigo-50/40 p-3 flex flex-col gap-2">
      <input
        ref={urlRef}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="SharePoint or file URL"
        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-indigo-400 bg-white placeholder:text-slate-400"
        required
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional — extracted from URL if blank)"
        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-indigo-400 bg-white placeholder:text-slate-400"
      />
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="flex-1 text-xs font-medium bg-slate-900 text-white rounded px-3 py-1.5 hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="text-xs text-slate-500 hover:text-slate-700 px-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── File drawer ──────────────────────────────────────────────────────────────

export function FileDrawer({ assetId, initialFiles }: { assetId: string; initialFiles: AssetFile[] }) {
  const [files, setFiles] = useState<AssetFile[]>(initialFiles);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDragStart(index: number) {
    dragIndex.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  function handleDrop(dropIndex: number) {
    const from = dragIndex.current;
    if (from === null || from === dropIndex) { handleDragEnd(); return; }

    const next = [...files];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setFiles(next);
    handleDragEnd();
    reorderAssetFiles(next.map((f) => f.id), assetId);
  }

  async function handleRemove(fileId: string) {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    await removeAssetFile(fileId, assetId);
  }

  async function handleRename(fileId: string, title: string) {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, title } : f)));
    await updateAssetFileTitle(fileId, title, assetId);
  }

  function handleAdded(file: AssetFile) {
    setFiles((prev) => [...prev, file]);
  }

  return (
    <section className="rounded-lg border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Files</h2>
        {files.length > 0 && (
          <span className="text-[11px] text-slate-400">{files.length} attached</span>
        )}
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {files.map((file, index) => (
            <FileCard
              key={file.id}
              file={file}
              isDragOver={dragOverIndex === index}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(index)}
              onRemove={() => handleRemove(file.id)}
              onRename={(title) => handleRename(file.id, title)}
            />
          ))}
        </div>
      )}

      <AddFileForm assetId={assetId} onAdded={handleAdded} />

      {files.length > 0 && (
        <p className="text-[10px] text-slate-400 text-center">Drag to reorder · Double-click title to rename</p>
      )}
    </section>
  );
}
