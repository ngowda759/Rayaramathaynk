#!/usr/bin/env npx ts-node --project tsconfig.scripts.json

/**
 * Proof Report Generator Script
 * 
 * This script generates a comprehensive proof report for the Sri Raghavendra Swamy Math website.
 * It crawls all public pages, takes screenshots, runs validations, and exports database content.
 * 
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-proof-report.ts
 *   npm run generate:proof-report
 *   pnpm generate:proof-report
 */

import * as path from 'path';
import * as fs from 'fs';
import { ProofReportService } from '../services/proof-report/proof-report.service';

async function main() {
  console.log('='.repeat(60));
  console.log('Content Proof Report Generator');
  console.log('Sri Raghavendra Swamy Math');
  console.log('='.repeat(60));
  console.log();

  // Get base URL from environment or use default
  const baseUrl = process.env.PROOF_REPORT_BASE_URL || 
    'https://work-2-nfusyslxkvqbgzgq.prod-runtime.all-hands.dev';
  
  // Get output directory from environment or use default
  const outputDir = process.env.PROOF_REPORT_OUTPUT_DIR || 
    path.join(process.cwd(), 'reports');

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Output Directory: ${outputDir}`);
  console.log();

  // Validate base URL
  try {
    new URL(baseUrl);
  } catch {
    console.error('Error: Invalid base URL provided');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create proof report service
  const proofReportService = new ProofReportService(baseUrl, outputDir);

  try {
    // Generate the report
    const pdfPath = await proofReportService.generate();
    
    console.log();
    console.log('='.repeat(60));
    console.log('Report Generation Complete!');
    console.log('='.repeat(60));
    console.log();
    console.log('Generated Files:');
    console.log(`  - PDF Report: ${pdfPath}`);
    console.log(`  - HTML Report: ${path.join(outputDir, 'proof-report.html')}`);
    console.log(`  - Screenshots: ${path.join(outputDir, 'screenshots')}/`);
    console.log();
    console.log('Please review the HTML report in a browser for the best experience.');
    console.log('The PDF is optimized for printing on A4 paper.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error generating proof report:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
