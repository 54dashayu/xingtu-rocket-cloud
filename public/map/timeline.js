// Tail lifetime applies only within the selected ascent window; it never extends playback.
export const TAIL_SECONDS=300;
export const PRELAUNCH_SECONDS=60;
export function playbackWindow(profile){
 const duration=profile?.full?.length&&Number.isFinite(profile.duration)&&profile.duration>0?profile.duration:null;
 const start=-PRELAUNCH_SECONDS,end=duration===null?300:duration;
 return {start,end,arrival:duration,zeroFraction:-start/(end-start),arrivalFraction:duration===null?null:(duration-start)/(end-start)};
}
export function clampPlayback(seconds,window){return Math.max(window.start,Math.min(window.end,seconds));}
