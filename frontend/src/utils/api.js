import { API_BASE_URL } from './constants'

const RESOLVED_API_BASE = API_BASE_URL.replace(/\/$/, '')

function buildUrl(path) {
  return `${RESOLVED_API_BASE}${path}`
}

function buildNetworkError(path, originalError) {
  const usingDirectBackend = Boolean(RESOLVED_API_BASE)
  const message = usingDirectBackend
    ? `Could not reach HowToob at ${RESOLVED_API_BASE}. Make sure the host machine is running and the connection address is correct.`
    : 'Could not reach HowToob right now. Make sure the host machine is running and try again.'

  const error = new Error(message)
  error.name = 'APIConnectionError'
  error.status = 0
  error.code = 'NETWORK_ERROR'
  error.details = {
    path,
    apiBase: RESOLVED_API_BASE || 'vite-proxy',
    originalMessage: originalError?.message || null,
  }
  error.payload = null
  return error
}

function normalizeNonJsonErrorBody(response, text) {
  const normalizedText = String(text || '').trim()
  const looksLikeHtml = /<!doctype html|<html[\s>]/i.test(normalizedText)

  if (looksLikeHtml) {
    return {
      error:
        response.status >= 500
          ? 'The service returned an unexpected error page. Please try again in a moment.'
          : `The service returned an unexpected response (${response.status}).`,
      details: {
        contentType: response.headers.get('content-type') || '',
        responseType: 'html',
      },
    }
  }

  return normalizedText ? { message: normalizedText } : {}
}

/**
 * API utility - thin wrappers around fetch() for the HowToob Flask backend.
 * All requests include credentials (session cookies for Flask-Login).
 * When VITE_API_BASE_URL is empty, Vite proxying handles local dev requests.
 */

async function request(method, path, body = null, isFormData = false) {
  const options = {
    method,
    credentials: 'include',
    headers: {},
  }

  if (body !== null && body !== undefined) {
    if (isFormData) {
      options.body = body
    } else {
      options.headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(body)
    }
  }

  let response
  try {
    response = await fetch(buildUrl(path), options)
  } catch (error) {
    throw buildNetworkError(path, error)
  }

  if (response.status === 204) {
    return { success: true }
  }

  const contentType = response.headers.get('content-type') || ''
  let data

  try {
    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      const text = await response.text()
      data = normalizeNonJsonErrorBody(response, text)
    }
  } catch {
    data = {}
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Request failed: ${response.status}`

    const error = new Error(message)
    error.name = 'APIError'
    error.status = response.status
    error.code = data?.code || null
    error.details = data?.details || null
    error.payload = data

    throw error
  }

  return data
}

function buildQuery(paramsObj = {}) {
  const params = new URLSearchParams()

  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  })

  const query = params.toString()
  return query ? `?${query}` : ''
}

// Auth

export const authAPI = {
  register: (username, email, password, role) =>
    request('POST', '/auth/register', { username, email, password, role }),

  login: (email, password) =>
    request('POST', '/auth/login', { email, password }),

  logout: () =>
    request('POST', '/auth/logout'),

  me: () =>
    request('GET', '/auth/me'),
}

// Videos

export const videosAPI = {
  getFeed: (page = 1, limit = 12, search = null) =>
    request(
      'GET',
      `/videos/feed${buildQuery({ page, limit, search })}`
    ),

  getById: (videoId) =>
    request('GET', `/videos/${videoId}`),

  recordWatchEvent: (videoId, data) =>
    request('POST', `/videos/${videoId}/watch-events`, data),

  getStats: (videoId) =>
    request('GET', `/videos/${videoId}/stats`),

  getByCreator: (userId) =>
    request('GET', `/videos/creator/${userId}`),

  upload: (formData) =>
    request('POST', '/videos/upload', formData, true),

  update: (videoId, data) =>
    request('PUT', `/videos/${videoId}`, data),

  delete: (videoId) =>
    request('DELETE', `/videos/${videoId}`),
}

// Social

export const socialAPI = {
  getComments: (videoId) =>
    request('GET', `/social/comments/${videoId}`),

  addComment: (videoId, content, parentId = null) =>
    request('POST', '/social/comments', {
      video_id: videoId,
      content,
      parent_id: parentId,
    }),

  toggleCommentLike: (commentId) =>
    request('POST', `/social/comments/${commentId}/likes/toggle`),

  toggleLike: (videoId) =>
    request('POST', '/social/likes/toggle', { video_id: videoId }),

  rateVideo: (videoId, rating) =>
    request('POST', '/social/ratings', { video_id: videoId, rating }),

  subscribe: (creatorId, tierLevel = 0) =>
    request('POST', '/social/subscribe', {
      creator_id: creatorId,
      tier_level: tierLevel,
    }),

  submitReport: ({ targetType, targetId, reason, details = '', label = '', videoId = null }) =>
    request('POST', '/social/reports', {
      target_type: targetType,
      target_id: targetId,
      reason,
      details,
      label,
      video_id: videoId,
    }),
}

// Users

export const usersAPI = {
  getSubscriptions: (userId) =>
    request('GET', `/users/${userId}/subscriptions`),

  getMyRatings: (limit = null) =>
    request('GET', `/users/me/ratings${buildQuery({ limit })}`),

  getProfile: (identifier) =>
    request('GET', `/users/profile/${encodeURIComponent(identifier)}`),
}

// Progress

export const progressAPI = {
  getAll: (status = null, limit = null) =>
    request('GET', `/users/me/progress${buildQuery({ status, limit })}`),

  upsert: ({ videoId, watchedSeconds, durationSeconds, percentComplete, completed }) =>
    request('POST', '/users/me/progress', {
      video_id: videoId,
      watched_seconds: watchedSeconds,
      duration_seconds: durationSeconds,
      percent_complete: percentComplete,
      completed,
    }),
}

// Playlists

export const playlistsAPI = {
  getAll: () =>
    request('GET', '/users/me/playlists'),

  create: ({ title, description, isDefault = false }) =>
    request('POST', '/users/me/playlists', {
      title,
      description,
      is_default: isDefault,
    }),

  getById: (playlistId) =>
    request('GET', `/users/me/playlists/${playlistId}`),

  update: (playlistId, { title, description }) =>
    request('PUT', `/users/me/playlists/${playlistId}`, {
      title,
      description,
    }),

  delete: (playlistId) =>
    request('DELETE', `/users/me/playlists/${playlistId}`),

  addVideo: (playlistId, videoId, position = null) =>
    request('POST', `/users/me/playlists/${playlistId}/videos`, {
      video_id: videoId,
      position,
    }),

  removeVideo: (playlistId, videoId) =>
    request('DELETE', `/users/me/playlists/${playlistId}/videos/${videoId}`),

  reorderVideos: (playlistId, videoIds) =>
    request('PUT', `/users/me/playlists/${playlistId}/videos/reorder`, {
      video_ids: videoIds,
    }),
}

// Quizzes

export const quizAPI = {
  getByVideoId: (videoId) =>
    request('GET', `/videos/${videoId}/quiz`),

  generate: (videoId, { questionCount = 5, overwrite = false } = {}) =>
    request('POST', `/videos/${videoId}/quiz/generate`, {
      question_count: questionCount,
      overwrite,
    }),

  submit: (videoId, answers) =>
    request('POST', `/videos/${videoId}/quiz/submissions`, { answers }),
}
