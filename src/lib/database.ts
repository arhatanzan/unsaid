export type Mood = 'reflective' | 'heavy' | 'hopeful' | 'peaceful' | 'unsettled'
export type Visibility = 'private' | 'public'
export type NoteRow = {
  id: string
  author_id: string
  title: string
  body: string
  entry_date: string
  mood: Mood
  visibility: Visibility
  image_path: string | null
  image_url: string | null
  created_at: string
  updated_at: string
  search_text: string
}
export type CommentRow = { id: string; note_id: string; author_id: string; body: string; created_at: string }
type ProfileRow = { id: string; display_name: string }
type BookmarkRow = { user_id: string; note_id: string }

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: ProfileRow
        Update: Partial<ProfileRow>
        Relationships: []
      }
      notes: {
        Row: NoteRow
        Insert: Pick<NoteRow, 'id' | 'author_id' | 'title' | 'body' | 'entry_date' | 'mood' | 'visibility' | 'image_path' | 'image_url'>
        Update: Partial<Pick<NoteRow, 'title' | 'body' | 'entry_date' | 'mood' | 'visibility' | 'image_path' | 'image_url'>>
        Relationships: [{ foreignKeyName: 'notes_author_id_fkey'; columns: ['author_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }]
      }
      comments: {
        Row: CommentRow
        Insert: Pick<CommentRow, 'note_id' | 'author_id' | 'body'>
        Update: never
        Relationships: [
          { foreignKeyName: 'comments_author_id_fkey'; columns: ['author_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'comments_note_id_fkey'; columns: ['note_id']; isOneToOne: false; referencedRelation: 'notes'; referencedColumns: ['id'] },
        ]
      }
      bookmarks: {
        Row: BookmarkRow
        Insert: BookmarkRow
        Update: never
        Relationships: [{ foreignKeyName: 'bookmarks_note_id_fkey'; columns: ['note_id']; isOneToOne: false; referencedRelation: 'notes'; referencedColumns: ['id'] }]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
