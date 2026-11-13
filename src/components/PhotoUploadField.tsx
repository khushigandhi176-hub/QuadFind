import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ImagePlus, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { uploadItemImage } from '../lib/api';
import { processImageFile } from '../lib/constants';

interface PhotoUploadFieldProps {
  value?: string;
  onChange: (imageUrl: string | undefined) => void;
  onBusyChange?: (busy: boolean) => void;
  compact?: boolean;
}

interface UploadMeta {
  filename: string;
  formatLabel: string;
  dimensions?: string;
}

export function PhotoUploadField({
  value,
  onChange,
  onBusyChange,
  compact = false,
}: PhotoUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<UploadMeta | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setIsUploading(true);
    onBusyChange?.(true);
    try {
      const processed = await processImageFile(file);
      const uploaded = await uploadItemImage({
        dataUrl: processed.dataUrl,
        filename: processed.originalName,
      });
      setMeta({
        filename: processed.originalName,
        formatLabel: processed.mimeType === 'image/png' ? 'PNG' : 'JPEG',
        dimensions: `${processed.width} × ${processed.height}`,
      });
      onChange(uploaded.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload image.');
    } finally {
      setIsUploading(false);
      onBusyChange?.(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        onChange={handleInputChange}
        className="sr-only"
      />

      {value ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
          <div className={`relative w-full bg-slate-100 overflow-hidden ${compact ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}>
            <img
              src={value}
              alt="Uploaded item photo preview"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="px-3.5 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate">
                {meta?.filename || 'Attached item photo'}
              </p>
              {meta && (
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {meta.formatLabel} · {meta.dimensions}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {isUploading ? 'Uploading...' : 'Replace'}
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  setMeta(null);
                  setError(null);
                  onChange(undefined);
                }}
                aria-label="Remove attached photo"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-white border border-slate-300 hover:bg-red-50 hover:border-red-200 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 px-4 border border-dashed rounded-xl transition-colors cursor-pointer text-center ${
            compact ? 'py-4' : 'py-6'
          } ${
            isDragging
              ? 'border-blue-700 bg-blue-50/60'
              : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
          }`}
        >
          {isUploading ? (
            <UploadCloud className="w-6 h-6 text-blue-700 animate-pulse" />
          ) : (
            <ImagePlus className="w-6 h-6 text-slate-400" />
          )}
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-slate-700">
              {isUploading
                ? 'Uploading photo...'
                : 'Drag and drop an item photo, or click to browse'}
            </p>
            <p className="text-xs text-slate-500">
              Supports JPEG (.jpg, .jpeg) and PNG (.png) up to 10 MB
            </p>
          </div>
        </label>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
