import { useEffect, useState } from 'react'
import {
  getLocalPreferences,
  subscribeToLocalPreferences,
  updateLocalPreferences,
} from '../utils/localPreferences'

export default function useLocalPreferences() {
  const [preferences, setPreferences] = useState(() => getLocalPreferences())

  useEffect(() => subscribeToLocalPreferences(setPreferences), [])

  function savePreferences(updates) {
    const next = updateLocalPreferences(updates)
    setPreferences(next)
    return next
  }

  return [preferences, savePreferences]
}
