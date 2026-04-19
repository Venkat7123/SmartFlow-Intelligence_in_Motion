// ──────────────────────────────────────────────
//  Middleware: authenticate
//  Verifies Firebase Auth ID token on every
//  protected route. Attaches decoded user to req.
// ──────────────────────────────────────────────
const { auth } = require('../config/firebase');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized – missing Bearer token' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decoded = await auth.verifyIdToken(idToken);
    req.user = decoded; // { uid, email, name, ... }
    next();
  } catch (err) {
    console.error('[authenticate]', err.message);
    return res.status(403).json({ error: 'Forbidden – invalid or expired token' });
  }
}

module.exports = authenticate;
