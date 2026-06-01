function dt(date,time){ return `${date.replaceAll('-','')}T${time.replace(':','')}00`; }
function foldLine(line){ return line.match(/.{1,72}/g).join('\r\n '); }
function escapeText(text=''){ return String(text).replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n'); }
export function downloadIcs({title,startDate,endDate,startTime,duration,location,attendees,recurring=true}){
  const uid = `controlquest-${crypto.randomUUID()}@controlquest.local`;
  const [hour,minute] = startTime.split(':').map(Number);
  const start = new Date(`${startDate}T${startTime}:00`);
  const end = new Date(start.getTime() + Number(duration || 60)*60000);
  const endTime = `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`;
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ControlQuest Studio//Ty and Comply//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    `UID:${uid}`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
    `DTSTART:${dt(startDate,startTime)}`,`DTEND:${dt(startDate,endTime)}`,`SUMMARY:${escapeText(title)}`,`LOCATION:${escapeText(location || 'Virtual study session')}`,
    `DESCRIPTION:${escapeText('ControlQuest CISA study session. Open the site, check in, run the 7-8 AM quest, and log QAE progress.')}`
  ];
  if(recurring) lines.push(`RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL:${endDate.replaceAll('-','')}T235959`);
  attendees.filter(Boolean).forEach(email => lines.push(`ATTENDEE;CN=${email};ROLE=REQ-PARTICIPANT:mailto:${email}`));
  lines.push('END:VEVENT','END:VCALENDAR');
  const ics = lines.map(foldLine).join('\r\n');
  const blob = new Blob([ics],{type:'text/calendar'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download = recurring ? 'controlquest-weekday-study-sessions.ics' : 'controlquest-extra-study-session.ics';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
