import styles from './ProgressBar.module.css'

function clampPercent(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(100, Math.max(0, parsed))
}

export default function ProgressBar({
  value = 0,
  label = 'Progress',
  detail = '',
  showLabel = false,
  size = 'md',
  variant = 'primary',
  className = '',
}) {
  const percent = clampPercent(value)
  const rounded = Math.round(percent)
  const labelText = detail || `${rounded}% complete`

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      {showLabel ? (
        <div className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{labelText}</span>
        </div>
      ) : null}

      <div
        className={[
          styles.track,
          styles[size] || styles.md,
          styles[variant] || styles.primary,
        ].join(' ')}
        role="progressbar"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={rounded}
      >
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
