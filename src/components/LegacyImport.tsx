import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { importBrowserJournal } from '../lib/legacy'
import { LEGACY_KEY, parseLegacy } from '../lib/journal'
import { errorMessage } from '../lib/supabase'

export default function LegacyImport({ userId, onImported }: { userId?: string; onImported: () => void }) {
  const [legacy] = useState(() => {
    try {
      const raw = localStorage.getItem(LEGACY_KEY)
      return { raw, error: '', count: raw ? parseLegacy(raw).length : 0 }
    } catch (cause) { return { raw: null, error: `Browser journal could not be read: ${errorMessage(cause)}`, count: 0 } }
  })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [exported, setExported] = useState(false)
  if (!legacy.raw && !legacy.error) return null
  async function importNotes() {
    if (!legacy.raw || !userId) return
    setBusy(true); setError(''); setProgress(0)
    try { await importBrowserJournal(legacy.raw, userId, setProgress); setDone(true); onImported() }
    catch (cause) { setError(`${progress ? 'Some entries may already be imported. ' : ''}${errorMessage(cause)} You can retry without duplicating entries. The original browser journal is unchanged.`) }
    finally { setBusy(false) }
  }
  function exportNotes() {
    if (!legacy.raw) return
    const url = URL.createObjectURL(new Blob([legacy.raw], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'the-unsaid-browser-journal.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExported(true)
  }
  return <aside className="legacy-panel" aria-label="Existing browser journal">
    <h3>Your old pages can come with you.</h3>
    {legacy.error ? <p className="inline-error" role="alert">{legacy.error} The original data has not been changed.</p> : <><p>Found {legacy.count} fragments from the browser-only journal. Download a backup, then import them into your account as private entries. Repeated imports do not create duplicates. The original is never erased.</p><div className="flex flex-wrap gap-3"><button className="secondary-button" disabled={busy} onClick={exportNotes}><Download size={16} /> Download backup</button><button className="secondary-button" disabled={!userId || busy || done || !exported} onClick={() => void importNotes()}><Upload size={16} />{busy ? `Importing ${progress}/${legacy.count}…` : done ? 'Imported privately' : 'Import into my journal'}</button></div>{!userId && <p className="help-text">Sign in to import. Download your backup before importing.</p>}{error && <p className="inline-error" role="alert">{error}</p>}{done && <p role="status">Your old pages are now saved to your account.</p>}</>}
  </aside>
}
