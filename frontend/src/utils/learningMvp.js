import { STORAGE_KEYS } from './constants'

const PLAYLIST_CHANGE_EVENT = 'howtoob:playlists-updated'
const DEFAULT_PLAYLIST_ID = 'saved-learning-path'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `playlist-${Date.now()}`
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
    // Ignore local storage write errors so the UI can keep working in-memory.
  }
}

function dispatchPlaylistChange() {
  if (!canUseStorage()) return
  window.dispatchEvent(new CustomEvent(PLAYLIST_CHANGE_EVENT))
}

function getDefaultPlaylist() {
  const now = new Date().toISOString()

  return {
    id: DEFAULT_PLAYLIST_ID,
    title: 'Saved learning path',
    description:
      'Local-only playlist for lessons you want to revisit until playlist endpoints are available.',
    source: 'local',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    items: [],
  }
}

function normalizePlaylistItem(item) {
  const videoId = Number(item?.videoId ?? item?.id ?? item?.video?.id)
  if (!Number.isFinite(videoId)) return null

  return {
    videoId,
    title: item?.title || item?.video?.title || 'Untitled lesson',
    description: item?.description || item?.video?.description || '',
    thumbnail_url:
      item?.thumbnail_url || item?.video?.thumbnail_url || item?.thumbnail || '',
    creator_id:
      item?.creator_id ?? item?.video?.creator_id ?? item?.video?.creator?.id ?? null,
    author_name:
      item?.author_name ||
      item?.video?.author_name ||
      item?.video?.creator?.username ||
      null,
    created_at: item?.created_at || item?.video?.created_at || null,
    views: item?.views || item?.video?.views || 0,
    addedAt: item?.addedAt || item?.savedAt || new Date().toISOString(),
  }
}

function normalizePlaylist(playlist) {
  const items = Array.isArray(playlist?.items)
    ? playlist.items.map(normalizePlaylistItem).filter(Boolean)
    : []

  return {
    id: String(playlist?.id || createId()),
    title: playlist?.title || playlist?.name || 'Untitled learning path',
    description: playlist?.description || '',
    source: playlist?.source || 'local',
    isDefault: Boolean(playlist?.isDefault),
    createdAt: playlist?.createdAt || new Date().toISOString(),
    updatedAt: playlist?.updatedAt || playlist?.createdAt || new Date().toISOString(),
    items,
  }
}

function ensureDefaultPlaylist(playlists) {
  const normalized = Array.isArray(playlists) ? playlists.map(normalizePlaylist) : []
  const hasDefault = normalized.some((playlist) => playlist.id === DEFAULT_PLAYLIST_ID)
  const withDefault = hasDefault ? normalized : [getDefaultPlaylist(), ...normalized]

  return withDefault.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

function writePlaylists(playlists) {
  writeJson(STORAGE_KEYS.LOCAL_PLAYLISTS, playlists)
  dispatchPlaylistChange()
  return playlists
}

function createVideoSnapshot(video) {
  return normalizePlaylistItem({
    videoId: video?.id,
    title: video?.title,
    description: video?.description,
    thumbnail_url: video?.thumbnail_url,
    creator_id: video?.creator_id,
    author_name:
      video?.author_name || video?.creator_name || video?.creator?.username || null,
    created_at: video?.created_at,
    views: video?.views,
    addedAt: new Date().toISOString(),
  })
}

export function getDefaultPlaylistId() {
  return DEFAULT_PLAYLIST_ID
}

export function getLocalPlaylists() {
  return ensureDefaultPlaylist(readJson(STORAGE_KEYS.LOCAL_PLAYLISTS, []))
}

export function subscribeToLocalPlaylists(onChange) {
  if (typeof window === 'undefined') return () => {}

  const handleChange = () => onChange(getLocalPlaylists())

  window.addEventListener(PLAYLIST_CHANGE_EVENT, handleChange)
  window.addEventListener('storage', handleChange)

  return () => {
    window.removeEventListener(PLAYLIST_CHANGE_EVENT, handleChange)
    window.removeEventListener('storage', handleChange)
  }
}

export function getLocalPlaylistById(playlistId) {
  return getLocalPlaylists().find((playlist) => playlist.id === String(playlistId)) || null
}

export function createLocalPlaylist({ title, description = '' }) {
  const now = new Date().toISOString()
  const nextPlaylist = {
    id: createId(),
    title: title.trim(),
    description: description.trim(),
    source: 'local',
    isDefault: false,
    createdAt: now,
    updatedAt: now,
    items: [],
  }

  writePlaylists([nextPlaylist, ...getLocalPlaylists()])
  return nextPlaylist
}

export function updateLocalPlaylist(playlistId, updates) {
  const now = new Date().toISOString()
  const playlists = getLocalPlaylists().map((playlist) => {
    if (playlist.id !== String(playlistId)) return playlist

    return {
      ...playlist,
      title: typeof updates?.title === 'string' && updates.title.trim()
        ? updates.title.trim()
        : playlist.title,
      description:
        typeof updates?.description === 'string'
          ? updates.description.trim()
          : playlist.description,
      updatedAt: now,
    }
  })

  writePlaylists(playlists)
}

export function deleteLocalPlaylist(playlistId) {
  if (String(playlistId) === DEFAULT_PLAYLIST_ID) return false

  const playlists = getLocalPlaylists().filter(
    (playlist) => playlist.id !== String(playlistId)
  )

  writePlaylists(playlists)
  return true
}

export function addVideoToPlaylist(playlistId, video) {
  const snapshot = createVideoSnapshot(video)
  if (!snapshot) return null

  const targetId = String(playlistId)
  const playlists = getLocalPlaylists().map((playlist) => {
    if (playlist.id !== targetId) return playlist

    const filteredItems = playlist.items.filter((item) => item.videoId !== snapshot.videoId)

    return {
      ...playlist,
      updatedAt: new Date().toISOString(),
      items: [...filteredItems, snapshot],
    }
  })

  writePlaylists(playlists)
  return getLocalPlaylistById(targetId)
}

export function removeVideoFromPlaylist(playlistId, videoId) {
  const targetId = String(playlistId)
  const normalizedVideoId = Number(videoId)

  const playlists = getLocalPlaylists().map((playlist) => {
    if (playlist.id !== targetId) return playlist

    return {
      ...playlist,
      updatedAt: new Date().toISOString(),
      items: playlist.items.filter((item) => item.videoId !== normalizedVideoId),
    }
  })

  writePlaylists(playlists)
  return getLocalPlaylistById(targetId)
}

export function getPlaylistsContainingVideo(videoId) {
  const normalizedVideoId = Number(videoId)

  return getLocalPlaylists().filter((playlist) =>
    playlist.items.some((item) => item.videoId === normalizedVideoId)
  )
}

export function isVideoSavedToPlaylist(videoId, playlistId = DEFAULT_PLAYLIST_ID) {
  return getPlaylistsContainingVideo(videoId).some(
    (playlist) => playlist.id === String(playlistId)
  )
}
