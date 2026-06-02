import * as cfg from '../config/firebase-config.js';
const googleCalendarConfig = cfg.googleCalendarConfig || { enabled:false, clientId:'' };

let tokenClient;
let accessToken;

export async function canUseGoogleCalendar(){
  return Boolean(googleCalendarConfig?.enabled && googleCalendarConfig?.clientId);
}

export async function connectGoogleCalendar(){
  if (!(await canUseGoogleCalendar())) throw new Error('Google Calendar is not configured. Add a Google OAuth Client ID in config/firebase-config.js.');
  await loadScript('https://accounts.google.com/gsi/client');
  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: googleCalendarConfig.clientId,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error));
        else { accessToken = resp.access_token; resolve(resp); }
      }
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export async function createGoogleEvent(event, attendees = []){
  if (!accessToken) await connectGoogleCalendar();
  const body = {
    summary: event.title,
    description: event.description || '',
    start: { dateTime: event.start, timeZone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: { dateTime: event.end, timeZone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone },
    attendees: attendees.filter(Boolean).map(email => ({ email })),
    recurrence: event.rrule ? [event.rrule] : undefined
  };
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
    method:'POST',
    headers:{ 'Authorization': `Bearer ${accessToken}`, 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function downloadIcs(event, attendees = []){
  const stamp = toIcsDate(new Date());
  const uid = `${event.id || crypto.randomUUID()}@controlquest.local`;
  const attendeeLines = attendees.filter(Boolean).map(email => `ATTENDEE;CN=${email};ROLE=REQ-PARTICIPANT:MAILTO:${email}`).join('\r\n');
  const recurrence = event.rrule ? `${event.rrule}\r\n` : '';
  const text = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ControlQuest Studio//CISA Study Companion//EN','CALSCALE:GREGORIAN','METHOD:REQUEST','BEGIN:VEVENT',
    `UID:${uid}`,`DTSTAMP:${stamp}`,`DTSTART:${toIcsDate(new Date(event.start))}`,`DTEND:${toIcsDate(new Date(event.end))}`,
    `SUMMARY:${escapeIcs(event.title)}`,`DESCRIPTION:${escapeIcs(event.description || '')}`,recurrence.trim(),attendeeLines,'END:VEVENT','END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
  const blob = new Blob([text], { type:'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${safeFile(event.title || 'ControlQuest Event')}.ics`; a.click();
  URL.revokeObjectURL(url);
}

function toIcsDate(d){ return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''); }
function escapeIcs(s){ return String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
function safeFile(s){ return String(s).replace(/[^a-z0-9-_]+/gi,'_').slice(0,60); }
function loadScript(src){ return new Promise((resolve,reject)=>{ if(document.querySelector(`script[src="${src}"]`)) return resolve(); const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s); }); }
