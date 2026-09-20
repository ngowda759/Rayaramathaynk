// Donations Retrieval - Donation information and purposes
// Single source of truth for donation-related information

import { DonationInfo, RetrievedData } from "./types";
import { RetrievalType } from "../intent/types";
import { getTempleSettings } from "./settings";

// Cache for donation info
let cachedDonationInfo: DonationInfo | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Default donation information
 */
const DEFAULT_DONATION_INFO: DonationInfo = {
  purposes: [
    { name: "Annadanam", description: "Food donation and distribution" },
    { name: "Temple Maintenance", description: "Temple upkeep and cleanliness" },
    { name: "Festival Sponsorship", description: "Support festival celebrations" },
    { name: "General Donation", description: "General temple development" },
  ],
  has80G: true,
  paymentMethods: ["UPI", "Bank Transfer", "Cash", "Cheque"],
  websiteUrl: "/donations",
};

/**
 * Get donation information
 */
export async function getDonationInfo(): Promise<RetrievedData<DonationInfo>> {
  const now = Date.now();
  const fromCache = cachedDonationInfo && now - lastFetchTime < CACHE_DURATION;

  if (fromCache) {
    return {
      data: cachedDonationInfo,
      source: RetrievalType.REPOSITORY,
      confidence: 95,
      retrievedAt: lastFetchTime,
      fromCache: true,
    };
  }

  try {
    // Get temple settings for website URL
    const settings = await getTempleSettings();
    
    const donationInfo: DonationInfo = {
      ...DEFAULT_DONATION_INFO,
      websiteUrl: settings.data?.phone ? "/donations" : DEFAULT_DONATION_INFO.websiteUrl,
    };

    cachedDonationInfo = donationInfo;
    lastFetchTime = now;

    return {
      data: donationInfo,
      source: RetrievalType.REPOSITORY,
      confidence: 90,
      retrievedAt: now,
      fromCache: false,
    };
  } catch (error) {
    console.error("[Donations Retrieval] Error:", error);
    return {
      data: cachedDonationInfo || DEFAULT_DONATION_INFO,
      source: RetrievalType.FALLBACK,
      confidence: 50,
      retrievedAt: now,
      fromCache: false,
    };
  }
}

/**
 * Format donation purposes for display
 */
export function formatDonationInfoForDisplay(donationInfo: DonationInfo): string {
  let text = "💝 **Donation Options:**\n\n";
  
  text += "You can contribute towards:\n\n";
  
  donationInfo.purposes.forEach((purpose, index) => {
    text += `**${index + 1}. ${purpose.name}**\n`;
    text += `   ${purpose.description}\n\n`;
  });
  
  text += "---\n\n";
  
  text += "**Payment Methods:**\n";
  text += donationInfo.paymentMethods.join(", ") + "\n\n";
  
  if (donationInfo.has80G) {
    text += "✅ Donations are eligible for **80G Tax Benefit**\n\n";
  }
  
  text += `🌐 Visit ${donationInfo.websiteUrl} to donate online.\n`;
  
  return text;
}

/**
 * Format donation purpose explanation
 */
export function formatDonationPurposeForDisplay(purposes: DonationInfo["purposes"]): string {
  let text = "💝 **How Your Donations Help:**\n\n";
  
  purposes.forEach((purpose) => {
    text += `• **${purpose.name}**: ${purpose.description}\n`;
  });
  
  return text;
}

/**
 * Format 80G information
 */
export function format80GInfo(has80G: boolean): string {
  if (has80G) {
    return `✅ **Tax Benefit Available**

Your donations to Sri Raghavendra Swamy Matha Trust are eligible for tax deduction under **Section 80G** of the Income Tax Act.

• You will receive a donation receipt
• 50% of the donation amount is tax-deductible
• Please retain your receipt for tax filing

For more details, please contact the temple office.`;
  }
  
  return "For information about tax benefits, please contact the temple office directly.";
}

/**
 * Clear donation info cache
 */
export function clearDonationInfoCache(): void {
  cachedDonationInfo = null;
  lastFetchTime = 0;
}
