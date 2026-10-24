// USNO approximate solar coordinates, UTC, east-positive longitude.
// https://aa.usno.navy.mil/faq/sun_approx — geometric centre, no refraction.
export const rad = (d) => d * Math.PI / 180;
export const deg = (r) => r * 180 / Math.PI;
export const wrap = (d) => ((d + 180) % 360 + 360) % 360 - 180;
export const clamp = (n) => Math.max(-1, Math.min(1, n));
export function solarPosition(date) {
  const ms = typeof date === 'number' ? date : Date.parse(date);
  if (!Number.isFinite(ms)) throw new RangeError('Invalid solar date');
  const d = ms / 86400000 + 2440587.5 - 2451545;
  const g = rad(wrap(357.529 + 0.98560028 * d));
  const q = wrap(280.459 + 0.98564736 * d);
  const l = rad(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  const e = rad(23.439 - 0.00000036 * d);
  const ra = deg(Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)));
  const latitude = deg(Math.asin(Math.sin(e) * Math.sin(l)));
  const equationMinutes = 4 * wrap(q - ra);
  const minutes = ((ms / 60000) % 1440 + 1440) % 1440;
  return { latitude, longitude: wrap(180 - (minutes + equationMinutes) / 4), equationMinutes };
}
export function altitudeAt(sun, latitude, longitude) {
  return deg(Math.asin(clamp(Math.sin(rad(latitude)) * Math.sin(rad(sun.latitude)) + Math.cos(rad(latitude)) * Math.cos(rad(sun.latitude)) * Math.cos(rad(longitude - sun.longitude)))));
}
export function solarAltitude(date, latitude, longitude) {
  return altitudeAt(solarPosition(date), latitude, longitude);
}
