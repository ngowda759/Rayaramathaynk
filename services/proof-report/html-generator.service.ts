import * as fs from 'fs';
import * as path from 'path';
import {
  ProofReportData,
  TableOfContentsItem,
} from '@/types/proof-report';

export class HtmlGeneratorService {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async generate(data: ProofReportData): Promise<string> {
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const html = this.generateHtml(data);
    const outputPath = path.join(this.outputDir, 'proof-report.html');
    fs.writeFileSync(outputPath, html, 'utf-8');

    return outputPath;
  }

  private generateHtml(data: ProofReportData): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Content Proof Report - Sri Raghavendra Swamy Math</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    header {
      background: linear-gradient(135deg, #8B4513 0%, #D2691E 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
      margin-bottom: 30px;
    }
    
    header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    
    header .subtitle {
      font-size: 1.2em;
      opacity: 0.9;
    }
    
    .toc {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .toc h2 {
      color: #8B4513;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #D2691E;
    }
    
    .toc ul {
      list-style: none;
    }
    
    .toc li {
      margin: 8px 0;
    }
    
    .toc a {
      color: #D2691E;
      text-decoration: none;
    }
    
    .toc a:hover {
      text-decoration: underline;
    }
    
    .toc .sub-items {
      margin-left: 20px;
    }
    
    .summary {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .summary h2 {
      color: #8B4513;
      margin-bottom: 20px;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    
    .summary-item {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    
    .summary-item .value {
      font-size: 2em;
      font-weight: bold;
      color: #8B4513;
    }
    
    .summary-item .label {
      color: #666;
      margin-top: 5px;
    }
    
    .summary-item.errors .value {
      color: #e74c3c;
    }
    
    .summary-item.warnings .value {
      color: #f39c12;
    }
    
    section {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    section h2 {
      color: #8B4513;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #D2691E;
    }
    
    section h3 {
      color: #D2691E;
      margin: 20px 0 10px 0;
    }
    
    .page-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    
    .page-card .header {
      background: #f9f9f9;
      padding: 15px;
      border-bottom: 1px solid #ddd;
    }
    
    .page-card .header h4 {
      color: #8B4513;
      margin-bottom: 5px;
    }
    
    .page-card .header .url {
      color: #666;
      font-size: 0.9em;
      word-break: break-all;
    }
    
    .page-card .content {
      padding: 15px;
    }
    
    .page-card .screenshot {
      margin: 15px;
      text-align: center;
    }
    
    .page-card .screenshot img {
      max-width: 100%;
      max-height: 400px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    
    .review-checklist {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 4px;
      margin-top: 15px;
    }
    
    .review-checklist label {
      display: block;
      margin: 5px 0;
      cursor: pointer;
    }
    
    .review-checklist input[type="checkbox"] {
      margin-right: 10px;
    }
    
    .issue-list {
      list-style: none;
    }
    
    .issue-item {
      padding: 10px;
      margin: 5px 0;
      border-radius: 4px;
      background: #f9f9f9;
    }
    
    .issue-item.error {
      border-left: 4px solid #e74c3c;
    }
    
    .issue-item.warning {
      border-left: 4px solid #f39c12;
    }
    
    .article-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .article-card h4 {
      color: #8B4513;
      margin-bottom: 10px;
    }
    
    .article-card .meta {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 10px;
    }
    
    .article-card .content {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 4px;
      margin-top: 10px;
    }
    
    .event-card, .seva-card, .album-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    
    .event-card h4, .seva-card h4, .album-card h4 {
      color: #8B4513;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    
    th {
      background: #f9f9f9;
      color: #8B4513;
      font-weight: 600;
    }
    
    tr:hover {
      background: #f9f9f9;
    }
    
    footer {
      text-align: center;
      padding: 30px;
      color: #666;
    }
    
    @media print {
      body {
        background: white;
      }
      
      section {
        box-shadow: none;
        border: 1px solid #ddd;
        page-break-inside: avoid;
      }
      
      .page-card {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Content Proof Report</h1>
    <p class="subtitle">Sri Raghavendra Swamy Math - Website Validation</p>
    <p class="subtitle">Generated: ${new Date().toLocaleString()}</p>
  </header>
  
  <div class="container">
    ${this.generateTableOfContents(data.tableOfContents)}
    ${this.generateSummary(data)}
    ${this.generatePagesSection(data)}
    ${this.generateAccessibilitySection(data)}
    ${this.generateSEOSection(data)}
    ${this.generateLinkSection(data)}
    ${this.generateImageSection(data)}
    ${this.generateContentQualitySection(data)}
    ${this.generateTempleValidationSection(data)}
    ${this.generateAIKnowledgeSection(data)}
    ${this.generateDatabaseSection(data)}
  </div>
  
  <footer>
    <p>This report was automatically generated for content verification purposes.</p>
    <p>Environment: ${data.summary.environment}</p>
    ${data.summary.gitCommitHash ? `<p>Git Commit: ${data.summary.gitCommitHash}</p>` : ''}
  </footer>
</body>
</html>`;
  }

  private generateTableOfContents(toc: TableOfContentsItem[]): string {
    if (toc.length === 0) return '';

    let html = '<div class="toc"><h2>Table of Contents</h2><ul>';
    
    for (const item of toc) {
      if (item.level === 1) {
        html += `<li><a href="#${item.anchor || item.title.toLowerCase().replace(/\s+/g, '-')}">${item.title}</a></li>`;
      } else {
        html += `<li class="sub-items"><a href="#${item.anchor || item.title.toLowerCase().replace(/\s+/g, '-')}">${item.title}</a></li>`;
      }
    }
    
    html += '</ul></div>';
    return html;
  }

  private generateSummary(data: ProofReportData): string {
    const { summary } = data;
    
    return `
<div class="summary">
  <h2>Summary Dashboard</h2>
  <div class="summary-grid">
    <div class="summary-item">
      <div class="value">${summary.totalPages}</div>
      <div class="label">Total Pages</div>
    </div>
    <div class="summary-item">
      <div class="value">${summary.totalEvents}</div>
      <div class="label">Total Events</div>
    </div>
    <div class="summary-item">
      <div class="value">${summary.totalSevas}</div>
      <div class="label">Total Sevas</div>
    </div>
    <div class="summary-item">
      <div class="value">${summary.totalGalleryAlbums}</div>
      <div class="label">Gallery Albums</div>
    </div>
    <div class="summary-item">
      <div class="value">${summary.totalGalleryImages}</div>
      <div class="label">Gallery Images</div>
    </div>
    <div class="summary-item">
      <div class="value">${summary.totalAnnouncements}</div>
      <div class="label">Announcements</div>
    </div>
    <div class="summary-item">
      <div class="value">${summary.totalAIArticles}</div>
      <div class="label">AI Articles</div>
    </div>
    <div class="summary-item">
      <div class="value">${summary.totalScreenshots}</div>
      <div class="label">Screenshots</div>
    </div>
    <div class="summary-item errors">
      <div class="value">${summary.errors}</div>
      <div class="label">Errors</div>
    </div>
    <div class="summary-item warnings">
      <div class="value">${summary.warnings}</div>
      <div class="label">Warnings</div>
    </div>
  </div>
</div>`;
  }

  private generatePagesSection(data: ProofReportData): string {
    let html = '<section id="pages"><h2>Website Pages</h2>';
    
    for (const page of data.pages) {
      const screenshot = data.screenshots.find(s => s.pageUrl === page.url);
      
      html += `
<div class="page-card">
  <div class="header">
    <h4>${page.title || 'Untitled'}</h4>
    <div class="url">${page.url}</div>
  </div>
  <div class="content">
    <p><strong>Heading:</strong> ${page.heading || 'N/A'}</p>
    <p><strong>Meta Title:</strong> ${page.metaTitle || 'N/A'}</p>
    <p><strong>Meta Description:</strong> ${page.metaDescription || 'N/A'}</p>
    
    ${screenshot ? `<div class="screenshot"><img src="../${path.relative(this.outputDir, screenshot.screenshotPath)}" alt="Screenshot of ${page.title}"></div>` : ''}
    
    <h3>Visible Content</h3>
    <div style="background:#f9f9f9;padding:15px;border-radius:4px;max-height:300px;overflow-y:auto;">
      ${this.escapeHtml(page.visibleText.substring(0, 2000))}${page.visibleText.length > 2000 ? '...' : ''}
    </div>
    
    <h3>Images Used (${page.images.length})</h3>
    ${page.images.length > 0 ? `<ul>${page.images.map(img => `<li>${img.src} ${img.alt ? `(alt: ${this.escapeHtml(img.alt)})` : '(no alt)'}</li>`).join('')}</ul>` : '<p>No images found</p>'}
    
    <h3>Links</h3>
    <p><strong>Internal Links:</strong> ${page.internalLinks.length}</p>
    <p><strong>External Links:</strong> ${page.externalLinks.length}</p>
    
    <h3>Buttons (${page.buttons.length})</h3>
    ${page.buttons.length > 0 ? `<p>${page.buttons.join(', ')}</p>` : '<p>No buttons found</p>'}
    
    <h3>Forms (${page.forms.length})</h3>
    ${page.forms.length > 0 ? page.forms.map(form => `<p>Form: ${form.id || form.name || 'Unnamed'} (${form.fields.length} fields)</p>`).join('') : '<p>No forms found</p>'}
    
    <h3>Contact Information</h3>
    <p><strong>Phones:</strong> ${page.contactInfo.phones.join(', ') || 'None found'}</p>
    <p><strong>Emails:</strong> ${page.contactInfo.emails.join(', ') || 'None found'}</p>
    <p><strong>Addresses:</strong> ${page.contactInfo.addresses.join(', ') || 'None found'}</p>
    
    <div class="review-checklist">
      <h3>Review Checklist</h3>
      <label><input type="checkbox"> Spelling verified</label>
      <label><input type="checkbox"> Grammar verified</label>
      <label><input type="checkbox"> Kannada verified</label>
      <label><input type="checkbox"> Sanskrit verified</label>
      <label><input type="checkbox"> Dates verified</label>
      <label><input type="checkbox"> Timings verified</label>
      <label><input type="checkbox"> Phone verified</label>
      <label><input type="checkbox"> Email verified</label>
      <label><input type="checkbox"> Address verified</label>
      <label><input type="checkbox"> Image verified</label>
      <label><input type="checkbox"> Link verified</label>
      <label><input type="checkbox"> Formatting verified</label>
      <label><input type="checkbox"> Mobile reviewed</label>
      <p><strong>Reviewer Notes:</strong> _______________________________________________</p>
    </div>
  </div>
</div>`;
    }
    
    html += '</section>';
    return html;
  }

  private generateAccessibilitySection(data: ProofReportData): string {
    const { accessibilityIssues } = data;
    
    return `
<section id="accessibility">
  <h2>Accessibility Issues (${accessibilityIssues.length})</h2>
  ${accessibilityIssues.length === 0 ? '<p>No accessibility issues found!</p>' : `
  <ul class="issue-list">
    ${accessibilityIssues.map(issue => `
      <li class="issue-item ${issue.severity}">
        <strong>${issue.type}</strong> - ${issue.message}
        <br><small>Page: ${issue.pageUrl}</small>
        ${issue.element ? `<br><small>Element: ${issue.element}</small>` : ''}
      </li>
    `).join('')}
  </ul>
  `}
</section>`;
  }

  private generateSEOSection(data: ProofReportData): string {
    const { seoIssues } = data;
    
    return `
<section id="seo">
  <h2>SEO Issues (${seoIssues.length})</h2>
  ${seoIssues.length === 0 ? '<p>No SEO issues found!</p>' : `
  <ul class="issue-list">
    ${seoIssues.map(issue => `
      <li class="issue-item ${issue.severity}">
        <strong>${issue.type}</strong> - ${issue.message}
        <br><small>Page: ${issue.pageUrl}</small>
      </li>
    `).join('')}
  </ul>
  `}
</section>`;
  }

  private generateLinkSection(data: ProofReportData): string {
    const { linkValidation } = data;
    const brokenLinks = linkValidation.filter(l => l.status === 'broken');
    const redirects = linkValidation.filter(l => l.status === 'redirect');
    
    return `
<section id="links">
  <h2>Link Validation</h2>
  <p><strong>Total Links Checked:</strong> ${linkValidation.length}</p>
  <p><strong>Broken Links:</strong> ${brokenLinks.length}</p>
  <p><strong>Redirects:</strong> ${redirects.length}</p>
  
  ${brokenLinks.length > 0 ? `
  <h3>Broken Links</h3>
  <ul class="issue-list">
    ${brokenLinks.map(link => `
      <li class="issue-item error">
        <strong>${link.url}</strong>
        <br><small>From: ${link.pageUrl}</small>
        ${link.error ? `<br><small>Error: ${link.error}</small>` : ''}
        ${link.statusCode ? `<br><small>Status: ${link.statusCode}</small>` : ''}
      </li>
    `).join('')}
  </ul>
  ` : ''}
  
  ${redirects.length > 0 ? `
  <h3>Redirects</h3>
  <ul class="issue-list">
    ${redirects.map(link => `
      <li class="issue-item warning">
        <strong>${link.url}</strong> → <strong>${link.redirectUrl}</strong>
        <br><small>From: ${link.pageUrl}</small>
      </li>
    `).join('')}
  </ul>
  ` : ''}
</section>`;
  }

  private generateImageSection(data: ProofReportData): string {
    const { imageValidation } = data;
    const brokenImages = imageValidation.filter(i => i.status === 'broken');
    const oversizedImages = imageValidation.filter(i => i.status === 'oversized');
    
    return `
<section id="images">
  <h2>Image Validation</h2>
  <p><strong>Total Images Checked:</strong> ${imageValidation.length}</p>
  <p><strong>Broken Images:</strong> ${brokenImages.length}</p>
  <p><strong>Oversized Images:</strong> ${oversizedImages.length}</p>
  
  ${brokenImages.length > 0 ? `
  <h3>Broken Images</h3>
  <ul class="issue-list">
    ${brokenImages.map(img => `
      <li class="issue-item error">
        <strong>${img.src}</strong>
        <br><small>From: ${img.pageUrl}</small>
        ${img.error ? `<br><small>Error: ${img.error}</small>` : ''}
      </li>
    `).join('')}
  </ul>
  ` : ''}
</section>`;
  }

  private generateContentQualitySection(data: ProofReportData): string {
    const { contentQualityIssues } = data;
    
    return `
<section id="content-quality">
  <h2>Content Quality Issues (${contentQualityIssues.length})</h2>
  ${contentQualityIssues.length === 0 ? '<p>No content quality issues found!</p>' : `
  <ul class="issue-list">
    ${contentQualityIssues.map(issue => `
      <li class="issue-item ${issue.severity}">
        <strong>${issue.type}</strong> - ${issue.message}
        <br><small>Page: ${issue.pageUrl}</small>
      </li>
    `).join('')}
  </ul>
  `}
</section>`;
  }

  private generateTempleValidationSection(data: ProofReportData): string {
    const { templeValidationIssues } = data;
    
    return `
<section id="temple-validation">
  <h2>Temple-Specific Validation (${templeValidationIssues.length})</h2>
  ${templeValidationIssues.length === 0 ? '<p>All temple validations passed!</p>' : `
  <ul class="issue-list">
    ${templeValidationIssues.map(issue => `
      <li class="issue-item ${issue.severity}">
        <strong>${issue.type}</strong> - ${issue.message}
      </li>
    `).join('')}
  </ul>
  `}
</section>`;
  }

  private generateAIKnowledgeSection(data: ProofReportData): string {
    const { seedArticles } = data;
    
    let html = `<section id="ai-knowledge"><h2>AI Knowledge Base (${seedArticles.length} articles)</h2>`;
    
    for (const article of seedArticles) {
      html += `
<div class="article-card">
  <h4>${article.title}</h4>
  <div class="meta">
    <strong>Filename:</strong> ${article.filename} |
    <strong>Category:</strong> ${article.category} |
    <strong>Language:</strong> ${article.language} |
    <strong>Version:</strong> ${article.version} |
    <strong>Approved:</strong> ${article.approved ? 'Yes' : 'No'}
  </div>
  <p><strong>Slug:</strong> ${article.slug}</p>
  <p><strong>Keywords:</strong> ${article.keywords.join(', ')}</p>
  <p><strong>Summary:</strong> ${article.summary}</p>
  <div class="content">
    <strong>Content:</strong><br>
    ${this.escapeHtml(article.content)}
  </div>
  ${article.questions && article.questions.length > 0 ? `
  <h3>Questions & Answers</h3>
  ${article.questions.map(qa => `
    <div style="margin:10px 0;padding:10px;background:#f9f9f9;border-radius:4px;">
      <p><strong>Q:</strong> ${qa.q}</p>
      <p><strong>A:</strong> ${qa.a}</p>
    </div>
  `).join('')}
  ` : ''}
  <div class="review-checklist" style="margin-top:15px;">
    <h3>Review Checklist</h3>
    <label><input type="checkbox"> Content accurate</label>
    <label><input type="checkbox"> Keywords appropriate</label>
    <label><input type="checkbox"> Questions relevant</label>
    <label><input type="checkbox"> Approved for production</label>
    <p><strong>Reviewer Notes:</strong> _______________________________________________</p>
  </div>
</div>`;
    }
    
    html += '</section>';
    return html;
  }

  private generateDatabaseSection(data: ProofReportData): string {
    const { databaseContent } = data;
    
    let html = `<section id="database"><h2>Database Content</h2>`;
    
    // Events
    html += `
<h3>Events (${databaseContent.events.length})</h3>
<table>
  <thead>
    <tr>
      <th>Title</th>
      <th>Date</th>
      <th>Location</th>
      <th>Status</th>
      <th>Featured</th>
      <th>Published</th>
    </tr>
  </thead>
  <tbody>
    ${databaseContent.events.map(event => {
      const startDate = event.startDate?.toDate?.() || new Date(event.startDate);
      const endDate = event.endDate?.toDate?.() || new Date(event.endDate);
      return `
    <tr>
      <td>${event.title}</td>
      <td>${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</td>
      <td>${event.location}</td>
      <td>${event.status}</td>
      <td>${event.featured ? 'Yes' : 'No'}</td>
      <td>${event.published !== false ? 'Yes' : 'No'}</td>
    </tr>`;
    }).join('')}
  </tbody>
</table>`;
    
    // Sevas
    html += `
<h3>Sevas (${databaseContent.sevas.length})</h3>
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Category</th>
      <th>Amount</th>
      <th>Duration</th>
      <th>Active</th>
    </tr>
  </thead>
  <tbody>
    ${databaseContent.sevas.map(seva => `
    <tr>
      <td>${seva.name}</td>
      <td>${seva.category}</td>
      <td>${seva.amount}</td>
      <td>${seva.duration}</td>
      <td>${seva.active ? 'Yes' : 'No'}</td>
    </tr>`).join('')}
  </tbody>
</table>`;
    
    // Gallery Albums
    html += `
<h3>Gallery Albums (${databaseContent.galleryAlbums.length})</h3>
<table>
  <thead>
    <tr>
      <th>Title</th>
      <th>Slug</th>
      <th>Active</th>
      <th>Display Order</th>
    </tr>
  </thead>
  <tbody>
    ${databaseContent.galleryAlbums.map(album => `
    <tr>
      <td>${album.title}</td>
      <td>${album.slug}</td>
      <td>${album.active ? 'Yes' : 'No'}</td>
      <td>${album.displayOrder}</td>
    </tr>`).join('')}
  </tbody>
</table>`;
    
    // Gallery Media
    html += `
<h3>Gallery Media (${databaseContent.galleryMedia.length})</h3>
<table>
  <thead>
    <tr>
      <th>Title</th>
      <th>Album</th>
      <th>Type</th>
      <th>Featured</th>
    </tr>
  </thead>
  <tbody>
    ${databaseContent.galleryMedia.map(media => `
    <tr>
      <td>${media.title}</td>
      <td>${media.albumId}</td>
      <td>${media.type}</td>
      <td>${media.isFeatured ? 'Yes' : 'No'}</td>
    </tr>`).join('')}
  </tbody>
</table>`;
    
    // Announcements
    html += `
<h3>Announcements (${databaseContent.announcements.length})</h3>
<table>
  <thead>
    <tr>
      <th>Title</th>
      <th>Message</th>
      <th>Active</th>
    </tr>
  </thead>
  <tbody>
    ${databaseContent.announcements.map(ann => `
    <tr>
      <td>${ann.title}</td>
      <td>${ann.message.substring(0, 100)}${ann.message.length > 100 ? '...' : ''}</td>
      <td>${ann.isActive ? 'Yes' : 'No'}</td>
    </tr>`).join('')}
  </tbody>
</table>`;
    
    // Settings
    if (databaseContent.settings) {
      html += `
<h3>Website Settings</h3>
<table>
  <tr><th>Property</th><th>Value</th></tr>
  <tr><td>Temple Name</td><td>${databaseContent.settings.templeName}</td></tr>
  <tr><td>Contact Email</td><td>${databaseContent.settings.contactEmail}</td></tr>
  <tr><td>Contact Phone</td><td>${databaseContent.settings.contactPhone}</td></tr>
  <tr><td>Address</td><td>${databaseContent.settings.address}</td></tr>
</table>`;
    }
    
    // Homepage
    if (databaseContent.homepage) {
      html += `
<h3>Homepage Configuration</h3>
<table>
  <tr><th>Property</th><th>Value</th></tr>
  <tr><td>Hero Title</td><td>${databaseContent.homepage.heroTitle}</td></tr>
  <tr><td>Hero Subtitle</td><td>${databaseContent.homepage.heroSubtitle}</td></tr>
  <tr><td>Morning Timings</td><td>${databaseContent.homepage.morningOpen} - ${databaseContent.homepage.morningClose}</td></tr>
  <tr><td>Evening Timings</td><td>${databaseContent.homepage.eveningOpen} - ${databaseContent.homepage.eveningClose}</td></tr>
  <tr><td>Temple Name</td><td>${databaseContent.homepage.templeName}</td></tr>
  <tr><td>Is Temple Open</td><td>${databaseContent.homepage.isTempleOpen ? 'Yes' : 'No'}</td></tr>
</table>`;
    }
    
    html += '</section>';
    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  }
}
