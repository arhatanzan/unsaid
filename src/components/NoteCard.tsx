import { useState } from 'react'
import { Bookmark, Globe2, LockKeyhole, MessageCircle, Pencil, Trash2 } from 'lucide-react'
import type { Note } from '../lib/api'
import { displayDate } from '../lib/journal'

export default function NoteCard({ note, userId, saved, pending, onBookmark, onEdit, onDelete, onComments }: {
  note: Note; userId?: string; saved: boolean; pending: boolean;
  onBookmark: () => void; onEdit: () => void; onDelete: () => void; onComments: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const owned = userId === note.author_id
  return <article className={`fragment ${note.imageSrc ? 'has-image' : ''}`} aria-label={note.title || `Entry from ${displayDate(note.entry_date)}`}>
    <div className="fragment-meta flex flex-wrap items-center justify-between gap-3"><time dateTime={note.entry_date}>{displayDate(note.entry_date)}</time><span className="visibility-badge">{note.visibility === 'private' ? <LockKeyhole size={13} /> : <Globe2 size={13} />}{note.visibility === 'private' ? 'Private' : 'Public'}</span></div>
    {note.title && <h3 className="fragment-title">{note.title}</h3>}
    {note.imageSrc && <figure className="fragment-image">{imageFailed ? <figcaption>This photograph could not be loaded. Refresh to renew its access link.</figcaption> : <img src={note.imageSrc} alt={note.title ? `Memory for ${note.title}` : 'A photograph attached to this journal entry'} loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />}</figure>}
    <p className="fragment-text">{note.body}</p>
    <div className="note-attribution"><span>{owned ? 'You' : note.author?.display_name || 'A quiet soul'}</span><span className="mood-tag">{note.mood}</span></div>
    <div className="fragment-footer flex flex-wrap items-center justify-between gap-2">
      {note.visibility === 'public' ? <button className="note-action comment-button" onClick={onComments}><MessageCircle size={16} /> Comments</button> : <span className="private-caption">Your eyes only</span>}
      <div className="flex items-center gap-1">
        <button className={`note-action ${saved ? 'is-saved' : ''}`} disabled={pending} aria-label={saved ? 'Remove from kept close' : 'Keep this fragment close'} aria-pressed={saved} onClick={onBookmark}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button>
        {owned && <><button className="note-action" aria-label="Edit entry" onClick={onEdit}><Pencil size={16} /></button><button className="note-action" aria-label="Delete entry" onClick={onDelete}><Trash2 size={16} /></button></>}
      </div>
    </div>
  </article>
}
