import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { playlistsAPI } from '../utils/api'
import {
  addVideoToPlaylist as addVideoToLocalPlaylist,
  createLocalPlaylist,
  deleteLocalPlaylist,
  getLocalPlaylists,
  removeVideoFromPlaylist as removeVideoFromLocalPlaylist,
  updateLocalPlaylist,
} from '../utils/learningMvp'

const PlaylistContext = createContext(null)

const DEFAULT_PLAYLIST_TITLE = 'Saved learning path'
const DEFAULT_PLAYLIST_DESCRIPTION =
  'A quick-save learning path for lessons you want to revisit later.'

function toIsoDate(value) {
  return value || new Date().toISOString()
}

function normalizePlaylistItem(item, index = 0) {
  const rawVideo = item?.video ?? item ?? {}
  const videoId = Number(item?.video_id ?? item?.videoId ?? rawVideo?.id ?? 0)

  return {
    id: item?.id ?? `${videoId}-${index}`,
    videoId,
    position: Number(item?.position ?? index + 1),
    addedAt: toIsoDate(item?.added_at ?? item?.addedAt),
    title: rawVideo?.title || item?.title || 'Untitled lesson',
    description: rawVideo?.description || item?.description || '',
    thumbnail_url: rawVideo?.thumbnail_url || rawVideo?.thumbnail || item?.thumbnail_url || '',
    creator_id: rawVideo?.creator_id ?? item?.creator_id ?? null,
    author_name:
      rawVideo?.author_name ||
      rawVideo?.creator_name ||
      rawVideo?.creator?.username ||
      item?.author_name ||
      (rawVideo?.creator_id ? `Creator #${rawVideo.creator_id}` : 'HowToob creator'),
    views: rawVideo?.views || item?.views || 0,
    created_at: rawVideo?.created_at || item?.created_at || null,
    source: item?.source || 'backend',
    rawVideo,
  }
}

function normalizePlaylist(playlist) {
  const hasLoadedItems = Array.isArray(playlist?.items)
  const items = hasLoadedItems
    ? playlist.items
        .map((item, index) => normalizePlaylistItem(item, index))
        .sort((left, right) => left.position - right.position)
    : []

  return {
    id: String(playlist?.id ?? ''),
    userId: playlist?.user_id ?? playlist?.userId ?? null,
    title: playlist?.title || 'Untitled learning path',
    description: playlist?.description || '',
    source: playlist?.source || 'backend',
    isDefault: Boolean(playlist?.is_default ?? playlist?.isDefault),
    createdAt: toIsoDate(playlist?.created_at ?? playlist?.createdAt),
    updatedAt: toIsoDate(playlist?.updated_at ?? playlist?.updatedAt),
    itemCount: typeof playlist?.item_count === 'number' ? playlist.item_count : items.length,
    hasLoadedItems,
    items,
  }
}

function normalizePlaylistCollection(playlists) {
  return (Array.isArray(playlists) ? playlists : [])
    .map(normalizePlaylist)
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    })
}

function replacePlaylistInCollection(collection, nextPlaylist) {
  const normalized = normalizePlaylist(nextPlaylist)
  const nextCollection = [...collection]
  const index = nextCollection.findIndex((playlist) => playlist.id === normalized.id)

  if (index >= 0) {
    nextCollection[index] = normalized
  } else {
    nextCollection.unshift(normalized)
  }

  return normalizePlaylistCollection(nextCollection)
}

async function hydratePlaylistsFromBackend(playlists) {
  if (!playlists.length) return playlists

  const details = await Promise.allSettled(
    playlists.map((playlist) => playlistsAPI.getById(playlist.id))
  )

  return details.map((result, index) =>
    result.status === 'fulfilled' ? result.value : playlists[index]
  )
}

export function PlaylistProvider({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [source, setSource] = useState('backend')

  const loadLocalFallback = useCallback((message = '') => {
    setPlaylists(normalizePlaylistCollection(getLocalPlaylists()))
    setSource('local')
    setError(message)
  }, [])

  const refreshPlaylists = useCallback(async () => {
    if (authLoading) return

    if (!isAuthenticated) {
      loadLocalFallback('')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await playlistsAPI.getAll()
      const normalizedPlaylists = normalizePlaylistCollection(data)
      const hydratedPlaylists = await hydratePlaylistsFromBackend(normalizedPlaylists)
      setPlaylists(normalizePlaylistCollection(hydratedPlaylists))
      setSource('backend')
    } catch (requestError) {
      loadLocalFallback(
        requestError.message ||
          'Your learning paths are not fully available right now. Saved paths on this device are still ready.'
      )
    } finally {
      setLoading(false)
    }
  }, [authLoading, isAuthenticated, loadLocalFallback])

  useEffect(() => {
    refreshPlaylists()
  }, [refreshPlaylists])

  const getPlaylistById = useCallback(
    (playlistId) => playlists.find((playlist) => playlist.id === String(playlistId)) || null,
    [playlists]
  )

  const getPlaylistDetail = useCallback(
    async (playlistId) => {
      const existing = playlists.find((playlist) => playlist.id === String(playlistId)) || null

      if (!existing || source !== 'backend' || !isAuthenticated) {
        return existing
      }

      if (existing.hasLoadedItems) {
        return existing
      }

      const detail = await playlistsAPI.getById(playlistId)
      const normalized = normalizePlaylist(detail)
      setPlaylists((prev) => replacePlaylistInCollection(prev, normalized))
      return normalized
    },
    [isAuthenticated, playlists, source]
  )

  const createPlaylist = useCallback(
    async ({ title, description = '', isDefault = false }) => {
      if (source === 'backend' && isAuthenticated) {
        const created = await playlistsAPI.create({ title, description, isDefault })
        const normalized = normalizePlaylist(created)
        setPlaylists((prev) => replacePlaylistInCollection(prev, normalized))
        return normalized
      }

      const created = createLocalPlaylist({ title, description, isDefault })
      const normalized = normalizePlaylist(created)
      setPlaylists(normalizePlaylistCollection(getLocalPlaylists()))
      return normalized
    },
    [isAuthenticated, source]
  )

  const ensureDefaultPlaylist = useCallback(async () => {
    const existing = playlists.find((playlist) => playlist.isDefault) || null
    if (existing) return existing

    return createPlaylist({
      title: DEFAULT_PLAYLIST_TITLE,
      description: DEFAULT_PLAYLIST_DESCRIPTION,
      isDefault: true,
    })
  }, [createPlaylist, playlists])

  const updatePlaylist = useCallback(
    async (playlistId, updates) => {
      if (source === 'backend' && isAuthenticated) {
        const updated = await playlistsAPI.update(playlistId, updates)
        const normalized = normalizePlaylist(updated)
        setPlaylists((prev) => replacePlaylistInCollection(prev, normalized))
        return normalized
      }

      const updated = updateLocalPlaylist(playlistId, updates)
      setPlaylists(normalizePlaylistCollection(getLocalPlaylists()))
      return updated ? normalizePlaylist(updated) : null
    },
    [isAuthenticated, source]
  )

  const deletePlaylist = useCallback(
    async (playlistId) => {
      if (source === 'backend' && isAuthenticated) {
        await playlistsAPI.delete(playlistId)
        setPlaylists((prev) => prev.filter((playlist) => playlist.id !== String(playlistId)))
        return true
      }

      const deleted = deleteLocalPlaylist(playlistId)
      setPlaylists(normalizePlaylistCollection(getLocalPlaylists()))
      return deleted
    },
    [isAuthenticated, source]
  )

  const addVideoToPlaylist = useCallback(
    async (playlistId, video, options = {}) => {
      const videoId = Number(video?.id ?? video?.videoId)
      const existingPlaylist = playlists.find((playlist) => playlist.id === String(playlistId))
      const alreadyPresent = existingPlaylist?.items.some((item) => item.videoId === videoId) || false

      if (source === 'backend' && isAuthenticated) {
        const updated = await playlistsAPI.addVideo(playlistId, videoId, options.position ?? null)
        const normalized = normalizePlaylist(updated)
        setPlaylists((prev) => replacePlaylistInCollection(prev, normalized))
        return { playlist: normalized, alreadyPresent }
      }

      const updated = addVideoToLocalPlaylist(playlistId, video, options)
      setPlaylists(normalizePlaylistCollection(getLocalPlaylists()))
      return {
        playlist: updated ? normalizePlaylist(updated) : null,
        alreadyPresent,
      }
    },
    [isAuthenticated, playlists, source]
  )

  const removeVideoFromPlaylist = useCallback(
    async (playlistId, videoId) => {
      if (source === 'backend' && isAuthenticated) {
        const updated = await playlistsAPI.removeVideo(playlistId, videoId)
        const normalized = normalizePlaylist(updated)
        setPlaylists((prev) => replacePlaylistInCollection(prev, normalized))
        return normalized
      }

      const updated = removeVideoFromLocalPlaylist(playlistId, videoId)
      setPlaylists(normalizePlaylistCollection(getLocalPlaylists()))
      return updated ? normalizePlaylist(updated) : null
    },
    [isAuthenticated, source]
  )

  const reorderPlaylistVideos = useCallback(
    async (playlistId, videoIds) => {
      if (source === 'backend' && isAuthenticated) {
        const updated = await playlistsAPI.reorderVideos(playlistId, videoIds)
        const normalized = normalizePlaylist(updated)
        setPlaylists((prev) => replacePlaylistInCollection(prev, normalized))
        return normalized
      }

      return getPlaylistById(playlistId)
    },
    [getPlaylistById, isAuthenticated, source]
  )

  const value = useMemo(
    () => ({
      playlists,
      loading,
      error,
      source,
      refreshPlaylists,
      getPlaylistById,
      getPlaylistDetail,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      ensureDefaultPlaylist,
      addVideoToPlaylist,
      removeVideoFromPlaylist,
      reorderPlaylistVideos,
    }),
    [
      addVideoToPlaylist,
      createPlaylist,
      deletePlaylist,
      ensureDefaultPlaylist,
      error,
      getPlaylistById,
      getPlaylistDetail,
      loading,
      playlists,
      refreshPlaylists,
      removeVideoFromPlaylist,
      reorderPlaylistVideos,
      source,
      updatePlaylist,
    ]
  )

  return <PlaylistContext.Provider value={value}>{children}</PlaylistContext.Provider>
}

export function usePlaylists() {
  const context = useContext(PlaylistContext)
  if (!context) {
    throw new Error('usePlaylists must be used inside <PlaylistProvider>')
  }

  return context
}
