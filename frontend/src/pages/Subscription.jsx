import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorMessage from '../components/common/ErrorMessage'
import { useProgress } from '../context/ProgressContext'
import useLocalPreferences from '../hooks/useLocalPreferences'
import { authAPI, usersAPI, videosAPI } from '../utils/api'
import { getAccessMetadata, getCreatorProfileSlug } from '../utils/lessonMetadata'
import {
  formatNumericDate,
  formatViewCount,
  getInitials,
  getProgressLabel,
  truncate,
} from '../utils/formatters'
import styles from './Subscription.module.css'

function normalizeSubscriptionsResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.subscriptions)) return data.subscriptions
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.items)) return data.items
  return []
}

function normalizeFeedResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.videos)) return data.videos
  if (Array.isArray(data?.items)) return data.items
  return []
}

function normalizeCreator(item) {
  return {
    id: Number(item.id ?? item.creator_id ?? item.user_id),
    username:
      item.username ||
      item.creator_name ||
      item.name ||
      item.creator?.username ||
      null,
    avatar_url:
      item.avatar_url ||
      item.creator_avatar ||
      item.creator?.avatar_url ||
      '',
    subscribed_at:
      item.subscribed_at ||
      item.created_at ||
      item.joined_at ||
      null,
  }
}

function normalizeVideo(video) {
  return {
    ...video,
    id: Number(video.id),
    creator_id: Number(video.creator_id ?? video.creator?.id ?? 0),
    creator_name:
      video.author_name ||
      video.creator_name ||
      video.creator?.username ||
      (video.creator_id ? `Creator #${video.creator_id}` : 'HowToob creator'),
    thumbnail_url: video.thumbnail_url || video.thumbnail || '',
    title: video.title || 'Untitled lesson',
    description: video.description || '',
    views: video.views || 0,
    created_at: video.created_at || null,
  }
}

export default function Subscription() {
  const { progress } = useProgress()
  const [preferences] = useLocalPreferences()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  const [feed, setFeed] = useState([])

  useEffect(() => {
    let active = true

    async function loadSubscriptions() {
      setLoading(true)
      setError('')

      try {
        const meData = await authAPI.me()
        const user = meData.user ?? meData

        if (!user?.id) {
          throw new Error('Could not determine current user.')
        }

        const [subscriptionData, feedData] = await Promise.all([
          usersAPI.getSubscriptions(user.id),
          videosAPI.getFeed(1, 24),
        ])

        if (!active) return

        setCurrentUser(user)
        setSubscriptions(
          normalizeSubscriptionsResponse(subscriptionData).map(normalizeCreator)
        )
        setFeed(normalizeFeedResponse(feedData).map(normalizeVideo))
      } catch (requestError) {
        if (!active) return
        setError(requestError.message || 'Failed to load subscriptions.')
        setSubscriptions([])
        setFeed([])
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadSubscriptions()

    return () => {
      active = false
    }
  }, [])

  const creatorDirectory = useMemo(() => {
    const directory = new Map()

    feed.forEach((video) => {
      if (!video.creator_id) return

      const previous = directory.get(video.creator_id)
      directory.set(video.creator_id, {
        id: video.creator_id,
        username: video.creator_name,
        sampleTitle: video.title,
        lessonCount: (previous?.lessonCount || 0) + 1,
      })
    })

    return directory
  }, [feed])

  const followedCreatorIds = useMemo(
    () =>
      new Set(
        subscriptions
          .map((subscription) => subscription.id)
          .filter((value) => Number.isFinite(value))
      ),
    [subscriptions]
  )

  const enrichedSubscriptions = useMemo(
    () =>
      subscriptions.map((creator) => {
        const directoryEntry = creatorDirectory.get(creator.id)

        return {
          ...creator,
          username:
            creator.username ||
            directoryEntry?.username ||
            `Creator #${creator.id}`,
          lessonCount: directoryEntry?.lessonCount || 0,
          sampleTitle: directoryEntry?.sampleTitle || '',
          profileSlug:
            creator.username || directoryEntry?.username || String(creator.id),
        }
      }),
    [creatorDirectory, subscriptions]
  )

  const subscriptionLessons = useMemo(
    () => feed.filter((video) => followedCreatorIds.has(video.creator_id)).slice(0, 6),
    [feed, followedCreatorIds]
  )

  const recommendedCreators = useMemo(() => {
    const seen = new Set()

    return feed
      .filter((video) => !followedCreatorIds.has(video.creator_id))
      .map((video) => ({
        id: video.creator_id,
        username: video.creator_name,
        sampleTitle: video.title,
      }))
      .filter((creator) => {
        if (!creator.id || seen.has(creator.id)) {
          return false
        }

        seen.add(creator.id)
        return true
      })
      .slice(0, 4)
  }, [feed, followedCreatorIds])

  const recommendedLessons = useMemo(
    () => feed.filter((video) => !followedCreatorIds.has(video.creator_id)).slice(0, 4),
    [feed, followedCreatorIds]
  )

  const resumeReadyCount = useMemo(
    () =>
      subscriptionLessons.filter((video) => {
        const entry = progress[String(video.id)]
        return entry && entry.percent > 0 && !entry.completed
      }).length,
    [progress, subscriptionLessons]
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.centerState}>
          <LoadingSpinner size="lg" label="Loading subscriptions..." />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <ErrorMessage message={error} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Learning subscriptions</p>
          <h1 className={styles.title}>Followed creators and next lessons</h1>
          <p className={styles.subtitle}>
            Subscription records come from the backend. Creator names and lesson
            suggestions are enriched from the current feed when more metadata is available.
          </p>
        </div>

        <div className={styles.heroMeta}>
          <article className={styles.metaCard}>
            <span className={styles.metaLabel}>Signed in as</span>
            <strong className={styles.metaValue}>
              {currentUser?.username || 'Learner'}
            </strong>
          </article>
          <article className={styles.metaCard}>
            <span className={styles.metaLabel}>Unsubscribe</span>
            <strong className={styles.metaValue}>Not supported yet</strong>
          </article>
        </div>
      </section>

      <section className={styles.statsGrid} aria-label="Subscription summary">
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Creators followed</span>
          <strong className={styles.statValue}>{enrichedSubscriptions.length}</strong>
          <span className={styles.statText}>Backend subscription records</span>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Lessons in feed</span>
          <strong className={styles.statValue}>{subscriptionLessons.length}</strong>
          <span className={styles.statText}>Current feed items from followed creators</span>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Resume-ready</span>
          <strong className={styles.statValue}>{resumeReadyCount}</strong>
          <span className={styles.statText}>Subscription lessons with saved progress</span>
        </article>
      </section>

      {preferences.reminderNudges ? (
        <section className={styles.nudgeCard}>
          <strong className={styles.nudgeTitle}>Reminder nudge</strong>
          <p className={styles.nudgeText}>
            {enrichedSubscriptions.length > 0
              ? 'Followed creators shape your dashboard and search context. Open a lesson from this page to keep the learning flow tight.'
              : 'You have not followed any creators yet. Use the watch page follow action to turn subscriptions into a real learning network.'}
          </p>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Followed creators</p>
            <h2 className={styles.sectionTitle}>Your learning network</h2>
          </div>
        </div>

        {enrichedSubscriptions.length > 0 ? (
          <div className={styles.creatorGrid}>
            {enrichedSubscriptions.map((creator) => (
              <article key={creator.id} className={styles.creatorCard}>
                <div className={styles.creatorAvatarWrap}>
                  {creator.avatar_url ? (
                    <img
                      src={creator.avatar_url}
                      alt={creator.username}
                      className={styles.creatorAvatar}
                    />
                  ) : (
                    <div className={styles.creatorFallback}>
                      {getInitials(creator.username)}
                    </div>
                  )}
                </div>

                <div className={styles.creatorBody}>
                  <div className={styles.creatorHeader}>
                    <h3 className={styles.creatorName}>{creator.username}</h3>
                    {creator.subscribed_at ? (
                      <span className={styles.creatorMeta}>
                        Since {formatNumericDate(creator.subscribed_at)}
                      </span>
                    ) : null}
                  </div>

                  <p className={styles.creatorText}>
                    {creator.lessonCount > 0
                      ? `${creator.lessonCount} lesson${creator.lessonCount === 1 ? '' : 's'} are currently visible in the feed from this creator.`
                      : 'The subscription record exists, but the current feed does not expose richer creator metadata yet.'}
                  </p>

                  {creator.sampleTitle ? (
                    <p className={styles.creatorHint}>
                      Latest visible lesson: {truncate(creator.sampleTitle, 60)}
                    </p>
                  ) : null}

                  <div className={styles.inlineActions}>
                    <Link
                      to={`/profile/${encodeURIComponent(creator.profileSlug)}`}
                      className={styles.secondaryLink}
                    >
                      View profile
                    </Link>
                    <span className={styles.inlineNote}>Following</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <article className={styles.emptyState}>
            <h3 className={styles.emptyTitle}>No followed creators yet</h3>
            <p className={styles.emptyText}>
              Follow creators from the watch page to make subscriptions influence your
              dashboard, watch context, and discovery shelves.
            </p>
            <Link to="/search" className={styles.primaryButton}>
              Browse lessons
            </Link>
          </article>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>From subscriptions</p>
            <h2 className={styles.sectionTitle}>Lessons from creators you follow</h2>
          </div>
        </div>

        {subscriptionLessons.length > 0 ? (
          <div className={styles.lessonGrid}>
            {subscriptionLessons.map((video) => {
              const progressEntry = progress[String(video.id)]
              const accessMetadata = getAccessMetadata(video)

              return (
                <article key={video.id} className={styles.lessonCard}>
                  <Link to={`/watch/${video.id}`} className={styles.lessonThumb}>
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={`Thumbnail for ${video.title}`}
                        className={styles.lessonImage}
                      />
                    ) : (
                      <div className={styles.lessonPlaceholder} aria-hidden="true">
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="7 5 19 12 7 19 7 5" />
                        </svg>
                      </div>
                    )}
                  </Link>

                  <div className={styles.lessonBody}>
                    <Link to={`/watch/${video.id}`} className={styles.lessonTitle}>
                      {truncate(video.title, 72)}
                    </Link>
                    <p className={styles.lessonMeta}>
                      {video.creator_name} | {formatViewCount(video.views)} views
                    </p>
                    <p className={styles.lessonText}>
                      {video.description
                        ? truncate(video.description, 120)
                        : 'Open this lesson to keep learning from a creator you already follow.'}
                    </p>

                    <p className={styles.accessNote}>{accessMetadata.note}</p>

                    <div className={styles.lessonFooter}>
                      <div className={styles.badgeGroup}>
                        {preferences.showProgressBadges && progressEntry ? (
                          <span className={styles.progressBadge}>
                            {getProgressLabel(progressEntry.percent)}
                          </span>
                        ) : (
                          <span className={styles.progressBadge}>Subscription lesson</span>
                        )}
                        <span className={styles.accessBadge}>{accessMetadata.badgeLabel}</span>
                      </div>
                      <Link to={`/watch/${video.id}`} className={styles.primaryButton}>
                        {progressEntry?.percent > 0 && !progressEntry.completed
                          ? 'Resume lesson'
                          : 'Open lesson'}
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <article className={styles.emptyState}>
            <h3 className={styles.emptyTitle}>No current feed lessons from followed creators</h3>
            <p className={styles.emptyText}>
              Your subscriptions are valid, but the current backend feed did not return
              matching lessons right now.
            </p>
          </article>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Suggested next</p>
            <h2 className={styles.sectionTitle}>Recommended creators and lessons</h2>
          </div>
        </div>

        <div className={styles.recommendationGrid}>
          <article className={styles.panel}>
            <h3 className={styles.panelTitle}>Creators to explore</h3>
            {recommendedCreators.length > 0 ? (
              <div className={styles.recommendationList}>
                {recommendedCreators.map((creator) => (
                  <div key={creator.id} className={styles.recommendationItem}>
                    <div>
                      <strong className={styles.recommendationTitle}>{creator.username}</strong>
                      <p className={styles.recommendationText}>
                        Preview lesson: {truncate(creator.sampleTitle, 52)}
                      </p>
                    </div>
                    <Link
                      to={`/profile/${encodeURIComponent(getCreatorProfileSlug(creator) || String(creator.id))}`}
                      className={styles.secondaryLink}
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.panelText}>
                Feed metadata is limited right now, so creator recommendations are waiting
                on more visible creator entries.
              </p>
            )}
          </article>

          <article className={styles.panel}>
            <h3 className={styles.panelTitle}>Lessons beyond your subscriptions</h3>
            {recommendedLessons.length > 0 ? (
              <div className={styles.recommendationList}>
                {recommendedLessons.map((video) => (
                  <div key={video.id} className={styles.recommendationItem}>
                    <div>
                      <strong className={styles.recommendationTitle}>
                        {truncate(video.title, 58)}
                      </strong>
                      <p className={styles.recommendationText}>
                        {video.creator_name} | {formatViewCount(video.views)} views
                      </p>
                    </div>
                    <Link to={`/watch/${video.id}`} className={styles.secondaryLink}>
                      Open lesson
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.panelText}>
                Once the backend feed returns more items, this section becomes a wider exploration shelf.
              </p>
            )}
          </article>
        </div>
      </section>
    </div>
  )
}
