// Average bitrate matters more than total file size for playback continuity.
export function mediaBitrate(file) {
 const duration=Number(file.length);
 return duration>0 ? Number(file.size)*8/duration : /512kb/i.test(file.name || '') ? 512000 : 700000;
}
