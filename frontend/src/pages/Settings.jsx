import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorMessage from '../components/common/ErrorMessage'
import { useAuth } from '../context/AuthContext'
import useLocalPreferences from '../hooks/useLocalPreferences'
import useLocalReports from '../hooks/useLocalReports'
import { authAPI } from '../utils/api'
import { getCreatorProfileSlug } from '../utils/lessonMetadata'
import { formatRelativeTime } from '../utils/formatters'
import { updateLocalReportStatus } from '../utils/moderationMvp'
import styles from './Settings.module.css'

const PREFERENCE_FIELDS = [
  {
    name: 'autoplay',
    title: 'Autoplay lessons',
    description: 'Controls whether lessons start playing automatically on the watch page.',
  },
  {
    name: 'compactCardLayout',
    title: 'Compact discovery cards',
    description: 'Makes search results denser so browsing feels more like a study library.',
  },
  {
    name: 'showProgressBadges',
    title: 'Show progress badges',
    description: 'Adds local progress labels to discovery cards when lesson progress exists.',
  },
  {
    name: 'reminderNudges',
    title: 'Reminder nudges',
    description: 'Keeps lightweight prompts visible on learner-facing pages when you need a next step.',
  },
  {
    name: 'emailNotifications',
    title: 'Email notification preference',
    description: 'Saved for this device so your study setup feels consistent each time you return.',
  },
]

function getRoleLabel(role) {
  if (role === 'creator') return 'Creator'
  if (role === 'admin') return 'Admin'
  return 'Explorer'
}

export default function Settings() {
  const { user } = useAuth()
  const [preferences, savePreferences] = useLocalPreferences()
  const reports = useLocalReports()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [account, setAccount] = useState({
    username: user?.username || '',
    email: user?.email || '',
    role: user?.role || 'viewer',
  })
  const [form, setForm] = useState(preferences)

  useEffect(() => {
    setForm(preferences)
  }, [preferences])

  useEffect(() => {
    let active = true

    async function loadAccount() {
      setLoading(true)
      setError('')

      try {
        const data = await authAPI.me()
        const resolvedUser = data.user ?? data

        if (!active) return

        setAccount({
          username: resolvedUser?.username || user?.username || '',
          email: resolvedUser?.email || user?.email || '',
          role: resolvedUser?.role || user?.role || 'viewer',
        })
      } catch (requestError) {
        if (!active) return

        if (user) {
          setAccount({
            username: user.username || '',
            email: user.email || '',
            role: user.role || 'viewer',
          })
        } else {
          setError(requestError.message || 'Failed to load account settings.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadAccount()

    return () => {
      active = false
    }
  }, [user])

  const canReviewReports = account.role === 'admin'
  const pendingReports = useMemo(
    () => reports.filter((report) => report.status === 'pending'),
    [reports]
  )
  const profileSlug = getCreatorProfileSlug({
    username: account.username || user?.username || '',
    creator_id: user?.id || null,
  })

  function handleChange(event) {
    const { name, value, type, checked } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      savePreferences(form)
      setSuccess('Preferences saved locally for this device.')
    } catch (requestError) {
      setError(requestError.message || 'Failed to save preferences.')
    } finally {
      setSaving(false)
    }
  }

  function handleReportStatus(reportId, status) {
    updateLocalReportStatus(reportId, status)
    setSuccess(`Report marked as ${status}.`)
    setError('')
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.centerState}>
          <LoadingSpinner size="lg" label="Loading settings..." />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Settings</p>
          <h1 className={styles.title}>Tune the learning experience</h1>
          <p className={styles.subtitle}>
            Adjust the way HowToob feels on this device and keep your learning setup comfortable.
          </p>
        </div>

        <div className={styles.heroMeta}>
          <article className={styles.metaCard}>
            <span className={styles.metaLabel}>Role</span>
            <strong className={styles.metaValue}>{getRoleLabel(account.role)}</strong>
          </article>
          <article className={styles.metaCard}>
            <span className={styles.metaLabel}>Saved reports</span>
            <strong className={styles.metaValue}>{pendingReports.length}</strong>
          </article>
        </div>
      </section>

      {error ? <ErrorMessage message={error} /> : null}
      {success ? (
        <div className={styles.successBanner} role="status">
          {success}
        </div>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>Account</p>
                <h2 className={styles.panelTitle}>Account snapshot</h2>
              </div>
            </div>

            <div className={styles.accountGrid}>
              <div className={styles.accountField}>
                <span className={styles.fieldLabel}>Username</span>
                <strong className={styles.fieldValue}>{account.username || 'Unavailable'}</strong>
              </div>
              <div className={styles.accountField}>
                <span className={styles.fieldLabel}>Email</span>
                <strong className={styles.fieldValue}>{account.email || 'Unavailable'}</strong>
              </div>
              <div className={styles.accountField}>
                <span className={styles.fieldLabel}>Role</span>
                <strong className={styles.fieldValue}>{getRoleLabel(account.role)}</strong>
              </div>
            </div>

            <p className={styles.panelText}>
              These account details are shown here for reference and stay read-only on this page.
            </p>

            <div className={styles.inlineActions}>
              {profileSlug ? (
                <Link
                  to={`/profile/${encodeURIComponent(profileSlug)}`}
                  className={styles.secondaryLink}
                >
                  Open profile
                </Link>
              ) : null}
              <Link to="/subscription" className={styles.secondaryLink}>
                View subscriptions
              </Link>
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>Preferences</p>
                <h2 className={styles.panelTitle}>Learning controls</h2>
              </div>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.preferenceList}>
                {PREFERENCE_FIELDS.map((field) => (
                  <label key={field.name} className={styles.preferenceRow}>
                    <div className={styles.preferenceCopy}>
                      <span className={styles.preferenceTitle}>{field.title}</span>
                      <span className={styles.preferenceDescription}>{field.description}</span>
                    </div>
                    <input
                      type="checkbox"
                      name={field.name}
                      checked={Boolean(form[field.name])}
                      onChange={handleChange}
                      className={styles.checkbox}
                      disabled={saving}
                    />
                  </label>
                ))}

                <label className={styles.selectRow}>
                  <span className={styles.preferenceTitle}>Profile visibility preference</span>
                  <span className={styles.preferenceDescription}>
                    Saved on this device with your other learning preferences.
                  </span>
                  <select
                    name="profileVisibility"
                    value={form.profileVisibility}
                    onChange={handleChange}
                    className={styles.select}
                    disabled={saving}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="subscribers">Subscribers only</option>
                  </select>
                </label>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  {saving ? 'Saving...' : 'Save device settings'}
                </button>
              </div>
            </form>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>Reports</p>
                <h2 className={styles.panelTitle}>Saved report center</h2>
              </div>
            </div>

            <p className={styles.panelText}>
              Reports saved on this device appear here so you can keep track of them later.
            </p>

            {reports.length > 0 ? (
              <div className={styles.reportList}>
                {reports.map((report) => (
                  <article key={report.id} className={styles.reportCard}>
                    <div className={styles.reportHeader}>
                      <div>
                        <strong className={styles.reportTitle}>{report.label}</strong>
                        <p className={styles.reportMeta}>
                          {report.targetType} report - {report.reason} - {formatRelativeTime(report.createdAt)}
                        </p>
                      </div>
                      <span className={styles.statusBadge}>{report.status}</span>
                    </div>

                    {report.details ? (
                      <p className={styles.reportDetails}>{report.details}</p>
                    ) : (
                      <p className={styles.reportDetails}>No extra details were added.</p>
                    )}

                    {canReviewReports ? (
                      <div className={styles.reportActions}>
                        <button
                          type="button"
                          className={styles.secondaryLink}
                          onClick={() => handleReportStatus(report.id, 'reviewing')}
                        >
                          Mark reviewing
                        </button>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => handleReportStatus(report.id, 'resolved')}
                        >
                          Resolve
                        </button>
                      </div>
                    ) : (
                      <p className={styles.reportFootnote}>
                        Review actions are available for admin accounts.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <h3 className={styles.emptyTitle}>No saved reports yet</h3>
                <p className={styles.emptyText}>
                  Reports you save from lesson pages will appear here for quick review.
                </p>
              </div>
            )}
          </article>
        </div>

        <aside className={styles.sideColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>Where settings apply</p>
                <h2 className={styles.panelTitle}>Current impact</h2>
              </div>
            </div>

            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <strong className={styles.infoTitle}>Watch page</strong>
                <p className={styles.infoText}>
                  Autoplay already affects lesson playback directly.
                </p>
              </div>
              <div className={styles.infoItem}>
                <strong className={styles.infoTitle}>Search and discovery</strong>
                <p className={styles.infoText}>
                  Compact cards and progress badges now shape how lessons are shown.
                </p>
              </div>
              <div className={styles.infoItem}>
                <strong className={styles.infoTitle}>Device preferences</strong>
                <p className={styles.infoText}>
                  Your preferences stay available on this device each time you come back.
                </p>
              </div>
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>Next steps</p>
                <h2 className={styles.panelTitle}>Continue learning</h2>
              </div>
            </div>

            <div className={styles.inlineActionsColumn}>
              <Link to="/dashboard" className={styles.primaryButton}>
                Open dashboard
              </Link>
              <Link to="/search" className={styles.secondaryLink}>
                Browse lessons
              </Link>
              {account.role === 'creator' ? (
                <Link to="/creator-dashboard" className={styles.secondaryLink}>
                  Creator studio
                </Link>
              ) : null}
            </div>
          </article>
        </aside>
      </div>
    </div>
  )
}
