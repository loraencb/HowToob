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
      <div className={styles.bentoPlaceholder}>
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
    </div>
  )
}

function normalizeFeedResponse(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.videos)) return data.videos
  if (Array.isArray(data?.items)) return data.items
  return []
}

function BentoLessonCard({ video, primary = false }) {
  if (!video) return null

  const ratingCount = video.rating_count ?? video.like_count ?? 0
  const createdAt = video.created_at || null

  return (
    <article
      className={`${styles.bentoCard} ${primary ? styles.bentoPrimary : styles.bentoSecondary}`}
    >
      <div className={styles.bentoLabel}>{getLessonBadgeLabel(video)}</div>
      <Link to={`/watch/${video.id}`} className={styles.bentoLink}>
        <div className={styles.bentoThumbnail}>
          {video.thumbnail_url ? (
            <>
              <img src={video.thumbnail_url} alt={video.title} />
              <PlayOverlay />
            </>
          ) : (
            <ThumbnailFallback primary={primary} />
          )}
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

  const activeCategoryMeta = useMemo(
    () => getCategoryMetadata(activeCategory),
    [activeCategory]
  )

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

  const homeHeading = activeCategory
    ? activeCategoryMeta.pathLabel || activeCategoryMeta.label || 'Selected learning path'
    : 'Structured learning feed'

  const homeDescription = activeCategory
    ? `Showing ${filteredVideos.length} lesson${
        filteredVideos.length === 1 ? '' : 's'
      } in this selected path. Creators assign these labels directly when they publish.`
    : 'Browse the lesson library through creator-assigned categories and curated learning shelves.'

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
            <div className={styles.bentoGrid}>
              <div
                className={`${styles.bentoCard} ${styles.bentoPrimary}`}
                aria-label="Continue Learning"
              >
                {(() => {
                  const v = featuredVideos[0] || {
                    title: 'Welcome: Platform Overview',
                    views: 0,
                    created_at: new Date().toISOString(),
                  }

                  return (
                    <>
                      <div className={styles.bentoLabel}>Continue Learning</div>
                      <Link
                        to={v.id ? `/watch/${v.id}` : '#'}
                        className={styles.bentoLink}
                      >
                        <div className={styles.bentoThumbnail}>
                          {v.thumbnail_url ? (
                            <>
                              <img src={v.thumbnail_url} alt={v.title} />
                              {v.id && <PlayOverlay />}
                            </>
                          ) : (
                            <ThumbnailFallback primary={true} />
                          )}
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

              {[featuredVideos[1], featuredVideos[2]].map((video, idx) => {
                const v = video || { title: `New Upload: Series ${idx + 1}` }

                return (
                  <div
                    key={v.id ?? `ghost-new-${idx}`}
                    className={`${styles.bentoCard} ${styles.bentoSecondary}`}
                    aria-label={`New Upload ${idx + 1}`}
                    style={{ cursor: 'default' }}
                  >
                    <div className={styles.bentoLabel}>New Upload</div>
                    <div className={styles.bentoLink}>
                      <div className={styles.bentoThumbnail}>
                        {v.thumbnail_url ? (
                          <>
                            <img src={v.thumbnail_url} alt={v.title} />
                            {v.id && <PlayOverlay />}
                          </>
                        ) : (
                          <ThumbnailFallback primary={false} />
                        )}
                      </div>
                      <div className={styles.bentoTitle}>
                        {truncate(cleanTitle(v.title), 60)}
                      </div>
                    </div>
                  </div>
                )
              })}

              {[featuredVideos[3], featuredVideos[4]].map((video, idx) => {
                const v = video || { title: `Premium Features: Spotlight ${idx + 1}` }

                return (
                  <div
                    key={v.id ?? `ghost-tier-${idx}`}
                    className={`${styles.bentoCard} ${styles.bentoTiered}`}
                    aria-label={`Tiered Content ${idx + 1}`}
                    style={{ cursor: 'default' }}
                  >
                    <div className={styles.bentoLabel}>
                      {getCardBadgeLabel(v.title, 'Tier 1')}
                    </div>
                    <div className={styles.bentoLink}>
                      <div className={styles.bentoThumbnail}>
                        {v.thumbnail_url ? (
                          <>
                            <img src={v.thumbnail_url} alt={v.title} />
                            {v.id && <PlayOverlay />}
                          </>
                        ) : (
                          <ThumbnailFallback primary={false} />
                        )}
                      </div>
                      <div className={styles.bentoTitle}>
                        {truncate(cleanTitle(v.title), 60)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {Object.entries(categorySections).map(([categoryName, categoryVideos], sectionIdx) => {
              const alternateLayout = (sectionIdx + 1) % 2 !== 0
              const topVideo = categoryVideos[0]
              const otherVideos = categoryVideos.slice(1, 5)

              return (
                <section key={categoryName} className={styles.categorySectionContainer}>
                  <div className={styles.categoryHeader}>
                    <h2 className={styles.categoryTitle}>{categoryName}</h2>
                    <Link
                      to={`/search?category=${encodeURIComponent(categoryName)}`}
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
                      const v = topVideo || {
                        title: getPlaceholderTitle(categoryName, 0),
                        views: 0,
                        created_at: new Date().toISOString(),
                      }

                      return (
                        <div
                          className={`${styles.bentoCard} ${styles.bentoPrimary}`}
                          style={{ cursor: 'default' }}
                        >
                          <div className={styles.bentoLabel}>Most Popular</div>
                          <div className={styles.bentoLink}>
                            <div className={styles.bentoThumbnail}>
                              {v.thumbnail_url ? (
                                <>
                                  <img src={v.thumbnail_url} alt={v.title} />
                                  {v.id && <PlayOverlay />}
                                </>
                              ) : (
                                <ThumbnailFallback primary={true} />
                              )}
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
                          </div>
                        </div>
                      )
                    })()}

                    {Array.from({ length: 4 }).map((_, i) => {
                      const video = otherVideos[i]
                      const cardClass = i < 2 ? styles.bentoSecondary : styles.bentoTiered
                      const v = video || {
                        title: getPlaceholderTitle(categoryName, i + 1),
                      }

                      return (
                        <div
                          key={v.id ?? `cat-${categoryName}-ghost-${i}`}
                          className={`${styles.bentoCard} ${cardClass}`}
                          style={{ cursor: 'default' }}
                        >
                          <div className={styles.bentoLabel}>
                            {getCardBadgeLabel(v.title, i < 2 ? 'New Upload' : 'Tier 1')}
                          </div>
                          <div className={styles.bentoLink}>
                            <div className={styles.bentoThumbnail}>
                              {v.thumbnail_url ? (
                                <>
                                  <img src={v.thumbnail_url} alt={v.title} />
                                  {v.id && <PlayOverlay />}
                                </>
                              ) : (
                                <ThumbnailFallback primary={false} />
                              )}
                            </div>
                            <div className={styles.bentoTitle}>
                              {truncate(cleanTitle(v.title), 60)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}

            {featuredVideos.length > 5 && (
              <div className={styles.bentoFooter}>
                <h2 className={styles.sectionTitle}>Explore More</h2>
                <div className={styles.videoGrid}>
                  {featuredVideos.slice(5).map((video, index) => (
                    <VideoCard
                      key={video.id}
                      video={{
                        ...video,
                        title: cleanTitle(video.title),
                        views: EXPLORE_MORE_VIEW_COUNTS[index] ?? video.views,
                      }}
                      textOnly={true}
                    />
                  ))}

                  <VideoCard
                    key="explore-placeholder"
                    video={{
                      id: 'placeholder',
                      title: 'React Fundamentals',
                      creator: { username: 'Creator #1' },
                      views:
                        EXPLORE_MORE_VIEW_COUNTS[featuredVideos.slice(5).length] ?? 451,
                      created_at: new Date().toISOString(),
                    }}
                    textOnly={true}
                  />
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
                  className={styles.loadMoreButton}
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
