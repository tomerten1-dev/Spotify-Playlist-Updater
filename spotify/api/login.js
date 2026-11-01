// הקובץ הזה שולח אותך לדף ההתחברות של ספוטיפיי.
// משתמשים בו פעם אחת בלבד, כדי לקבל "טוקן רענון".

module.exports = (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,          // המזהה של האפליקציה שלך בספוטיפיי
    response_type: 'code',                             // "תחזיר לי קוד חד-פעמי"
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,    // לאן לחזור אחרי האישור
    // ההרשאות שאנחנו מבקשים:
    // user-top-read          = לקרוא את השירים הכי מושמעים שלך
    // playlist-read-private  = לראות את הפלייליסטים שלך
    // playlist-modify-*      = לשנות פלייליסטים
    scope: 'user-top-read playlist-read-private playlist-modify-private playlist-modify-public',
    show_dialog: 'true',                               // תמיד להציג את מסך האישור
  });

  res.redirect('https://accounts.spotify.com/authorize?' + params.toString());
};
