/**
 * Repository exports
 * All repositories follow a consistent interface pattern,
 * making it easy to swap implementations (e.g., JSON to SQL later).
 */

export { announcementsRepository } from "./announcements.repository";
export { eventsRepository } from "./events.repository";
export { poojasRepository } from "./poojas.repository";
export { sevasRepository } from "./sevas.repository";
export { timingsRepository } from "./timings.repository";
export { galleryRepository } from "./gallery.repository";
export { donationsRepository } from "./donations.repository";
export { donationCampaignsRepository } from "./donationCampaigns.repository";
export { sevaBookingsRepository } from "./sevaBookings.repository";
export { membersRepository, volunteersRepository } from "./volunteers.repository";
export { aaradhanesRepository } from "./aaradhanes.repository";
export { homepageRepository } from "./homepage.repository";
export { settingsRepository } from "./settings.repository";
