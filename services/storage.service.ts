/**
 * Vercel Blob Storage Service
 * Handles all file uploads to Vercel Blob Storage
 */

import { put, del, list } from '@vercel/blob';

export type UploadFolder = 'testimonials' | 'gallery' | 'aaradhane' | 'events' | 'profile' | 'donations' | 'sevas';

interface UploadResult {
  url: string;
  pathname: string;
}

class StorageService {
  /**
   * Upload a base64 image to Vercel Blob Storage
   */
  async uploadBase64Image(
    base64Data: string,
    filename: string,
    folder: UploadFolder = 'testimonials'
  ): Promise<UploadResult> {
    // Convert base64 to Blob
    const response = await fetch(base64Data);
    if (!response.ok) {
      throw new Error('Failed to fetch base64 image data');
    }
    const blob = await response.blob();

    const pathname = `${folder}/${filename}`;
    
    // Upload to Vercel Blob (private store works with Next.js Image on Vercel)
    const uploadedBlob = await put(pathname, blob, {
      access: 'public',
      contentType: blob.type || 'image/jpeg',
      addRandomSuffix: false,
    });

    console.log(`[Storage] Uploaded to: ${uploadedBlob.url}`);
    
    return {
      url: uploadedBlob.url,
      pathname: uploadedBlob.pathname,
    };
  }

  /**
   * Upload a File/Blob directly
   */
  async uploadFile(
    file: File | Blob,
    filename: string,
    folder: UploadFolder = 'gallery'
  ): Promise<UploadResult> {
    const pathname = `${folder}/${filename}`;
    
    const uploadedBlob = await put(pathname, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
    });

    console.log(`[Storage] Uploaded to: ${uploadedBlob.url}`);
    
    return {
      url: uploadedBlob.url,
      pathname: uploadedBlob.pathname,
    };
  }

  /**
   * Delete a file from Vercel Blob
   */
  async deleteFile(url: string): Promise<void> {
    await del(url);
    console.log(`[Storage] Deleted: ${url}`);
  }

  /**
   * List files in a folder
   */
  async listFiles(folder: UploadFolder): Promise<{ url: string; pathname: string }[]> {
    const { blobs } = await list({
      prefix: `${folder}/`,
    });
    
    return blobs.map(blob => ({
      url: blob.url,
      pathname: blob.pathname,
    }));
  }

  /**
   * Generate a unique filename
   */
  generateFilename(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = originalName.split('.').pop() || 'jpg';
    const cleanName = prefix 
      ? `${prefix}_${timestamp}_${random}`
      : `${timestamp}_${random}`;
    return `${cleanName}.${ext}`;
  }

  /**
   * Sanitize filename for storage
   */
  sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s.-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }
}

export const storageService = new StorageService();
