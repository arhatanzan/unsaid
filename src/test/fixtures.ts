import type { Session } from '@supabase/supabase-js'
import type { Note } from '../lib/api'

export const testSession: Session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 2000000000,
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'reader@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: { display_name: 'A reader' },
    created_at: '2026-10-22T00:00:00Z',
  },
}
export const testNote: Note = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  author_id: testSession.user.id,
  title: 'A page to keep',
  body: 'The words I wanted to remember.',
  entry_date: '2026-10-22',
  mood: 'reflective',
  visibility: 'private',
  image_path: null,
  image_url: null,
  created_at: '2026-10-22T12:00:00Z',
  updated_at: '2026-10-22T12:00:00Z',
  search_text: 'A page to keep The words I wanted to remember.',
  author: { display_name: 'A reader' },
}
