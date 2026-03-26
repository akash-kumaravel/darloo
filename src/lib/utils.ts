import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitize filename for Firebase Storage compatibility
 * Removes special characters that can cause issues with storage paths
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .trim();
}

/**
 * Validate that file is an image and within size limits
 */
export function validateImageFile(file: File, maxSizeMb: number = 5): { valid: boolean; error?: string } {
  const maxBytes = maxSizeMb * 1024 * 1024;
  const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  if (!validImageTypes.includes(file.type)) {
    return { valid: false, error: `Invalid image type. Supported: JPG, PNG, GIF, WebP, SVG` };
  }

  if (file.size > maxBytes) {
    return { valid: false, error: `Image too large (max ${maxSizeMb}MB)` };
  }

  if (file.size < 100) {
    return { valid: false, error: 'Image file is too small' };
  }

  return { valid: true };
}
