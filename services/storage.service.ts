/**
 * Vercel Blob Storage Service
 * Handles all file uploads to Vercel Blob Storage
 */

import { put, del, list } from '@vercel/blob';

export type UploadFolder = 'testimonials' | 'gallery' | 'aaradhane' | 'events' | 'profile' | 'donations' | 'sevas' | 'reports';

export type ReportFileType = 'screenshot' | 'pdf' | 'json' | 'excel' | 'markdown';

export interface SaveReportOptions {
  filename: string;
  content: Buffer | Blob | string;
  contentType: string;
  fileType: ReportFileType;
  metadata?: Record<string, string>;
}

interface UploadResult {
  url: string;
  pathname: string;
}

class StorageService {
  /**
   * Upload a base64 image to Vercel Blob Storage
   * @param base64Data - Base64 encoded image data
   * @param pathname - Full pathname including folder (e.g., 'images/testimonials/filename.jpg')
   * @param folder - Optional folder for backward compatibility (ignored if pathname is full path)
   */
  async uploadBase64Image(
    base64Data: string,
    pathnameOrFilename: string,
    folder?: UploadFolder
  ): Promise<UploadResult> {
    // Extract base64 content - handle both raw base64 and data URL format
    let base64Content = base64Data;
    let mimeType = 'image/jpeg';
    
    if (base64Data.includes(',')) {
      const parts = base64Data.split(',');
      const header = parts[0];
      base64Content = parts[1];
      
      // Extract mime type from header like "data:image/jpeg;base64"
      const match = header.match(/data:([^;]+)/);
      if (match) {
        mimeType = match[1];
      }
    }
    
    // Decode base64 to binary
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });

    // Determine pathname - use full path if it contains '/', otherwise prepend folder
    const pathname = pathnameOrFilename.includes('/') 
      ? pathnameOrFilename 
      : `${folder || 'testimonials'}/${pathnameOrFilename}`;
    
    console.log(`[Storage] Uploading ${blob.size} bytes (${mimeType}) to ${pathname}`);
    
    // Upload to Vercel Blob
    const uploadedBlob = await put(pathname, blob, {
      access: 'public',
      contentType: mimeType,
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

  /**
   * Generate a report filename with timestamp
   */
  generateReportFilename(type: ReportFileType, name?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sanitizedName = name ? `_${this.sanitizeFilename(name)}` : '';
    
    const extensions: Record<ReportFileType, string> = {
      screenshot: 'png',
      pdf: 'pdf',
      json: 'json',
      excel: 'xlsx',
      markdown: 'md',
    };
    
    return `${type}/${timestamp}${sanitizedName}.${extensions[type]}`;
  }

  /**
   * Save a report file (screenshot, PDF, etc.) to Vercel Blob storage
   */
  async saveReport(options: SaveReportOptions): Promise<UploadResult> {
    const { filename, content, contentType, metadata } = options;
    
    // Ensure filename starts with reports/
    const pathname = filename.startsWith('reports/') ? filename : `reports/${filename}`;
    
    console.log(`[Storage] Saving report (${contentType}) to ${pathname}`);
    
    // Convert content to Blob if needed
    let blob: Blob;
    if (typeof content === 'string') {
      blob = new Blob([content], { type: contentType });
    } else if (Buffer.isBuffer(content)) {
      // Convert Buffer to Uint8Array for Blob compatibility
      blob = new Blob([new Uint8Array(content)], { type: contentType });
    } else {
      blob = content;
    }
    
    console.log(`[Storage] Report size: ${blob.size} bytes`);
    
    // Upload to Vercel Blob
    const uploadedBlob = await put(pathname, blob, {
      access: 'public',
      contentType: contentType,
      addRandomSuffix: false,
    });

    console.log(`[Storage] Report saved to: ${uploadedBlob.url}`);
    
    return {
      url: uploadedBlob.url,
      pathname: uploadedBlob.pathname,
    };
  }

  /**
   * Save a screenshot to Vercel Blob storage
   */
  async saveScreenshot(
    screenshotData: string,
    pageName: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    // Extract base64 content if it's a data URL
    let base64Content = screenshotData;
    if (screenshotData.includes(',')) {
      base64Content = screenshotData.split(',')[1];
    }
    
    // Decode base64 to binary
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });
    
    const filename = this.generateReportFilename('screenshot', pageName);
    
    return this.saveReport({
      filename,
      content: blob,
      contentType: 'image/png',
      fileType: 'screenshot',
      metadata,
    });
  }

  /**
   * Save a PDF to Vercel Blob storage
   */
  async savePdf(
    pdfData: Buffer | Blob | string,
    reportName: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    const filename = this.generateReportFilename('pdf', reportName);
    
    return this.saveReport({
      filename,
      content: pdfData,
      contentType: 'application/pdf',
      fileType: 'pdf',
      metadata,
    });
  }

  /**
   * List all reports
   */
  async listReports(prefix?: string): Promise<{ url: string; pathname: string }[]> {
    const { blobs } = await list({
      prefix: `reports/${prefix || ''}`,
    });
    
    return blobs.map(blob => ({
      url: blob.url,
      pathname: blob.pathname,
    }));
  }
}

export const storageService = new StorageService();
