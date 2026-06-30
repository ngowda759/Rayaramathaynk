import { HomepageFormData, HomepageValidationErrors } from "./types";

export function validateHomepageForm(
  data: HomepageFormData
): HomepageValidationErrors {
  const errors: HomepageValidationErrors = {};

  if (!data.heroTitle.trim()) {
    errors.heroTitle = "Hero title is required.";
  }

  if (!data.heroSubtitle.trim()) {
    errors.heroSubtitle = "Hero subtitle is required.";
  }

  if (!data.templeName.trim()) {
    errors.templeName = "Temple name is required.";
  }

  if (!data.morningOpen.trim()) {
    errors.morningOpen = "Morning opening time is required.";
  }

  if (!data.morningClose.trim()) {
    errors.morningClose = "Morning closing time is required.";
  }

  if (!data.eveningOpen.trim()) {
    errors.eveningOpen = "Evening opening time is required.";
  }

  if (!data.eveningClose.trim()) {
    errors.eveningClose = "Evening closing time is required.";
  }

  if (!data.donationTitle.trim()) {
    errors.donationTitle = "Donation title is required.";
  }

  if (!data.heroPrimaryButton.trim()) {
    errors.heroPrimaryButton = "Primary button text is required.";
  }

  if (!data.heroSecondaryButton.trim()) {
    errors.heroSecondaryButton = "Secondary button text is required.";
  }

  return errors;
}

export function hasHomepageValidationErrors(
  errors: HomepageValidationErrors
): boolean {
  return Object.keys(errors).length > 0;
}
