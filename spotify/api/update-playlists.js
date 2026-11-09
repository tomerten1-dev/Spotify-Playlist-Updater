// זה הלב של המערכת: רץ כל יום ומעדכן את 3 הפלייליסטים.

// שלושת הפלייליסטים, וטווח הזמן שכל אחד לוקח מספוטיפיי:
// short_term  = בערך 4 שבועות אחרונים
// medium_term = בערך 6 חודשים אחרונים
// long_term   = בערך שנה אחרונה
// count = כמה שירים לשים בפלייליסט (המקסימום שספוטיפיי מאפשרת הוא 99)
const PLAYLISTS = [
  { name: 'Top Songs - All Time',   range: 'long_term',   count: 99 },
  { name: 'Top Songs - This Year',  range: 'medium_term', count: 50 },
  { name: 'Top Songs - This Month', range: 'short_term',  count: 50 },
];

// מביא את השירים הכי מושמעים שלך בטווח זמן מסוים.
// ספוטיפיי נותנת עד 50 שירים בכל בקשה, ולא מאפשרת להגיע מעבר למקום ה-99.
// לכן: בקשה ראשונה = מקומות 1-50, בקשה שנייה (offset=49) = מקומות 50-99.
async function getTopTracks(token, range, count) {
  const first = await spotify(
    token, 'GET', '/me/top/tracks?time_range=' + range + '&limit=50&offset=0'
  );
  let tracks = first.items;

  if (count > 50) {
    const second = await spotify(
      token, 'GET', '/me/top/tracks?time_range=' + range + '&limit=50&offset=49'
    );
    tracks = tracks.concat(second.items);
  }

  // new Set מסיר כפילויות (השיר במקום 50 מגיע בשתי הבקשות)
  const uris = [...new Set(tracks.map((t) => t.uri))];
  return uris.slice(0, count); // חותכים למספר המבוקש
}

// שלב א': מקבלים "טוקן גישה" טרי בעזרת טוקן הרענון.
// טוקן גישה תקף רק לשעה, לכן מבקשים חדש בכל ריצה.
async function getAccessToken() {
  const basic = Buffer.from(
    process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
  ).toString('base64');

  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basic,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
    }),
  });

  const data = await r.json();
  if (!r.ok) {
    // invalid_grant כאן = טוקן הרענון פג. צריך להיכנס שוב ל-/api/login
    throw new Error('Token refresh failed: ' + JSON.stringify(data));
  }
  return data.access_token;
}

// פונקציית עזר: שולחת בקשה ל-API של ספוטיפיי וזורקת שגיאה ברורה אם משהו נכשל
async function spotify(token, method, path, body) {
  const r = await fetch('https://api.spotify.com/v1' + path, {
    method: method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await r.text();
  if (!r.ok) {
    throw new Error(method + ' ' + path + ' -> ' + r.status + ': ' + text);
  }
  return text ? JSON.parse(text) : {};
}

// מחפש פלייליסט שלך לפי שם. אם הוא לא קיים, יוצר אותו.
async function findOrCreatePlaylist(token, myId, name) {
  let path = '/me/playlists?limit=50';

  while (path) {
    const page = await spotify(token, 'GET', path);
    const found = page.items.find(
      (p) => p && p.name === name && p.owner && p.owner.id === myId
    );
    if (found) return found.id;

    // אם יש עוד עמודים של פלייליסטים, ממשיכים לעמוד הבא
    path = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }

  const created = await spotify(token, 'POST', '/me/playlists', {
    name: name,
    public: false,
    description: 'Updated automatically every day',
  });
  return created.id;
}

module.exports = async (req, res) => {
  // הגנה: רק Vercel (או אתה, עם הסיסמה) יכולים להפעיל את העדכון
  const secret = process.env.CRON_SECRET;
  const allowed =
    !secret ||
    req.headers.authorization === 'Bearer ' + secret ||
    req.query.secret === secret;
  if (!allowed) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const token = await getAccessToken();
    const me = await spotify(token, 'GET', '/me');   // מי אני (צריך את ה-ID שלך)
    const results = [];

    for (const p of PLAYLISTS) {
      // השירים הכי מושמעים שלך בטווח הזמן הזה, בכמות שנקבעה למעלה
      const uris = await getTopTracks(token, p.range, p.count);

      const playlistId = await findOrCreatePlaylist(token, me.id, p.name);

      // PUT = "תחליף את כל התוכן של הפלייליסט ברשימה הזו"
      // (הכתובת החדשה של ספוטיפיי היא /items ולא /tracks)
      await spotify(token, 'PUT', '/playlists/' + playlistId + '/items', { uris: uris });
            // כותב בתיאור הפלייליסט מתי הוא עודכן לאחרונה
      const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      await spotify(token, 'PUT', '/playlists/' + playlistId, {
        description: 'Last update: ' + now,
      });

      results.push({ playlist: p.name, songs: uris.length });
    }

    res.status(200).json({ ok: true, results: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
