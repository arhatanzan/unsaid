import { useState } from 'react'
import { ArrowUpRight, Feather, LogIn, UserRound } from 'lucide-react'
import { AuthProvider, useAuth } from './lib/auth'
import type { Scope } from './lib/journal'
import AccountDialog from './components/AccountDialog'
import Dialog from './components/Dialog'
import Journal from './components/Journal'
import './styles.css'

function Botanical() {
  return <svg className="botanical" viewBox="0 0 240 260" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1">
      <path d="M113 254C137 204 142 154 119 105C104 73 111 48 137 40M123 226C99 196 88 174 80 148M135 181C158 155 172 136 180 111M129 148C106 131 91 115 85 91" />
      <path d="M80 149C49 148 45 123 40 109C65 109 85 119 80 149ZM83 160C96 144 102 128 99 119C82 126 74 138 83 160ZM133 190C152 187 176 174 178 158C155 158 140 171 133 190ZM176 119C163 105 165 85 172 75C187 88 189 104 176 119ZM178 116C198 119 213 106 219 91C199 87 184 96 178 116ZM87 95C65 96 51 85 47 68C70 68 86 77 87 95Z" />
      <path d="M136 43C126 38 119 27 125 19C129 14 138 19 140 26C138 11 145 6 152 12C156 16 151 27 146 31C161 23 170 29 166 37C164 44 151 47 143 43C151 54 147 65 139 63C132 61 130 53 136 43ZM133 44C117 50 111 42 114 35C117 30 127 34 133 38" />
      <path d="M113 254L104 247M115 249L124 246M119 239L110 233M123 230L131 225M132 207L123 199M137 168L146 162M128 126L119 119" opacity=".55" />
      <ellipse cx="140" cy="38" rx="6" ry="5" />
    </g>
  </svg>
}

function JournalApp() {
  const { session, loading, error, recovery, endRecovery } = useAuth()
  const [scope, setScope] = useState<Scope>('journal')
  const [account, setAccount] = useState(false)
  const [about, setAbout] = useState(false)
  return <div className="app-shell">
    <a className="skip-link" href="#journal">Skip to journal</a>
    <header className="site-header">
      <a href="#" className="wordmark flex items-center gap-3" aria-label="The Unsaid home"><Feather size={25} strokeWidth={1} /><span>the unsaid<span className="wordmark-dot">.</span></span></a>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={`nav-link ${scope === 'journal' ? 'active' : ''}`} aria-pressed={scope === 'journal'} onClick={() => setScope('journal')}>MY JOURNAL</button>
        <button className={`nav-link ${scope === 'community' ? 'active' : ''}`} aria-pressed={scope === 'community'} onClick={() => setScope('community')}>COMMUNITY</button>
        <button className="nav-link about-link" onClick={() => setAbout(true)}>A QUIET WORD <ArrowUpRight size={13} /></button>
        <button className="account-button" disabled={loading} onClick={() => setAccount(true)}>{session ? <UserRound size={17} /> : <LogIn size={17} />}<span>{loading ? 'Restoring…' : session ? 'My account' : 'Sign in'}</span></button>
      </nav>
    </header>
    <main id="journal" className="main-content" tabIndex={-1}>
      <section className="introduction relative">
        <div className="eyebrow flex items-center gap-3"><span className="little-line" /> A PLACE TO LEAVE IT ALL</div>
        <h1>For everything<br />you <em>never said.</em></h1>
        <p className="intro-copy">The words that stayed. The people who didn’t.<br />A journal for your days. A little less to carry.</p>
        <div className="hero-art"><Botanical /><span>even here, something grows.</span></div>
        <div className="volume-label">A PERSONAL COLLECTION<br /><span>OF HUMAN THINGS</span></div>
      </section>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <Journal key={session?.user.id ?? 'guest'} scope={scope} onLogin={() => setAccount(true)} />
    </main>
    <footer className="site-footer flex flex-wrap items-center justify-between gap-4"><span>THE UNSAID <span className="footer-dash">/</span> A LITTLE LESS TO CARRY.</span><button className="text-button" onClick={() => setAbout(true)}>Privacy & a quiet word</button><Feather size={17} strokeWidth={1} /></footer>
    {(account || recovery) && <AccountDialog onClose={() => { setAccount(false); endRecovery() }} />}
    {about && !account && !recovery && <Dialog title="A quiet word." onClose={() => setAbout(false)}><p>Not everything needs an audience. This is a place for unfinished thoughts, old memories, and words you need to put somewhere.</p><h3>Your journal, your choice.</h3><p>New entries are private by default and saved to your account, not just this browser. Choose “Public” to share an entry, its image, and your pen name with everyone. Comments are public and require an account to post.</p><h3>A note about privacy.</h3><p>Private entries are protected by database access rules and uploaded images use a private storage bucket. Entries are not end-to-end encrypted. Signed image links remain valid for up to five minutes after access changes; already viewed or downloaded content cannot be recalled.</p><p>Linked images load from their original hosts, and fonts load from Google Fonts. Sign out on shared devices. Signing out clears the current journal from the screen; your account keeps its pages.</p><button className="primary-button" onClick={() => setAbout(false)}>Stay a while</button></Dialog>}
  </div>
}

export default function App() {
  return <AuthProvider><JournalApp /></AuthProvider>
}
