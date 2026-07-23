/**
 * i18n Dictionary Types
 * Type-safe translations for all supported locales
 */

import { Locale } from "./config";

export type DictionaryKey = 
  | "common"
  | "nav"
  | "home"
  | "events"
  | "gallery"
  | "aaradhane"
  | "panchanga"
  | "quotes"
  | "stotras"
  | "library"
  | "profile"
  | "auth"
  | "settings"
  | "notifications"
  | "media"
  | "live"
  | "learn"
  | "about"
  | "contact"
  | "donation"
  | "sevas"
  | "calendar"
  | "faq"
  | "errors"
  | "accessibility";

export interface Dictionary {
  common: CommonDictionary;
  nav: NavDictionary;
  home: HomeDictionary;
  events: EventsDictionary;
  gallery: GalleryDictionary;
  aaradhane: AaradhaneDictionary;
  panchanga: PanchangaDictionary;
  quotes: QuotesDictionary;
  stotras: StotrasDictionary;
  library: LibraryDictionary;
  profile: ProfileDictionary;
  auth: AuthDictionary;
  settings: SettingsDictionary;
  notifications: NotificationsDictionary;
  media: MediaDictionary;
  live: LiveDictionary;
  learn: LearnDictionary;
  about: AboutDictionary;
  contact: ContactDictionary;
  donation: DonationDictionary;
  sevas: SevasDictionary;
  calendar: CalendarDictionary;
  faq: FaqDictionary;
  errors: ErrorsDictionary;
  accessibility: AccessibilityDictionary;
}

export interface CommonDictionary {
  appName: string;
  templeName: string;
  tagline: string;
  loading: string;
  search: string;
  submit: string;
  cancel: string;
  save: string;
  delete: string;
  edit: string;
  view: string;
  close: string;
  back: string;
  next: string;
  previous: string;
  readMore: string;
  learnMore: string;
  viewAll: string;
  seeAll: string;
  filter: string;
  sort: string;
  clear: string;
  confirm: string;
  yes: string;
  no: string;
  ok: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  required: string;
  optional: string;
  language: string;
  theme: string;
  settings: string;
  home: string;
  menu: string;
  openMenu: string;
  closeMenu: string;
  skipToContent: string;
  showMore: string;
  showLess: string;
}

export interface NavDictionary {
  home: string;
  shlokas: string;
  guruParampara: string;
  knowledgeCentre: string;
  templeExplorer: string;
  ekadasiCalendar: string;
  festivalCalendar: string;
  aaradhane: string;
  upcomingEvents: string;
  pastEvents: string;
  aboutUs: string;
  facilities: string;
  trustCommittee: string;
  futurePlans: string;
  dailySeva: string;
  specialSeva: string;
  donate: string;
  gallery: string;
  calendar: string;
  onlineServices: string;
}

export interface HomeDictionary {
  welcome: string;
  subtitle: string;
  todaysPanchanga: string;
  todaysQuote: string;
  upcomingEvents: string;
  liveDarshan: string;
  quickLinks: string;
  newsUpdates: string;
  visitUs: string;
}

export interface EventsDictionary {
  title: string;
  upcoming: string;
  past: string;
  all: string;
  featured: string;
  category: string;
  date: string;
  time: string;
  location: string;
  description: string;
  register: string;
  addToCalendar: string;
  share: string;
}

export interface GalleryDictionary {
  title: string;
  photos: string;
  videos: string;
  categories: string;
  allPhotos: string;
  allVideos: string;
}

export interface AaradhaneDictionary {
  title: string;
  schedule: string;
  day: string;
  timings: string;
  description: string;
}

export interface PanchangaDictionary {
  title: string;
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
  rahukalam: string;
  yamaganda: string;
  abhijitMuhurta: string;
  isFestival: string;
  isEkadashi: string;
}

export interface QuotesDictionary {
  title: string;
  daily: string;
  random: string;
  categories: string;
  share: string;
  copy: string;
  favorite: string;
}

export interface StotrasDictionary {
  title: string;
  kannada: string;
  sanskrit: string;
  english: string;
  meaning: string;
  audio: string;
  pdf: string;
  categories: string;
}

export interface LibraryDictionary {
  title: string;
  search: string;
  categories: string;
  articles: string;
  books: string;
  audio: string;
  video: string;
  recent: string;
  popular: string;
}

export interface ProfileDictionary {
  title: string;
  myProfile: string;
  settings: string;
  preferences: string;
  name: string;
  email: string;
  phone: string;
  profilePhoto: string;
  uploadPhoto: string;
  removePhoto: string;
  language: string;
  timezone: string;
  theme: string;
  notifications: string;
  favorites: string;
  recentlyViewed: string;
}

export interface AuthDictionary {
  login: string;
  logout: string;
  register: string;
  forgotPassword: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  namePlaceholder: string;
  phonePlaceholder: string;
  loginWithGoogle: string;
  loginWithEmail: string;
  orContinueWith: string;
  dontHaveAccount: string;
  alreadyHaveAccount: string;
  createAccount: string;
  resetPassword: string;
  resetPasswordSent: string;
  verifyEmail: string;
}

export interface SettingsDictionary {
  title: string;
  account: string;
  preferences: string;
  notifications: string;
  privacy: string;
  security: string;
  language: string;
  theme: string;
  timezone: string;
  saveChanges: string;
  changesSaved: string;
}

export interface NotificationsDictionary {
  title: string;
  enable: string;
  disable: string;
  schedule: string;
  test: string;
  dailyPanchanga: string;
  dailyQuote: string;
  upcomingEvents: string;
  festivalReminders: string;
  aaradhaneReminder: string;
  liveDarshan: string;
  generalAnnouncements: string;
}

export interface MediaDictionary {
  title: string;
  videos: string;
  audio: string;
  discourses: string;
  interviews: string;
  downloads: string;
}

export interface LiveDictionary {
  title: string;
  youtube: string;
  facebook: string;
  upcoming: string;
  previous: string;
  notify: string;
  share: string;
  watchNow: string;
}

export interface LearnDictionary {
  title: string;
  guruParampara: string;
  madhwaPhilosophy: string;
  articles: string;
  festivals: string;
  faq: string;
  childrensCorner: string;
}

export interface AboutDictionary {
  title: string;
  history: string;
  mission: string;
  team: string;
  contact: string;
}

export interface ContactDictionary {
  title: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  getDirections: string;
}

export interface DonationDictionary {
  title: string;
  donate: string;
  amount: string;
  purpose: string;
  message: string;
  payment: string;
  receipt: string;
}

export interface SevasDictionary {
  title: string;
  daily: string;
  special: string;
  book: string;
  amount: string;
  duration: string;
  description: string;
}

export interface CalendarDictionary {
  title: string;
  ekadasi: string;
  festivals: string;
  importantDates: string;
  today: string;
}

export interface FaqDictionary {
  title: string;
  question: string;
  answer: string;
  categories: string;
  search: string;
}

export interface ErrorsDictionary {
  notFound: string;
  serverError: string;
  unauthorized: string;
  forbidden: string;
  validationError: string;
  networkError: string;
  tryAgain: string;
}

export interface AccessibilityDictionary {
  mainContent: string;
  navigation: string;
  searchInput: string;
  menuButton: string;
  closeButton: string;
  languageSelector: string;
  themeToggle: string;
  previousButton: string;
  nextButton: string;
  loadingContent: string;
  imageAlt: string;
  videoPlayer: string;
  expandAccordion: string;
  collapseAccordion: string;
  openDropdown: string;
  closeDropdown: string;
  requiredField: string;
  invalidInput: string;
  pageOf: string;
  stepOf: string;
  resultOf: string;
  noResults: string;
  searchResults: string;
  filterResults: string;
  sortResults: string;
}

export type DictionaryLoader = () => Promise<Dictionary>;

export const dictionaryLoaders: Record<Locale, DictionaryLoader> = {
  en: () => import("./dictionaries/en.json").then((module) => module.default),
  kn: () => import("./dictionaries/kn.json").then((module) => module.default),
  sa: () => import("./dictionaries/sa.json").then((module) => module.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  try {
    const loader = dictionaryLoaders[locale];
    if (loader) {
      return await loader();
    }
    // Fallback to English
    return await dictionaryLoaders.en();
  } catch (error) {
    console.error(`Failed to load dictionary for locale: ${locale}`, error);
    return await dictionaryLoaders.en();
  }
}
