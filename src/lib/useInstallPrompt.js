import { useEffect, useState } from 'react'

let cachedPrompt = null
const listeners = new Set()

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  cachedPrompt = e
  listeners.forEach((fn) => fn(e))
})

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(cachedPrompt)

  useEffect(() => {
    const handler = (e) => setPrompt(e)
    listeners.add(handler)
    return () => listeners.delete(handler)
  }, [])

  const install = async () => {
    if (!prompt) return false
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      cachedPrompt = null
      setPrompt(null)
    }
    return outcome === 'accepted'
  }

  return { canInstall: !!prompt, install }
}
