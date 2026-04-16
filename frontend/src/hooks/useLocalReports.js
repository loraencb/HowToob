import { useEffect, useState } from 'react'
import { getLocalReports, subscribeToLocalReports } from '../utils/moderationMvp'

export default function useLocalReports() {
  const [reports, setReports] = useState(() => getLocalReports())

  useEffect(() => subscribeToLocalReports(setReports), [])

  return reports
}
