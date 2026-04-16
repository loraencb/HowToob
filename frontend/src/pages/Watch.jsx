import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProgress } from '../context/ProgressContext'
import { usePlaylists } from '../context/PlaylistContext'
import useLocalPreferences from '../hooks/useLocalPreferences'
import { socialAPI, usersAPI, videosAPI } from '../utils/api'
import { addLocalReport } from '../utils/moderationMvp'
import { PROGRESS_SAVE_INTERVAL_MS } from '../utils/constants'
import {
  formatNumericDate,
  formatRelativeTime,
  formatViewCount,
  getInitials,
} from '../utils/formatters'
import { getAccessMetadata } from '../utils/lessonMetadata'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorMessage from '../components/common/ErrorMessage'
import Modal from '../components/common/Modal'
import VideoCard from '../components/common/VideoCard'
import styles from './Watch.module.css'

function cleanTitle(title) {
  if (!title) return ''
  return title.replace(/^[^:]+:\s*/, '')
}

const EXPLORE_MORE_VIEW_COUNTS = [132, 187, 241, 316, 402, 489]

function normalizeVideoResponse(data) {
  const raw = data?.video ?? data?.data ?? data ?? null
  if (!raw) return null

  return {
    ...raw,
    id: raw.id,
    title: raw.title || 'Untitled Video',
    description: raw.description || '',
    views: raw.views || 0,
    created_at: raw.created_at || new Date().toISOString(),
    video_url: raw.video_url || raw.file_url || raw.url || '',
    thumbnail_url: raw.thumbnail_url || raw.thumbnail || '',
    category: raw.category || raw.subject || raw.topic || '',
    author_name:
      raw.author_name ||
      raw.creator_name ||
      raw.username ||
      raw.creator?.username ||
      'HowToob Official',
    author_avatar:
      raw.author_avatar ||
      raw.creator_avatar ||
      raw.creator?.avatar_url ||
      '/videos/files/thumbnails/howtoob_logo.png',
  }
}

function getCategoryLabel(video) {
  return video?.category || 'Not tagged yet'
}

function normalizeFeedResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.videos)) return data.videos
  if (Array.isArray(data?.items)) return data.items
  return []
}

function normalizeCommentsResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.comments)) return data.comments
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.items)) return data.items
  return []
}

function normalizeComment(comment) {
  return {
    ...comment,
    id: comment.id,
    parent_id: comment.parent_id ?? comment.parentId ?? null,
    content: comment.content || comment.text || '',
    created_at: comment.created_at || comment.createdAt || new Date().toISOString(),
    username:
      comment.username ||
      comment.user?.username ||
      comment.author_name ||
      comment.author ||
      null,
    user_id: comment.user_id || comment.user?.id || null,
  }
}

function buildCommentTree(comments) {
  const byId = new Map()
  const roots = []

  comments.forEach((comment) => {
    byId.set(comment.id, { ...comment, replies: [] })
  })

  comments.forEach((comment) => {
    const node = byId.get(comment.id)
    if (comment.parent_id && byId.has(comment.parent_id)) {
      byId.get(comment.parent_id).replies.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

function CommentItem({
  comment,
  isAuthenticated,
  replyingTo,
  replyDrafts,
  submittingCommentId,
  onReplyStart,
  onReplyCancel,
  onReplyChange,
  onReplySubmit,
  onReport,
}) {
  return (
    <article className={styles.commentItem}>
      <div className={styles.commentAvatar}>
        {getInitials(comment.username || 'User')}
      </div>

      <div className={styles.commentBody}>
        <div className={styles.commentCard}>
          <div className={styles.commentHeader}>
            <span className={styles.commentAuthor}>
              {comment.username || `User #${comment.user_id ?? ''}`}
            </span>
            <span className={styles.commentTime}>
              {formatRelativeTime(comment.created_at)}
            </span>
          </div>
          <p className={styles.commentText}>{comment.content}</p>
        </div>

        {isAuthenticated && (
          <div className={styles.commentActions}>
            <button
              type="button"
              className={styles.replyButton}
              onClick={() => onReplyStart(comment.id)}
            >
              Reply
            </button>
            <button
              type="button"
              className={styles.reportCommentButton}
              onClick={() =>
                onReport(
                  'comment',
                  comment.id,
                  `comment by ${comment.username || `User #${comment.user_id ?? ''}`}`
                )
              }
            >
              Report
            </button>
          </div>
        )}

        {replyingTo === comment.id && (
          <form
            className={styles.replyComposer}
            onSubmit={(event) => onReplySubmit(event, comment.id)}
          >
            <textarea
              className={styles.replyInput}
              value={replyDrafts[comment.id] || ''}
              onChange={(event) => onReplyChange(comment.id, event.target.value)}
              placeholder={`Reply to ${comment.username || 'this comment'}...`}
              rows={3}
            />
            <div className={styles.replyComposerActions}>
              <button
                type="button"
                className={styles.replyCancelButton}
                onClick={onReplyCancel}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.replySubmitButton}
                disabled={
                  submittingCommentId === comment.id ||
                  !(replyDrafts[comment.id] || '').trim()
                }
              >
                {submittingCommentId === comment.id ? 'Replying...' : 'Post Reply'}
              </button>
            </div>
          </form>
        )}

        {comment.replies.length > 0 && (
          <div className={styles.replyList}>
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                isAuthenticated={isAuthenticated}
                replyingTo={replyingTo}
                replyDrafts={replyDrafts}
                submittingCommentId={submittingCommentId}
                onReplyStart={onReplyStart}
                onReplyCancel={onReplyCancel}
                onReplyChange={onReplyChange}
                onReplySubmit={onReplySubmit}
                onReport={onReport}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

export default function Watch() {
  const { videoId } = useParams()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, user } = useAuth()
  const {
    getPlaylistProgress,
    getVideoProgress,
    updateVideoProgress,
    progressSource,
  } = useProgress()
  const {
    playlists,
    loading: playlistsLoading,
    getPlaylistDetail,
    ensureDefaultPlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
  } = usePlaylists()
  const [preferences] = useLocalPreferences()

  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accessDenied, setAccessDenied] = useState(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [recommendedVideos, setRecommendedVideos] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [subscriptionTier, setSubscriptionTier] = useState(0)
  const [interactionNotice, setInteractionNotice] = useState('')
  const [interactionError, setInteractionError] = useState('')
  const [likeLoading, setLikeLoading] = useState(false)
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [resumeNotice, setResumeNotice] = useState('')
  const [playlistNotice, setPlaylistNotice] = useState('')
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('spam')
  const [reportDetails, setReportDetails] = useState('')
  const [reportFeedback, setReportFeedback] = useState('')
  const [reportFeedbackMode, setReportFeedbackMode] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)

  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentsError, setCommentsError] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [replyDrafts, setReplyDrafts] = useState({})
  const [replyingTo, setReplyingTo] = useState(null)
  const [submittingCommentId, setSubmittingCommentId] = useState(null)

  const commentTree = useMemo(() => buildCommentTree(comments), [comments])
  const activePlaylistId = searchParams.get('playlist')
  const savedProgress = useMemo(() => getVideoProgress(videoId), [getVideoProgress, videoId])
  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId) || null,
    [activePlaylistId, playlists]
  )
  const playlistContextUnavailable = Boolean(
    activePlaylistId && !activePlaylist && !playlistsLoading
  )
  const defaultPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.isDefault) || null,
    [playlists]
  )
  const savedToPlaylist = useMemo(
    () =>
      Boolean(
        defaultPlaylist?.items.some((item) => item.videoId === Number(video?.id || videoId))
      ),
    [defaultPlaylist?.items, video?.id, videoId]
  )
  const playlistProgress = useMemo(
    () =>
      activePlaylist
        ? getPlaylistProgress(activePlaylist.items.map((item) => item.videoId))
        : null,
    [activePlaylist, getPlaylistProgress]
  )
  const currentPlaylistIndex = activePlaylist
    ? activePlaylist.items.findIndex((item) => Number(item.videoId) === Number(videoId))
    : -1
  const nextPlaylistItem =
    activePlaylist && currentPlaylistIndex > -1
      ? activePlaylist.items[currentPlaylistIndex + 1] || null
      : null
  const upNextVideo = nextPlaylistItem || recommendedVideos[0] || null
  const exploreMoreVideos = recommendedVideos
    .filter((item) => Number(item.id) !== Number(upNextVideo?.id || upNextVideo?.videoId))
    .slice(0, 6)

  const videoRef = useRef(null)
  const settingsRef = useRef(null)
  const settingsButtonRef = useRef(null)
  const playerWrapperRef = useRef(null)
  const lastPersistedSecondsRef = useRef(0)
  const resumeAppliedRef = useRef(false)

  useEffect(() => {
    function handleClickOutside(event) {
      const clickedInsidePopup = settingsRef.current?.contains(event.target)
      const clickedSettingsButton = settingsButtonRef.current?.contains(event.target)

      if (!clickedInsidePopup && !clickedSettingsButton) {
        setShowSettings(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    setResumeNotice('')
    setPlaylistNotice('')
    setInteractionNotice('')
    setInteractionError('')
    setReportFeedback('')
    setReportFeedbackMode('')
    setAccessDenied(null)
    setReportTarget(null)
    setReportReason('spam')
    setReportDetails('')
    setLiked(false)
    setDisliked(false)
    setSubscribed(false)
    setSubscriptionTier(0)
    lastPersistedSecondsRef.current = 0
    resumeAppliedRef.current = false
  }, [refreshToken, videoId])

  useEffect(() => {
    if (!activePlaylistId) return

    getPlaylistDetail(activePlaylistId).catch(() => {
      // The page already handles unavailable playlist context gracefully.
    })
  }, [activePlaylistId, getPlaylistDetail])

  useEffect(() => {
    async function fetchVideoData() {
      setLoading(true)
      setError(null)
      setAccessDenied(null)

      try {
        const [videoResult, feedResult] = await Promise.allSettled([
          videosAPI.getById(videoId),
          videosAPI.getFeed(1, 10),
        ])

        const normalizedFeed =
          feedResult.status === 'fulfilled' ? normalizeFeedResponse(feedResult.value) : []

        setRecommendedVideos(
          normalizedFeed.filter((item) => Number(item.id) !== Number(videoId))
        )

        if (videoResult.status === 'rejected') {
          if (videoResult.reason?.code === 'ACCESS_DENIED') {
            setAccessDenied(videoResult.reason)
            setVideo(null)
            setError(null)
            return
          }

          throw videoResult.reason
        }

        const normalizedVideo = normalizeVideoResponse(videoResult.value)

        if (!normalizedVideo) {
          throw new Error('Video not found.')
        }

        setVideo(normalizedVideo)
      } catch (err) {
        setError(err.message || 'Failed to load video')
      } finally {
        setLoading(false)
      }
    }

    fetchVideoData()
  }, [refreshToken, videoId])

  useEffect(() => {
    async function fetchComments() {
      setCommentsLoading(true)
      setCommentsError('')

      try {
        const data = await socialAPI.getComments(videoId)
        const normalizedComments = normalizeCommentsResponse(data).map(normalizeComment)
        setComments(normalizedComments)
      } catch (err) {
        setComments([])
        setCommentsError(err.message || 'Failed to load comments')
      } finally {
        setCommentsLoading(false)
      }
    }

    fetchComments()
  }, [videoId])

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !video?.creator_id) {
      setSubscribed(false)
      setSubscriptionTier(0)
      return
    }

    let active = true

    async function fetchSubscriptionState() {
      try {
        const data = await usersAPI.getSubscriptions(user.id)
        if (!active) return

        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.subscriptions)
            ? data.subscriptions
            : Array.isArray(data?.results)
              ? data.results
              : []

        const matchingSubscription =
          items.find((item) => Number(item.creator_id ?? item.id) === Number(video.creator_id)) ||
          null

        setSubscribed(Boolean(matchingSubscription))
        setSubscriptionTier(Number(matchingSubscription?.tier_level || 0))
      } catch {
        if (active) {
          setSubscribed(false)
          setSubscriptionTier(0)
        }
      }
    }

    fetchSubscriptionState()

    return () => {
      active = false
    }
  }, [isAuthenticated, user?.id, video?.creator_id])

  useEffect(() => {
    const handleFsChange = () => {
      const fullscreenActive = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      )

      setShowSettings(false)
      setIsPlaying(videoRef.current ? !videoRef.current.paused : false)

      if (!fullscreenActive) {
        playerWrapperRef.current?.focus?.()
      }
    }

    document.addEventListener('fullscreenchange', handleFsChange)
    document.addEventListener('webkitfullscreenchange', handleFsChange)
    document.addEventListener('mozfullscreenchange', handleFsChange)
    document.addEventListener('MSFullscreenChange', handleFsChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      document.removeEventListener('webkitfullscreenchange', handleFsChange)
      document.removeEventListener('mozfullscreenchange', handleFsChange)
      document.removeEventListener('MSFullscreenChange', handleFsChange)
    }
  }, [])

  const persistProgress = useCallback(
    (watchedSeconds, durationSeconds) => {
      const normalizedDuration = durationSeconds || videoRef.current?.duration || duration
      const normalizedWatched = watchedSeconds ?? videoRef.current?.currentTime ?? currentTime

      if (!video?.id || !normalizedDuration) return

      updateVideoProgress(
        video.id,
        Math.min(normalizedWatched, normalizedDuration),
        normalizedDuration
      )
    },
    [currentTime, duration, updateVideoProgress, video?.id]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleBeforeUnload = () => {
      persistProgress()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      handleBeforeUnload()
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [persistProgress])

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed)
    if (videoRef.current) {
      videoRef.current.playbackRate = speed
    }
  }

  const togglePlay = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }

    setIsPlaying(!isPlaying)
  }

  const handleVolumeChange = (event) => {
    const value = parseFloat(event.target.value)
    setVolume(value)

    if (videoRef.current) {
      videoRef.current.volume = value
      videoRef.current.muted = value === 0
      setIsMuted(value === 0)
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return

    const muted = !isMuted
    setIsMuted(muted)
    videoRef.current.muted = muted

    if (muted) {
      videoRef.current.volume = 0
    } else {
      videoRef.current.volume = volume || 0.5
    }
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return

    const nextCurrentTime = videoRef.current.currentTime
    const nextDuration = videoRef.current.duration || duration

    setCurrentTime(nextCurrentTime)

    if (
      nextDuration &&
      nextCurrentTime - lastPersistedSecondsRef.current >= PROGRESS_SAVE_INTERVAL_MS / 1000
    ) {
      persistProgress(nextCurrentTime, nextDuration)
      lastPersistedSecondsRef.current = nextCurrentTime
    }
  }

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return

    const nextDuration = videoRef.current.duration || 0
    const resumeSeconds = savedProgress.watchedSeconds || 0
    setDuration(nextDuration)

    if (
      !resumeAppliedRef.current &&
      nextDuration &&
      resumeSeconds > 5 &&
      !savedProgress.completed
    ) {
      const safeResume = Math.min(resumeSeconds, Math.max(0, nextDuration - 2))

      if (safeResume > 0) {
        videoRef.current.currentTime = safeResume
        setCurrentTime(safeResume)
        setResumeNotice(
          `Resumed from ${formatTime(safeResume)} using ${
            progressSource === 'backend' ? 'backend progress' : 'local fallback progress'
          }.`
        )
        lastPersistedSecondsRef.current = safeResume
      }
    }

    resumeAppliedRef.current = true
  }

  const handlePlaybackError = () => {
    setInteractionNotice('')
    setInteractionError(
      'The lesson stream could not be loaded on this device. Check that the backend is reachable over the LAN, your session is still valid here, and the host machine firewall allows video traffic.'
    )
  }

  const handleSeek = (event) => {
    const value = parseFloat(event.target.value)
    setCurrentTime(value)

    if (videoRef.current) {
      videoRef.current.currentTime = value
    }
  }

  const toggleFullscreen = () => {
    const element = playerWrapperRef.current
    if (!element) return

    const fullscreenActive = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    )

    if (!fullscreenActive) {
      const fullscreenOptions = { navigationUI: 'hide' }
      if (element.requestFullscreen) {
        element.requestFullscreen(fullscreenOptions).catch((err) => {
          console.error('Fullscreen error:', err)
        })
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen()
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen()
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen()
      }
      return
    }

    if (document.exitFullscreen) {
      document.exitFullscreen().catch((err) => {
        console.error('Exit fullscreen error:', err)
      })
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen()
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen()
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen()
    }
  }

  const togglePictureInPicture = async () => {
    try {
      if (!videoRef.current) return

      if (videoRef.current !== document.pictureInPictureElement) {
        await videoRef.current.requestPictureInPicture()
      } else {
        await document.exitPictureInPicture()
      }

      setShowSettings(false)
    } catch (err) {
      console.error('Picture-in-picture failed', err)
    }
  }

  const handleReplyChange = (commentId, value) => {
    setReplyDrafts((prev) => ({ ...prev, [commentId]: value }))
  }

  const handleReplyStart = (commentId) => {
    setReplyingTo(commentId)
  }

  const handleReplyCancel = () => {
    setReplyingTo(null)
  }

  const handleCommentSubmit = async (event) => {
    event.preventDefault()
    const content = commentDraft.trim()
    if (!content) return

    setSubmittingCommentId('new')

    try {
      const created = await socialAPI.addComment(videoId, content)
      const normalizedCreated = normalizeComment(
        created?.comment ?? created?.data ?? created
      )

      setComments((prev) => [...prev, normalizedCreated])
      setCommentDraft('')
      setCommentsError('')
    } catch (err) {
      setCommentsError(err.message || 'Failed to post comment')
    } finally {
      setSubmittingCommentId(null)
    }
  }

  const handleReplySubmit = async (event, parentId) => {
    event.preventDefault()
    const content = (replyDrafts[parentId] || '').trim()
    if (!content) return

    setSubmittingCommentId(parentId)

    try {
      const created = await socialAPI.addComment(videoId, content, parentId)
      const normalizedCreated = normalizeComment(
        created?.comment ?? created?.data ?? created
      )

      setComments((prev) => [...prev, normalizedCreated])
      setReplyDrafts((prev) => ({ ...prev, [parentId]: '' }))
      setReplyingTo(null)
      setCommentsError('')
    } catch (err) {
      setCommentsError(err.message || 'Failed to post reply')
    } finally {
      setSubmittingCommentId(null)
    }
  }

  const handleLikeToggle = async () => {
    if (!isAuthenticated) {
      setInteractionError('Sign in to save helpful feedback on lessons.')
      setInteractionNotice('')
      return
    }

    setLikeLoading(true)
    setInteractionError('')
    setInteractionNotice('')

    try {
      const result = await socialAPI.toggleLike(videoId)
      const nextLiked = Boolean(result?.liked)

      setLiked(nextLiked)
      setDisliked(false)
      setVideo((prev) =>
        prev
          ? {
              ...prev,
              like_count: Math.max(
                0,
                (prev.like_count || 0) + (nextLiked ? 1 : -1)
              ),
            }
          : prev
      )
      setInteractionNotice(
        nextLiked ? 'Lesson marked as helpful.' : 'Helpful reaction removed.'
      )
    } catch (err) {
      setInteractionError(err.message || 'Could not update your feedback.')
    } finally {
      setLikeLoading(false)
    }
  }

  const handleDislikeToggle = () => {
    setDisliked((prev) => !prev)
    setLiked(false)
    setInteractionError('')
    setInteractionNotice(
      'Dislike feedback is currently a local-only prototype and is not sent to the backend yet.'
    )
  }

  const handleSubscribe = async (requestedTier = 0) => {
    const creatorId = Number(video?.creator_id ?? accessDenied?.details?.creator_id ?? 0)
    if (!creatorId || creatorId === Number(user?.id)) return

    if (!isAuthenticated) {
      setInteractionError(
        requestedTier > 0
          ? 'Sign in to unlock tiered lessons and manage creator subscriptions.'
          : 'Sign in to follow creators and personalize your learning feed.'
      )
      setInteractionNotice('')
      return
    }

    const nextTier = Math.max(0, Number(requestedTier || 0))

    if (subscribed && subscriptionTier >= nextTier) {
      setInteractionNotice(
        nextTier > 0
          ? `You already have Tier ${subscriptionTier} access for this creator.`
          : 'You are already following this creator. Unsubscribe is not supported by the current backend yet.'
      )
      setInteractionError('')
      return
    }

    setSubscribeLoading(true)
    setInteractionError('')
    setInteractionNotice('')

    try {
      const result = await socialAPI.subscribe(creatorId, nextTier)
      setSubscribed(true)
      setSubscriptionTier(Number(result?.tier_level || nextTier || 0))
      setInteractionNotice(
        nextTier > 0
          ? `Access upgraded to Tier ${Math.max(nextTier, Number(result?.tier_level || 0))}. Reloading this lesson now.`
          : 'Creator added to your subscriptions. Future dashboard shelves will use this backend data.'
      )

      if (nextTier > 0) {
        setAccessDenied(null)
        setRefreshToken((value) => value + 1)
      }
    } catch (err) {
      setInteractionError(err.message || 'Could not subscribe to this creator.')
    } finally {
      setSubscribeLoading(false)
    }
  }

  const handleSaveToggle = async () => {
    if (!video) return

    if (!isAuthenticated) {
      setPlaylistNotice('')
      setInteractionNotice('')
      setInteractionError('Sign in to save lessons into a backend learning path.')
      return
    }

    if (savedToPlaylist) {
      try {
        if (!defaultPlaylist) {
          throw new Error('Your saved learning path is not available right now.')
        }

        await removeVideoFromPlaylist(defaultPlaylist.id, video.id)
        setPlaylistNotice('Removed from your saved learning path.')
        setInteractionError('')
      } catch (requestError) {
        setInteractionError(
          requestError.message || 'Could not update your learning path right now.'
        )
        setPlaylistNotice('')
      }

      return
    }

    try {
      const playlist = defaultPlaylist || (await ensureDefaultPlaylist())
      const result = await addVideoToPlaylist(playlist.id, video)

      setPlaylistNotice(
        result?.alreadyPresent
          ? `Already in ${playlist.title}.`
          : `Saved to ${playlist.title || 'your learning path'}.`
      )
      setInteractionError('')
    } catch (requestError) {
      setInteractionError(
        requestError.message || 'Could not save this lesson to your learning path.'
      )
      setPlaylistNotice('')
    }
  }

  const openReport = (targetType, targetId, label) => {
    setReportTarget({ targetType, targetId, label })
    setReportReason('spam')
    setReportDetails('')
    setReportFeedback('')
    setReportFeedbackMode('')
  }

  const closeReport = () => {
    setReportTarget(null)
    setReportReason('spam')
    setReportDetails('')
    setReportSubmitting(false)
  }

  const handleReportSubmit = async (event) => {
    event.preventDefault()
    if (!reportTarget) return

    if (!isAuthenticated) {
      setReportFeedbackMode('error')
      setReportFeedback('Sign in to submit reports to the moderation backend.')
      closeReport()
      return
    }

    setReportSubmitting(true)

    try {
      await socialAPI.submitReport({
        targetType: reportTarget.targetType,
        targetId: reportTarget.targetId,
        videoId: Number(videoId),
        label: reportTarget.label,
        reason: reportReason,
        details: reportDetails.trim(),
      })

      setReportFeedback(
        'Report submitted to the moderation backend. Review status is not surfaced in the learner UI yet.'
      )
      setReportFeedbackMode('backend')
      closeReport()
    } catch (requestError) {
      if (requestError?.code === 'DUPLICATE_REPORT') {
        setReportFeedback(
          'You already submitted a pending report for this content. The backend rejected a duplicate report.'
        )
        setReportFeedbackMode('backend')
        closeReport()
        return
      }

      if (!requestError?.status || requestError.status >= 500) {
        addLocalReport({
          targetType: reportTarget.targetType,
          targetId: reportTarget.targetId,
          videoId: Number(videoId),
          reporterId: user?.id ?? null,
          reporterName: user?.username || 'Anonymous learner',
          label: reportTarget.label,
          reason: reportReason,
          details: reportDetails.trim(),
        })

        setReportFeedback(
          'The moderation backend is unavailable right now, so this report was saved locally as a temporary fallback.'
        )
        setReportFeedbackMode('local')
        closeReport()
        return
      }

      setReportFeedbackMode('error')
      setReportFeedback(requestError.message || 'Could not submit this report.')
    } finally {
      setReportSubmitting(false)
    }
  }

  const formatTime = (time) => {
    const minutes = Math.floor((time || 0) / 60)
    const seconds = Math.floor((time || 0) % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const progressPercent = Math.round(savedProgress.percent || 0)
  const accessMetadata = getAccessMetadata(video)
  const requiredAccessTier = Number(
    video?.subscription?.tier_level || accessDenied?.details?.required_tier || 0
  )
  const playlistPositionLabel =
    activePlaylist && currentPlaylistIndex > -1
      ? `Lesson ${currentPlaylistIndex + 1} of ${activePlaylist.items.length}`
      : null
  const playlistHref = activePlaylist ? `/playlist/${activePlaylist.id}` : null
  const isLastPlaylistLesson =
    Boolean(activePlaylist) &&
    currentPlaylistIndex > -1 &&
    currentPlaylistIndex === activePlaylist.items.length - 1
  const canSubscribeToCreator =
    Boolean(video?.creator_id) && Number(video?.creator_id) !== Number(user?.id)
  const subscribeActionLabel =
    requiredAccessTier > 0 && subscriptionTier < requiredAccessTier
      ? subscribeLoading
        ? 'Upgrading access...'
        : `Upgrade to Tier ${requiredAccessTier}`
      : subscribeLoading
        ? 'Following...'
        : subscribed
          ? 'Following creator'
          : 'Follow creator'
  const learningMetadata = [
    { label: 'Creator', value: video?.author_name || 'HowToob creator' },
    { label: 'Category', value: getCategoryLabel(video) },
    {
      label: 'Learning path',
      value: activePlaylist ? activePlaylist.title : 'Independent lesson',
    },
    { label: 'Access', value: accessMetadata.badgeLabel },
    { label: 'Progress source', value: progressSource === 'backend' ? 'Backend sync' : 'Local fallback' },
  ]
  const upNextHref = nextPlaylistItem
    ? `/watch/${nextPlaylistItem.videoId}?playlist=${activePlaylist?.id}`
    : upNextVideo?.id
      ? `/watch/${upNextVideo.id}`
      : null
  const quizHref = activePlaylist
    ? `/quiz/${videoId}?playlist=${activePlaylist.id}`
    : `/quiz/${videoId}`

  if (loading) {
    return (
      <div className={styles.watchPage}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
          <LoadingSpinner size="lg" label="Loading video..." />
        </div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className={styles.watchPage}>
        <div className={styles.noticeStack}>
          <div className={`${styles.noticeCard} ${styles.noticeCardError}`}>
            <div>
              <strong className={styles.noticeTitle}>Lesson access required</strong>
              <p className={styles.noticeText}>
                {accessDenied.message ||
                  'This lesson requires a higher subscription tier before it can be played.'}
              </p>
            </div>
          </div>

          <div className={styles.learningGrid}>
            <article className={styles.learningCard}>
              <div className={styles.learningHeader}>
                <div>
                  <p className={styles.learningEyebrow}>Premium lesson</p>
                  <h2 className={styles.learningTitle}>Upgrade access to continue</h2>
                </div>
                <span className={styles.learningTag}>
                  Tier {requiredAccessTier || 1}
                </span>
              </div>

              <p className={styles.learningText}>
                HowToob now enforces lesson access tiers on watch and quiz routes. If you
                subscribe at the required tier, this page will reload and unlock the lesson.
              </p>

              <div className={styles.noticeActions}>
                {isAuthenticated ? (
                  <button
                    type="button"
                    className={styles.quizButton}
                    onClick={() => handleSubscribe(requiredAccessTier || 1)}
                    disabled={subscribeLoading}
                  >
                    {subscribeActionLabel}
                  </button>
                ) : (
                  <Link to="/login" className={styles.quizButton}>
                    Sign in to upgrade
                  </Link>
                )}
                <Link to="/subscription" className={styles.noticeLink}>
                  Open subscriptions
                </Link>
                <Link to="/" className={styles.noticeLink}>
                  Back to feed
                </Link>
              </div>
            </article>

            {interactionError ? (
              <article className={styles.learningCard}>
                <div className={styles.learningHeader}>
                  <div>
                    <p className={styles.learningEyebrow}>Access status</p>
                    <h2 className={styles.learningTitle}>Upgrade attempt</h2>
                  </div>
                </div>
                <p className={styles.learningText}>{interactionError}</p>
              </article>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.watchPage}>
        <ErrorMessage message={error} onRetry={() => window.location.reload()} />
      </div>
    )
  }

  if (!video) return null

  return (
    <div className={styles.watchPage}>
      <div className={styles.mainLayout}>
        <div className={styles.videoSection}>
          <div className={styles.playerWrapper} ref={playerWrapperRef}>
            <video
              ref={videoRef}
              className={styles.videoElement}
              src={video.video_url}
              poster={video.thumbnail_url}
              autoPlay={preferences.autoplay}
              onPlay={() => {
                setIsPlaying(true)
                if (videoRef.current) {
                  videoRef.current.playbackRate = playbackSpeed
                }
              }}
              onPause={() => {
                setIsPlaying(false)
                persistProgress()
              }}
              onEnded={() => {
                const completedDuration = videoRef.current?.duration || duration
                persistProgress(completedDuration, completedDuration)
              }}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onError={handlePlaybackError}
              onClick={togglePlay}
              onDoubleClick={toggleFullscreen}
            />

            <div className={styles.customControlBar}>
              <div className={styles.progressBarContainer}>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className={styles.progressBar}
                  aria-label="Seek through lesson"
                  style={{
                    '--progress': `${duration ? (currentTime / duration) * 100 : 0}%`,
                  }}
                />
              </div>

              <div className={styles.controlsRow}>
                <div className={styles.leftControls}>
                  <button
                    onClick={togglePlay}
                    className={styles.iconBtn}
                    title={isPlaying ? 'Pause' : 'Play'}
                    aria-label={isPlaying ? 'Pause lesson' : 'Play lesson'}
                  >
                    {isPlaying ? (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </button>

                  <div className={styles.volumeGroup}>
                    <button
                      onClick={toggleMute}
                      className={styles.iconBtn}
                      aria-label={isMuted || volume === 0 ? 'Unmute lesson' : 'Mute lesson'}
                    >
                      {isMuted || volume === 0 ? (
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 5L6 9H2v6h4l5 4V5z" />
                          <line x1="23" y1="9" x2="17" y2="15" />
                          <line x1="17" y1="9" x2="23" y2="15" />
                        </svg>
                      ) : (
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 5L6 9H2v6h4l5 4V5z" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                      )}
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className={styles.volumeSlider}
                      aria-label="Lesson volume"
                      style={{
                        '--volume-progress': `${(isMuted ? 0 : volume) * 100}%`,
                      }}
                    />
                  </div>

                  <div className={styles.timeDisplay}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                <div className={styles.rightControls}>
                  <button
                    ref={settingsButtonRef}
                    className={`${styles.iconBtn} ${
                      showSettings ? styles.iconBtnActive : ''
                    }`}
                    onClick={() => setShowSettings((prev) => !prev)}
                    title="Settings"
                    aria-label="Playback settings"
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>

                  <button
                    onClick={toggleFullscreen}
                    className={styles.iconBtn}
                    title="Fullscreen"
                    aria-label="Toggle fullscreen"
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                  </button>

                  {showSettings && (
                    <div className={styles.settingsPopup} ref={settingsRef}>
                      <div className={styles.settingsHeader}>Playback settings</div>

                      <div className={styles.settingItem}>
                        <div className={styles.settingLabel}>
                          <span>Playback speed</span>
                          <span className={styles.speedValue}>{playbackSpeed}x</span>
                        </div>
                        <div className={styles.sliderContainer}>
                          <button
                            className={styles.adjustBtn}
                            onClick={() =>
                              handleSpeedChange(Math.max(0.25, playbackSpeed - 0.05))
                            }
                          >
                            -
                          </button>
                          <input
                            type="range"
                            min="0.25"
                            max="2"
                            step="0.05"
                            value={playbackSpeed}
                            onChange={(event) =>
                              handleSpeedChange(parseFloat(event.target.value))
                            }
                            className={styles.speedSlider}
                          />
                          <button
                            className={styles.adjustBtn}
                            onClick={() =>
                              handleSpeedChange(Math.min(2, playbackSpeed + 0.05))
                            }
                          >
                            +
                          </button>
                        </div>
                        <div className={styles.speedPresets}>
                          {[1, 1.25, 1.5, 2].map((speed) => (
                            <button
                              key={speed}
                              onClick={() => handleSpeedChange(speed)}
                              className={`${styles.presetBtn} ${
                                playbackSpeed === speed ? styles.presetBtnActive : ''
                              }`}
                            >
                              {speed === 1 ? 'Normal' : `${speed}x`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <hr
                        style={{
                          border: '0',
                          borderTop: '1px solid rgba(255,255,255,0.1)',
                          margin: '1rem 0',
                        }}
                      />

                      <div className={styles.settingItem}>
                        <button
                          className={styles.settingsActionBtn}
                          onClick={togglePictureInPicture}
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <rect x="13" y="13" width="7" height="7" rx="1" />
                          </svg>
                          <span>Picture-in-Picture</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.videoInfoArea}>
            <div className={styles.titleRow}>
              <h1 className={styles.videoTitle}>{video.title}</h1>
              <div className={styles.authorContainer}>
                <div className={styles.authorText}>
                  <span className={styles.authorName}>{video.author_name}</span>
                  <div className={styles.videoMeta}>
                    <span>{formatViewCount(video.views || 0)} views</span>
                    <span className={styles.dotSeparator}>•</span>
                    <span>{formatNumericDate(video.created_at)}</span>
                  </div>
                </div>
                <div className={styles.authorAvatar}>
                  <img src={video.author_avatar} alt={video.author_name} />
                </div>
              </div>
            </div>

            <div className={styles.creatorSupportRow}>
              <div className={styles.creatorSupportCopy}>
                <div className={styles.creatorBadgeRow}>
                  {playlistPositionLabel ? (
                    <span className={styles.creatorBadge}>{playlistPositionLabel}</span>
                  ) : (
                    <span className={styles.creatorBadge}>Independent lesson</span>
                  )}
                  {video?.subscription?.tier_level ? (
                    <span className={styles.creatorBadge}>
                      {accessMetadata.badgeLabel}
                    </span>
                  ) : null}
                </div>

                <p className={styles.creatorSupportText}>
                  {activePlaylist
                    ? `You are learning inside ${activePlaylist.title}. Up next will stay in order so the path behaves like a course.`
                    : 'This lesson is currently outside a saved path, so discovery and up-next suggestions come from the live backend feed.'}
                </p>
              </div>

              <div className={styles.creatorSupportActions}>
                {canSubscribeToCreator ? (
                  <button
                    type="button"
                    className={`${styles.actionChip} ${
                      subscribed ? styles.actionChipActive : ''
                    }`}
                    onClick={handleSubscribe}
                    disabled={subscribeLoading}
                    aria-pressed={subscribed}
                  >
                    {subscribeActionLabel}
                  </button>
                ) : null}

                <button
                  type="button"
                  className={styles.secondaryActionChip}
                  onClick={() => openReport('video', video.id, video.title)}
                >
                  Report lesson
                </button>
              </div>
            </div>

            <div className={styles.actionRow}>
              <div className={styles.engagementActions}>
                <button
                  type="button"
                  className={`${styles.actionChip} ${
                    liked ? styles.actionChipActive : ''
                  }`}
                  onClick={handleLikeToggle}
                  disabled={likeLoading}
                  aria-pressed={liked}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M7 10v12" />
                    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.97 2.35l-1 7A2 2 0 0 1 18.82 21H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h3.76a2 2 0 0 0 1.94-1.53L13 2a2 2 0 0 1 2 2.44Z" />
                  </svg>
                  <span>{likeLoading ? 'Saving...' : 'Like'}</span>
                </button>

                <button
                  type="button"
                  className={`${styles.actionChip} ${
                    disliked ? styles.actionChipActive : ''
                  }`}
                  onClick={handleDislikeToggle}
                  aria-pressed={disliked}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17 14V2" />
                    <path d="M9 18.12 10 14H4.17A2 2 0 0 1 2.2 11.65l1-7A2 2 0 0 1 5.18 3H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3.76a2 2 0 0 0-1.94 1.53L11 22a2 2 0 0 1-2-2.44Z" />
                  </svg>
                  <span>Dislike</span>
                </button>

                <button
                  type="button"
                  className={`${styles.actionChip} ${
                    savedToPlaylist ? styles.actionChipActive : ''
                  }`}
                  onClick={handleSaveToggle}
                  aria-pressed={savedToPlaylist}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{savedToPlaylist ? 'Saved to Path' : 'Save to Learning Path'}</span>
                </button>
              </div>

              <div className={styles.actionContainer}>
                <Link to={quizHref} className={styles.quizButton}>
                  Open lesson quiz
                </Link>
                <p className={styles.quizHelper}>
                  Backend quiz delivery with a local prototype fallback only if the
                  quiz service is unavailable
                  {activePlaylist ? ' for this learning path.' : '.'}
                </p>
              </div>
            </div>

            {(resumeNotice ||
              playlistNotice ||
              interactionNotice ||
              interactionError ||
              reportFeedback ||
              playlistContextUnavailable ||
              activePlaylist) && (
              <div className={styles.noticeStack}>
                {playlistContextUnavailable ? (
                  <div className={`${styles.noticeCard} ${styles.noticeCardInfo}`}>
                    <div>
                      <strong className={styles.noticeTitle}>Learning path unavailable</strong>
                      <p className={styles.noticeText}>
                        The requested learning path is not available in your current
                        playlist data, so this lesson is continuing as a standalone watch session.
                      </p>
                    </div>
                    <Link to="/my-playlists" className={styles.noticeLink}>
                      Open playlists
                    </Link>
                  </div>
                ) : null}

                {activePlaylist ? (
                  <div className={styles.noticeCard}>
                    <div>
                      <strong className={styles.noticeTitle}>Learning path context</strong>
                      <p className={styles.noticeText}>
                        {playlistPositionLabel
                          ? `${playlistPositionLabel} in ${activePlaylist.title}.`
                          : `Watching from ${activePlaylist.title}.`}{' '}
                        {playlistProgress
                          ? `${playlistProgress.completed} of ${playlistProgress.total} lessons are currently complete.`
                          : 'Playlist progress will appear here as you move through the path.'}
                      </p>
                    </div>
                    <div className={styles.noticeActions}>
                      {playlistHref ? (
                        <Link to={playlistHref} className={styles.noticeLink}>
                          Open path
                        </Link>
                      ) : null}
                      {upNextHref && !isLastPlaylistLesson ? (
                        <Link to={upNextHref} className={styles.noticeLink}>
                          Next lesson
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {resumeNotice ? (
                  <div className={styles.noticeCard}>
                    <div>
                      <strong className={styles.noticeTitle}>Continue watching</strong>
                      <p className={styles.noticeText}>{resumeNotice}</p>
                    </div>
                  </div>
                ) : null}

                {playlistNotice ? (
                  <div className={styles.noticeCard}>
                    <div>
                      <strong className={styles.noticeTitle}>Learning path updated</strong>
                      <p className={styles.noticeText}>{playlistNotice}</p>
                    </div>
                    <Link
                      to={isAuthenticated ? '/my-playlists' : '/login'}
                      className={styles.noticeLink}
                    >
                      {isAuthenticated ? 'Open playlists' : 'Sign in'}
                    </Link>
                  </div>
                ) : null}

                {interactionNotice ? (
                  <div className={`${styles.noticeCard} ${styles.noticeCardInfo}`}>
                    <div>
                      <strong className={styles.noticeTitle}>Lesson interaction</strong>
                      <p className={styles.noticeText}>{interactionNotice}</p>
                    </div>
                  </div>
                ) : null}

                {interactionError ? (
                  <div className={`${styles.noticeCard} ${styles.noticeCardError}`}>
                    <div>
                      <strong className={styles.noticeTitle}>Action unavailable</strong>
                      <p className={styles.noticeText}>{interactionError}</p>
                    </div>
                  </div>
                ) : null}

                {reportFeedback ? (
                  <div className={`${styles.noticeCard} ${styles.noticeCardInfo}`}>
                    <div>
                      <strong className={styles.noticeTitle}>Report status</strong>
                      <p className={styles.noticeText}>{reportFeedback}</p>
                    </div>
                    {reportFeedbackMode === 'local' ? (
                      <Link
                        to={isAuthenticated ? '/settings' : '/login'}
                        className={styles.noticeLink}
                      >
                        {isAuthenticated ? 'Open fallback reports' : 'Sign in'}
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            <div className={styles.learningGrid}>
              <article className={styles.learningCard}>
                <div className={styles.learningHeader}>
                  <div>
                    <p className={styles.learningEyebrow}>Lesson progress</p>
                    <h2 className={styles.learningTitle}>Continue learning</h2>
                  </div>
                  <span className={styles.learningTag}>
                    {progressPercent > 0 ? `${progressPercent}% watched` : 'Not started'}
                  </span>
                </div>

                <div
                  className={styles.learningProgressTrack}
                  aria-label="Lesson progress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={progressPercent}
                  role="progressbar"
                >
                  <span
                    className={styles.learningProgressFill}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className={styles.learningProgressMeta}>
                  <span>
                    {savedProgress.lastUpdated
                      ? `Last saved ${formatRelativeTime(savedProgress.lastUpdated)}`
                      : 'Progress will save as you watch.'}
                  </span>
                  <span>{duration ? `${formatTime(currentTime)} / ${formatTime(duration)}` : 'Waiting on video metadata'}</span>
                </div>

                <p className={styles.learningText}>
                  {progressSource === 'backend'
                    ? 'Progress for this lesson is syncing through the backend watch-event API, with local fallback only if that request fails.'
                    : 'Backend progress is unavailable right now, so resume state is temporarily falling back to this browser.'}
                </p>
              </article>

              <article className={styles.learningCard}>
                <div className={styles.learningHeader}>
                  <div>
                    <p className={styles.learningEyebrow}>Up next</p>
                    <h2 className={styles.learningTitle}>
                      {activePlaylist ? 'Next lesson in this path' : 'Recommended next lesson'}
                    </h2>
                  </div>
                  {playlistProgress ? (
                    <span className={styles.learningTag}>
                      {playlistProgress.completed}/{playlistProgress.total} complete
                    </span>
                  ) : null}
                </div>

                {upNextVideo && upNextHref ? (
                  <div className={styles.upNextLayout}>
                    <Link to={upNextHref} className={styles.upNextArtwork}>
                      {upNextVideo.thumbnail_url ? (
                        <img
                          src={upNextVideo.thumbnail_url}
                          alt={`Thumbnail for ${upNextVideo.title}`}
                          className={styles.upNextImage}
                        />
                      ) : (
                        <div className={styles.upNextPlaceholder} aria-hidden="true">
                          <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="7 5 19 12 7 19 7 5" />
                          </svg>
                        </div>
                      )}
                    </Link>

                    <div className={styles.upNextContent}>
                      <Link to={upNextHref} className={styles.upNextTitle}>
                        {cleanTitle(upNextVideo.title || 'Untitled lesson')}
                      </Link>
                      <p className={styles.upNextText}>
                        {activePlaylist
                          ? 'Stay inside the same learning path and move to the next step in order.'
                          : 'No playlist context is active, so the next lesson comes from the backend feed.'}
                      </p>
                      <div className={styles.upNextMeta}>
                        <span>{formatViewCount(upNextVideo.views || 0)} views</span>
                        {upNextVideo.created_at ? (
                          <span>{formatNumericDate(upNextVideo.created_at)}</span>
                        ) : null}
                      </div>
                      <Link to={upNextHref} className={styles.noticeLink}>
                        Open next lesson
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className={styles.upNextEmptyState}>
                    <p className={styles.learningText}>
                      {isLastPlaylistLesson
                        ? 'You are on the final lesson in this learning path. Review the playlist or jump back into discovery from here.'
                        : 'More lessons will appear here when the feed or playlist context has another step ready.'}
                    </p>
                    {playlistHref && isLastPlaylistLesson ? (
                      <Link to={playlistHref} className={styles.noticeLink}>
                        Review playlist
                      </Link>
                    ) : null}
                  </div>
                )}
              </article>
            </div>

            <div className={styles.learningMetaGrid}>
              {learningMetadata.map((item) => (
                <article key={item.label} className={styles.learningMetaCard}>
                  <span className={styles.learningMetaLabel}>{item.label}</span>
                  <strong className={styles.learningMetaValue}>{item.value}</strong>
                </article>
              ))}
            </div>

            <p className={styles.videoDesc}>{video.description}</p>
          </div>

          <section className={styles.commentsSection}>
            <div className={styles.commentsHeader}>
              <h3 className={styles.commentsTitle}>Comments</h3>
              <span className={styles.commentsCount}>{comments.length}</span>
            </div>

            {isAuthenticated ? (
              <form className={styles.commentComposer} onSubmit={handleCommentSubmit}>
                <textarea
                  className={styles.commentInput}
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Share your thoughts about this tutorial..."
                  rows={4}
                />
                <div className={styles.commentComposerActions}>
                  <span className={styles.commentHint}>Replies are allowed!</span>
                  <button
                    type="submit"
                    className={styles.commentSubmitButton}
                    disabled={submittingCommentId === 'new' || !commentDraft.trim()}
                  >
                    {submittingCommentId === 'new' ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </form>
            ) : (
              <div className={styles.commentsNotice}>
                Sign in to leave a comment or reply to the discussion.
              </div>
            )}

            {commentsError && <p className={styles.commentsError}>{commentsError}</p>}

            {commentsLoading ? (
              <div className={styles.commentsLoading}>Loading comments...</div>
            ) : commentTree.length > 0 ? (
              <div className={styles.commentList}>
                {commentTree.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    isAuthenticated={isAuthenticated}
                    replyingTo={replyingTo}
                    replyDrafts={replyDrafts}
                    submittingCommentId={submittingCommentId}
                    onReplyStart={handleReplyStart}
                    onReplyCancel={handleReplyCancel}
                    onReplyChange={handleReplyChange}
                    onReplySubmit={handleReplySubmit}
                    onReport={openReport}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.commentsEmpty}>
                No comments yet. Start the conversation.
              </div>
            )}
          </section>

          <div className={styles.recommendedSection}>
            <h3 className={styles.recommendedTitle}>Explore More</h3>
            <div className={styles.videoGrid}>
              {exploreMoreVideos.map((item, index) => (
                <VideoCard
                  key={item.id}
                  video={{
                    ...item,
                    title: cleanTitle(item.title),
                    views: EXPLORE_MORE_VIEW_COUNTS[index] ?? item.views,
                  }}
                  textOnly={true}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={Boolean(reportTarget)}
        onClose={closeReport}
        title="Report content"
      >
        <form className={styles.reportForm} onSubmit={handleReportSubmit}>
          <p className={styles.reportIntro}>
            Reports submit to the backend moderation route first. If that service is
            temporarily unavailable, HowToob keeps a local fallback report so your
            action is not lost.
          </p>

          <div className={styles.reportTargetCard}>
            <span className={styles.reportTargetLabel}>Reporting</span>
            <strong className={styles.reportTargetValue}>
              {reportTarget?.label || 'Selected content'}
            </strong>
          </div>

          <label className={styles.reportField}>
            <span className={styles.reportFieldLabel}>Reason</span>
            <select
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              className={styles.reportSelect}
            >
              <option value="spam">Spam or misleading</option>
              <option value="abuse">Harassment or abuse</option>
              <option value="unsafe">Unsafe instructions</option>
              <option value="copyright">Copyright concern</option>
              <option value="other">Other issue</option>
            </select>
          </label>

          <label className={styles.reportField}>
            <span className={styles.reportFieldLabel}>Details</span>
            <textarea
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              className={styles.reportTextarea}
              rows={5}
              placeholder="Add optional context about why this content should be reviewed."
            />
          </label>

          <div className={styles.reportActions}>
            <button
              type="button"
              className={styles.reportCancelButton}
              onClick={closeReport}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.reportSubmitButton}
              disabled={reportSubmitting}
            >
              {reportSubmitting ? 'Submitting...' : 'Submit report'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
