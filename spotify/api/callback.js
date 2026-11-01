// לכאן ספוטיפיי מחזירה אותך אחרי שאישרת.
// הקובץ ממיר את הקוד החד-פעמי ל"טוקן רענון" ומציג אותו על המסך כדי שתעתיק אותו.

module.exports = async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing code - start again from /api/login');
  }

  // ספוטיפיי דורשת את ה-Client ID וה-Secret ביחד, מקודדים בפורמט Base64
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
      grant_type: 'authorization_code',               // "אני מחליף קוד בטוקן"
      code: code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    }),
  });

  const data = await r.json();
  if (!r.ok) {
    return res.status(500).json(data);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <div dir="rtl" style="font-family:sans-serif;padding:24px">
      <h2>הצליח!</h2>
      <p>תעתיק את כל הטקסט שבתיבה ותשמור אותו ב-Vercel בתור <b>SPOTIFY_REFRESH_TOKEN</b></p>
      <textarea style="width:100%;height:120px" readonly>${data.refresh_token}</textarea>
    </div>
  `);
};
