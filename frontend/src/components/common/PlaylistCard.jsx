import { Link } from 'react-router-dom'
import { formatRelativeTime } from '../../utils/formatters'
import Badge from './Badge'
import ProgressBar from './ProgressBar'
import styles from './PlaylistCard.module.css'

export default function PlaylistCard({
  playlist,
  progress,
  to,
  actionLabel = 'Open path',
  className = '',
}) {
  const lessonCount = Number(playlist.lessonCount ?? playlist.items?.length ?? 0)
  const completed = Number(progress?.completed ?? 0)
  const total = Number(progress?.total ?? lessonCount)
  const percent = Number(progress?.percent ?? 0)
  const updatedAt = playlist.updatedAt || playlist.updated_at || playlist.createdAt || playlist.created_at

  return (
    <article className={[styles.card, className].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>{playlist.title || 'Untitled learning path'}</h3>
            {playlist.isDefault ? <Badge variant="primary">Default</Badge> : null}
          </div>
          <p className={styles.description}>
            {playlist.description || 'A structured path you can keep refining over time.'}
          </p>
        </div>
      </div>

      <div className={styles.stats} aria-label="Learning path summary">
        <div>
          <span className={styles.statLabel}>Lessons</span>
          <strong className={styles.statValue}>{lessonCount}</strong>
        </div>
        <div>
          <span className={styles.statLabel}>Completed</span>
          <strong className={styles.statValue}>
            {completed}/{total}
          </strong>
        </div>
        <div>
          <span className={styles.statLabel}>Progress</span>
          <strong className={styles.statValue}>{Math.round(percent)}%</strong>
        </div>
      </div>

      <ProgressBar
        value={percent}
        label={`${playlist.title || 'Learning path'} progress`}
        size="md"
      />

      <div className={styles.footer}>
        <span className={styles.updatedText}>
          {updatedAt ? `Updated ${formatRelativeTime(updatedAt)}` : 'Ready to organize'}
        </span>
        <Link to={to} className={styles.action}>
          {actionLabel}
        </Link>
      </div>
    </article>
  )
}
