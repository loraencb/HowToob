import { STORAGE_KEYS } from './constants'

const REPORTS_CHANGE_EVENT = 'howtoob:reports-updated'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `report-${Date.now()}`
}

function readJson(key, fallback) {
  if (!canUseStorage()) return fallback

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  if (!canUseStorage()) return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage write issues to keep the UI responsive.
  }
}

function dispatchReportsChange(reports) {
  if (!canUseStorage()) return
  window.dispatchEvent(
    new CustomEvent(REPORTS_CHANGE_EVENT, {
      detail: reports,
    })
  )
}

function normalizeReport(report) {
  return {
    id: report?.id || createId(),
    targetType: report?.targetType || 'video',
    targetId: String(report?.targetId || ''),
    videoId: report?.videoId ?? null,
    reporterId: report?.reporterId ?? null,
    reporterName: report?.reporterName || 'Anonymous learner',
    label: report?.label || 'Untitled target',
    reason: report?.reason || 'other',
    details: report?.details || '',
    status: report?.status || 'pending',
    source: 'local-prototype',
    createdAt: report?.createdAt || new Date().toISOString(),
    updatedAt: report?.updatedAt || report?.createdAt || new Date().toISOString(),
  }
}

function normalizeReports(reports) {
  return Array.isArray(reports) ? reports.map(normalizeReport) : []
}

function writeReports(reports) {
  const normalized = normalizeReports(reports)
  writeJson(STORAGE_KEYS.LOCAL_REPORTS, normalized)
  dispatchReportsChange(normalized)
  return normalized
}

export function getLocalReports() {
  return normalizeReports(readJson(STORAGE_KEYS.LOCAL_REPORTS, [])).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function addLocalReport(report) {
  const created = normalizeReport(report)
  writeReports([created, ...getLocalReports()])
  return created
}

export function updateLocalReportStatus(reportId, status) {
  const nextReports = getLocalReports().map((report) =>
    report.id === reportId
      ? {
          ...report,
          status,
          updatedAt: new Date().toISOString(),
        }
      : report
  )

  return writeReports(nextReports)
}

export function subscribeToLocalReports(onChange) {
  if (typeof window === 'undefined') return () => {}

  const handleChange = (event) => {
    onChange(normalizeReports(event?.detail || getLocalReports()))
  }

  const handleStorage = () => {
    onChange(getLocalReports())
  }

  window.addEventListener(REPORTS_CHANGE_EVENT, handleChange)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(REPORTS_CHANGE_EVENT, handleChange)
    window.removeEventListener('storage', handleStorage)
  }
}
