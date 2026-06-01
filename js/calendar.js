import { todayISO, addDays } from './planner.js';

export function downloadIcs({ title, description='', location='', startDate, time='07:00', durationMinutes=60, recurrence=null, attendees=[] }){
  const start = combineDateTime(startDate || todayISO(), time);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@controlquest.local`;
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ControlQuest Studio//CISA Study//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'BEGIN:VEVENT',`UID:${uid}`,`DTSTAMP:${icsDate(new Date())}`,`DTSTART:${icsDate(start)}`,`DTEND:${icsDate(end)}`,`SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`
  ];
  if(location) lines.push(`LOCATION:${escapeIcs(location)}`);
  attendees.filter(Boolean).forEach(email => lines.push(`ATTENDEE;CN=${escapeIcs(email)}:MAILTO:${email}`));
  if(recurrence) lines.push(recurrence);
  lines.push('END:VEVENT','END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type:'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'controlquest-event'}.ics`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export function recurrenceRuleForDays(days=[1,2,3,4,5], untilDate=null){
  const map = { 0:'SU',1:'MO',2:'TU',3:'WE',4:'TH',5:'FR',6:'SA' };
  const parts = [`FREQ=WEEKLY`,`BYDAY=${days.map(d=>map[d]).join(',')}`];
  if(untilDate){
    const until = new Date(`${addDays(untilDate,1)}T00:00:00`);
    parts.push(`UNTIL=${icsDate(until)}`);
  }
  return `RRULE:${parts.join(';')}`;
}

export function combineDateTime(dateISO,time){
  const [h,m] = String(time || '07:00').split(':').map(Number);
  const d = new Date(`${dateISO}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function icsDate(d){
  return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
}
function escapeIcs(text){
  return String(text || '').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}
