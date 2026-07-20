import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface FontInfo {
  family: string;
  fullName: string;
  status: 'loaded' | 'failed' | 'pending';
}

interface ValidationResult {
  pageUrl: string;
  pageName: string;
  screenshotPath: string;
  pdfPath: string;
  fontsUsed: FontInfo[];
  passed: boolean;
  issues: string[];
  missingGlyphs: string[];
}

interface ValidationReport {
  generatedAt: string;
  totalPages: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  summary: {
    missingFonts: string[];
    componentsFixed: string[];
  };
}

const KANNADA_PAGES = [
  { name: 'About', path: '/about' },
  { name: 'Shlokas', path: '/shlokas' },
  { name: 'Trust Committee', path: '/trust' },
  { name: 'Future Plans', path: '/future-plans' },
  { name: 'AI Analytics', path: '/ai/analytics' },
];

const OUTPUT_DIR = path.join(__dirname, 'reports', 'kannada-font-validation');
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots');
const PDF_DIR = path.join(OUTPUT_DIR, 'pdfs');

// Ensure output directories exist
[OUTPUT_DIR, SCREENSHOT_DIR, PDF_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function waitForFontsAndNetwork(page: Page): Promise<void> {
  // Wait for document.fonts.ready
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  // Wait a fixed amount of time for fonts to load
  // (avoid networkidle as Firebase keeps connections open)
  await page.waitForTimeout(3000);
}

async function detectMissingGlyphs(page: Page): Promise<string[]> {
  const missingGlyphs = await page.evaluate(() => {
    const KannadaRegex = /[\u0C80-\u0CFF]/g;
    const allTextNodes: Text[] = [];
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Text) => {
          if (KannadaRegex.test(node.textContent || '')) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      allTextNodes.push(node);
    }

    const missing: string[] = [];

    for (const textNode of allTextNodes) {
      const text = textNode.textContent || '';
      const parent = textNode.parentElement;
      
      if (!parent) continue;

      // Check if the computed font can render the Kannada text
      const computedStyle = window.getComputedStyle(parent);
      const fontFamily = computedStyle.fontFamily;
      
      // Create a canvas to test glyph rendering
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.font = `16px ${fontFamily}`;
      
      // Test each unique Kannada character
      const uniqueChars = [...new Set(text.match(KannadaRegex) || [])];
      for (const char of uniqueChars) {
        const metrics = ctx.measureText(char);
        // If the width is 0 or near-zero, the glyph might be missing
        if (metrics.width < 5) {
          missing.push(`Character: ${char} (U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}) in: "${text.substring(0, 30)}..."`);
        }
      }
    }

    return missing;
  });

  return missingGlyphs;
}

async function getLoadedFonts(page: Page): Promise<FontInfo[]> {
  const fonts = await page.evaluate(() => {
    const fontList: FontInfo[] = [];
    
    document.fonts.forEach((fontFace: FontFace) => {
      fontList.push({
        family: fontFace.family,
        fullName: fontFace.fullname,
        status: fontFace.status
      });
    });

    // If document.fonts is empty, try to get fonts from CSS
    if (fontList.length === 0) {
      // Check computed styles for font-family
      const bodyStyle = window.getComputedStyle(document.body);
      const bodyFont = bodyStyle.fontFamily;
      
      // Add a note that fonts are loaded via CSS variables
      fontList.push({
        family: 'CSS Font Stack (check computed styles)',
        fullName: bodyFont,
        status: 'loaded' as const
      });
    }

    return fontList;
  });

  return fonts;
}

async function checkFontLoading(page: Page): Promise<{ success: boolean; errors: string[] }> {
  const result = await page.evaluate(() => {
    const errors: string[] = [];
    
    document.fonts.forEach((fontFace: FontFace) => {
      // Ignore "Fallback" fonts - these are system fallbacks that don't load as font faces
      if (fontFace.status === 'error' && !fontFace.family.includes('Fallback')) {
        errors.push(`Font "${fontFace.family}" (${fontFace.fullname}) failed to load: ${fontFace.status}`);
      }
    });

    // Check if fonts are being applied
    const bodyStyles = window.getComputedStyle(document.body);
    const fontFamily = bodyStyles.fontFamily;
    
    return { errors, fontFamily };
  });

  return {
    success: result.errors.length === 0,
    errors: result.errors
  };
}

async function capturePageArtifacts(
  page: Page,
  pageName: string
): Promise<{ screenshotPath: string; pdfPath: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = pageName.replace(/\s+/g, '-').toLowerCase();

  // Take full-page screenshot
  const screenshotPath = path.join(SCREENSHOT_DIR, `${safeName}-${timestamp}.png`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    type: 'png'
  });

  // Generate A4 PDF
  const pdfPath = path.join(PDF_DIR, `${safeName}-${timestamp}.pdf`);
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    }
  });

  return { screenshotPath, pdfPath };
}

async function validatePage(page: Page, pageInfo: { name: string; path: string }): Promise<ValidationResult> {
  // Use local dev server for testing
  const baseUrl = 'http://localhost:3000';
  const url = `${baseUrl}${pageInfo.path}`;

  console.log(`\n🔍 Testing: ${pageInfo.name} (${url})`);

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for fonts and network
  await waitForFontsAndNetwork(page);

  // Additional wait for any lazy-loaded content
  await page.waitForTimeout(2000);

  // Get loaded fonts
  const fonts = await getLoadedFonts(page);
  console.log(`   Fonts detected: ${fonts.map(f => f.family).join(', ') || 'None'}`);

  // Check font loading status
  const fontLoadingResult = await checkFontLoading(page);
  console.log(`   Font loading: ${fontLoadingResult.success ? '✅ OK' : '❌ Issues found'}`);

  // Detect missing glyphs
  const missingGlyphs = await detectMissingGlyphs(page);
  console.log(`   Missing glyphs: ${missingGlyphs.length === 0 ? 'None' : missingGlyphs.length}`);

  // Capture artifacts
  const { screenshotPath, pdfPath } = await capturePageArtifacts(page, pageInfo.name);
  console.log(`   Screenshot: ${screenshotPath}`);
  console.log(`   PDF: ${pdfPath}`);

  const issues: string[] = [...fontLoadingResult.errors];
  
  // Check for visible text vs DOM text
  const textVisibilityCheck = await page.evaluate(() => {
    const KannadaRegex = /[\u0C80-\u0CFF]/g;
    let totalKannadaChars = 0;
    const invisibleElements: string[] = [];

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null
    );

    let node: Element | null;
    while ((node = walker.nextNode() as Element | null)) {
      const text = node.textContent || '';
      const matches = text.match(KannadaRegex);
      if (matches) {
        totalKannadaChars += matches.length;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
          invisibleElements.push(`Element ${node.tagName} with class "${node.className}" contains Kannada text`);
        }
      }
    }

    return { totalKannadaChars, invisibleElements };
  });

  console.log(`   Kannada characters found in DOM: ${textVisibilityCheck.totalKannadaChars}`);

  const passed = fontLoadingResult.success && missingGlyphs.length === 0;

  if (!passed) {
    issues.push(...missingGlyphs);
  }

  return {
    pageUrl: url,
    pageName: pageInfo.name,
    screenshotPath,
    pdfPath,
    fontsUsed: fonts,
    passed,
    issues,
    missingGlyphs
  };
}

test.describe('Kannada Font Validation', () => {
  let report: ValidationReport;

  test.beforeAll(async () => {
    report = {
      generatedAt: new Date().toISOString(),
      totalPages: KANNADA_PAGES.length,
      passed: 0,
      failed: 0,
      results: [],
      summary: {
        missingFonts: [],
        componentsFixed: []
      }
    };
  });

  for (const pageInfo of KANNADA_PAGES) {
    test(`Kannada Font Validation: ${pageInfo.name}`, async ({ page }) => {
      const result = await validatePage(page, pageInfo);
      
      report.results.push(result);
      
      if (result.passed) {
        report.passed++;
      } else {
        report.failed++;
      }

      // Log issues for debugging
      if (result.issues.length > 0) {
        console.log(`\n⚠️  Issues found on ${pageInfo.name}:`);
        result.issues.forEach(issue => console.log(`   - ${issue}`));
      }

      // Expect Kannada text to be rendered (check for presence of Kannada characters in DOM)
      // The test passes if we find Kannada characters in the DOM
      // We pass if missing glyphs are 0 (meaning fonts can render the characters)
      expect(result.missingGlyphs.length).toBe(0);
    });
  }

  test.afterAll(async () => {
    // Generate report
    const reportPath = path.join(OUTPUT_DIR, 'validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdownReport = generateMarkdownReport(report);
    const markdownPath = path.join(OUTPUT_DIR, 'validation-report.md');
    fs.writeFileSync(markdownPath, markdownReport);

    console.log(`\n📊 Validation Report saved to: ${reportPath}`);
    console.log(`📄 Markdown Report saved to: ${markdownPath}`);
  });
});

function generateMarkdownReport(report: ValidationReport): string {
  let md = `# Kannada Font Validation Report\n\n`;
  md += `**Generated:** ${report.generatedAt}\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Pages Tested | ${report.totalPages} |\n`;
  md += `| Passed | ✅ ${report.passed} |\n`;
  md += `| Failed | ❌ ${report.failed} |\n\n`;

  if (report.summary.missingFonts.length > 0) {
    md += `### Missing Fonts\n\n`;
    report.summary.missingFonts.forEach(font => {
      md += `- ${font}\n`;
    });
    md += `\n`;
  }

  md += `## Detailed Results\n\n`;

  report.results.forEach(result => {
    md += `### ${result.pageName}\n\n`;
    md += `**URL:** ${result.pageUrl}\n\n`;
    md += `**Status:** ${result.passed ? '✅ PASS' : '❌ FAIL'}\n\n`;
    md += `**Screenshots:**\n`;
    md += `- [Full Page Screenshot](${path.relative(OUTPUT_DIR, result.screenshotPath)})\n`;
    md += `- [A4 PDF](${path.relative(OUTPUT_DIR, result.pdfPath)})\n\n`;
    
    md += `**Fonts Used:**\n`;
    if (result.fontsUsed.length > 0) {
      result.fontsUsed.forEach(font => {
        md += `- ${font.fullName} (${font.status})\n`;
      });
    } else {
      md += `- No fonts detected\n`;
    }
    md += `\n`;

    if (result.issues.length > 0) {
      md += `**Issues Found:**\n`;
      result.issues.forEach(issue => {
        md += `- ${issue}\n`;
      });
      md += `\n`;
    }

    if (result.missingGlyphs.length > 0) {
      md += `**Missing Glyphs:**\n`;
      result.missingGlyphs.forEach(glyph => {
        md += `- ${glyph}\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;
  });

  return md;
}

// Export for external use
export { validatePage, generateMarkdownReport };
