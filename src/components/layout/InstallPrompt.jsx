import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-teal-700 text-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
      <Download size={20} className="shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold">Install JAR App</p>
        <p className="text-xs text-teal-200">Add to home screen for quick access</p>
      </div>
      <button
        onClick={install}
        className="bg-white text-teal-700 text-xs font-bold px-3 py-1.5 rounded-lg shrink-0"
      >
        Install
      </button>
      <button
        onClick={() => setShow(false)}
        className="text-teal-300 text-xs px-1 shrink-0"
      >
        ✕
      </button>
    </div>
  )
}
