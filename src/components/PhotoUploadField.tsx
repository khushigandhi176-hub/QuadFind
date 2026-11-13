import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  ExternalLink,
  HardDrive,
  ImagePlus,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { PhotoStorageProvider } from '../types';
import { uploadItemImage } from '../lib/api';
import { processImageFile } from '../lib/constants';
import { uploadImageToGoogleDrive } from '../lib/googleDrive';
import { GoogleSignInButton } from './GoogleSignInButton';

export interface PhotoUploadValue {
  imageUrl: string;
  storageProvider: PhotoStorageProvider;
  driveFileId?: string;
  driveWebViewLink?: string;
}

interface PhotoUploadFieldProps {
  value?: PhotoUploadValue;
  onChange: (next: PhotoUploadValue | undefined) => void;
  onBusyChange?: (busy: boolean) => void;
  googleAccessToken: string | null;
  onRequestGoogleSignIn: () => Promise<string | null>;
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
  googleAccessToken,
  onRequestGoogleSignIn,
  compact = false,
}: PhotoUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [provider, setProvider] = useState<PhotoStorageProvider>(
    value?.storageProvider ?? 'system',
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<UploadMeta | null>(null);

  const handleGoogleConnect = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await onRequestGoogleSignIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in was cancelled.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    setIsUploading(true);
    onBusyChange?.(true);
    try {
      const processed = await processImageFile(file);

      let driveFileId: string | undefined;
      let driveWebViewLink: string | undefined;

      if (provider === 'drive') {
        let token = googleAccessToken;
        if (!token) {
          token = await onRequestGoogleSignIn();
        }
        if (!token) {
          throw new Error('Sign in with Google to upload photos to Google Drive.');
        }
        const driveResult = await uploadImageToGoogleDrive(token, {
          dataUrl: processed.dataUrl,
          filename: processed.originalName,
        });
        driveFileId = driveResult.fileId;
        driveWebViewLink = driveResult.webViewLink;
      }

      const systemUpload = await uploadItemImage({
        dataUrl: processed.dataUrl,
        filename: processed.originalName,
      });

      setMeta({
        filename: processed.originalName,
        formatLabel: processed.mimeType === 'image/png' ? 'PNG' : 'JPEG',
        dimensions: `${processed.width} × ${processed.height}`,
      });

      onChange({
        imageUrl: systemUpload.imageUrl,
        storageProvider: provider,
        driveFileId,
        driveWebViewLink,
      });
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

  const driveAuthRequired = provider === 'drive' && !googleAccessToken;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div
          role="group"
          aria-label="Choose photo upload destination"
          className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          <button
            type="button"
            disabled={isUploading}
            onClick={() => {
              setError(null);
              setProvider('system');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              provider === 'system'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" aria-hidden="true" />
            Upload to System
          </button>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => {
              setError(null);
              setProvider('drive');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              provider === 'drive'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
            Upload to Google Drive
          </button>
        </div>

        <span className="text-[11px] text-slate-500">
          {provider === 'drive'
            ? 'Saves to your Google Drive & links to listing'
            : 'Saves directly to campus server'}
        </span>
      </div>

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
          <div
            className={`relative w-full bg-slate-100 overflow-hidden ${
              compact ? 'aspect-[16/10]' : 'aspect-[4/3]'
            }`}
          >
            <img
              src={value.imageUrl}
              alt="Uploaded item photo preview"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="px-3.5 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate">
                {meta?.filename || 'Attached item photo'}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>
                  {value.storageProvider === 'drive' ? 'Google Drive' : 'System Storage'}
                </span>
                {meta && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {meta.formatLabel} · {meta.dimensions}
                    </span>
                  </>
                )}
                {value.driveWebViewLink && (
                  <>
                    <span aria-hidden="true">·</span>
                    <a
                      href={value.driveWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium"
                    >
                      Open in Drive
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </div>
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
      ) : driveAuthRequired ? (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-6 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center">
          <p className="text-sm text-slate-700 max-w-md">
            Sign in with Google to upload your JPEG or PNG item photo directly to Google Drive.
          </p>
          <GoogleSignInButton
            onClick={handleGoogleConnect}
            disabled={isSigningIn}
            label={isSigningIn ? 'Connecting...' : 'Sign in with Google'}
          />
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
                ? provider === 'drive'
                  ? 'Uploading photo to Google Drive...'
                  : 'Uploading photo...'
                : provider === 'drive'
                  ? 'Drop photo here or click to upload to Google Drive'
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
