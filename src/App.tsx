import React, { useRef, useState } from 'react'
import { ArrowDown, ArrowUpRight, Bookmark, Check, Feather, ImagePlus, Link, Plus, Trash2, X } from 'lucide-react'
import './styles.css'

type Note = { id: string; text: string; date: string; image?: string; saved: boolean }
const STORAGE_KEY = 'the-unsaid-fragments-v1'
const initialNotes: Note[] = [
  { id: 'first', text: 'I think the hardest part is not missing you.\n\nIt is remembering who I was before I knew what it felt like to lose you.', date: '2026-10-21T18:40:00', saved: false },
  { id: 'second', text: 'Somewhere, there is a version of us that stayed.', date: '2026-10-20T17:10:00', image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=85', saved: false },
  { id: 'third', text: 'The house is quiet now.\n\nNot the peaceful kind of quiet. The kind that still expects a key in the door.', date: '2026-10-18T21:20:00', saved: false },
  { id: 'fourth', text: 'There are days when all I do is carry the things I cannot put down.\n\nToday was one of them.', date: '2026-10-16T19:15:00', saved: false },
  { id: 'fifth', text: 'Even the flowers on the windowsill have learned to lean toward something that is no longer here.', date: '2026-10-14T16:30:00', saved: false },
  { id: 'sixth', text: 'A small reminder:\n\nYou do not have to make something beautiful out of everything that hurt you.', date: '2026-10-12T10:00:00', saved: false },
]

function loadNotes(): { notes: Note[]; error: string } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { notes: initialNotes, error: '' }
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((note): note is Note =>
      typeof note === 'object' && note !== null && typeof note.id === 'string' &&
      typeof note.text === 'string' && typeof note.date === 'string' &&
      Number.isFinite(Date.parse(note.date)) && typeof note.saved === 'boolean' &&
      (note.image === undefined || (typeof note.image === 'string' && /^(https?:\/\/|data:image\/)/.test(note.image)))
    )) throw new Error('The saved journal format is not valid.')
    return { notes: parsed, error: '' }
  } catch (error) {
    console.error('Unable to open the saved journal:', error)
    return { notes: [], error: 'Your saved journal could not be opened. Existing browser data has not been changed. Please reload or check your browser storage.' }
  }
}

function Botanical() {
  return <svg className="botanical" viewBox="0 0 240 260" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1">
      <path d="M113 254C137 204 142 154 119 105C104 73 111 48 137 40M123 226C99 196 88 174 80 148M135 181C158 155 172 136 180 111M129 148C106 131 91 115 85 91" />
      <path d="M80 149C49 148 45 123 40 109C65 109 85 119 80 149ZM83 160C96 144 102 128 99 119C82 126 74 138 83 160ZM133 190C152 187 176 174 178 158C155 158 140 171 133 190ZM176 119C163 105 165 85 172 75C187 88 189 104 176 119ZM178 116C198 119 213 106 219 91C199 87 184 96 178 116ZM87 95C65 96 51 85 47 68C70 68 86 77 87 95Z" />
      <path d="M136 43C126 38 119 27 125 19C129 14 138 19 140 26C138 11 145 6 152 12C156 16 151 27 146 31C161 23 170 29 166 37C164 44 151 47 143 43C151 54 147 65 139 63C132 61 130 53 136 43ZM133 44C117 50 111 42 114 35C117 30 127 34 133 38" />
      <path d="M113 254L104 247M115 249L124 246M119 239L110 233M123 230L131 225M132 207L123 199M137 168L146 162M128 126L119 119" opacity=".55"/>
      <ellipse cx="140" cy="38" rx="6" ry="5" />
    </g>
  </svg>
}

export default function App() {
  const [loaded] = useState(loadNotes)
  const [notes, setNotes] = useState(loaded.notes)
  const [error, setError] = useState(loaded.error)
  const [text, setText] = useState('')
  const [image, setImage] = useState('')
  const [url, setUrl] = useState('')
  const [showUrl, setShowUrl] = useState(false)
  const [filter, setFilter] = useState<'all' | 'saved'>('all')
  const [oldest, setOldest] = useState(false)
  const [about, setAbout] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [imageError, setImageError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  function persist(next: Note[]) {
    if (loaded.error) {
      setError('Saving is paused to protect the journal that could not be opened. Please reload after resolving the browser storage issue.')
      return false
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setNotes(next)
      setError('')
      return true
    } catch (cause) {
      console.error('Unable to save journal:', cause)
      setError('This fragment could not be saved. Browser storage may be full or unavailable. Try a smaller image; your writing is still here.')
      return false
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!text.trim() && !image) return
    const next: Note = { id: crypto.randomUUID(), text: text.trim(), date: new Date().toISOString(), image: image || undefined, saved: false }
    if (persist([next, ...notes])) {
      setText(''); setImage(''); setUrl(''); setImageError(''); setShowUrl(false); setFilter('all'); setOldest(false)
      setAnnouncement('Your fragment has found a place here.')
    }
  }

  function attachUrl() {
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported image URL')
      setImage(parsed.href); setShowUrl(false); setImageError('')
    } catch {
      setImageError('Please enter a complete http or https image URL.')
    }
  }

  async function upload(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setImageError('Please choose a JPG, PNG, WebP, or GIF image.'); return
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageError('Please choose an image smaller than 2 MB to keep your journal safe in browser storage.'); return
    }
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') { setImage(reader.result); setImageError('') } }
    reader.onerror = () => setImageError('This image could not be read. Please try another file.')
    reader.readAsDataURL(file)
  }

  const visible = notes.filter(note => filter === 'all' || note.saved).sort((a, b) =>
    oldest ? Date.parse(a.date) - Date.parse(b.date) : Date.parse(b.date) - Date.parse(a.date))

  return <div className="app-shell">
    <header className="site-header flex items-center justify-between">
      <a href="#" className="wordmark flex items-center gap-3" aria-label="The Unsaid home"><Feather size={25} strokeWidth={1} /><span>the unsaid<span className="wordmark-dot">.</span></span></a>
      <nav className="flex items-center gap-9" aria-label="Main navigation">
        <a className="nav-link active" href="#journal">THE JOURNAL</a>
        <button className="nav-link" onClick={() => setAbout(true)}>A QUIET WORD <ArrowUpRight size={12} /></button>
      </nav>
    </header>

    <main id="journal" className="main-content">
      <section className="introduction relative">
        <div className="eyebrow flex items-center gap-3"><span className="little-line" /> A PLACE TO LEAVE IT ALL</div>
        <h1>For everything<br />you <em>never said.</em></h1>
        <p className="intro-copy">The words that stayed. The people who didn’t.<br />Leave a little of the weight here.</p>
        <div className="hero-art"><Botanical /><span>even here, something grows.</span></div>
        <div className="volume-label">A PRIVATE COLLECTION<br /><span>OF HUMAN THINGS</span></div>
      </section>

      <section className="writing-section" aria-label="Write a fragment">
        <form onSubmit={submit}>
          <div className="composer-top flex items-center justify-between"><label htmlFor="thought" className="eyebrow">A NEW FRAGMENT</label><span className="date-label">{new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())}</span></div>
          <textarea id="thought" ref={textRef} value={text} onChange={event => { setText(event.target.value); setAnnouncement('') }} placeholder="Bury your thoughts here..." maxLength={10000} />
          {image && <div className="attachment-preview"><img src={image} alt="Attached memory" onError={() => { setImage(''); setImageError('This image could not be loaded. Check its URL or upload a file instead.') }} /><button type="button" aria-label="Remove attached image" onClick={() => setImage('')}><X size={14} /></button></div>}
          {showUrl && <div className="url-input flex gap-3"><input type="url" aria-label="Image URL" placeholder="https://… a photograph to remember" value={url} onChange={e => setUrl(e.target.value)} /><button type="button" onClick={attachUrl}>Attach <Plus size={13} /></button><button type="button" aria-label="Close image URL" onClick={() => setShowUrl(false)}><X size={15} /></button></div>}
          {imageError && <p className="error-message" role="alert">{imageError}</p>}
          <div className="composer-bottom flex items-center justify-between gap-4">
            <div className="flex items-center gap-5"><button type="button" className="attachment-button flex items-center gap-2" onClick={() => fileRef.current?.click()}><ImagePlus size={15} strokeWidth={1.4} /><span>Attach a memory</span></button><span className="toolbar-divider" /><button type="button" className="icon-button" aria-label="Attach image by URL" onClick={() => setShowUrl(!showUrl)}><Link size={14} strokeWidth={1.4} /></button></div>
            <button type="submit" className="submit-button flex items-center gap-5" disabled={!text.trim() && !image}>Leave it here <ArrowUpRight size={16} strokeWidth={1.3} /></button>
          </div>
          <input ref={fileRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} />
        </form>
      </section>
      <div className="under-composer flex items-center justify-between"><span><span className="privacy-dot" /> Only this browser. Only for you.</span><span className="announcement" role="status">{announcement}</span><span className="no-judgment">No right words required.</span></div>
      {error && <p className="error-message storage-error" role="alert">{error}</p>}

      <section className="fragments-section" aria-labelledby="fragments-heading">
        <div className="feed-header flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-baseline gap-4"><h2 id="fragments-heading">What remains</h2><span className="fragment-count">{notes.length.toString().padStart(2, '0')} FRAGMENTS</span></div>
          <div className="feed-controls flex items-center gap-6"><div className="filter-controls flex gap-5"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All fragments</button><button className={filter === 'saved' ? 'selected' : ''} onClick={() => setFilter('saved')}>Kept close <Bookmark size={12} /></button></div><span className="toolbar-divider" /><button className="sort-button flex items-center gap-2" onClick={() => setOldest(!oldest)}>{oldest ? 'Oldest first' : 'Newest first'}<ArrowDown size={12} className={oldest ? 'rotate-180' : ''} /></button></div>
        </div>
        {visible.length === 0 ? <div className="empty-state"><Feather size={28} strokeWidth={1} /><h3>{filter === 'saved' ? 'Nothing held close. Yet.' : 'A quiet beginning.'}</h3><p>{filter === 'saved' ? 'Bookmark a fragment to keep it in this corner.' : 'When you are ready, leave your first fragment above.'}</p></div> : <div className="masonry">
          {visible.map((note) => <article key={note.id} className={`fragment ${note.image ? 'has-image' : ''}`} style={{ '--tilt': `${(note.id.charCodeAt(0) % 3 - 1) * 0.45}deg` } as React.CSSProperties}>
            <div className="fragment-meta flex items-center justify-between"><time dateTime={note.date}>{new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(note.date))}</time><span>NO. {String(notes.length - notes.findIndex(n => n.id === note.id)).padStart(3, '0')}</span></div>
            {note.image && <figure className="fragment-image"><img src={note.image} alt="A memory accompanying this fragment" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; const caption = event.currentTarget.nextElementSibling; if (caption instanceof HTMLElement) caption.hidden = false }} /><figcaption hidden>This photograph is no longer available.</figcaption></figure>}
            <p className="fragment-text">{note.text}</p>
            <div className="fragment-footer flex items-center justify-between"><span className="fragment-flourish">—</span><div className="flex items-center gap-4"><button className={`note-action ${note.saved ? 'is-saved' : ''}`} aria-label={note.saved ? 'Remove from kept close' : 'Keep this fragment close'} aria-pressed={note.saved} onClick={() => persist(notes.map(n => n.id === note.id ? { ...n, saved: !n.saved } : n))}><Bookmark size={14} strokeWidth={1.2} fill={note.saved ? 'currentColor' : 'none'} /></button><button className="note-action delete-action" aria-label="Delete fragment" onClick={() => setDeleteId(note.id)}><Trash2 size={13} strokeWidth={1.2} /></button></div></div>
          </article>)}
        </div>}
        <div className="end-mark"><span /> <span className="end-ornament">✧</span> <span /></div>
        <p className="closing-line">Some things are lighter once they’re written.</p>
      </section>
    </main>
    <footer className="site-footer flex flex-wrap items-center justify-between gap-4"><span>THE UNSAID <span className="footer-dash">/</span> A LITTLE LESS TO CARRY.</span><span>Made for the beautifully unfinished.</span><Feather size={17} strokeWidth={1} /></footer>

    {(about || deleteId) && <div className="modal-backdrop">
      <dialog
        ref={element => {
          if (element && !element.open) element.showModal()
          return () => element?.close()
        }}
        aria-labelledby="dialog-title"
        onCancel={() => { setAbout(false); setDeleteId(null) }}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            setAbout(false); setDeleteId(null)
          }
        }}
        onClick={event => {
          if (event.target !== event.currentTarget) return
          const rect = event.currentTarget.getBoundingClientRect()
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
            setAbout(false); setDeleteId(null)
          }
        }}
      >
        <button autoFocus className="modal-close" aria-label="Close dialog" onClick={() => { setAbout(false); setDeleteId(null) }}><X size={19} /></button>
        <Feather size={27} strokeWidth={1} />
        <h2 id="dialog-title">{deleteId ? 'Let this one go?' : 'A quiet word.'}</h2>
        <p>{deleteId ? 'This fragment will be permanently removed from your journal. There is no need to keep everything.' : 'Not everything needs an audience. This is a small place for unfinished thoughts, old memories, and words you need to put somewhere.'}</p>
        {!deleteId && <p>Your fragments are stored only in this browser, not sent to a server. They are not encrypted, and clearing browser data will erase them. Attached image links load from their original websites. The first few fragments are here to keep you company; you can remove them whenever you like.</p>}
        <div className="modal-buttons flex gap-4">{deleteId ? <><button onClick={() => setDeleteId(null)}>Keep it</button><button className="confirm-button" onClick={() => { if (persist(notes.filter(n => n.id !== deleteId))) { setDeleteId(null); setAnnouncement('The fragment has been released.') } }}>Let it go <Trash2 size={13} /></button></> : <button className="confirm-button" onClick={() => setAbout(false)}>Stay a while <Check size={14} /></button>}</div>
      </dialog>
    </div>}
  </div>
}
