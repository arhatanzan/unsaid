import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import Dialog from './Dialog'
import { deleteComment, getComments, postComment, type Comment, type Note } from '../lib/api'
import { errorMessage } from '../lib/supabase'
import { PAGE_SIZE } from '../lib/journal'

export default function CommentsDialog({ note, userId, onClose, onLogin }: { note: Note; userId?: string; onClose: () => void; onLogin: () => void }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    void getComments(note.id, page).then(result => {
      if (active) { setComments(result.comments); setCount(result.count) }
    }).catch(cause => { if (active) { setError(errorMessage(cause)); setComments([]) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [note.id, page, revision])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!userId) { onLogin(); return }
    if (!body.trim()) { setError('Write a few words before posting.'); return }
    setBusy(true); setError('')
    try {
      await postComment(note.id, userId, body.trim())
      setBody(''); setPage(0); setRevision(value => value + 1)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  async function remove(id: string) {
    setBusy(true); setError('')
    try { await deleteComment(id); setPage(0); setRevision(value => value + 1) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  return <Dialog title="A few words, shared." onClose={() => { if (!busy) onClose() }} wide>
    <p className="comment-context">{note.title || note.body.slice(0, 180)}{!note.title && note.body.length > 180 ? '…' : ''}</p>
    <p className="help-text">Comments are public. Be gentle with the person behind the words.</p>
    {loading ? <p role="status">Opening the conversation…</p> : <div className="comments-list" aria-live="polite">
      {comments.length === 0 && !error && <p className="help-text">No words here yet. You can leave the first.</p>}
      {comments.map(comment => <article className="comment" key={comment.id}><div className="flex items-center justify-between gap-3"><strong>{comment.author?.display_name || 'A quiet soul'}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString()}</time></div><p>{comment.body}</p>{(comment.author_id === userId || note.author_id === userId) && <button disabled={busy} className="comment-delete" aria-label="Delete comment" onClick={() => void remove(comment.id)}><Trash2 size={15} /> Remove comment</button>}</article>)}
    </div>}
    {count > PAGE_SIZE && <div className="pagination"><button className="secondary-button" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Previous comments</button><span>Page {page + 1} of {Math.ceil(count / PAGE_SIZE)}</span><button className="secondary-button" disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage(page + 1)}>Next comments</button></div>}
    {error && <p className="inline-error" role="alert">{error} <button className="text-button" onClick={() => setRevision(value => value + 1)}>Retry loading</button></p>}
    {userId ? <form className="comment-form" onSubmit={event => void submit(event)}><label htmlFor="comment-body">Leave a kind word</label><textarea id="comment-body" value={body} onChange={event => setBody(event.target.value)} required maxLength={2000} disabled={busy} placeholder="Sometimes, being heard is enough…" /><div className="flex items-center justify-between gap-3"><span className="help-text">{body.length}/2,000</span><button className="primary-button" disabled={busy || !body.trim()}>{busy ? 'Posting…' : 'Post comment'}</button></div></form> : <button className="primary-button" onClick={onLogin}>Sign in to comment</button>}
  </Dialog>
}
