export {
  CATEGORY_OPTIONS,
  CATEGORIES,
  PRIMARY_CATEGORIES,
  SUB_CATEGORIES,
} from './categoryTaxonomy'

// API
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim()

// Subscription tiers
export const TIERS = {
  FREE: 'free',
  MID: 'mid',
  PREMIUM: 'premium',
}

export const TIER_LABELS = {
  [TIERS.FREE]: 'Free',
  [TIERS.MID]: 'Plus',
  [TIERS.PREMIUM]: 'Premium',
}

export const TIER_FEATURES = {
  [TIERS.FREE]: {
    label: 'Free',
    price: 0,
    features: [
      'Access to free videos',
      'Basic progress tracking',
      'Community comments',
      'Standard video quality',
    ],
    limitations: ['Ads shown', 'Limited quiz attempts', 'No offline access'],
    color: 'var(--color-tier-free)',
  },
  [TIERS.MID]: {
    label: 'Plus',
    price: 9.99,
    features: [
      'Everything in Free',
      'Ad-free experience',
      'Unlimited quiz attempts',
      'HD video quality',
      'Download for offline',
      'Priority support',
    ],
    limitations: ['Some premium content locked'],
    color: 'var(--color-tier-mid)',
  },
  [TIERS.PREMIUM]: {
    label: 'Premium',
    price: 19.99,
    features: [
      'Everything in Plus',
      'All premium content unlocked',
      'AI-powered quiz generation',
      '4K video quality',
      'Creator analytics dashboard',
      'Custom learning paths',
      'Completion certificates',
      'Early access to new features',
    ],
    limitations: [],
    color: 'var(--color-tier-premium)',
  },
}

// User roles
export const ROLES = {
  VIEWER: 'viewer',
  CREATOR: 'creator',
  ADMIN: 'admin',
}

// Pagination
export const PAGE_SIZE = 12

// Search timing
export const SEARCH_DEBOUNCE_MS = 300

// Video player
export const PROGRESS_SAVE_INTERVAL_MS = 5000 // Save progress every 5 seconds.
export const COMPLETION_THRESHOLD = 0.9 // Mark a video complete after 90% is watched.

// Quiz
export const QUIZ_PASS_SCORE = 70 // Minimum passing score.

// Local storage keys
export const STORAGE_KEYS = {
  SIDEBAR_COLLAPSED: 'howtoob_sidebar_collapsed',
  THEME: 'howtoob_theme',
  LEARNING_PROGRESS: 'howtoob_learning_progress',
  LEARNING_STATS: 'howtoob_learning_stats',
  LOCAL_PLAYLISTS: 'howtoob_local_playlists',
  LOCAL_PREFERENCES: 'howtoob_local_preferences',
  LOCAL_REPORTS: 'howtoob_local_reports',
}
