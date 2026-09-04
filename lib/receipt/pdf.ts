import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument,PDFFont,PDFImage,StandardFonts,rgb } from "pdf-lib";

import type { Receipt } from "@/types/receipt";

export interface ReceiptTempleContact {
  templeName: string;
  subtitle: string;
  address: string;
  phone: string;
  email: string;
}

export interface ReceiptPdfOptions {
  temple?: ReceiptTempleContact;
  logoBytes?: Uint8Array;
  logoFallbackPath?: string;
  logoFallbackOrigin?: string;
}

const DEFAULT_TEMPLE: ReceiptTempleContact = {
  templeName: "Sri Raghavendra Swamy Matha",subtitle: "Yelahanka New Town,Bengaluru",address: "Sri Rayara Matha,Yelahanka New Town,Bengaluru",phone: "+91 9886364462",email: "ngowda759@gmail.com",};

const GOLD = hexRgb("C2862F");
const DARK = hexRgb("21201C");
const GRAY = hexRgb("6B6B6B");

function hexRgb(hex: string): ReturnType<typeof rgb> {
  const value = parseInt(hex,16);
  const r = Math.floor(value / 65536) % 256;
  const g = Math.floor(value / 256) % 256;
  const b = value % 256;
  return rgb(r / 255,g / 255,b / 255);
}

function toAscii(value: unknown): string {
  const text = String(value ?? "").trim();
  return text.replace(/[^A-Za-z0-9 .,:;/#@()+-]/g," ").trim();
}

function truncate(text: string,font: PDFFont,size: number,maxWidth: number): string {
  const safe = toAscii(text);
  if (font.widthOfTextAtSize(safe,size) <= maxWidth) return safe;
  const cut = safe.length - 4;
  return safe.slice(0,cut).concat("...");
}

const PAGESIZE_W = 612;
const PAGESIZE_H = 792;
const MARGIN = 48;
const RIGHT = PAGESIZE_W - MARGIN;

function line(page:any,x1:number,y1:number,x2:number,y2:number,width:number): void {
  page.drawLine({ start: { x: x1,y: y1 },end: { x: x2,y: y2 },thickness: width,color: GRAY });
}

function text(page:any,label:string,x:number,y:number,font:PDFFont,size:number,color:any): void {
  page.drawText(label,{ x,y,size,font,color });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN",{ day: "2-digit",month: "short",year: "numeric" });
}

function drawHeader(page:any,font:PDFFont,bold:PDFFont,logo:PDFImage | null): void {
  page.drawRectangle({ x: 0,y: PAGESIZE_H_MINUS_12,width: PAGESIZE_W,height: 12,color: GOLD });
  let x = MARGIN;
  if (logo) {
    const ratio = Math.min(64 / logo.width,64 / logo.height);
    const lw = Math.floor(logo.width * ratio);
    const lh = Math.floor(logo.height * ratio);
    const logoY = PAGESIZE_H_MINUS_88;
    page.drawImage(logo,{ x,y: logoY - lh,width: lw,height: lh });
    x = x + lw + 16;
  }
  page.drawText("SRI RAGHAVENDRA SWAMY MATHA",{ x,y: PAGESIZE_H_MINUS_48,size: 18,font: bold,color: DARK });
  page.drawText("Yelahanka New Town,Bengaluru",{ x,y: PAGESIZE_H_MINUS_70,size: 11,font,color: GRAY });
}

const PAGESIZE_H_MINUS_12 = PAGESIZE_H - 12;
const PAGESIZE_H_MINUS_48 = PAGESIZE_H - 48;
const PAGESIZE_H_MINUS_70 = PAGESIZE_H - 70;
const PAGESIZE_H_MINUS_88 = PAGESIZE_H - 88;
const PAGESIZE_H_MINUS_108 = PAGESIZE_H - 108;
const PAGESIZE_H_MINUS_118 = PAGESIZE_H - 118;
const PAGESIZE_H_MINUS_140 = PAGESIZE_H - 140;
const PAGESIZE_H_MINUS_190 = PAGESIZE_H - 190;

function drawMeta(page:any,font:PDFFont,bold:PDFFont,receipt:Receipt): void {
  text(page,"Receipt Number",MARGIN,PAGESIZE_H_MINUS_108,font,10,GRAY);
  text(page,receipt.receiptNumber,MARGIN + 115,PAGESIZE_H_MINUS_108,bold,11,DARK);
  text(page,"Date",RIGHT - 85,PAGESIZE_H_MINUS_108,font,10,GRAY);
  page.drawText(formatDate(receipt.createdAt),{ x: RIGHT -  30,y: PAGESIZE_H_MINUS_108,font: bold,size:  11,color: DARK });
  line(page,MARGIN,PAGESIZE_H_MINUS_118,RIGHT,PAGESIZE_H_MINUS_118,1);
  const rowY = PAGESIZE_H_MINUS_140;
  text(page,"Devotee",MARGIN,rowY,font,10,GRAY);
  text(page,receipt.devoteeName,MARGIN + 115,rowY,bold,11,DARK);
  text(page,"Mobile",MARGIN + 310,rowY,font,10,GRAY);
  text(page,receipt.devoteePhone || "-",MARGIN + 370,rowY,bold,11,DARK);
  const metaY = rowY - 28;
  if (receipt.devoteeEmail) {
    text(page,"Email",MARGIN,metaY,font,10,GRAY);
    text(page,receipt.devoteeEmail,MARGIN + 115,metaY,bold,11,DARK);
  }
  if (receipt.devoteeAddress) {
    text(page,"Address",MARGIN,metaY,font,10,GRAY);
  }
}

function drawItems(page:any,font:PDFFont,bold:PDFFont,receipt:Receipt): number {
  let y = PAGESIZE_H_MINUS_190;
  text(page,"Seva",MARGIN,y,bold,10,GRAY);
  text(page,"Qty",MARGIN_PLUS_260,y,bold,10,GRAY);
  text(page,"Rate",RIGHT_MINUS_120,y,bold,10,GRAY);
  text(page,"Amount",RIGHT,y,bold,10,GRAY);
  y =y - 16;
  line(page,MARGIN,y,RIGHT,y,1);
  y =y - 10;
  receipt.items.forEach((item,index) => {
    if (index > 0) {
      y =y - 6;
    }
    text(page,item.sevaName,MARGIN,y,font,11,DARK);
    text(page,String(item.quantity),MARGIN_PLUS_260,y,font,11,DARK);
    text(page,formatPdfAmount(item.rate),RIGHT_MINUS_120,y,font,11,DARK);
    text(page,formatPdfAmount(item.amount),RIGHT,y,font,11,DARK);
    y =y - 22;
  });
  return y;
}

const MARGIN_PLUS_260 = MARGIN + 260;
const RIGHT_MINUS_120 = RIGHT - 120;

function drawTotals(page:any,font:PDFFont,bold:PDFFont,receipt:Receipt): number {
  let y = drawItems(page,font,bold,receipt);
  y =y - 18;
  if (receipt.subtotal !== receipt.totalAmount) {
    text(page,"Subtotal",MARGIN,y,font,11,DARK);
    text(page,formatPdfAmount(receipt.subtotal),RIGHT,y,bold,11,DARK);
    y =y - 20;
  }
  line(page,MARGIN,y,RIGHT,y,1);
  y =y - 14;
  text(page,"Total Amount",MARGIN,y,bold,13,DARK);
  text(page,formatPdfAmount(receipt.totalAmount),RIGHT,y,bold,13,DARK);
  y =y - 30;
  return y;
}

function drawNotes(page:any,font:PDFFont,bold:PDFFont,receipt:Receipt,y:number): number {
  let yy = y;
  if (receipt.paymentReference) {
    text(page,"UPI Reference",MARGIN,yy,font,10,GRAY);
    text(page,receipt.paymentReference,MARGIN + 115,yy,font,11,DARK);
    yy = yy - 24;
  }
  const mode = receipt.paymentMode === "upi" ? "UPI" : receipt.paymentMode;
  text(page,"Payment Mode",MARGIN,yy,font,10,GRAY);
  text(page,mode,MARGIN + 115,yy,bold,11,DARK);
  yy = yy - 24;
  if (receipt.notes) {
    const noteLines = truncate(receipt.notes,font,10,RIGHT - MARGIN - 20);
    text(page,"Notes",MARGIN,yy,font,10,GRAY);
    text(page,noteLines,MARGIN + 115,yy,font,11,DARK);
    yy = yy - 24;
  }
  const contact = [DEFAULT_TEMPLE.phone,DEFAULT_TEMPLE.email].filter(Boolean).join(" | ");
  text(page,contact,MARGIN,yy,font,9,GRAY);
  return yy - 20;
}

export async function buildReceiptPdf(
  receipt: Receipt,options?: ReceiptPdfOptions
): Promise<Uint8Array> {
  const temple = { ...DEFAULT_TEMPLE,...(options?.temple || {}) };
  const pdf = await PDFDocument.create();
  pdf.setTitle(receipt.receiptNumber + " - " + temple.templeName);
  pdf.setCreator("Sri Raghavendra Swamy Matha");
  pdf.setProducer("Sri Raghavendra Swamy Matha");
  pdf.setSubject("Seva Receipt");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGESIZE_W,PAGESIZE_H]);
  const logo = await loadLogoBytes(options);
  drawHeader(page,font,bold,logo);
  drawMeta(page,font,bold,receipt);
  const y = drawTotals(page,font,bold,receipt);
  drawNotes(page,font,bold,receipt,y);
  const bytes = await pdf.save({ useObjectStreams: false });
  return new Uint8Array(bytes);
}

export function formatPdfAmount(amount: number): string {
  const formatted = new Intl.NumberFormat("en-IN",{ maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
  return "Rs. " + formatted;
}

async function loadLogoBytes(options?: ReceiptPdfOptions): Promise<PDFImage | null> {
  const files: string[] = [
    options?.logoFallbackPath as string,
    options?.logoFallbackOrigin as string,
    path.join(process.cwd(), "public", "images", "logos", "ynk_matha_logo.png") as string,
    path.join(process.cwd(), "public", "images", "logo.png") as string,
  ];
  if (options?.logoBytes) return embedFromBytes(options.logoBytes);
  for (const file of files) {
    try {
      const bytes = await readFile(file);
      return embedFromBytes(bytes);
    } catch {
      // try next
    }
  }
  return null;
}

async function embedFromBytes(bytes: Uint8Array | Buffer): Promise<PDFImage> {
  const doc = await PDFDocument.create();
  const imageBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as never);
  const img = await doc.embedPng(imageBytes as never);
  return img;
}