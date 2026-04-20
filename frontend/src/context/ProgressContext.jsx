import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react'
import { useAuth } from './AuthContext'
import { COMPLETION_THRESHOLD, STORAGE_KEYS } from '../utils/constants'
import { progressAPI, videosAPI } from '../utils/api'

/**
 * ProgressContext stores lesson progress keyed by videoId.
 *
 * Shape:
 *   { watchedSeconds, durationSeconds, percent, completed, lastUpdated }
 */

const ProgressContext = createContext(null)
const EMPTY_PROGRESS_ENTRY = {
  watchedSeconds: 0,
  durationSeconds: 0,
  percent: 0,
  completed: false,
  lastUpdated: null,
  source: 'local',
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
    // Ignore storage errors and keep the app usable in-memory.
  }
}

function getLatestDate(left, right) {
  const leftTime = left ? new Date(left).getTime() : 0
  const rightTime = right ? new Date(right).getTime() : 0
  return rightTime >= leftTime ? right || null : left || null
}

function normalizeProgressEntry(entry, source = 'backend') {
  const rawEntry = entry?.progress ?? entry ?? {}
  const watchedSeconds = Math.max(
    0,
    Number(rawEntry?.watched_seconds ?? rawEntry?.watchedSeconds ?? 0)
  )
  const durationSeconds = Math.max(
    0,
    Number(rawEntry?.duration_seconds ?? rawEntry?.durationSeconds ?? 0)
  )
  const rawPercent = Number(rawEntry?.percent_complete ?? rawEntry?.percent ?? 0)
  const percent = Math.max(
    0,
    Math.min(
      100,
      rawPercent || (durationSeconds > 0 ? (watchedSeconds / durationSeconds) * 100 : 0)
    )
  )

  return {
    watchedSeconds,
    durationSeconds,
    percent,
    completed: Boolean(rawEntry?.completed) || percent / 100 >= COMPLETION_THRESHOLD,
    lastUpdated:
      rawEntry?.last_watched_at ||
      rawEntry?.updated_at ||
      rawEntry?.lastUpdated ||
      rawEntry?.created_at ||
      null,
    source,
    video: rawEntry?.video || null,
  }
}

function mergeProgressEntry(previous, nextEntry) {
  const previousEntry = previous || EMPTY_PROGRESS_ENTRY
  const incomingEntry = nextEntry || EMPTY_PROGRESS_ENTRY

  return {
    watchedSeconds: Math.max(
      previousEntry.watchedSeconds || 0,
      incomingEntry.watchedSeconds || 0
    ),
    durationSeconds: incomingEntry.durationSeconds || previousEntry.durationSeconds || 0,
    percent: Math.max(previousEntry.percent || 0, incomingEntry.percent || 0),
    completed: Boolean(previousEntry.completed || incomingEntry.completed),
    lastUpdated: getLatestDate(previousEntry.lastUpdated, incomingEntry.lastUpdated),
    source: incomingEntry.source || previousEntry.source || 'local',
    video: incomingEntry.video || previousEntry.video || null,
  }
}

function normalizeProgressMap(entries, source = 'backend') {
  const normalized = {}

  ;(Array.isArray(entries) ? entries : []).forEach((entry) => {
    const videoId = String(entry?.video_id ?? entry?.videoId ?? entry?.video?.id ?? '')
    if (!videoId) return

    normalized[videoId] = mergeProgressEntry(
      normalized[videoId],
      normalizeProgressEntry(entry, source)
    )
  })

  return normalized
}

function mergeProgressMaps(primaryProgress, fallbackProgress) {
  const merged = { ...(fallbackProgress || {}) }

  Object.entries(primaryProgress || {}).forEach(([videoId, entry]) => {
    merged[videoId] = mergeProgressEntry(merged[videoId], entry)
  })

  return merged
}

function deriveProgressStats(progress) {
  const values = Object.values(progress || {})

  return {
    totalVideosWatched: values.filter((entry) => entry?.completed).length,
    totalWatchTimeSeconds: values.reduce(
      (sum, entry) => sum + Math.max(0, Math.floor(entry?.watchedSeconds || 0)),
      0
    ),
  }
}

export function ProgressProvider({ children }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth()
  // Map of videoId → progress object
  const [localProgress, setLocalProgress] = useState(() =>
    readJson(STORAGE_KEYS.LEARNING_PROGRESS, {})
  )
  const [backendProgress, setBackendProgress] = useState({})
  const [progressSource, setProgressSource] = useState('local')
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [progressError, setProgressError] = useState('')

  const [storedStats, setStoredStats] = useState(() =>
    readJson(STORAGE_KEYS.LEARNING_STATS, {
      quizScores: [],
      completedPlaylists: [],
    })
  )

  const stats = useMemo(
    () => ({
      ...deriveProgressStats(
        progressSource === 'backend'
          ? mergeProgressMaps(backendProgress, localProgress)
          : localProgress
      ),
      quizScores: Array.isArray(storedStats.quizScores) ? storedStats.quizScores : [],
      completedPlaylists: Array.isArray(storedStats.completedPlaylists)
        ? storedStats.completedPlaylists
        : [],
    }),
    [backendProgress, localProgress, progressSource, storedStats]
  )

  const progress = useMemo(
    () =>
      progressSource === 'backend'
        ? mergeProgressMaps(backendProgress, localProgress)
        : localProgress,
    [backendProgress, localProgress, progressSource]
  )

  useEffect(() => {
    writeJson(STORAGE_KEYS.LEARNING_PROGRESS, localProgress)
  }, [localProgress])

  useEffect(() => {
    writeJson(STORAGE_KEYS.LEARNING_STATS, storedStats)
  }, [storedStats])

  const setProgressEntry = useCallback((setter, videoId, entry) => {
    if (!videoId || !entry) return

    setter((previousMap) => {
      const normalizedVideoId = String(videoId)
      return {
        ...previousMap,
        [normalizedVideoId]: mergeProgressEntry(previousMap[normalizedVideoId], entry),
      }
    })
  }, [])

  const updateLocalEntry = useCallback(
    (videoId, watchedSeconds, durationSeconds) => {
      if (!videoId || !durationSeconds) return EMPTY_PROGRESS_ENTRY

      const nextEntry = normalizeProgressEntry(
        {
          watchedSeconds,
          durationSeconds,
          percent: Math.min((watchedSeconds / durationSeconds) * 100, 100),
          completed: watchedSeconds / durationSeconds >= COMPLETION_THRESHOLD,
          lastUpdated: new Date().toISOString(),
        },
        'local'
      )

      setProgressEntry(setLocalProgress, videoId, nextEntry)
      return nextEntry
    },
    [setProgressEntry]
  )

  const loadBackendProgress = useCallback(async () => {
    if (authLoading) return

    if (!isAuthenticated) {
      setBackendProgress({})
      setProgressSource('local')
      setProgressError('')
      setProgressLoaded(true)
      return
    }

    setProgressLoaded(false)
    setProgressError('')

    try {
      const payload = await progressAPI.getAll()
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.progress)
          ? payload.progress
          : Array.isArray(payload?.results)
            ? payload.results
            : []

      setBackendProgress(normalizeProgressMap(items, 'backend'))
      setProgressSource('backend')
      setProgressError('')
    } catch (requestError) {
      setBackendProgress({})
      setProgressSource('local')
      setProgressError(
        requestError.message ||
          'Progress could not be refreshed right now. Your recent activity on this device is still available.'
      )
    } finally {
      setProgressLoaded(true)
    }
  }, [authLoading, isAuthenticated])

  useEffect(() => {
    loadBackendProgress()
  }, [loadBackendProgress, user?.id])

  const updateVideoProgress = useCallback(
    async (videoId, watchedSeconds, durationSeconds) => {
      if (!videoId || !durationSeconds) return EMPTY_PROGRESS_ENTRY

      const normalizedWatchedSeconds = Math.max(
        0,
        Math.min(watchedSeconds, durationSeconds)
      )
      const optimisticEntry = updateLocalEntry(
        videoId,
        normalizedWatchedSeconds,
        durationSeconds
      )

      if (!isAuthenticated) {
        return optimisticEntry
      }

      try {
        const payload = await videosAPI.recordWatchEvent(videoId, {
          watched_seconds: normalizedWatchedSeconds,
          duration_seconds: durationSeconds,
          percent_complete: optimisticEntry.percent,
          completed: optimisticEntry.completed,
        })

        const backendEntry = normalizeProgressEntry(payload, 'backend')
        setProgressEntry(setBackendProgress, videoId, backendEntry)
        setProgressSource('backend')
        setProgressError('')
        return backendEntry
      } catch (requestError) {
        setProgressError(
          requestError.message ||
            'Progress could not be saved right now. Your latest activity is still kept on this device.'
        )
        return optimisticEntry
      }
    },
    [isAuthenticated, setProgressEntry, updateLocalEntry]
  )

  // Get progress for a specific video
  const getVideoProgress = useCallback(
    (videoId) =>
      progress[String(videoId)] || {
        ...EMPTY_PROGRESS_ENTRY,
      },
    [progress]
  )

  // Save quiz score
  const saveQuizScore = useCallback((videoId, score, metadata = {}) => {
    setStoredStats((prev) => ({
      ...prev,
      quizScores: [
        ...prev.quizScores.filter((quiz) => quiz.videoId !== videoId),
        {
          videoId,
          score,
          takenAt: metadata.takenAt || metadata.submittedAt || new Date().toISOString(),
          source: metadata.source || 'local',
          passed: metadata.passed ?? null,
        },
      ],
    }))
  }, [])

  // Get quiz score for a video
  const getQuizScore = useCallback(
    (videoId) => stats.quizScores.find((quiz) => quiz.videoId === videoId) || null,
    [stats.quizScores]
  )

  // Calculate playlist completion
  const getPlaylistProgress = useCallback(
    (videoIds) => {
      if (!videoIds?.length) return { completed: 0, total: 0, percent: 0 }

      const completed = videoIds.filter((id) => progress[String(id)]?.completed).length

      return {
        completed,
        total: videoIds.length,
        percent: Math.round((completed / videoIds.length) * 100),
      }
    },
    [progress]
  )

  const markPlaylistCompleted = useCallback((playlistId, title) => {
    setStoredStats((prev) => {
      if (prev.completedPlaylists.some((item) => item.playlistId === playlistId)) {
        return prev
      }

      return {
        ...prev,
        completedPlaylists: [
          ...prev.completedPlaylists,
          {
            playlistId,
            title,
            completedAt: new Date().toISOString(),
          },
        ],
      }
    })
  }, [])

  const value = {
    progress,
    stats,
    progressSource,
    progressLoaded,
    progressError,
    refreshProgress: loadBackendProgress,
    updateVideoProgress,
    getVideoProgress,
    saveQuizScore,
    getQuizScore,
    getPlaylistProgress,
    markPlaylistCompleted,
  }

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProgress() {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress must be used inside <ProgressProvider>')
  return ctx
}
