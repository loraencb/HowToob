/**
 * Formatting utilities for dates, durations, numbers, and display strings.
 */

// Numbers

/**
 * Format a view count with K/M abbreviations (e.g. 1200 → "1.2K")
 */
export function formatViewCount(count) {
  if (count == null) return '0'
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

/**
 * Format a like count with K/M abbreviations.
 */
export function formatLikeCount(count) {
  return formatViewCount(count)
}

/**
 * Format a rating count with K/M abbreviations.
 */
export function formatRatingCount(count) {
  return formatViewCount(count)
}

/**
 * Format an average star rating.
 */
export function formatAverageRating(rating) {
  const normalized = Number(rating || 0)
  if (!normalized) return 'No ratings yet'
  return `${normalized.toFixed(1)}★`
}

/**
 * Format rating summary copy for lesson cards and metadata rows.
 */
export function formatRatingSummary(averageRating, ratingCount) {
  const normalizedCount = Number(ratingCount || 0)
  if (!normalizedCount) return 'No ratings yet'
  return `${formatAverageRating(averageRating)} (${formatRatingCount(normalizedCount)})`
}

/**
 * Format seconds into a human-readable duration (e.g. 3661 → "1:01:01")
 */
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Format total watch time in seconds to a readable string (e.g. "2h 34m")
 */
export function formatWatchTime(seconds) {
  if (!seconds || seconds < 60) return `${Math.floor(seconds || 0)}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// Dates

/**
 * Format a date string into a relative time (e.g. "3 days ago")
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)
  const diffYear = Math.floor(diffDay / 365)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`
  if (diffWeek < 5) return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`
  if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`
  return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`
}

/**
 * Format a date string into a numeric date (e.g. "3/31/26")
 */
export function formatNumericDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const m = date.getMonth() + 1
  const d = date.getDate()
  const y = String(date.getFullYear()).slice(-2)
  return `${m}/${d}/${y}`
}

/**
 * Format a date string to a short readable date (e.g. "Mar 26, 2026")
 */
export function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Progress

/**
 * Convert a decimal (0–1) to a percentage string (e.g. 0.75 → "75%")
 */
export function formatPercent(decimal) {
  return `${Math.round((decimal || 0) * 100)}%`
}

/**
 * Return a short status label for a progress percentage
 */
export function getProgressLabel(percent) {
  if (percent >= 100) return 'Completed'
  if (percent >= 1) return `${Math.round(percent)}% watched`
  return 'Not started'
}

// Strings

/**
 * Truncate a string to maxLength characters, appending "…"
 */
export function truncate(str, maxLength = 100) {
  if (!str) return ''
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength).trimEnd() + '…'
}

/**
 * Generate initials from a display name (e.g. "John Doe" → "JD")
 */
export function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}
