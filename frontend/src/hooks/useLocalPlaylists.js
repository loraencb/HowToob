import { useEffect, useState } from 'react'
import { getLocalPlaylists, subscribeToLocalPlaylists } from '../utils/learningMvp'

export default function useLocalPlaylists() {
  const [playlists, setPlaylists] = useState(() => getLocalPlaylists())

  useEffect(() => subscribeToLocalPlaylists(setPlaylists), [])

  return playlists
}
