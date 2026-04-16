import { useEffect, useId, useRef } from 'react'
import styles from './Modal.module.css'

/**
 * Accessible modal dialog.
 * Traps focus, closes on Escape key and backdrop click.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  hideCloseButton = false,
}) {
  const dialogRef = useRef(null)
  const titleId = useId()

  // Trap focus and handle Escape
  useEffect(() => {
    if (!isOpen) return

    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement

    // Focus the dialog
    dialog?.focus()

    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()

      // Focus trap
      if (e.key === 'Tab') {
        const focusable = dialog.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) {
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
          e.preventDefault()
          (e.shiftKey ? last : first)?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    // Prevent body scroll
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`${styles.dialog} ${styles[size]}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {(title || !hideCloseButton) && (
          <div className={styles.header}>
            {title && <h2 id={titleId} className={styles.title}>{title}</h2>}
            {!hideCloseButton && (
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close dialog"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  )
}
