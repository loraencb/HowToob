import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ErrorMessage from '../components/common/ErrorMessage'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Modal from '../components/common/Modal'
import { useAuth } from '../context/AuthContext'
import { videosAPI } from '../utils/api'
import { formatNumericDate, formatViewCount, truncate } from '../utils/formatters'

function normalizeCreatorVideos(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.videos)) return data.videos
  if (Array.isArray(data?.results)) return data.results
  return []
}

export default function CreatorDashboard() {
  const { user } = useAuth()
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', description: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [pendingDeleteVideo, setPendingDeleteVideo] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const loadCreatorData = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError('')

    try {
      const data = await videosAPI.getByCreator(user.id)
      setVideos(normalizeCreatorVideos(data))
    } catch (requestError) {
      setError(requestError.message || 'Failed to load creator analytics.')
      setVideos([])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadCreatorData()
  }, [loadCreatorData])

  const totalViews = useMemo(
    () => videos.reduce((sum, video) => sum + (video.views || 0), 0),
    [videos]
  )

  const totalLikes = useMemo(
    () => videos.reduce((sum, video) => sum + (video.like_count || 0), 0),
    [videos]
  )

  const totalComments = useMemo(
    () => videos.reduce((sum, video) => sum + (video.comment_count || 0), 0),
    [videos]
  )

  const statCards = [
    { label: 'Published lessons', value: videos.length, helper: 'Videos currently live on HowToob' },
    { label: 'Total views', value: formatViewCount(totalViews), helper: 'Combined views across your uploads' },
    { label: 'Engagement', value: totalLikes + totalComments, helper: 'Likes plus comments captured so far' },
  ]

  const topViewedVideo = useMemo(
    () =>
      videos.reduce(
        (top, video) => ((video.views || 0) > (top?.views || 0) ? video : top),
        null
      ),
    [videos]
  )

  const topEngagedVideo = useMemo(
    () =>
      videos.reduce((top, video) => {
        const score = (video.like_count || 0) + (video.comment_count || 0)
        const topScore = (top?.like_count || 0) + (top?.comment_count || 0)
        return score > topScore ? video : top
      }, null),
    [videos]
  )

  const newestVideo = useMemo(
    () =>
      videos.reduce((latest, video) => {
        const latestTime = latest?.created_at ? new Date(latest.created_at).getTime() : 0
        const videoTime = video?.created_at ? new Date(video.created_at).getTime() : 0
        return videoTime > latestTime ? video : latest
      }, null),
    [videos]
  )

  function handleStartEdit(video) {
    setEditingId(video.id)
    setEditForm({
      title: video.title || '',
      description: video.description || '',
    })
    setActionMessage('')
    setActionError('')
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditForm({ title: '', description: '' })
  }

  function handleRequestDelete(video) {
    setPendingDeleteVideo(video)
    setActionError('')
    setActionMessage('')
  }

  function handleCloseDeleteModal() {
    setPendingDeleteVideo(null)
  }

  async function handleSaveEdit(event, videoId) {
    event.preventDefault()
    const title = editForm.title.trim()

    if (!title) {
      setActionError('A lesson title is required.')
      return
    }

    setSavingEdit(true)
    setActionError('')
    setActionMessage('')

    try {
      const updated = await videosAPI.update(videoId, {
        title,
        description: editForm.description.trim(),
      })

      setVideos((prev) =>
        prev.map((video) => (video.id === videoId ? { ...video, ...updated } : video))
      )
      setActionMessage('Lesson details updated.')
      handleCancelEdit()
    } catch (requestError) {
      setActionError(requestError.message || 'Could not save your lesson changes.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete(videoId) {
    setDeletingId(videoId)
    setActionError('')
    setActionMessage('')

    try {
      await videosAPI.delete(videoId)
      setVideos((prev) => prev.filter((video) => video.id !== videoId))
      if (editingId === videoId) {
        handleCancelEdit()
      }
      setPendingDeleteVideo(null)
      setActionMessage('Lesson deleted.')
    } catch (requestError) {
      setActionError(requestError.message || 'Could not delete this lesson.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)' }}>
      <section style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 'var(--space-xl)',
        alignItems: 'flex-end',
        padding: 'var(--space-2xl)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border-strong)',
        background: 'var(--gradient-panel)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), var(--shadow-lg)',
      }}>
        <div style={{ maxWidth: '680px' }}>
          <p style={{
            margin: '0 0 var(--space-sm)',
            color: 'var(--color-primary-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)',
          }}>
            Creator studio
          </p>
          <h1 style={{ margin: 0, color: 'var(--color-text-light)' }}>
            Manage your published lessons
          </h1>
          <p style={{ margin: 'var(--space-sm) 0 0', color: 'rgba(248, 249, 250, 0.74)', lineHeight: 'var(--line-height-relaxed)' }}>
            Review your live uploads, keep an eye on engagement, and jump back into
            publishing without relying on external chart packages.
          </p>
        </div>

        <Link
          to="/upload"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '46px',
            padding: '0.8rem 1.15rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: '#fff',
            background: 'linear-gradient(180deg, var(--color-primary-light), var(--color-primary))',
            boxShadow: '0 12px 22px rgba(var(--color-primary-rgb), 0.28)',
          }}
        >
          Upload new lesson
        </Link>
      </section>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3xl) 0' }}>
          <LoadingSpinner size="lg" label="Loading creator dashboard..." />
        </div>
      ) : (
        <>
          {error ? <ErrorMessage message={error} onRetry={loadCreatorData} /> : null}
          {actionError ? <ErrorMessage message={actionError} /> : null}
          {actionMessage ? (
            <div style={{
              padding: '0.95rem 1.1rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(var(--color-primary-rgb), 0.22)',
              background: 'var(--color-surface-tint-strong)',
              color: 'var(--color-text-light)',
            }} role="status">
              {actionMessage}
            </div>
          ) : null}

          <section style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-lg)',
          }}>
            {statCards.map((card) => (
              <article
                key={card.label}
                style={{
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--color-border)',
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 22%), var(--color-bg-secondary)',
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.2)',
                  padding: 'var(--space-xl)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-sm)',
                }}
              >
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-text-muted)',
                }}>
                  {card.label}
                </span>
                <strong style={{
                  fontSize: 'clamp(1.8rem, 2.5vw, 2.6rem)',
                  color: 'var(--color-text-light)',
                  fontFamily: 'var(--font-family-heading)',
                }}>
                  {card.value}
                </strong>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  {card.helper}
                </span>
              </article>
            ))}
          </section>

          {videos.length > 0 ? (
            <section style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--space-lg)',
            }}>
              {[
                {
                  label: 'Most watched',
                  title: topViewedVideo?.title || 'No lessons yet',
                  helper: topViewedVideo
                    ? `${formatViewCount(topViewedVideo.views || 0)} views`
                    : 'Upload a lesson to start collecting insights',
                },
                {
                  label: 'Most engaged',
                  title: topEngagedVideo?.title || 'No lessons yet',
                  helper: topEngagedVideo
                    ? `${(topEngagedVideo.like_count || 0) + (topEngagedVideo.comment_count || 0)} combined likes and comments`
                    : 'Engagement appears when learners react or comment',
                },
                {
                  label: 'Newest live lesson',
                  title: newestVideo?.title || 'No lessons yet',
                  helper: newestVideo
                    ? `Published ${formatNumericDate(newestVideo.created_at)}`
                    : 'Your next upload will appear here',
                },
              ].map((item) => (
                <article
                  key={item.label}
                  style={{
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--color-border)',
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 22%), var(--color-bg-secondary)',
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.2)',
                    padding: 'var(--space-xl)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-sm)',
                  }}
                >
                  <span style={{
                    fontSize: 'var(--font-size-xs)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-primary-light)',
                    fontWeight: 'var(--font-weight-semibold)',
                  }}>
                    {item.label}
                  </span>
                  <strong style={{
                    color: 'var(--color-text-light)',
                    fontSize: 'var(--font-size-lg)',
                  }}>
                    {truncate(item.title, 52)}
                  </strong>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    {item.helper}
                  </span>
                </article>
              ))}
            </section>
          ) : null}

          <section style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.9fr)',
            gap: 'var(--space-xl)',
            alignItems: 'start',
          }}>
            <article style={{
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 22%), var(--color-bg-secondary)',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.2)',
              padding: 'var(--space-xl)',
            }}>
              <h2 style={{ margin: 0, color: 'var(--color-text-light)', fontSize: 'var(--font-size-xl)' }}>
                Recent uploads
              </h2>
              <p style={{ margin: 'var(--space-sm) 0 var(--space-lg)', color: 'var(--color-text-muted)' }}>
                Keep an eye on your latest lessons and see how they are performing.
              </p>

              {videos.length > 0 ? (
                <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                  {videos.slice(0, 5).map((video) => (
                    <Link
                      key={video.id}
                      to={`/watch/${video.id}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: 'var(--space-md)',
                        padding: 'var(--space-lg)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        background: 'var(--color-bg-elevated)',
                        color: 'inherit',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--color-text-light)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-xs)' }}>
                          {truncate(video.title, 80)}
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                          Published {formatNumericDate(video.created_at)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <div style={{ color: 'var(--color-text-light)', fontWeight: 'var(--font-weight-semibold)' }}>
                          {formatViewCount(video.views || 0)} views
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                          {video.like_count || 0} likes | {video.comment_count || 0} comments
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: 'var(--space-xl)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  background: 'var(--color-bg-elevated)',
                }}>
                  <h3 style={{ margin: '0 0 var(--space-sm)', color: 'var(--color-text-light)' }}>
                    No lessons published yet
                  </h3>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-relaxed)' }}>
                    Once you upload your first lesson, this dashboard will summarize
                    your recent performance here.
                  </p>
                </div>
              )}
            </article>

            <article style={{
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 22%), var(--color-bg-secondary)',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.2)',
              padding: 'var(--space-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-lg)',
            }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--color-text-light)', fontSize: 'var(--font-size-xl)' }}>
                  Studio notes
                </h2>
                <p style={{ margin: 'var(--space-sm) 0 0', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-relaxed)' }}>
                  Insights here come from the real lesson records you already have, without pretending the backend exposes a full analytics suite yet.
                </p>
              </div>

              <div style={{
                padding: 'var(--space-lg)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-bg-elevated)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Next best move
                </div>
                <div style={{ color: 'var(--color-text-light)', fontWeight: 'var(--font-weight-semibold)', margin: 'var(--space-sm) 0' }}>
                  Use lightweight insights to decide what to improve next
                </div>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-relaxed)' }}>
                  The current backend already gives you live counts for views, likes,
                  and comments, so this page focuses on actionable upload feedback
                  and lesson management instead of fake charts.
                </p>
              </div>

              <Link
                to="/upload"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '44px',
                  padding: '0.8rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--color-text-light)',
                  background: 'var(--color-surface-tint)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                Go back to uploader
              </Link>
            </article>
          </section>

          {videos.length > 0 ? (
            <section style={{
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 22%), var(--color-bg-secondary)',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.2)',
              padding: 'var(--space-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-lg)',
            }}>
              <div>
                <p style={{
                  margin: '0 0 var(--space-sm)',
                  color: 'var(--color-primary-light)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}>
                  Lesson management
                </p>
                <h2 style={{ margin: 0, color: 'var(--color-text-light)', fontSize: 'var(--font-size-xl)' }}>
                  Edit or remove published lessons
                </h2>
                <p style={{ margin: 'var(--space-sm) 0 0', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-relaxed)' }}>
                  These actions use the real update and delete endpoints, so the studio stays honest about what is actually supported.
                </p>
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                {videos.map((video) => (
                  <article
                    key={`manage-${video.id}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-md)',
                      padding: 'var(--space-lg)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      background: 'var(--color-bg-elevated)',
                    }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      gap: 'var(--space-md)',
                      alignItems: 'start',
                    }}>
                      <div>
                        <div style={{ color: 'var(--color-text-light)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-xs)' }}>
                          {truncate(video.title, 80)}
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                          Published {formatNumericDate(video.created_at)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '140px' }}>
                        <div style={{ color: 'var(--color-text-light)', fontWeight: 'var(--font-weight-semibold)' }}>
                          {formatViewCount(video.views || 0)} views
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                          {video.like_count || 0} likes | {video.comment_count || 0} comments
                        </div>
                      </div>
                    </div>

                    <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-relaxed)' }}>
                      {video.description || 'No lesson description added yet.'}
                    </p>

                    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(video)}
                        aria-expanded={editingId === video.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '42px',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: 'var(--color-text-light)',
                          background: 'var(--color-surface-tint)',
                          fontWeight: 'var(--font-weight-semibold)',
                          cursor: 'pointer',
                        }}
                      >
                        Edit details
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestDelete(video)}
                        disabled={deletingId === video.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '42px',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(255, 112, 98, 0.28)',
                          color: 'var(--color-text-light)',
                          background: 'rgba(186, 25, 11, 0.12)',
                          fontWeight: 'var(--font-weight-semibold)',
                          cursor: deletingId === video.id ? 'wait' : 'pointer',
                          opacity: deletingId === video.id ? 0.7 : 1,
                        }}
                      >
                        {deletingId === video.id ? 'Deleting...' : 'Delete lesson'}
                      </button>
                    </div>

                    {editingId === video.id ? (
                      <form
                        onSubmit={(event) => handleSaveEdit(event, video.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--space-md)',
                          padding: 'var(--space-lg)',
                          borderRadius: 'var(--radius-lg)',
                          border: '1px solid var(--color-border)',
                          background: 'rgba(14, 33, 56, 0.74)',
                        }}
                      >
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                            Lesson title
                          </span>
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(event) =>
                              setEditForm((prev) => ({ ...prev, title: event.target.value }))
                            }
                            style={{
                              width: '100%',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              background: 'rgba(14, 33, 56, 0.88)',
                              color: 'var(--color-text-light)',
                              font: 'inherit',
                              padding: '0.95rem 1rem',
                            }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                            Description
                          </span>
                          <textarea
                            value={editForm.description}
                            onChange={(event) =>
                              setEditForm((prev) => ({
                                ...prev,
                                description: event.target.value,
                              }))
                            }
                            rows={4}
                            style={{
                              width: '100%',
                              minHeight: '120px',
                              resize: 'vertical',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              background: 'rgba(14, 33, 56, 0.88)',
                              color: 'var(--color-text-light)',
                              font: 'inherit',
                              padding: '0.95rem 1rem',
                            }}
                          />
                        </label>

                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                          <button
                            type="submit"
                            disabled={savingEdit}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: '42px',
                              padding: '0.75rem 1rem',
                              borderRadius: 'var(--radius-md)',
                              border: 'none',
                              color: '#fff',
                              background: 'linear-gradient(180deg, var(--color-primary-light), var(--color-primary))',
                              fontWeight: 'var(--font-weight-semibold)',
                              cursor: savingEdit ? 'wait' : 'pointer',
                              opacity: savingEdit ? 0.75 : 1,
                            }}
                          >
                            {savingEdit ? 'Saving...' : 'Save changes'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: '42px',
                              padding: '0.75rem 1rem',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              color: 'var(--color-text-light)',
                              background: 'var(--color-surface-tint)',
                              fontWeight: 'var(--font-weight-semibold)',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <Modal
        isOpen={Boolean(pendingDeleteVideo)}
        onClose={handleCloseDeleteModal}
        title="Delete lesson"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-relaxed)' }}>
            This uses the real delete endpoint and removes the lesson from your creator
            dashboard. It does not have an undo flow in the current backend.
          </p>

          <div style={{
            padding: 'var(--space-lg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            background: 'rgba(14, 33, 56, 0.7)',
          }}>
            <strong style={{ color: 'var(--color-text-light)' }}>
              {pendingDeleteVideo?.title || 'Selected lesson'}
            </strong>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleCloseDeleteModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '42px',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: 'var(--color-text-light)',
                background: 'var(--color-surface-tint)',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleDelete(pendingDeleteVideo.id)}
              disabled={deletingId === pendingDeleteVideo?.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '42px',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255, 112, 98, 0.28)',
                color: 'var(--color-text-light)',
                background: 'rgba(186, 25, 11, 0.12)',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: deletingId === pendingDeleteVideo?.id ? 'wait' : 'pointer',
                opacity: deletingId === pendingDeleteVideo?.id ? 0.7 : 1,
              }}
            >
              {deletingId === pendingDeleteVideo?.id ? 'Deleting...' : 'Delete lesson'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
