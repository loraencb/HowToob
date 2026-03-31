import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { videosAPI } from '../utils/api'
import { formatViewCount, formatRelativeTime, truncate } from '../utils/formatters'
import { PAGE_SIZE } from '../utils/constants'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorMessage from '../components/common/ErrorMessage'
import VideoCard from '../components/common/VideoCard'
import SkillPathFilter from '../components/common/SkillPathFilter'
import Badge from '../components/common/Badge'
import styles from './Home.module.css'

// Helper function to group videos by inferred category
function groupVideosByCategory(videosList) {
  const categories = {}
  
  videosList.forEach(video => {
    // Infer category from title keywords with improved matching
    let category = null
    const title = video.title.toLowerCase()
    const desc = (video.description || '').toLowerCase()
    const combined = `${title} ${desc}`
    
    if (combined.includes('python') || combined.includes('typescript') || combined.includes('react') || combined.includes('web') || combined.includes('backend') || combined.includes('frontend') || combined.includes('javascript') || combined.includes('machine learning') || combined.includes('ml') || combined.includes('api') || combined.includes('performance')) {
      category = 'Technology'
    } else if (combined.includes('painting') || combined.includes('art') || combined.includes('design') || combined.includes('ui/ux') || combined.includes('digital') || combined.includes('color') || combined.includes('3d')) {
      category = 'Arts & Design'
    } else if (combined.includes('workout') || combined.includes('fitness') || combined.includes('training') || combined.includes('yoga') || combined.includes('nutrition') || combined.includes('hiit') || combined.includes('cardio') || combined.includes('exercise')) {
      category = 'Fitness & Wellness'
    }
    
    // If not categorized, skip it
    if (!category) return
    
    if (!categories[category]) {
      categories[category] = []
    }
    categories[category].push(video)
  })
  
  // Sort each category by views (descending) and ensure at least 5 per category
  Object.keys(categories).forEach(key => {
    categories[key].sort((a, b) => b.views - a.views)
  })
  
  // Filter out categories with less than 5 videos
  const filtered = {}
  Object.keys(categories).forEach(key => {
    if (categories[key].length >= 5) {
      filtered[key] = categories[key]
    }
  })
  
  return filtered
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
    if (pageNum === 1) setLoading(true)
    else setLoadingMore(true)
    setError('')

    try {
      const data = await videosAPI.getFeed(pageNum, PAGE_SIZE)
      // Backend returns { results: [...], total, page, pages }
      const items = Array.isArray(data.results) ? data.results : []
      setVideos(prev => reset || pageNum === 1 ? items : [...prev, ...items])
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

  // Group videos by category for Bento sections
  const categorySections = useMemo(() => {
    if (videos.length <= 5) return {}
    const grouped = groupVideosByCategory(videos.slice(5))
    return grouped
  }, [videos])

  function handleLoadMore() {
    if (!loadingMore && hasMore) fetchVideos(page + 1)
  }

  return (
    <div className={styles.page}>
      {/* Skill-Path Category Filter with Two-Tier System */}
      <SkillPathFilter 
        activeCategory={activeCategory} 
        onCategoryChange={setActiveCategory} 
      />



      {/* Bento Grid Layout */}
      <section aria-label="Video feed" className={styles.bentoSection}>
        {loading ? (
          <div className={styles.spinnerWrapper}>
            <LoadingSpinner size="lg" label="Loading videos…" />
          </div>
        ) : error ? (
          <ErrorMessage message={error} onRetry={() => fetchVideos(1, true)} />
        ) : videos.length === 0 ? (
          <div className={styles.empty}>
            <svg className={styles.emptyIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <h3>No videos yet</h3>
            <p className={styles.emptyText}>Check back soon. Creators are uploading new tutorials.</p>
          </div>
        ) : (
          <>
            <div className={styles.bentoGrid}>
              {/* Continue Learning - Feature Card (2x2) */}
              {videos[0] && (
                <div className={`${styles.bentoCard} ${styles.bentoPrimary}`} aria-label="Continue Learning">
                  <div className={styles.bentoLabel}>Continue Learning</div>
                  <Link to={`/watch/${videos[0].id}`} className={styles.bentoLink}>
                    <div className={styles.bentoThumbnail}>
                      {videos[0].thumbnail_url ? (
                        <img src={videos[0].thumbnail_url} alt={videos[0].title} />
                      ) : (
                        <div className={styles.bentoPlaceholder}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className={styles.bentoTitle}>{truncate(videos[0].title, 80)}</div>
                    <div className={styles.bentoMeta}>
                      <span>{formatViewCount(videos[0].views)} views</span>
                      <span className={styles.bentoDot}>·</span>
                      <span>{formatRelativeTime(videos[0].created_at)}</span>
                    </div>
                  </Link>
                </div>
              )}

              {/* New Uploads Section */}
              {videos.slice(1, 3).map((video, idx) => (
                <div key={video.id} className={`${styles.bentoCard} ${styles.bentoSecondary}`} aria-label={`New Upload ${idx + 1}`}>
                  <div className={styles.bentoLabel}>New Upload</div>
                  <Link to={`/watch/${video.id}`} className={styles.bentoLink}>
                    <div className={styles.bentoThumbnail}>
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt={video.title} />
                      ) : (
                        <div className={styles.bentoPlaceholder}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className={styles.bentoTitle}>{truncate(video.title, 60)}</div>
                  </Link>
                </div>
              ))}

              {/* Tiered Content Section */}
              {videos.slice(3, 5).map((video, idx) => (
                <div key={video.id} className={`${styles.bentoCard} ${styles.bentoTiered}`} aria-label={`Tiered Content ${idx + 1}`}>
                  <div className={styles.bentoLabel}>🔐 Tier 1</div>
                  <Link to={`/watch/${video.id}`} className={styles.bentoLink}>
                    <div className={styles.bentoThumbnail}>
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt={video.title} />
                      ) : (
                        <div className={styles.bentoPlaceholder}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className={styles.bentoTitle}>{truncate(video.title, 60)}</div>
                  </Link>
                </div>
              ))}
            </div>

            {/* Category-Based Bento Sections */}
            {Object.entries(categorySections).map((entry, sectionIdx) => {
              const [categoryName, categoryVideos] = entry
              const alternateLayout = sectionIdx % 2 === 0 // First section starts on opposite side (RIGHT), then alternates
              const topVideo = categoryVideos[0]
              const otherVideos = categoryVideos.slice(1, 5) // Get 4 videos for 2x2 grid

              return (
                <div key={categoryName} className={styles.categorySectionContainer}>
                  {/* Category Header */}
                  <div className={styles.categoryHeader}>
                    <h2 className={styles.categoryTitle}>{categoryName}</h2>
                    <Link to="#" className={styles.categoryViewAll}>View all →</Link>
                  </div>

                  {/* Mini Bento Grid - Big video + 4 smaller videos */}
                  <div className={`${styles.miniBentoGrid} ${alternateLayout ? styles.miniBentoGridReverse : ''}`}>
                    {/* Featured Video - 2x2 on alternating sides */}
                    {topVideo && (
                      <div className={`${styles.bentoCard} ${styles.bentoPrimary}`} aria-label="Most Popular">
                        <div className={styles.bentoLabel}>🔥 Most Popular</div>
                        <Link to={`/watch/${topVideo.id}`} className={styles.bentoLink}>
                          <div className={styles.bentoThumbnail}>
                            {topVideo.thumbnail_url ? (
                              <img src={topVideo.thumbnail_url} alt={topVideo.title} />
                            ) : (
                              <div className={styles.bentoPlaceholder}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className={styles.bentoTitle}>{truncate(topVideo.title, 80)}</div>
                          <div className={styles.bentoMeta}>
                            <span>{formatViewCount(topVideo.views)} views</span>
                            <span className={styles.bentoDot}>·</span>
                            <span>{formatRelativeTime(topVideo.created_at)}</span>
                          </div>
                        </Link>
                      </div>
                    )}

                    {/* Other Videos - 4 boxes in 2x2 layout */}
                    {otherVideos.map((video) => (
                      <div key={video.id} className={`${styles.bentoCard} ${styles.bentoSecondary}`}>
                        <Link to={`/watch/${video.id}`} className={styles.bentoLink}>
                          <div className={styles.bentoThumbnail}>
                            {video.thumbnail_url ? (
                              <img src={video.thumbnail_url} alt={video.title} />
                            ) : (
                              <div className={styles.bentoPlaceholder}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className={styles.bentoTitle}>{truncate(video.title, 60)}</div>
                          <div className={styles.bentoMeta}>
                            <span>{formatViewCount(video.views)} views</span>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Browse All - Full Width */}
            {videos.length > 0 && (
              <div className={styles.bentoFooter}>
                <h2 className={styles.sectionTitle}>Explore all tutorials</h2>
                <div className={styles.videoGrid}>
                  {videos.slice(5).map(video => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              </div>
            )}

            {hasMore && (
              <div className={styles.loadMoreWrapper}>
                <button
                  type="button"
                  className={styles.loadMoreBtn}
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <><LoadingSpinner size="sm" /> Loading…</>
                  ) : (
                    'Load more tutorials'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
