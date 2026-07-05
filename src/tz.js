// Timezone helpers. Every chat stores an IANA timezone (e.g. "Asia/Tehran")
// or a fixed offset ("UTC+3:30"). Uses Intl so DST is handled correctly.

// Parse a fixed-offset value like "UTC+3:30" → minutes east of UTC (or null).
export function parseFixedOffset(tz) {
  const m = /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/i.exec(String(tz).trim());
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0));
}

// Offset (minutes east of UTC) for a timezone at a given instant.
export function tzOffsetMinutes(tz, date = new Date()) {
  const fixed = parseFixedOffset(tz);
  if (fixed !== null) return fixed;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).reduce((a, p) => (a[p.type] = p.value, a), {});
    const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return Math.round((asUTC - date.getTime()) / 60000);
  } catch {
    return 0; // safe fallback: UTC
  }
}

// Wall-clock parts {y,m,d,hh,mm,wd} in the target timezone.
export function localParts(tz, date = new Date()) {
  const off = tzOffsetMinutes(tz, date);
  const s = new Date(date.getTime() + off * 60000);
  return {
    y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate(),
    hh: s.getUTCHours(), mm: s.getUTCMinutes(), wd: s.getUTCDay(),
  };
}

const FA_DAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

export function formatLocal(tz, date = new Date()) {
  const p = localParts(tz, date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.hh)}:${pad(p.mm)}`;
}

export function dayNameFa(tz, date = new Date()) {
  return FA_DAYS[localParts(tz, date).wd];
}

// Next UTC instant when wall-clock hour:minute happens in tz (today or tomorrow).
export function nextOccurrenceUTC(tz, hour, minute, from = new Date()) {
  const off = tzOffsetMinutes(tz, from);
  const p = localParts(tz, from);
  let targetUTC = Date.UTC(p.y, p.m - 1, p.d, hour, minute, 0) - off * 60000;
  if (targetUTC <= from.getTime()) targetUTC += 24 * 3600 * 1000;
  return new Date(targetUTC);
}

// City / country → IANA timezone (keys are lowercased, spaces & ZWNJ removed).
const CITY_TZ = {
  // Iran & region
  "تهران": "Asia/Tehran", "ایران": "Asia/Tehran", "tehran": "Asia/Tehran", "iran": "Asia/Tehran",
  "مشهد": "Asia/Tehran", "اصفهان": "Asia/Tehran", "شیراز": "Asia/Tehran", "تبریز": "Asia/Tehran",
  "دبی": "Asia/Dubai", "امارات": "Asia/Dubai", "ابوظبی": "Asia/Dubai", "dubai": "Asia/Dubai", "uae": "Asia/Dubai",
  "استانبول": "Europe/Istanbul", "ترکیه": "Europe/Istanbul", "آنکارا": "Europe/Istanbul", "istanbul": "Europe/Istanbul", "turkey": "Europe/Istanbul",
  "باکو": "Asia/Baku", "آذربایجان": "Asia/Baku", "baku": "Asia/Baku",
  "ایروان": "Asia/Yerevan", "ارمنستان": "Asia/Yerevan", "yerevan": "Asia/Yerevan",
  "تفلیس": "Asia/Tbilisi", "گرجستان": "Asia/Tbilisi", "tbilisi": "Asia/Tbilisi",
  "بغداد": "Asia/Baghdad", "عراق": "Asia/Baghdad", "baghdad": "Asia/Baghdad", "iraq": "Asia/Baghdad",
  "ریاض": "Asia/Riyadh", "عربستان": "Asia/Riyadh", "جده": "Asia/Riyadh", "مکه": "Asia/Riyadh", "مدینه": "Asia/Riyadh", "riyadh": "Asia/Riyadh", "saudi": "Asia/Riyadh",
  "کویت": "Asia/Kuwait", "kuwait": "Asia/Kuwait",
  "دوحه": "Asia/Qatar", "قطر": "Asia/Qatar", "doha": "Asia/Qatar", "qatar": "Asia/Qatar",
  "مسقط": "Asia/Muscat", "عمان": "Asia/Muscat", "muscat": "Asia/Muscat", "oman": "Asia/Muscat",
  "بیروت": "Asia/Beirut", "لبنان": "Asia/Beirut", "beirut": "Asia/Beirut",
  "کابل": "Asia/Kabul", "افغانستان": "Asia/Kabul", "kabul": "Asia/Kabul", "afghanistan": "Asia/Kabul",
  "کراچی": "Asia/Karachi", "پاکستان": "Asia/Karachi", "karachi": "Asia/Karachi", "pakistan": "Asia/Karachi",
  "دهلی": "Asia/Kolkata", "بمبئی": "Asia/Kolkata", "هند": "Asia/Kolkata", "delhi": "Asia/Kolkata", "mumbai": "Asia/Kolkata", "india": "Asia/Kolkata",
  // Europe
  "لندن": "Europe/London", "انگلیس": "Europe/London", "انگلستان": "Europe/London", "london": "Europe/London", "uk": "Europe/London",
  "پاریس": "Europe/Paris", "فرانسه": "Europe/Paris", "paris": "Europe/Paris", "france": "Europe/Paris",
  "برلین": "Europe/Berlin", "آلمان": "Europe/Berlin", "berlin": "Europe/Berlin", "germany": "Europe/Berlin",
  "رم": "Europe/Rome", "ایتالیا": "Europe/Rome", "rome": "Europe/Rome", "italy": "Europe/Rome",
  "مادرید": "Europe/Madrid", "اسپانیا": "Europe/Madrid", "madrid": "Europe/Madrid", "spain": "Europe/Madrid",
  "آمستردام": "Europe/Amsterdam", "هلند": "Europe/Amsterdam", "amsterdam": "Europe/Amsterdam",
  "مسکو": "Europe/Moscow", "روسیه": "Europe/Moscow", "moscow": "Europe/Moscow", "russia": "Europe/Moscow",
  // Americas
  "نیویورک": "America/New_York", "واشنگتن": "America/New_York", "newyork": "America/New_York", "washington": "America/New_York",
  "شیکاگو": "America/Chicago", "chicago": "America/Chicago",
  "لسآنجلس": "America/Los_Angeles", "losangeles": "America/Los_Angeles", "la": "America/Los_Angeles",
  "تورنتو": "America/Toronto", "کانادا": "America/Toronto", "toronto": "America/Toronto", "canada": "America/Toronto",
  "مکزیک": "America/Mexico_City", "mexico": "America/Mexico_City",
  "سائوپائولو": "America/Sao_Paulo", "برزیل": "America/Sao_Paulo", "brazil": "America/Sao_Paulo",
  // Asia-Pacific
  "توکیو": "Asia/Tokyo", "ژاپن": "Asia/Tokyo", "tokyo": "Asia/Tokyo", "japan": "Asia/Tokyo",
  "پکن": "Asia/Shanghai", "شانگهای": "Asia/Shanghai", "چین": "Asia/Shanghai", "beijing": "Asia/Shanghai", "shanghai": "Asia/Shanghai", "china": "Asia/Shanghai",
  "هنگکنگ": "Asia/Hong_Kong", "hongkong": "Asia/Hong_Kong",
  "سنگاپور": "Asia/Singapore", "singapore": "Asia/Singapore",
  "بانکوک": "Asia/Bangkok", "تایلند": "Asia/Bangkok", "bangkok": "Asia/Bangkok", "thailand": "Asia/Bangkok",
  "سیدنی": "Australia/Sydney", "استرالیا": "Australia/Sydney", "sydney": "Australia/Sydney", "australia": "Australia/Sydney",
  "ملبورن": "Australia/Melbourne", "melbourne": "Australia/Melbourne",
  "اکلند": "Pacific/Auckland", "نیوزیلند": "Pacific/Auckland", "auckland": "Pacific/Auckland",
  // Africa
  "قاهره": "Africa/Cairo", "مصر": "Africa/Cairo", "cairo": "Africa/Cairo", "egypt": "Africa/Cairo",
  "utc": "UTC+0:00", "gmt": "UTC+0:00",
};

// Resolve free-text input → { tz, label } or null.
export function resolveTimezone(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  // 1) UTC/GMT offset: +3:30, -8, utc+4, +05:30, gmt+3
  const om = /^(?:utc|gmt)?([+-])(\d{1,2})(?::?(\d{2}))?$/i.exec(raw.replace(/\s+/g, ""));
  if (om) {
    const sign = om[1];
    const h = parseInt(om[2], 10);
    const mm = om[3] || "00";
    return { tz: `UTC${sign}${h}:${mm}`, label: `UTC${sign}${h}:${mm}` };
  }

  // 2) IANA name (contains "/") — validate via Intl
  if (/^[A-Za-z_]+\/[A-Za-z0-9_+\-\/]+$/.test(raw)) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: raw }); return { tz: raw, label: raw }; }
    catch { /* not a real IANA zone */ }
  }

  // 3) City / country name
  const key = raw.toLowerCase().replace(/[\u200c\s]/g, "");
  if (CITY_TZ[key]) return { tz: CITY_TZ[key], label: raw };

  return null;
}

// Normalize Persian/Arabic digits to English.
function normDigits(s) {
  const fa = "۰۱۲۳۴۵۶۷۸۹", ar = "٠١٢٣٤٥٦٧٨٩";
  return String(s).replace(/[۰-۹٠-٩]/g, (ch) => {
    let i = fa.indexOf(ch); if (i > -1) return String(i);
    i = ar.indexOf(ch); return i > -1 ? String(i) : ch;
  });
}

// Extract a 24-hour clock time from free text, honoring Persian/English
// meridiem (بعد از ظهر / عصر / شب / صبح / ظهر / am / pm). Returns {hour, minute} or null.
export function parseClock(text) {
  const s = normDigits(text);
  let m = s.match(/(?:ساعت|at)\s*(\d{1,2}):(\d{2})/i)
       || s.match(/\b(\d{1,2}):(\d{2})\b/)
       || s.match(/ساعت\s*(\d{1,2})(?!\s*\d)/)
       || s.match(/\bat\s+(\d{1,2})(?!\s*\d)/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  let minute = m[2] ? parseInt(m[2], 10) : 0;
  const t = s.toLowerCase();
  const pm = /(بعد\s*از\s*ظهر|بعدازظهر|عصر|شب|\bpm\b|ب\.?ظ)/.test(t);
  const am = /(صبح|بامداد|\bam\b|ق\.?ظ)/.test(t);
  if (pm && hour < 12) hour += 12;
  else if (am && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}
