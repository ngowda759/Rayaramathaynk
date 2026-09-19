import { NextRequest, NextResponse } from "next/server";
import { storageService, ReportFileType } from "@/services/storage.service";

export const runtime = 'nodejs';
export const maxDuration = 60;

interface SaveReportRequest {
  type: ReportFileType;
  name: string;
  content: string; // Base64 encoded for screenshots, or raw string/JSON for PDFs
  contentType: string;
  metadata?: Record<string, string>;
}

/**
 * Save a report file (screenshot or PDF) to Vercel Blob storage
 * 
 * POST /api/reports/save
 * Body: {
 *   type: 'screenshot' | 'pdf' | 'json' | 'excel' | 'markdown',
 *   name: string,
 *   content: string (base64 for images, raw for text),
 *   contentType: string,
 *   metadata?: Record<string, string>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body: SaveReportRequest = await request.json();
    const { type, name, content, contentType, metadata } = body;

    // Validate required fields
    if (!type || !content) {
      return NextResponse.json(
        { error: "Missing required fields: type and content are required" },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes: ReportFileType[] = ['screenshot', 'pdf', 'json', 'excel', 'markdown'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid file type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    let result;

    if (type === 'screenshot') {
      // Handle screenshot - content should be base64 encoded image data
      result = await storageService.saveScreenshot(
        content,
        name || 'screenshot',
        metadata
      );
    } else if (type === 'pdf') {
      // Handle PDF - content can be base64 encoded or raw binary
      let pdfBuffer: Buffer;
      
      if (contentType === 'application/pdf' || content.startsWith('JVBERi0xLjQ')) {
        // Base64 encoded PDF
        const base64Content = content.includes(',') 
          ? content.split(',')[1] 
          : content;
        pdfBuffer = Buffer.from(base64Content, 'base64');
      } else {
        // Raw string content
        pdfBuffer = Buffer.from(content);
      }
      
      result = await storageService.savePdf(
        pdfBuffer,
        name || 'report',
        metadata
      );
    } else {
      // Handle other file types (json, excel, markdown)
      const filename = storageService.generateReportFilename(type, name || 'report');
      result = await storageService.saveReport({
        filename,
        content,
        contentType: contentType || getContentType(type),
        fileType: type,
        metadata,
      });
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      pathname: result.pathname,
      message: `${type} saved successfully`,
    });
  } catch (error) {
    console.error("Error saving report:", error);
    return NextResponse.json(
      { error: "Failed to save report. Please try again." },
      { status: 500 }
    );
  }
}

function getContentType(type: ReportFileType): string {
  const contentTypes: Record<ReportFileType, string> = {
    screenshot: 'image/png',
    pdf: 'application/pdf',
    json: 'application/json',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    markdown: 'text/markdown',
  };
  return contentTypes[type];
}
