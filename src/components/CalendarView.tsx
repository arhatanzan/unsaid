import { ChevronLeft, ChevronRight } from 'lucide-react'
import { calendarDays, displayDate, localDate } from '../lib/journal'
import type { Note } from '../lib/api'

export default function CalendarView({ month, selected, entries, loading, onMonth, onSelect, onToday }: {
  month: Date; selected: string; entries: Note[]; loading: boolean;
  onMonth: (offset: number) => void; onSelect: (date: string) => void; onToday: () => void;
}) {
  const counts = new Map<string, number>()
  entries.forEach(entry => counts.set(entry.entry_date, (counts.get(entry.entry_date) ?? 0) + 1))
  const today = localDate()
  return <div className="calendar-panel" aria-busy={loading}>
    <div className="calendar-heading"><div><span className="eyebrow">PAGES THROUGH TIME</span><h3 aria-live="polite">{month.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h3></div><div className="flex items-center gap-2"><button className="secondary-button" onClick={onToday}>Today</button><button className="icon-button" aria-label="Previous month" onClick={() => onMonth(-1)}><ChevronLeft size={20} /></button><button className="icon-button" aria-label="Next month" onClick={() => onMonth(1)}><ChevronRight size={20} /></button></div></div>
    <div className="calendar-grid" role="group" aria-label="Choose an entry date">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div className="weekday" key={day}>{day}</div>)}
      {calendarDays(month).map(date => {
        const key = localDate(date), count = counts.get(key) ?? 0, inMonth = date.getMonth() === month.getMonth()
        return <button key={key} disabled={!inMonth} className={`calendar-day ${key === today ? 'is-today' : ''} ${key === selected ? 'selected-day' : ''}`} aria-pressed={key === selected} aria-current={key === today ? 'date' : undefined} aria-label={`${displayDate(key)}, ${count} ${count === 1 ? 'entry' : 'entries'}`} onClick={() => onSelect(selected === key ? '' : key)}><span>{date.getDate()}</span>{inMonth && count > 0 && <span className="day-count">{count}<span className="desktop-day-label"> {count === 1 ? 'entry' : 'entries'}</span></span>}</button>
      })}
    </div>
    <p className="help-text">{loading ? 'Counting these pages…' : 'Counts follow your current filters. Choose a day to read its pages; choose it again to see the month.'}</p>
  </div>
}
