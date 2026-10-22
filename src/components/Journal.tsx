import { useEffect, useState } from 'react'
import { Bookmark, CalendarDays, Feather, LayoutGrid, List, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { deleteEntry, getBookmarks, getCalendarEntries, getEntries, saveEntry, toggleBookmark, type EntryInput, type Note } from '../lib/api'
import { useAuth } from '../lib/auth'
import { defaultFilters, displayDate, localDate, monthBounds, moods, PAGE_SIZE, type Filters, type Scope, type ViewMode } from '../lib/journal'
import { errorMessage, supabase } from '../lib/supabase'
import CalendarView from './CalendarView'
import CommentsDialog from './CommentsDialog'
import Composer from './Composer'
import Dialog from './Dialog'
import LegacyImport from './LegacyImport'
import NoteCard from './NoteCard'

export default function Journal({ scope, onLogin }: { scope: Scope; onLogin: () => void }) {
  const { session, loading: authLoading } = useAuth()
  const userId = session?.user.id
  const [view, setView] = useState<ViewMode>('fragments')
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(0)
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState('')
  const [entries, setEntries] = useState<Note[]>([])
  const [calendarEntries, setCalendarEntries] = useState<Note[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [count, setCount] = useState(0)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [bookmarksLoading, setBookmarksLoading] = useState(Boolean(userId))
  const [bookmarkError, setBookmarkError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [calendarError, setCalendarError] = useState('')
  const [actionError, setActionError] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [bookmarkPending, setBookmarkPending] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [editing, setEditing] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)
  const [commenting, setCommenting] = useState<Note | null>(null)
  const [newEntryDate, setNewEntryDate] = useState<string | null>(null)
  const canRead = Boolean(supabase) && !authLoading && (scope === 'community' || Boolean(userId))
  const dateError = filters.from && filters.to && filters.from > filters.to ? 'The start date must be on or before the end date.' : ''
  const savedKey = savedIds.join(',')

  useEffect(() => {
    const timer = setTimeout(() => { setFilters(value => value.search === search ? value : { ...value, search }); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setRevision(value => value + 1) }
    window.addEventListener('focus', refresh)
    const timer = setInterval(refresh, 240000)
    return () => { window.removeEventListener('focus', refresh); clearInterval(timer) }
  }, [])
  useEffect(() => { setPage(0); setSelectedDay('') }, [scope])
  useEffect(() => {
    if (!userId || !supabase) return
    let active = true
    setBookmarksLoading(true); setBookmarkError('')
    void getBookmarks(userId).then(ids => { if (active) setSavedIds(ids) })
      .catch(cause => { if (active) setBookmarkError(`Kept-close entries could not be loaded: ${errorMessage(cause)}`) })
      .finally(() => { if (active) setBookmarksLoading(false) })
    return () => { active = false }
  }, [userId, revision])
  useEffect(() => {
    if (!canRead || dateError || (filters.saved && (bookmarksLoading || bookmarkError))) {
      setEntries([]); setCount(0); setLoading(false); setFetchError('')
      return
    }
    let active = true
    setLoading(true); setFetchError('')
    void getEntries({
      scope, userId, filters, savedIds: savedKey ? savedKey.split(',') : [], page,
      ...(view === 'calendar' ? { month: monthBounds(month), day: selectedDay || undefined } : {}),
    }).then(result => {
      if (!active) return
      if (page > 0 && page * PAGE_SIZE >= result.count) { setPage(Math.max(0, Math.ceil(result.count / PAGE_SIZE) - 1)); return }
      setEntries(result.entries); setCount(result.count)
    }).catch(cause => { if (active) { setFetchError(errorMessage(cause)); setEntries([]); setCount(0) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [scope, userId, filters, savedKey, page, view, month, selectedDay, revision, canRead, dateError, bookmarksLoading, bookmarkError])
  useEffect(() => {
    if (!canRead || view !== 'calendar' || dateError || (filters.saved && (bookmarksLoading || bookmarkError))) {
      setCalendarEntries([]); setCalendarLoading(false); setCalendarError('')
      return
    }
    let active = true
    setCalendarLoading(true); setCalendarError('')
    void getCalendarEntries({ scope, userId, filters, savedIds: savedKey ? savedKey.split(',') : [], page: 0, month: monthBounds(month) })
      .then(result => { if (active) setCalendarEntries(result) })
      .catch(cause => { if (active) { setCalendarError(errorMessage(cause)); setCalendarEntries([]) } })
      .finally(() => { if (active) setCalendarLoading(false) })
    return () => { active = false }
  }, [scope, userId, filters, savedKey, month, view, revision, canRead, dateError, bookmarksLoading, bookmarkError])

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(current => ({ ...current, [key]: value })); setPage(0)
  }
  async function save(input: EntryInput, file: File | null, removeImage: boolean, existing?: Note) {
    if (!userId) { onLogin(); throw new Error('Sign in before saving an entry.') }
    setBusy(true); setActionError('')
    try {
      const result = await saveEntry(userId, input, file, existing, undefined, removeImage)
      setEditing(null); setNewEntryDate(null)
      setAnnouncement(input.visibility === 'private' ? 'Your page is saved privately to your account.' : 'Your fragment is now part of the community.')
      if (result.warning) setActionError(result.warning)
      setPage(0); setRevision(value => value + 1)
    } finally { setBusy(false) }
  }
  async function remove() {
    if (!deleting || !userId) return
    setBusy(true); setActionError('')
    try {
      const result = await deleteEntry(deleting, userId)
      setDeleting(null); setAnnouncement('The entry has been released.')
      if (result.warning) setActionError(result.warning)
      setRevision(value => value + 1)
    } catch (cause) { setActionError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  async function bookmark(note: Note) {
    if (!userId) { onLogin(); return }
    setBookmarkPending(note.id); setActionError('')
    try {
      const saved = savedIds.includes(note.id)
      await toggleBookmark(userId, note.id, saved)
      setSavedIds(current => saved ? current.filter(id => id !== note.id) : [...current, note.id])
      setAnnouncement(saved ? 'Fragment removed from kept close.' : 'Fragment kept close to your account.')
    } catch (cause) { setActionError(errorMessage(cause)) }
    finally { setBookmarkPending(null) }
  }
  const entryCards = entries.map(note => <NoteCard key={`${note.id}-${note.updated_at}-${note.imageSrc}`} note={note} userId={userId}
    saved={savedIds.includes(note.id)} pending={bookmarkPending !== null || bookmarksLoading}
    onBookmark={() => void bookmark(note)} onEdit={() => { setActionError(''); setEditing(note) }}
    onDelete={() => { setActionError(''); setDeleting(note) }} onComments={() => setCommenting(note)} />)

  return <>
    {supabase && userId && <><Composer busy={busy} signedIn configured onLogin={onLogin} onSave={(input, file, removeImage) => save(input, file, removeImage)} /><div className="under-composer"><span>Private by default. Saved to your account, across devices.</span><span className="no-judgment">No right words required.</span></div></>}
    {!supabase ? <div className="notice setup-notice" role="status"><h2>A home for your journal is being prepared.</h2><p>Cloud storage and accounts need to be connected. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in Netlify, run the supplied Supabase migration, and redeploy.</p><p>No entries will be saved to browser storage as a substitute.</p></div> : authLoading ? <p className="notice" role="status">Restoring your session…</p> : !userId && <div className="guest-notice"><div><h2>A journal that stays with you.</h2><p>Sign in to keep private pages across devices, publish selected fragments, and join the conversation.</p></div><button className="primary-button" onClick={onLogin}>Sign in / create account</button></div>}
    {scope === 'journal' && <LegacyImport userId={supabase ? userId : undefined} onImported={() => setRevision(value => value + 1)} />}
    <div className="announcement journal-announcement" role="status" aria-live="polite">{announcement}</div>
    {actionError && !deleting && <p className="inline-error" role="alert">{actionError}</p>}
    <section className="fragments-section" aria-labelledby="fragments-heading">
      <div className="feed-header">
        <div className="feed-heading"><h2 id="fragments-heading">{scope === 'journal' ? 'My journal' : 'What we leave here'}</h2><span className="fragment-count">{count} {count === 1 ? 'ENTRY' : 'ENTRIES'}</span><button className="icon-button" aria-label="Refresh entries" disabled={!canRead || loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={17} className={loading ? 'loading-icon' : ''} /></button></div>
        <div className="view-switcher" role="group" aria-label="Journal layout">{([
          ['fragments', 'Fragments', LayoutGrid], ['timeline', 'Timeline', List], ['calendar', 'Calendar', CalendarDays],
        ] as const).map(([value, label, Icon]) => <button key={value} aria-pressed={view === value} className={view === value ? 'selected' : ''} onClick={() => { setView(value); setPage(0) }}><Icon size={17} /><span>{label}</span></button>)}</div>
      </div>
      <div className="journal-toolbar">
        <label className="search-field"><Search size={17} /><span className="sr-only">Search entries</span><input type="search" value={search} maxLength={200} placeholder="Search these pages…" onChange={event => setSearch(event.target.value)} /></label>
        <label className="sort-field"><span className="sr-only">Sort entries</span><select aria-label="Sort entries" value={filters.sort} onChange={event => updateFilter('sort', event.target.value as Filters['sort'])}><option value="newest">Newest entry date</option><option value="oldest">Oldest entry date</option><option value="updated">Recently updated</option></select></label>
        <button className={`secondary-button ${filters.saved ? 'selected' : ''}`} disabled={!userId || !supabase} aria-pressed={filters.saved} onClick={() => updateFilter('saved', !filters.saved)}><Bookmark size={16} /> Kept close</button>
        <button className={`secondary-button ${showFilters ? 'selected' : ''}`} aria-expanded={showFilters} aria-controls="entry-filters" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={17} /> Filters</button>
      </div>
      {showFilters && <div className="filter-panel" id="entry-filters">
        <label>Mood<select value={filters.mood} onChange={event => updateFilter('mood', event.target.value as Filters['mood'])}><option value="">Every feeling</option>{moods.map(mood => <option key={mood} value={mood}>{mood[0].toUpperCase() + mood.slice(1)}</option>)}</select></label>
        {scope === 'journal' && <label>Visibility<select value={filters.visibility} onChange={event => updateFilter('visibility', event.target.value as Filters['visibility'])}><option value="">All my entries</option><option value="private">Private</option><option value="public">Published</option></select></label>}
        <label>From date<input type="date" value={filters.from} onChange={event => updateFilter('from', event.target.value)} /></label>
        <label>To date<input type="date" value={filters.to} onChange={event => updateFilter('to', event.target.value)} /></label>
        <label className="checkbox-label"><input type="checkbox" checked={filters.images} onChange={event => updateFilter('images', event.target.checked)} /> With photographs</label>
        <button className="text-button" onClick={() => { setFilters(defaultFilters); setSearch(''); setSelectedDay(''); setPage(0) }}>Clear filters</button>
      </div>}
      {dateError && <p className="inline-error" role="alert">{dateError}</p>}
      {bookmarkError && <p className="inline-error" role="alert">{bookmarkError} <button className="text-button" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
      {view === 'calendar' && <CalendarView month={month} selected={selectedDay} entries={calendarEntries} loading={calendarLoading} onMonth={offset => { setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1)); setSelectedDay(''); setPage(0) }} onSelect={day => { setSelectedDay(day); setPage(0) }} onToday={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDay(localDate(now)); setPage(0) }} />}
      {calendarError && <p className="inline-error" role="alert">Calendar could not load: {calendarError} <button className="text-button" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
      {view === 'calendar' && selectedDay && <div className="selected-day-heading"><h3>{displayDate(selectedDay)}</h3>{userId && <button className="secondary-button" onClick={() => setNewEntryDate(selectedDay)}><Plus size={16} /> Write for this day</button>}<button className="text-button" onClick={() => { setSelectedDay(''); setPage(0) }}>Show whole month</button></div>}
      {loading ? <div className="empty-state" role="status"><Feather size={28} /><p>Gathering these pages…</p></div> : fetchError ? <div className="empty-state"><p className="inline-error" role="alert">{fetchError}</p><button className="secondary-button" onClick={() => setRevision(value => value + 1)}>Try again</button></div> : entries.length ? <div className={view === 'fragments' ? 'masonry' : 'timeline'}>{entryCards}</div> : <div className="empty-state"><Feather size={28} strokeWidth={1} /><h3>{!supabase ? 'Your next chapter awaits.' : !userId && scope === 'journal' ? 'A place of your own.' : 'A quiet page.'}</h3><p>{!supabase ? 'Connect the cloud journal to begin.' : !userId && scope === 'journal' ? 'Sign in to read and write your private journal, or explore the community.' : filters.search || filters.mood || filters.saved || filters.from || filters.to || filters.images || filters.visibility ? 'No entries match these filters. Try widening your search.' : view === 'calendar' ? 'No entries for this date. A new page can begin here.' : scope === 'community' ? 'No published fragments yet. Private journal entries never appear here.' : 'When you are ready, write your first page above.'}</p></div>}
      {count > PAGE_SIZE && <div className="pagination"><button className="secondary-button" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Previous pages</button><span>Page {page + 1} of {Math.ceil(count / PAGE_SIZE)}</span><button className="secondary-button" disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage(page + 1)}>Next pages</button></div>}
      <div className="end-mark"><span /><Feather size={18} strokeWidth={1} /><span /></div><p className="closing-line">Some things are lighter once they’re written.</p>
    </section>
    {(editing || newEntryDate) && <Dialog title={editing ? 'Return to this page.' : 'A page for this day.'} onClose={() => { if (!busy) { setEditing(null); setNewEntryDate(null) } }} wide><Composer note={editing ?? undefined} initialDate={newEntryDate ?? undefined} busy={busy} signedIn={Boolean(userId)} configured={Boolean(supabase)} onLogin={onLogin} onSave={(input, file, removeImage) => save(input, file, removeImage, editing ?? undefined)} onCancel={() => { setEditing(null); setNewEntryDate(null) }} /></Dialog>}
    {deleting && <Dialog title="Let this page go?" onClose={() => { if (!busy) setDeleting(null) }}><p>This permanently deletes the entry and its comments. You cannot undo this.</p>{actionError && <p className="inline-error" role="alert">{actionError}</p>}<div className="modal-buttons flex gap-3"><button className="secondary-button" disabled={busy} onClick={() => setDeleting(null)}>Keep it</button><button className="danger-button" disabled={busy} onClick={() => void remove()}>{busy ? 'Deleting…' : 'Delete permanently'}</button></div></Dialog>}
    {commenting && <CommentsDialog note={commenting} userId={userId} onClose={() => setCommenting(null)} onLogin={() => { setCommenting(null); onLogin() }} />}
  </>
}
