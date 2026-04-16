import { STORAGE_KEYS } from './constants'

const PREFERENCES_CHANGE_EVENT = 'howtoob:preferences-updated'

export const DEFAULT_PREFERENCES = {
  autoplay: true,
  compactCardLayout: false,
  showProgressBadges: true,
  reminderNudges: true,
  emailNotifications: true,
  profileVisibility: 'public',
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readJson(key, fallback) {
  if (!canUseStorage()) return fallback

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  if (!canUseStorage()) return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage write errors to keep the UI usable.
  }
}

function dispatchPreferencesChange(preferences) {
  if (!canUseStorage()) return
  window.dispatchEvent(
    new CustomEvent(PREFERENCES_CHANGE_EVENT, {
      detail: preferences,
    })
  )
}

function normalizePreferences(preferences) {
  return {
    ...DEFAULT_PREFERENCES,
    ...(preferences || {}),
  }
}

export function getLocalPreferences() {
  return normalizePreferences(readJson(STORAGE_KEYS.LOCAL_PREFERENCES, DEFAULT_PREFERENCES))
}

export function updateLocalPreferences(updates) {
  const nextPreferences = normalizePreferences({
    ...getLocalPreferences(),
    ...(updates || {}),
  })

  writeJson(STORAGE_KEYS.LOCAL_PREFERENCES, nextPreferences)
  dispatchPreferencesChange(nextPreferences)
  return nextPreferences
}

export function subscribeToLocalPreferences(onChange) {
  if (typeof window === 'undefined') return () => {}

  const handleChange = (event) => {
    onChange(normalizePreferences(event?.detail || getLocalPreferences()))
  }

  const handleStorage = () => {
    onChange(getLocalPreferences())
  }

  window.addEventListener(PREFERENCES_CHANGE_EVENT, handleChange)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(PREFERENCES_CHANGE_EVENT, handleChange)
    window.removeEventListener('storage', handleStorage)
  }
}
