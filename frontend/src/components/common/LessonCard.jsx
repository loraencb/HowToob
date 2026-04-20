import { Link } from 'react-router-dom'
import {
  formatNumericDate,
  formatRatingSummary,
  formatViewCount,
  truncate,
} from '../../utils/formatters'
import { getCreatorName } from '../../utils/lessonMetadata'
import Badge from './Badge'
import ProgressBar from './ProgressBar'
import styles from './LessonCard.module.css'

function getProgressLabel(progress) {
  if (progress?.completed) return 'Completed'
  if (progress?.percent > 0) return `${Math.round(progress.percent)}% watched`
  return 'Not started'
}

export default function LessonCard({
  lesson,
  index,
  progress,
  to,
  actionLabel,
  onRemove,
  removeLabel = 'Remove',
  removing = false,
}) {
  const percent = Math.round(Number(progress?.percent || 0))
  const creatorName = getCreatorName(lesson, lesson?.author_name || 'HowToob creator')
  const ratingCount = lesson?.rating_count ?? lesson?.like_count ?? 0

  return (
    <article className={styles.card}>
      {index != null ? <div className={styles.index}>{index + 1}</div> : null}

      <Link to={to} className={styles.thumbnailLink} aria-label={`Open lesson: ${lesson.title}`}>
        {lesson.thumbnail_url ? (
          <img
            src={lesson.thumbnail_url}
            alt={`Thumbnail for ${lesson.title}`}
            className={styles.thumbnail}
            loading="lazy"
          />
        ) : (
          <div className={styles.thumbnailPlaceholder} aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="7 5 19 12 7 19 7 5" />
            </svg>
          </div>
        )}
      </Link>

      <div className={styles.body}>
        <div className={styles.header}>
          <div>
            <Link to={to} className={styles.title}>
              {truncate(lesson.title || 'Untitled lesson', 84)}
            </Link>
            <p className={styles.meta}>
              {creatorName} | {formatViewCount(lesson.views || 0)} views |{' '}
              {formatRatingSummary(lesson.average_rating, ratingCount)}
              {lesson.created_at ? ` | ${formatNumericDate(lesson.created_at)}` : ''}
            </p>
          </div>
          <Badge variant={progress?.completed ? 'success' : percent > 0 ? 'primary' : 'default'}>
            {getProgressLabel(progress)}
          </Badge>
        </div>

        <p className={styles.description}>
          {lesson.description || 'No lesson description available yet.'}
        </p>

        <ProgressBar
          value={percent}
          label={`${lesson.title || 'Lesson'} progress`}
          size="md"
        />

        <div className={styles.actions}>
          <Link to={to} className={styles.action}>
            {actionLabel || (percent > 0 && !progress?.completed ? 'Resume lesson' : 'Open lesson')}
          </Link>
          {onRemove ? (
            <button
              type="button"
              className={styles.removeButton}
              onClick={onRemove}
              disabled={removing}
            >
              {removing ? 'Removing...' : removeLabel}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
