# Content Proof Report Generator

A comprehensive proof report generator for the Sri Raghavendra Swamy Math website that allows temple administrators and proofreaders to manually verify every piece of content before publishing.

## Quick Start

```bash
# Generate the report
npm run generate:proof-report
```

## Output

The command generates:

| File | Description |
|------|-------------|
| `reports/proof-report.pdf` | A4 printable PDF report |
| `reports/proof-report.html` | HTML report for browser viewing |
| `reports/screenshots/` | Full-page screenshots for each page |

## Report Sections

### 1. Summary Dashboard
- Total pages analyzed
- Total events, sevas, gallery items
- Accessibility, SEO, and content issues
- Generation date and environment info

### 2. Page Analysis (per page)
- URL and page title
- Full-page screenshot
- Extracted content (headings, text, images, links)
- Review checklist with checkboxes

### 3. Accessibility Validation
- Images without alt text
- Empty headings
- Duplicate headings
- Very long paragraphs
- Broken anchors
- Missing form labels

### 4. SEO Validation
- Missing page titles
- Duplicate titles
- Missing meta descriptions
- Large images
- Missing Open Graph fields
- Canonical URL issues

### 5. Link Validation
- Broken links (404s)
- Redirect chains
- Internal links
- External links

### 6. Image Validation
- Images without alt text
- Broken images
- Oversized images

### 7. Content Quality
- Duplicate paragraphs
- Placeholder text (Lorem Ipsum, TODO, FIXME)
- Empty or very short pages
- Repeated announcements/events

### 8. Temple-Specific Validation
- Temple timings
- Daily poojas
- Seva prices
- Contact details
- Donation instructions
- Festival calendar
- Guru Parampara
- Brindavana information
- Location map
- Emergency contact

### 9. Database Content
Exports from Firestore:
- Events (upcoming, past, featured)
- Announcements
- Temple Timings
- Sevas
- Donations
- Gallery Albums & Images
- Website Settings
- Homepage Configuration

### 10. AI Knowledge Base
All seed files from `seed/ai/` including:
- Question/answer pairs
- Keywords and categories
- Review checkboxes for manual verification

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PROOF_REPORT_BASE_URL` | Base URL of the website | Configured in script |
| `PROOF_REPORT_OUTPUT_DIR` | Output directory | `./reports` |

## Architecture

```
scripts/
  generate-proof-report.ts    # Main entry point

services/proof-report/
  proof-report.service.ts     # Main orchestrator
  crawler.service.ts          # Page discovery and crawling
  screenshot.service.ts       # Screenshot capture
  accessibility.service.ts    # Accessibility checks
  seo.service.ts              # SEO validation
  link-validator.service.ts   # Link validation
  image-validator.service.ts  # Image validation
  content-quality.service.ts  # Content quality checks
  temple-validator.service.ts # Temple-specific checks
  database-export.service.ts   # Firestore export
  seed-reader.service.ts      # AI seed files
  html-generator.service.ts   # HTML report generation
  pdf-generator.service.ts     # PDF generation

types/
  proof-report.ts             # TypeScript interfaces
```

## Running Programmatically

```typescript
import { ProofReportService } from './services/proof-report/proof-report.service';

const service = new ProofReportService(
  'https://your-website.com',
  './reports'
);

const pdfPath = await service.generate();
```

## Notes

- The report uses Playwright to crawl pages and capture screenshots
- Firebase/Firestore is optional - report works without it
- Screenshots are saved to `reports/screenshots/` directory
- PDF is optimized for A4 paper printing
- HTML report includes clickable table of contents

## Troubleshooting

### Playwright browser not installed
```bash
npx playwright install chromium
```

### Website not accessible
Make sure the website is running before generating the report:
```bash
npm run dev
```

### Firebase not configured
The report will still work, but database content will be empty.
