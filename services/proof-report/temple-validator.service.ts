import {
  TempleValidationIssue,
  PageInfo,
  DatabaseContent,
} from '@/types/proof-report';

export class TempleValidatorService {
  async validate(pages: PageInfo[], dbContent: DatabaseContent): Promise<TempleValidationIssue[]> {
    const issues: TempleValidationIssue[] = [];

    // Check for temple timings
    const timingsFound = pages.some(p => 
      p.visibleText.includes('AM') && 
      p.visibleText.includes('PM') &&
      (p.visibleText.includes('Morning') || p.visibleText.includes('Evening') || p.visibleText.includes('Darshan'))
    );

    if (!timingsFound) {
      issues.push({
        type: 'missing-timings',
        severity: 'error',
        message: 'Temple timings not found on any page',
      });
    }

    // Check for daily poojas
    if (!dbContent.poojas || dbContent.poojas.length === 0) {
      issues.push({
        type: 'missing-poojas',
        severity: 'error',
        message: 'No daily poojas configured in database',
      });
    }

    // Check for seva prices
    if (!dbContent.sevas || dbContent.sevas.length === 0) {
      issues.push({
        type: 'missing-seva-prices',
        severity: 'error',
        message: 'No sevas configured in database',
      });
    } else {
      const sevasWithoutPrices = dbContent.sevas.filter(s => s.amount === undefined || s.amount === 0);
      if (sevasWithoutPrices.length === dbContent.sevas.length) {
        issues.push({
          type: 'missing-seva-prices',
          severity: 'warning',
          message: 'All sevas may be missing prices',
        });
      }
    }

    // Check for contact details
    const contactFound = pages.some(p => 
      p.contactInfo.phones.length > 0 || 
      p.contactInfo.emails.length > 0 ||
      p.contactInfo.addresses.length > 0
    );

    if (!contactFound) {
      issues.push({
        type: 'missing-contact',
        severity: 'error',
        message: 'Contact information not found on any page',
      });
    }

    // Check for donation instructions
    const donationFound = pages.some(p => 
      p.url.includes('donation') ||
      p.visibleText.toLowerCase().includes('donate') ||
      p.visibleText.toLowerCase().includes('donation')
    );

    if (!donationFound) {
      issues.push({
        type: 'missing-donation',
        severity: 'warning',
        message: 'Donation information not found',
      });
    }

    // Check for festival calendar
    const festivalFound = pages.some(p => 
      p.url.includes('calendar') ||
      p.visibleText.toLowerCase().includes('festival') ||
      p.visibleText.toLowerCase().includes('ekadashi')
    );

    if (!festivalFound) {
      issues.push({
        type: 'missing-festival',
        severity: 'warning',
        message: 'Festival calendar not found',
      });
    }

    // Check for Guru Parampara
    const guruFound = pages.some(p => 
      p.url.includes('guruparampara') ||
      p.visibleText.toLowerCase().includes('guru') ||
      p.visibleText.toLowerCase().includes('parampara')
    );

    if (!guruFound) {
      issues.push({
        type: 'missing-guru',
        severity: 'warning',
        message: 'Guru Parampara information not found',
      });
    }

    // Check for Brindavana
    const brindavanaFound = pages.some(p => 
      p.visibleText.toLowerCase().includes('brindavana') ||
      p.visibleText.toLowerCase().includes('brindavan')
    );

    if (!brindavanaFound) {
      issues.push({
        type: 'missing-brindavana',
        severity: 'warning',
        message: 'Brindavana information not found',
      });
    }

    // Check for location map
    const mapFound = pages.some(p => 
      p.visibleText.toLowerCase().includes('map') ||
      p.visibleText.toLowerCase().includes('location') ||
      p.visibleText.toLowerCase().includes('address') ||
      p.visibleText.toLowerCase().includes('yelahanka')
    );

    if (!mapFound) {
      issues.push({
        type: 'missing-map',
        severity: 'warning',
        message: 'Location/map information not found',
      });
    }

    // Check for emergency contact
    const emergencyKeywords = ['emergency', 'ambulance', 'hospital', 'police'];
    const emergencyFound = pages.some(p => 
      emergencyKeywords.some(kw => p.visibleText.toLowerCase().includes(kw))
    );

    if (!emergencyFound) {
      issues.push({
        type: 'missing-emergency',
        severity: 'warning',
        message: 'Emergency contact information not found',
      });
    }

    return issues;
  }
}
