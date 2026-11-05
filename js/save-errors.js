// Preserve the difference between cloud usage limits and browser storage limits.
export function saveErrorMessage(error){
 const message=error?.message||String(error),code=error?.code||'';
 if(error?.name==='QuotaExceededError'||code===22||code===1014)return 'This browser cannot store more data. Keep ControlQuest browser data and pending answers intact. Free space elsewhere on this device, then retry. Do not repeat the lesson.';
 if(/resource-exhausted/.test(code)||/quota exceeded|quota.*exceed/i.test(message))return 'Cloud database quota reached. This is a service usage limit, not a wrong answer. Lesson credit could not be confirmed. Keep this browser’s data and retry completion after the project owner checks Firebase usage or the quota resets. Do not repeat the lesson.';
 return message;
}
