import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { videosAPI } from '../utils/api'
import {
  formatNumericDate,
  formatRatingSummary,
  formatViewCount,
  truncate,
} from '../utils/formatters'
import { PAGE_SIZE, PRIMARY_CATEGORIES } from '../utils/constants'
import { getCategoryMetadata, matchesCategoryFilter } from '../utils/categoryTaxonomy'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorMessage from '../components/common/ErrorMessage'
import VideoCard from '../components/common/VideoCard'
import SkillPathFilter from '../components/common/SkillPathFilter'
import styles from './Home.module.css'

function groupVideosByCategory(videosList) {
  const grouped = new Map(
    PRIMARY_CATEGORIES.map((category) => [
      category.value,
      {
        value: category.value,
        label: category.label,
        videos: [],
      },
    ])
  )

  videosList.forEach((video) => {
    const category = getCategoryMetadata(video.category)
    if (!category.primaryValue || !grouped.has(category.primaryValue)) {
      return
    }

    grouped.get(category.primaryValue).videos.push(video)
  })

  return PRIMARY_CATEGORIES.map((category) => grouped.get(category.value)).filter(
    (section) => section.videos.length > 0
  )
}

function cleanTitle(title) {
  if (!title) return ''
  return title.replace(/^[^:]+:\s*/, '')
}

function getLessonBadgeLabel(video) {
  const category = getCategoryMetadata(video.category)

  if (category.label && category.primaryLabel && category.label !== category.primaryLabel) {
    return category.label
  }

  if (category.primaryLabel) {
    return category.primaryLabel
  }

  return 'Lesson'
}

function PlayOverlay() {
  return (
    <div className={styles.playOverlay} aria-hidden="true">
      <div className={styles.playButton}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="8 6 19 12 8 18 8 6" />
        </svg>
      </div>
    </div>
  )
}

function ThumbnailFallback({ primary = false }) {
  return (
    <div className={styles.bentoPlaceholder} aria-hidden="true">
      <svg
        width={primary ? 48 : 32}
        height={primary ? 48 : 32}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    </div>
  )
}

function ThumbnailArtwork({ video, primary = false, showPlay = false }) {
  if (!video?.thumbnail_url) {
    return <ThumbnailFallback primary={primary} />
  }

  const title = video.title || 'Lesson thumbnail'

  return (
    <>
      <img
        src={video.thumbnail_url}
        alt={title}
        className={styles.thumbnailImage}
      />
      {showPlay ? <PlayOverlay /> : null}
    </>
  )
}

function normalizeFeedResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.videos)) return data.videos
  if (Array.isArray(data?.items)) return data.items
  return []
}

function BentoLessonCard({ video, primary = false, tiered = false, label = null }) {
  if (!video) return null

  const ratingCount = video.rating_count ?? video.like_count ?? 0
  const createdAt = video.created_at || null
  const cardClass = primary
    ? styles.bentoPrimary
    : tiered
      ? styles.bentoTiered
      : styles.bentoSecondary

  return (
    <article className={`${styles.bentoCard} ${cardClass}`}>
      <div className={styles.bentoLabel}>{label || getLessonBadgeLabel(video)}</div>
      <Link to={`/watch/${video.id}`} className={styles.bentoLink}>
        <div className={styles.bentoThumbnail}>
          <ThumbnailArtwork video={video} primary={primary} showPlay={Boolean(video.id)} />
        </div>

        <div className={styles.bentoTitle}>
          {truncate(cleanTitle(video.title || 'Untitled lesson'), primary ? 80 : 60)}
        </div>

        <div className={styles.bentoMeta}>
          <span>{formatViewCount(video.views || 0)} views</span>
          <span className={styles.bentoDot}>|</span>
          <span>{formatRatingSummary(video.average_rating, ratingCount)}</span>
          {createdAt ? (
            <>
              <span className={styles.bentoDot}>|</span>
              <span>{formatNumericDate(createdAt)}</span>
            </>
          ) : null}
        </div>
      </Link>
    </article>
  )
}

export default function Home() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeCategory, setActiveCategory] = useState('')

  const fetchVideos = useCallback(async (pageNum = 1, reset = false) => {
    if (pageNum === 1) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    setError('')

    try {
      const data = await videosAPI.getFeed(pageNum, PAGE_SIZE)
      const items = normalizeFeedResponse(data)

      setVideos((prev) => {
        if (reset || pageNum === 1) {
          return items
        }

        const seen = new Set(prev.map((video) => video.id))
        const uniqueNew = items.filter((video) => !seen.has(video.id))
        return [...prev, ...uniqueNew]
      })

      setHasMore(items.length === PAGE_SIZE)
      setPage(pageNum)
    } catch (err) {
      setError(err.message || 'Failed to load videos.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchVideos(1, true)
  }, [fetchVideos])

  const filteredVideos = useMemo(() => {
    if (!activeCategory) return videos
    return videos.filter((video) => matchesCategoryFilter(video.category, activeCategory))
  }, [videos, activeCategory])

  const featuredVideos = useMemo(() => filteredVideos.slice(0, 5), [filteredVideos])

  const remainingVideos = useMemo(() => filteredVideos.slice(5), [filteredVideos])

  const categorySections = useMemo(() => {
    if (activeCategory) {
      return []
    }

    return groupVideosByCategory(remainingVideos)
  }, [activeCategory, remainingVideos])

  const categorizedVideoIds = useMemo(
    () => new Set(categorySections.flatMap((section) => section.videos.map((video) => video.id))),
    [categorySections]
  )

  const exploreVideos = useMemo(() => {
    if (activeCategory) return remainingVideos
    return remainingVideos.filter((video) => !categorizedVideoIds.has(video.id))
  }, [activeCategory, categorizedVideoIds, remainingVideos])

  function handleLoadMore() {
    if (!loadingMore && hasMore) {
      fetchVideos(page + 1)
    }
  }

  return (
    <div className={styles.page}>
      <SkillPathFilter
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <section aria-label="Video feed" className={styles.bentoSection}>
        {loading ? (
          <div className={styles.spinnerWrapper}>
            <LoadingSpinner size="lg" label="Loading videos…" />
          </div>
        ) : error ? (
          <ErrorMessage message={error} onRetry={() => fetchVideos(1, true)} />
        ) : (
          <>
            {featuredVideos.length > 0 ? (
            <div className={styles.bentoGrid}>
              <div
                className={`${styles.bentoCard} ${styles.bentoPrimary}`}
                aria-label="Continue Learning"
              >
                {(() => {
                  const v = featuredVideos[0]

                  return (
                    <>
                      <div className={styles.bentoLabel}>Continue Learning</div>
                      <Link
                        to={`/watch/${v.id}`}
                        className={styles.bentoLink}
                      >
                        <div className={styles.bentoThumbnail}>
                          <ThumbnailArtwork video={v} primary showPlay={Boolean(v.id)} />
                        </div>
                        <div className={styles.bentoTitle}>
                          {truncate(cleanTitle(v.title), 80)}
                        </div>
                        <div className={styles.bentoMeta}>
                          <span>{formatViewCount(v.views || 0)} views</span>
                          <span className={styles.bentoDot}>·</span>
                          <span>{formatRatingSummary(v.average_rating, v.rating_count ?? v.like_count)}</span>
                          <span>|</span>
                          <span>
                            {formatNumericDate(v.created_at || new Date())}
                          </span>
                        </div>
                      </Link>
                    </>
                  )
                })()}
              </div>

              {featuredVideos.slice(1, 3).map((video) => (
                <BentoLessonCard key={video.id} video={video} label="New Upload" />
              ))}

              {featuredVideos.slice(3, 5).map((video) => (
                <BentoLessonCard key={video.id} video={video} tiered />
              ))}
            </div>
            ) : null}

            {categorySections.map((section, sectionIdx) => {
              const categoryName = section.label
              const categoryVideos = section.videos
              const alternateLayout = (sectionIdx + 1) % 2 !== 0
              const topVideo = categoryVideos[0]
              const otherVideos = categoryVideos.slice(1, 5)

              return (
                <section key={categoryName} className={styles.categorySectionContainer}>
                  <div className={styles.categoryHeader}>
                    <h2 className={styles.categoryTitle}>{categoryName}</h2>
                    <Link
                      to={`/search?category=${encodeURIComponent(section.value)}`}
                      className={styles.categoryViewAll}
                    >
                      View all →
                    </Link>
                  </div>

                  <div
                    className={`${styles.bentoGrid} ${
                      alternateLayout ? styles.miniBentoGridReverse : styles.miniBentoGrid
                    }`}
                  >
                    {(() => {
                      const v = topVideo

                      return (
                        <div
                          className={`${styles.bentoCard} ${styles.bentoPrimary}`}
                          style={{ cursor: 'default' }}
                        >
                          <div className={styles.bentoLabel}>Most Popular</div>
                          <Link to={`/watch/${v.id}`} className={styles.bentoLink}>
                            <div className={styles.bentoThumbnail}>
                              <ThumbnailArtwork video={v} primary showPlay={Boolean(v.id)} />
                            </div>
                            <div className={styles.bentoTitle}>
                              {truncate(cleanTitle(v.title), 80)}
                            </div>
                            <div className={styles.bentoMeta}>
                              <span>{formatViewCount(v.views || 0)} views</span>
                              <span className={styles.bentoDot}>·</span>
                              <span>{formatRatingSummary(v.average_rating, v.rating_count ?? v.like_count)}</span>
                              <span>|</span>
                              <span>
                                {formatNumericDate(v.created_at || new Date().toISOString())}
                              </span>
                            </div>
                          </Link>
                        </div>
                      )
                    })()}

                    {otherVideos.map((video, i) => (
                      <BentoLessonCard
                        key={video.id}
                        video={video}
                        tiered={i >= 2}
                      />
                    ))}
                  </div>
                </section>
              )
            })}

            {exploreVideos.length > 0 && (
              <div className={styles.bentoFooter}>
                <h2 className={styles.sectionTitle}>Explore More</h2>
                <div className={styles.videoGrid}>
                  {exploreVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={{
                        ...video,
                        title: cleanTitle(video.title),
                      }}
                      textOnly={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && featuredVideos.length === 0 && (
              <div className={styles.spinnerWrapper}>
                <p>No videos found.</p>
              </div>
            )}

            {hasMore && featuredVideos.length > 0 && (
              <div className={styles.bentoFooter}>
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className={styles.loadMoreBtn}
                >
                  {loadingMore ? 'Loading…' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
