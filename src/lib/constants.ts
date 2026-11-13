import type { ItemCategory } from '../types';

export const ITEM_CATEGORIES: ItemCategory[] = [
  'Electronics',
  'Keys & IDs',
  'Books & Notes',
  'Bottles & Gear',
  'Eyewear & Accessories',
  'Bags & Apparel',
];

export const CAMPUS_BUILDINGS: string[] = [
  'Main Library',
  'Student Union',
  'Science Hall',
  'Engineering Quad',
  'Athletic Center',
  'Dining Commons',
  'Arts & Humanities',
  'North Residence Halls',
];

export const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
export const MAX_RAW_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ProcessedImageResult {
  dataUrl: string;
  mimeType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
  originalName: string;
}

export function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatShortDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function processImageFile(file: File): Promise<ProcessedImageResult> {
  const mime = file.type.toLowerCase();
  const nameLower = file.name.toLowerCase();
  const hasValidExtension =
    nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.png');

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mime) && !hasValidExtension) {
    throw new Error('Unsupported file format. Please upload a JPEG (.jpg, .jpeg) or PNG (.png) image.');
  }

  if (file.size > MAX_RAW_IMAGE_BYTES) {
    throw new Error('Image file is larger than 10 MB. Please choose a smaller photo.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid or corrupted JPEG/PNG image.'));
      img.onload = () => {
        const maxWidth = 1280;
        const maxHeight = 960;
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process image in browser.'));
          return;
        }

        const isPng = mime === 'image/png' || nameLower.endsWith('.png');
        if (isPng) {
          ctx.drawImage(img, 0, 0, width, height);
          const pngDataUrl = canvas.toDataURL('image/png');
          if (pngDataUrl.length <= 1_300_000) {
            resolve({
              dataUrl: pngDataUrl,
              mimeType: 'image/png',
              width,
              height,
              originalName: file.name,
            });
            return;
          }
          // Oversized PNG: composite onto neutral chalk background and export JPEG
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(0, 0, width, height);
        } else {
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }

        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.84);
        resolve({
          dataUrl: jpegDataUrl,
          mimeType: 'image/jpeg',
          width,
          height,
          originalName: file.name,
        });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
