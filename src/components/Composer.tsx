import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, Globe2, ImagePlus, Link, LockKeyhole, X } from 'lucide-react'
import type { Note, EntryInput } from '../lib/api'
import { displayDate, localDate, moods, validateImage, validateImageUrl } from '../lib/journal'
import { errorMessage } from '../lib/supabase'

export default function Composer({ note, initialDate, busy, signedIn, configured, onSave, onLogin, onCancel }: {
  note?: Note; initialDate?: string; busy: boolean; signedIn: boolean; configured: boolean;
  onSave: (input: EntryInput, file: File | null, removeImage: boolean) => Promise<void>;
  onLogin: () => void; onCancel?: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [date, setDate] = useState(note?.entry_date ?? initialDate ?? localDate())
  const [mood, setMood] = useState<EntryInput['mood']>(note?.mood ?? 'reflective')
  const [visibility, setVisibility] = useState<EntryInput['visibility']>(note?.visibility ?? 'private')
  const [file, setFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState(note?.image_url ?? '')
  const [removeImage, setRemoveImage] = useState(false)
  const [showUrl, setShowUrl] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [filePreview, setFilePreview] = useState('')
  const [error, setError] = useState('')
  const [imageFailed, setImageFailed] = useState(false)
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!file) { setFilePreview(''); return }
    const preview = URL.createObjectURL(file)
    setFilePreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [file])
  const preview = filePreview || imageUrl || (!removeImage ? note?.imageSrc : '')
  const hasImage = Boolean(file || imageUrl || (!removeImage && note?.image_path))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!signedIn) { onLogin(); return }
    if (!body.trim() && !hasImage) { setError('Leave a few words or attach an image before saving.'); return }
    if (showUrl && urlDraft.trim()) { setError('Attach the image URL or close the URL field before saving.'); return }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Choose a valid entry date.'); return }
    if (imageFailed && hasImage) { setError('Remove the unavailable image or attach a different one before saving.'); return }
    setError('')
    try {
      await onSave({ title: title.trim(), body: body.trim(), entry_date: date, mood, visibility, image_url: imageUrl || null }, file, removeImage)
      if (!note) { setTitle(''); setBody(''); setFile(null); setImageUrl(''); setRemoveImage(false); setShowUrl(false); setUrlDraft(''); setVisibility('private') }
    } catch (cause) { setError(errorMessage(cause)) }
  }
  function attachUrl() {
    try { setImageUrl(validateImageUrl(urlDraft)); setFile(null); setShowUrl(false); setRemoveImage(true); setImageFailed(false); setError(''); setUrlDraft('') }
    catch (cause) { setError(errorMessage(cause)) }
  }
  return <section className="writing-section" aria-label={note ? 'Edit entry' : 'Write a fragment'}>
    <form onSubmit={event => void submit(event)}>
      <fieldset disabled={busy}>
        <div className="composer-top flex items-center justify-between gap-3"><span className="eyebrow">{note ? 'REVISIT THIS PAGE' : 'A NEW FRAGMENT'}</span><span className="date-label">{displayDate(date || localDate())}</span></div>
        <label className="sr-only" htmlFor={`${id}-title`}>Entry title</label>
        <input id={`${id}-title`} className="entry-title" placeholder="Give this page a title (optional)" maxLength={160} value={title} onChange={event => setTitle(event.target.value)} />
        <label className="sr-only" htmlFor={`${id}-thought`}>Your thoughts</label>
        <textarea id={`${id}-thought`} value={body} onChange={event => setBody(event.target.value)} placeholder="Bury your thoughts here..." maxLength={10000} />
        {preview && <div className="attachment-preview"><img src={preview} alt="Attached memory" onError={() => { setImageFailed(true); setError('This image could not be displayed. Remove it or choose another image before saving.') }} /><button type="button" aria-label="Remove attached image" onClick={() => { setFile(null); setImageUrl(''); setRemoveImage(true); setImageFailed(false); setError('') }}><X size={17} /></button></div>}
        {showUrl && <div className="url-input flex flex-wrap gap-3"><label className="sr-only" htmlFor={`${id}-image-url`}>Image URL</label><input id={`${id}-image-url`} type="url" placeholder="https://… a photograph to remember" value={urlDraft} onChange={event => setUrlDraft(event.target.value)} /><button type="button" onClick={attachUrl}>Attach</button><button type="button" aria-label="Close image URL" onClick={() => { setShowUrl(false); setUrlDraft('') }}><X size={17} /></button><p className="help-text">Linked images load from their host, which can see requests. Upload for private storage.</p></div>}
        <div className="entry-options">
          <label>Entry date<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label>
          <label>Mood<select value={mood} onChange={event => setMood(event.target.value as EntryInput['mood'])}>{moods.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
          <label className="visibility-option">{visibility === 'private' ? <LockKeyhole size={15} /> : <Globe2 size={15} />} Visibility<select value={visibility} onChange={event => setVisibility(event.target.value as EntryInput['visibility'])}><option value="private">Private · only me</option><option value="public">Public · community</option></select></label>
        </div>
        <p className={`visibility-explanation ${visibility === 'public' ? 'publishing-warning' : ''}`}>{visibility === 'public' ? 'Published entries, your pen name, and their images are visible to everyone. Signed-in readers can comment. Making an entry private hides its comments but does not erase them.' : 'A private page in your journal. Only your account can read it.'}</p>
        {error && <p className="inline-error composer-error" role="alert">{error}</p>}
        <div className="composer-bottom flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><button type="button" className="attachment-button flex items-center gap-2" onClick={() => inputRef.current?.click()}><ImagePlus size={17} /><span>Attach a memory</span></button><button type="button" className="icon-button" aria-label="Attach image by URL" onClick={() => setShowUrl(!showUrl)}><Link size={17} /></button></div>
          <div className="flex gap-3">{onCancel && <button className="text-button" type="button" onClick={onCancel}>Cancel</button>}<button type="submit" className="submit-button flex items-center gap-4" disabled={busy || !configured || (signedIn && !body.trim() && !hasImage)}>{busy ? 'Saving…' : !signedIn ? 'Sign in to write' : note ? 'Save changes' : visibility === 'public' ? 'Publish fragment' : 'Save to journal'}<ArrowUpRight size={18} /></button></div>
        </div>
        <input ref={inputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => {
          const selected = event.target.files?.[0]
          if (selected) { try { validateImage(selected); setFile(selected); setImageUrl(''); setRemoveImage(true); setImageFailed(false); setError('') } catch (cause) { setError(errorMessage(cause)) } }
          event.target.value = ''
        }} />
      </fieldset>
    </form>
  </section>
}
