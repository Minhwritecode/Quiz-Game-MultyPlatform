import crypto from 'node:crypto';

const KNOWN_AAGUIDS = {
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': { name: 'Google Password Manager' },
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': { name: 'iCloud Keychain (Apple Passkeys)' },
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': { name: 'iCloud Keychain Managed' },
  'adce0002-35bc-c60a-648b-0b25f1f05503': { name: 'Chrome on Mac Touch ID' },
  '08987058-cadc-4b81-b6e1-30de50dcbe96': { name: 'Windows Hello' },
  'bada5566-a7aa-401f-bd96-45619a55120d': { name: '1Password' },
  'd548826e-79b4-db40-a3d8-11116f7e8349': { name: 'Bitwarden' },
};

function resolveServerRpId(req) {
  if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID;
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost');
  const hostOnly = hostHeader.split(',')[0].trim().split(':')[0].toLowerCase();
  return hostOnly || 'localhost';
}

function toBase64Url(strOrBuf) {
  const buf = Buffer.isBuffer(strOrBuf) ? strOrBuf : Buffer.from(String(strOrBuf), 'utf8');
  return buf.toString('base64url');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rpId = resolveServerRpId(req);
  const action = req.query?.action || req.body?.action || 'auth-options';

  if (action === 'register-options') {
    const rawUserId = String(req.body?.userId || req.query?.userId || 'papyrus-scholar');
    const email = String(req.body?.email || 'scholar@papyrus.app');
    const displayName = String(req.body?.displayName || 'Học giả Papyrus');
    const excludeIds = Array.isArray(req.body?.excludeCredentialIds) ? req.body.excludeCredentialIds : [];
    const promotion = Boolean(req.body?.promotion);

    const challenge = toBase64Url(crypto.randomBytes(32));
    const userBase64UrlId = toBase64Url(rawUserId);

    return res.status(200).json({
      challenge,
      rp: { id: rpId, name: 'Papyrus Academy' },
      user: {
        id: userBase64UrlId,
        name: email,
        displayName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      excludeCredentials: excludeIds
        .filter((id) => typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id) && id.length % 4 !== 1)
        .map((id) => ({ type: 'public-key', id })),
      authenticatorSelection: {
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'preferred',
        ...(promotion ? { authenticatorAttachment: 'platform' } : {}),
      },
      timeout: 60000,
    });
  }

  if (action === 'auth-options') {
    const challenge = toBase64Url(crypto.randomBytes(32));
    return res.status(200).json({
      challenge,
      rpId,
      allowCredentials: [],
      userVerification: 'preferred',
      timeout: 60000,
    });
  }

  if (action === 'lookup-aaguid') {
    const aaguid = String(req.query?.aaguid || req.body?.aaguid || '').toLowerCase();
    if (!aaguid || aaguid === '00000000-0000-0000-0000-000000000000') {
      return res.status(200).json({ rpId, providerName: null });
    }
    return res.status(200).json({
      rpId,
      providerName: KNOWN_AAGUIDS[aaguid]?.name || null,
    });
  }

  return res.status(200).json({ rpId, ok: true });
}
