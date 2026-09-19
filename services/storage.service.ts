import "server-only";

/**
 * Supabase Storage Service
 * Handles all file uploads to Supabase Storage, replacing Vercel Blob
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type UploadFolder = 'testimonials' | 'gallery' | 'videos' | 'aaradhane' | 'events' | 'profile' | 'donations' | 'sevas' | 'reports';

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

const BUCKET_NAME = 'temple-media';

class StorageService {
  /**
   * Get the singleton Supabase admin client instances
   * We initialize it on demand to avoid errors during build/client initialization if env vars are missing
   */
  private getClient() {
    return createAdminClient();
  }

  /**
   * Upload a base64 image to Supabase Storage
   * @param base64Data - Base64 encoded image data
   * @param pathnameOrFilename - Full pathname including folder (e.g., 'images/testimonials/filename.jpg')
   * @param folder - Optional folder for backward compatibility (ignored if pathname is full path)
   */
  async uploadBase64Image(
    base64Data: string,
    pathnameOrFilename: string,
    folder?: UploadFolder
  ): Promise<UploadResult> {
    const supabase = this.getClient();

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
    
    // Decode base64 to binary buffer for Node.js upload
    const buffer = Buffer.from(base64Content, 'base64');

    // Determine pathname - use full path if it contains '/', otherwise prepend folder
    const pathname = pathnameOrFilename.includes('/') 
      ? pathnameOrFilename 
      : `${folder || 'testimonials'}/${pathnameOrFilename}`;
    
    console.log(`[Storage] Uploading ${buffer.length} bytes (${mimeType}) to ${pathname}`);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(pathname, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error(`[Storage] Upload error:`, error);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(pathname);

    console.log(`[Storage] Uploaded to: ${publicUrlData.publicUrl}`);
    
    return {
      url: publicUrlData.publicUrl,
      pathname: pathname,
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
    const supabase = this.getClient();
    const pathname = `${folder}/${filename}`;
    
    // Convert Blob/File to Buffer for reliable server-side upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(pathname, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error(`[Storage] Upload file error:`, error);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(pathname);

    console.log(`[Storage] Uploaded to: ${publicUrlData.publicUrl}`);
    
    return {
      url: publicUrlData.publicUrl,
      pathname: pathname,
    };
  }

  /**
   * Upload a video file to Supabase Storage
   * Videos are stored under gallery/videos/{filename} for gallery media
   */
  async uploadVideo(
    file: File | Blob,
    filename?: string
  ): Promise<UploadResult> {
    const fileType = file instanceof File ? file.type : 'video/mp4';
    
    // Generate filename if not provided
    const finalFilename = filename || this.generateFilename(
      file instanceof File ? file.name : 'video.mp4',
      'video'
    );
    
    const pathname = `gallery/videos/${finalFilename}`;
    const contentType = file instanceof File ? file.type : 'video/mp4';
    
    const supabase = this.getClient();

    console.log(`[Storage] Uploading video (${(file instanceof File ? file.size : 0) / (1024 * 1024)} MB) to ${pathname}`);
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(pathname, buffer, {
        contentType: contentType,
        upsert: true,
      });

    if (error) {
      console.error(`[Storage] Upload video error:`, error);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(pathname);

    console.log(`[Storage] Video uploaded to: ${publicUrlData.publicUrl}`);
    
    return {
      url: publicUrlData.publicUrl,
      pathname: pathname,
    };
  }

  /**
   * List all videos in gallery/videos folder
   */
  async listVideos(): Promise<{ url: string; pathname: string; size: number }[]> {
    const supabase = this.getClient();
    
    // List files in the prefix directory
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('gallery/videos', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      console.error(`[Storage] List videos error:`, error);
      return [];
    }

    // Map to result, ignoring the empty placeholder if present
    return data
      .filter(file => file.name !== '.emptyFolderPlaceholder')
      .map(file => {
        const pathname = `gallery/videos/${file.name}`;
        const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(pathname);
        return {
          url: urlData.publicUrl,
          pathname: pathname,
          size: file.metadata?.size || 0,
        };
      });
  }

  /**
   * Delete a file from Storage
   */
  async deleteFile(urlOrPathname: string): Promise<void> {
    const supabase = this.getClient();

    // Extract pathname if a URL was provided
    let pathname = urlOrPathname;
    if (urlOrPathname.startsWith('http')) {
      // e.g. https://xyz.supabase.co/storage/v1/object/public/temple-media/gallery/videos/video.mp4
      const urlParts = urlOrPathname.split(`/object/public/${BUCKET_NAME}/`);
      if (urlParts.length > 1) {
        pathname = urlParts[1];
      }
    }

    // Attempt to decode URI if it's encoded
    pathname = decodeURIComponent(pathname);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([pathname]);

    if (error) {
      console.error(`[Storage] Delete error for ${pathname}:`, error);
      throw error;
    }
    console.log(`[Storage] Deleted: ${pathname}`);
  }

  /**
   * List files in a folder
   */
  async listFiles(folder: UploadFolder): Promise<{ url: string; pathname: string }[]> {
    const supabase = this.getClient();
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      console.error(`[Storage] List files error for ${folder}:`, error);
      return [];
    }

    return data
      .filter(file => file.name !== '.emptyFolderPlaceholder')
      .map(file => {
        const pathname = `${folder}/${file.name}`;
        const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(pathname);
        return {
          url: urlData.publicUrl,
          pathname: pathname,
        };
      });
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
   * Save a report file (screenshot, PDF, etc.) to Storage
   */
  async saveReport(options: SaveReportOptions): Promise<UploadResult> {
    const { filename, content, contentType, metadata } = options;
    
    // Ensure filename starts with reports/
    const pathname = filename.startsWith('reports/') ? filename : `reports/${filename}`;
    
    console.log(`[Storage] Saving report (${contentType}) to ${pathname}`);
    
    // Convert content to Buffer if needed
    let buffer: Buffer;
    if (typeof content === 'string') {
      buffer = Buffer.from(content, 'utf-8');
    } else if (Buffer.isBuffer(content)) {
      buffer = content;
    } else {
      const arrayBuffer = await content.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }
    
    console.log(`[Storage] Report size: ${buffer.length} bytes`);
    
    const supabase = this.getClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(pathname, buffer, {
        contentType: contentType,
        upsert: true,
      });

    if (error) {
      console.error(`[Storage] Save report error:`, error);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(pathname);

    console.log(`[Storage] Report saved to: ${publicUrlData.publicUrl}`);
    
    return {
      url: publicUrlData.publicUrl,
      pathname: pathname,
    };
  }

  /**
   * Save a screenshot to Storage
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
    
    const buffer = Buffer.from(base64Content, 'base64');
    const filename = this.generateReportFilename('screenshot', pageName);
    
    return this.saveReport({
      filename,
      content: buffer,
      contentType: 'image/png',
      fileType: 'screenshot',
      metadata,
    });
  }

  /**
   * Save a PDF to Storage
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
    const supabase = this.getClient();

    const folder = prefix ? `reports/${prefix}` : 'reports';
    
    // In Supabase, list is flat within a folder prefix. If there are subfolders,
    // they are returned without metadata. We might need to iterate or just query the exact folder.
    // Assuming reports are flat per prefix like 'reports/screenshot'.
    const searchPath = folder;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(searchPath, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'desc' },
      });

    if (error) {
      console.error(`[Storage] List reports error:`, error);
      return [];
    }

    return data
      .filter(file => file.name !== '.emptyFolderPlaceholder')
      .map(file => {
        // Need to correctly compose pathname
        const pathname = `${searchPath}/${file.name}`;
        const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(pathname);
        return {
          url: urlData.publicUrl,
          pathname: pathname,
        };
      });
  }
}

export const storageService = new StorageService();
