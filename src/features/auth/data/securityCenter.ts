import { Platform } from 'react-native';
import { supabase } from '@/core/network/supabase';
import { preferenceStorage } from '@/features/preferences/data/storage';

const DEVICE_ID_KEY = 'papyrus.security.device_id.v1';
const LOCAL_PASSKEYS_KEY = 'papyrus.security.passkeys_dir.v1';
const LOCAL_SECURITY_CACHE_KEY = 'papyrus.security.user_cache.v1';

export interface StoredPasskeyItem {
  id: string; // Valid unpadded Base64URL string
  passkeyUserId: string; // Valid unpadded Base64URL string
  userId: string;
  email: string;
  displayName: string;
  name: string;
  aaguid: string;
  credentialDeviceType: 'singleDevice' | 'multiDevice';
  credentialBackedUp: boolean;
  transports: string[];
  registeredAt: number;
  lastUsedAt?: number;
}

export interface DeviceSessionRecord {
  deviceId: string;
  deviceName: string;
  platformLabel: string;
  icon: 'phone-portrait-outline' | 'laptop-outline' | 'desktop-outline' | 'tablet-portrait-outline';
  timezone: string;
  lastActiveAt: string;
  createdAt: string;
  revoked?: boolean;
}

export interface UserSecuritySnapshot {
  rpId: string;
  passkeyUserId: string;
  passkeys: StoredPasskeyItem[];
  totpEnabled: boolean;
  totpFactorId?: string | null;
  totpBackupCodes?: string[];
  devices: DeviceSessionRecord[];
  currentDeviceId: string;
}

export function isValidBase64Url(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length % 4 !== 1 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function toUnpaddedBase64Url(input: string | Uint8Array): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : '';
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToUint8Array(b64url: string): Uint8Array {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const bin = typeof atob === 'function' ? atob(padded + '='.repeat(padLen)) : '';
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function randomBytes(len: number): Uint8Array {
  const arr = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

/**
 * Pure RFC-4648 Base32 encoder/decoder + RFC-6238 HMAC-SHA1 TOTP engine (works on Web & React Native!)
 */
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecretBase32(byteLen = 20): string {
  const bytes = randomBytes(byteLen);
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!;
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(secret: string): Uint8Array {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = B32_ALPHABET.indexOf(clean[i]!);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

// Compact pure-TS SHA-1 + HMAC-SHA1 for universal TOTP verification (including Jest / React Native without WebCrypto)
function sha1Bytes(msg: Uint8Array): Uint8Array {
  const ml = msg.length * 8;
  const withOne = msg.length + 1;
  const padLen = (56 - (withOne % 64) + 64) % 64;
  const total = withOne + padLen + 8;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[msg.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 4, ml >>> 0, false);
  view.setUint32(total - 8, Math.floor(ml / 0x100000000), false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);

  for (let offset = 0; offset < total; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 80; i++) {
      const n = w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!;
      w[i] = ((n << 1) | (n >>> 31)) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f = 0;
      let k = 0;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = ((((a << 5) | (a >>> 27)) >>> 0) + (f >>> 0) + e + k + w[i]!) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, h0, false);
  ov.setUint32(4, h1, false);
  ov.setUint32(8, h2, false);
  ov.setUint32(12, h3, false);
  ov.setUint32(16, h4, false);
  return out;
}

function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  const k = key.length > blockSize ? sha1Bytes(key) : key;
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(k);
  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = paddedKey[i]! ^ 0x5c;
    iKeyPad[i] = paddedKey[i]! ^ 0x36;
  }
  const inner = new Uint8Array(blockSize + message.length);
  inner.set(iKeyPad);
  inner.set(message, blockSize);
  const innerHash = sha1Bytes(inner);
  const outer = new Uint8Array(blockSize + 20);
  outer.set(oKeyPad);
  outer.set(innerHash, blockSize);
  return sha1Bytes(outer);
}

export function computeTotpCode(secretBase32: string, timestampMs = Date.now()): string {
  const key = decodeBase32(secretBase32);
  const counter = Math.floor(timestampMs / 30000);
  const counterBytes = new Uint8Array(8);
  const dv = new DataView(counterBytes.buffer);
  dv.setUint32(4, counter >>> 0, false);
  dv.setUint32(0, Math.floor(counter / 0x100000000), false);
  const hmac = hmacSha1(key, counterBytes);
  const offset = hmac[19]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpWindow(secretBase32: string, token: string): boolean {
  const clean = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean) || !secretBase32) return false;
  const now = Date.now();
  return (
    computeTotpCode(secretBase32, now) === clean ||
    computeTotpCode(secretBase32, now - 30000) === clean ||
    computeTotpCode(secretBase32, now + 30000) === clean
  );
}

// ── DEVICE FINGERPRINT & ACTIVE SESSIONS ──

export async function getOrCreateCurrentDeviceId(): Promise<string> {
  try {
    const existing = await preferenceStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = `dev-${toUnpaddedBase64Url(randomBytes(9))}`;
    await preferenceStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
    return 'dev-default-local';
  }
}

function detectDeviceDescriptor(): Omit<DeviceSessionRecord, 'deviceId' | 'lastActiveAt' | 'createdAt'> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
  if (Platform.OS === 'ios') {
    return { deviceName: 'iPhone / iPad (Ứng dụng iOS)', platformLabel: 'iOS Native', icon: 'phone-portrait-outline', timezone: tz };
  }
  if (Platform.OS === 'android') {
    return { deviceName: 'Điện thoại Android (Ứng dụng)', platformLabel: 'Android Native', icon: 'phone-portrait-outline', timezone: tz };
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIphone = /iPhone|iPod/i.test(ua);
  const isIpad = /iPad/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua);
  const isWin = /Windows/i.test(ua);

  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome\//i.test(ua) && !/Edg\//i.test(ua)
    ? 'Chrome'
    : /Firefox\//i.test(ua)
    ? 'Firefox'
    : /Safari\//i.test(ua)
    ? 'Safari'
    : 'Trình duyệt Web';

  if (isIphone) {
    return { deviceName: `iPhone · ${browser} iOS`, platformLabel: 'iOS Web / PWA', icon: 'phone-portrait-outline', timezone: tz };
  }
  if (isIpad) {
    return { deviceName: `iPad · ${browser}`, platformLabel: 'iPadOS Web', icon: 'tablet-portrait-outline', timezone: tz };
  }
  if (isAndroid) {
    return { deviceName: `Android · ${browser}`, platformLabel: 'Android Web / PWA', icon: 'phone-portrait-outline', timezone: tz };
  }
  if (isMac) {
    return { deviceName: `MacBook / Mac · ${browser}`, platformLabel: 'macOS Desktop', icon: 'laptop-outline', timezone: tz };
  }
  if (isWin) {
    return { deviceName: `Máy tính Windows · ${browser}`, platformLabel: 'Windows Desktop', icon: 'desktop-outline', timezone: tz };
  }
  return { deviceName: `Thiết bị Web · ${browser}`, platformLabel: 'Web App', icon: 'laptop-outline', timezone: tz };
}

interface CloudSecurityMeta {
  rpId?: string;
  passkeys?: StoredPasskeyItem[];
  totpEnabled?: boolean;
  totpSecret?: string;
  totpBackupCodes?: string[];
  devices?: DeviceSessionRecord[];
}

async function readCloudSecurityMeta(): Promise<{ userId: string; email: string; displayName: string; meta: CloudSecurityMeta } | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    if (!u) return null;
    const raw = (u.user_metadata?.papyrus_security as CloudSecurityMeta | undefined) ?? {};
    const displayName =
      (u.user_metadata?.full_name as string | undefined) ||
      (u.email ? u.email.split('@')[0]! : 'Học giả Papyrus');
    return { userId: u.id, email: u.email || '', displayName, meta: raw };
  } catch {
    return null;
  }
}

async function writeCloudSecurityMeta(userId: string, patch: Partial<CloudSecurityMeta>): Promise<CloudSecurityMeta> {
  const current = await readCloudSecurityMeta();
  const merged: CloudSecurityMeta = {
    ...(current?.meta ?? {}),
    ...patch,
  };
  try {
    await preferenceStorage.setItem(`${LOCAL_SECURITY_CACHE_KEY}.${userId}`, JSON.stringify(merged));
  } catch {
    // Ignore
  }
  if (supabase) {
    await supabase.auth
      .updateUser({ data: { papyrus_security: merged } })
      .catch(() => undefined);
  }
  return merged;
}

export async function touchCurrentDeviceSession(): Promise<{ revoked: boolean; devices: DeviceSessionRecord[] }> {
  const currentDeviceId = await getOrCreateCurrentDeviceId();
  const cloud = await readCloudSecurityMeta();
  if (!cloud) return { revoked: false, devices: [] };

  const existingList = Array.isArray(cloud.meta.devices) ? cloud.meta.devices : [];
  const mine = existingList.find((d) => d.deviceId === currentDeviceId);
  if (mine?.revoked) {
    return { revoked: true, devices: existingList.filter((d) => !d.revoked) };
  }

  const desc = detectDeviceDescriptor();
  const nowIso = new Date().toISOString();
  const updatedDevice: DeviceSessionRecord = {
    deviceId: currentDeviceId,
    deviceName: desc.deviceName,
    platformLabel: desc.platformLabel,
    icon: desc.icon,
    timezone: desc.timezone,
    createdAt: mine?.createdAt || nowIso,
    lastActiveAt: nowIso,
    revoked: false,
  };

  const others = existingList.filter((d) => d.deviceId !== currentDeviceId).slice(0, 12);
  const nextDevices = [updatedDevice, ...others];
  await writeCloudSecurityMeta(cloud.userId, { devices: nextDevices });
  return { revoked: false, devices: nextDevices.filter((d) => !d.revoked) };
}

export async function revokeDeviceSession(targetDeviceId: string): Promise<DeviceSessionRecord[]> {
  const cloud = await readCloudSecurityMeta();
  if (!cloud) return [];
  const list = Array.isArray(cloud.meta.devices) ? cloud.meta.devices : [];
  const next = list.map((d) => (d.deviceId === targetDeviceId ? { ...d, revoked: true } : d));
  await writeCloudSecurityMeta(cloud.userId, { devices: next });
  return next.filter((d) => !d.revoked);
}

export async function revokeAllOtherDeviceSessions(): Promise<DeviceSessionRecord[]> {
  const currentDeviceId = await getOrCreateCurrentDeviceId();
  const cloud = await readCloudSecurityMeta();
  if (!cloud) return [];
  if (supabase) {
    await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
  }
  const list = Array.isArray(cloud.meta.devices) ? cloud.meta.devices : [];
  const next = list.map((d) => (d.deviceId === currentDeviceId ? d : { ...d, revoked: true }));
  await writeCloudSecurityMeta(cloud.userId, { devices: next });
  return next.filter((d) => !d.revoked);
}

// ── WEBAUTHN PASSKEYS (STRICT MODERN WEB GUIDANCE COMPLIANCE) ──

export async function isPlatformPasskeyAvailable(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  const pkc = window.PublicKeyCredential as unknown as {
    getClientCapabilities?: () => Promise<Record<string, boolean>>;
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  };
  if (typeof pkc.getClientCapabilities === 'function') {
    try {
      const caps = await pkc.getClientCapabilities();
      return Boolean(caps.passkeyPlatformAuthenticator || caps.conditionalGet);
    } catch {
      return false;
    }
  }
  if (typeof pkc.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      return await pkc.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
  return false;
}

async function fetchWebAuthnApi(body: Record<string, unknown>): Promise<Record<string, any> | null> {
  try {
    const res = await fetch('/api/webauthn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      return (await res.json()) as Record<string, any>;
    }
  } catch {
    // Local Expo dev server fallback when /api/webauthn isn't mounted locally
  }
  return null;
}

/**
 * Synchronizes accepted credentials with OS/Browser Password Managers via WebAuthn Signal API.
 * Strictly uses server-provided rpId and validates unpadded Base64URL strings.
 */
export async function syncAcceptedPasskeysSignal(
  serverRpId: string,
  passkeyUserId: string,
  credentials: StoredPasskeyItem[]
): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.PublicKeyCredential) return;
  const pkc = window.PublicKeyCredential as unknown as {
    signalAllAcceptedCredentials?: (opts: {
      rpId: string;
      userId: string;
      allAcceptedCredentialIds: string[];
    }) => Promise<void>;
  };
  if (typeof pkc.signalAllAcceptedCredentials !== 'function') return;

  const ids = credentials.map((c) => c.id);
  if (!serverRpId || !isValidBase64Url(passkeyUserId) || !ids.every(isValidBase64Url)) {
    console.warn('SignalAllAcceptedCredentials skipped: valid server rpId and unpadded Base64URL IDs required.');
    return;
  }
  try {
    await pkc.signalAllAcceptedCredentials({
      rpId: serverRpId,
      userId: passkeyUserId,
      allAcceptedCredentialIds: ids,
    });
  } catch (err) {
    console.warn('SignalAllAcceptedCredentials sync warning:', err);
  }
}

export async function syncCurrentUserDetailsSignal(
  serverRpId: string,
  passkeyUserId: string,
  email: string,
  displayName: string
): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.PublicKeyCredential) return;
  const pkc = window.PublicKeyCredential as unknown as {
    signalCurrentUserDetails?: (opts: {
      rpId: string;
      userId: string;
      name: string;
      displayName: string;
    }) => Promise<void>;
  };
  if (typeof pkc.signalCurrentUserDetails !== 'function') return;
  if (!serverRpId || !isValidBase64Url(passkeyUserId)) return;
  try {
    await pkc.signalCurrentUserDetails({
      rpId: serverRpId,
      userId: passkeyUserId,
      name: email,
      displayName,
    });
  } catch (err) {
    console.warn('SignalCurrentUserDetails sync warning:', err);
  }
}

export async function loadUserSecuritySnapshot(): Promise<UserSecuritySnapshot | null> {
  const currentDeviceId = await getOrCreateCurrentDeviceId();
  const cloud = await readCloudSecurityMeta();
  if (!cloud) return null;

  const apiInfo = await fetchWebAuthnApi({ action: 'lookup-aaguid', aaguid: '' });
  const serverRpId = String(apiInfo?.rpId || cloud.meta.rpId || 'papyrus-lyart-five.vercel.app');
  const passkeyUserId = toUnpaddedBase64Url(cloud.userId);
  const passkeys = (cloud.meta.passkeys ?? []).filter((p) => isValidBase64Url(p.id));
  const devices = (cloud.meta.devices ?? []).filter((d) => !d.revoked);

  let totpEnabled = Boolean(cloud.meta.totpEnabled);
  let totpFactorId: string | null = null;

  if (supabase) {
    try {
      const { data: mfaList } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = mfaList?.totp?.find((f) => f.status === 'verified');
      if (verifiedTotp) {
        totpEnabled = true;
        totpFactorId = verifiedTotp.id;
      }
    } catch {
      // Use cloud metadata TOTP state
    }
  }

  void syncAcceptedPasskeysSignal(serverRpId, passkeyUserId, passkeys);

  return {
    rpId: serverRpId,
    passkeyUserId,
    passkeys,
    totpEnabled,
    totpFactorId,
    totpBackupCodes: cloud.meta.totpBackupCodes ?? [],
    devices,
    currentDeviceId,
  };
}

export async function registerNewPasskey(customNickname?: string): Promise<{ ok: boolean; message: string; credential?: StoredPasskeyItem }> {
  if (!(await isPlatformPasskeyAvailable())) {
    return {
      ok: false,
      message: 'Thiết bị hoặc trình duyệt hiện tại chưa hỗ trợ Passkey sinh trắc học (Face ID / Touch ID / Windows Hello). Hãy bật 2FA bên dưới!',
    };
  }
  const cloud = await readCloudSecurityMeta();
  if (!cloud) {
    return { ok: false, message: 'Vui lòng đăng nhập tài khoản trước khi đăng ký Passkey.' };
  }

  const existing = (cloud.meta.passkeys ?? []).filter((p) => isValidBase64Url(p.id));
  const serverJson = await fetchWebAuthnApi({
    action: 'register-options',
    userId: cloud.userId,
    email: cloud.email,
    displayName: cloud.displayName,
    excludeCredentialIds: existing.map((c) => c.id),
    promotion: false,
  });

  const creationOptionsJSON = serverJson ?? {
    challenge: toUnpaddedBase64Url(randomBytes(32)),
    rp: { id: 'localhost', name: 'Papyrus Academy' },
    user: {
      id: toUnpaddedBase64Url(cloud.userId),
      name: cloud.email || 'scholar@papyrus.app',
      displayName: cloud.displayName,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    excludeCredentials: existing.map((c) => ({ type: 'public-key', id: c.id })),
    authenticatorSelection: {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'preferred',
    },
  };

  const serverRpId = String(creationOptionsJSON.rp?.id || 'papyrus-lyart-five.vercel.app');
  const pkcStatic = window.PublicKeyCredential as unknown as {
    parseCreationOptionsFromJSON?: (json: any) => PublicKeyCredentialCreationOptions;
    signalUnknownCredential?: (opts: { rpId: string; credentialId: string }) => Promise<void>;
  };

  const publicKey: PublicKeyCredentialCreationOptions =
    typeof pkcStatic.parseCreationOptionsFromJSON === 'function'
      ? pkcStatic.parseCreationOptionsFromJSON(creationOptionsJSON)
      : {
          rp: creationOptionsJSON.rp ?? { id: serverRpId, name: 'Papyrus Academy' },
          pubKeyCredParams: creationOptionsJSON.pubKeyCredParams ?? [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: creationOptionsJSON.authenticatorSelection,
          challenge: base64UrlToUint8Array(String(creationOptionsJSON.challenge)).buffer as ArrayBuffer,
          user: {
            id: base64UrlToUint8Array(String(creationOptionsJSON.user?.id ?? cloud.userId)).buffer as ArrayBuffer,
            name: String(creationOptionsJSON.user?.name ?? cloud.email ?? 'scholar@papyrus.app'),
            displayName: String(creationOptionsJSON.user?.displayName ?? cloud.displayName),
          },
          excludeCredentials: (creationOptionsJSON.excludeCredentials ?? []).map((c: { id: string }) => ({
            type: 'public-key' as const,
            id: base64UrlToUint8Array(String(c.id)).buffer as ArrayBuffer,
          })),
        };

  let credential: PublicKeyCredential | null = null;
  try {
    credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  } catch (err: any) {
    if (err?.name === 'InvalidStateError') {
      return { ok: false, message: 'Thiết bị này đã có sẵn một Passkey cho tài khoản của bạn.' };
    }
    if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
      return { ok: false, message: 'Đã hủy thao tác tạo Passkey.' };
    }
    if (err?.name === 'SecurityError') {
      return { ok: false, message: 'Passkey yêu cầu kết nối HTTPS chính thức (hoặc localhost).' };
    }
    return { ok: false, message: 'Không thể khởi tạo Passkey trên thiết bị này.' };
  }

  if (!credential) {
    return { ok: false, message: 'Không nhận được phản hồi Passkey.' };
  }

  const credWithJson = credential as PublicKeyCredential & { toJSON?: () => Record<string, any> };
  const encoded =
    typeof credWithJson.toJSON === 'function'
      ? credWithJson.toJSON()
      : { id: toUnpaddedBase64Url(new Uint8Array(credential.rawId)) };

  const credId = isValidBase64Url(encoded.id)
    ? encoded.id
    : toUnpaddedBase64Url(new Uint8Array(credential.rawId));

  const desc = detectDeviceDescriptor();
  const newPasskey: StoredPasskeyItem = {
    id: credId,
    passkeyUserId: toUnpaddedBase64Url(cloud.userId),
    userId: cloud.userId,
    email: cloud.email,
    displayName: cloud.displayName,
    name: customNickname?.trim() || `Passkey trên ${desc.deviceName}`,
    aaguid: '00000000-0000-0000-0000-000000000000',
    credentialDeviceType: 'multiDevice',
    credentialBackedUp: true,
    transports: ['internal', 'hybrid'],
    registeredAt: Date.now(),
    lastUsedAt: Date.now(),
  };

  try {
    const nextList = [newPasskey, ...existing.filter((p) => p.id !== credId)];
    await writeCloudSecurityMeta(cloud.userId, { rpId: serverRpId, passkeys: nextList });

    // Also store in local device passkey directory so 1-tap Passkey Sign-In works immediately!
    const rawDir = await preferenceStorage.getItem(LOCAL_PASSKEYS_KEY);
    const dir: StoredPasskeyItem[] = rawDir ? JSON.parse(rawDir) : [];
    const nextDir = [newPasskey, ...dir.filter((d) => d.id !== credId)].slice(0, 20);
    await preferenceStorage.setItem(LOCAL_PASSKEYS_KEY, JSON.stringify(nextDir));

    await syncAcceptedPasskeysSignal(serverRpId, newPasskey.passkeyUserId, nextList);
    return { ok: true, message: `✅ Đã đăng ký "${newPasskey.name}" thành công!`, credential: newPasskey };
  } catch {
    if (typeof pkcStatic.signalUnknownCredential === 'function') {
      await pkcStatic
        .signalUnknownCredential({ rpId: serverRpId, credentialId: credId })
        .catch((e) => console.warn('signalUnknownCredential warning:', e));
    }
    return { ok: false, message: 'Không thể lưu Passkey lên đám mây lúc này.' };
  }
}

export async function deleteRegisteredPasskey(credentialId: string): Promise<StoredPasskeyItem[]> {
  const cloud = await readCloudSecurityMeta();
  if (!cloud) return [];
  const serverRpId = cloud.meta.rpId || 'papyrus-lyart-five.vercel.app';
  const next = (cloud.meta.passkeys ?? []).filter((p) => p.id !== credentialId);
  await writeCloudSecurityMeta(cloud.userId, { passkeys: next });

  try {
    const rawDir = await preferenceStorage.getItem(LOCAL_PASSKEYS_KEY);
    if (rawDir) {
      const dir = (JSON.parse(rawDir) as StoredPasskeyItem[]).filter((d) => d.id !== credentialId);
      await preferenceStorage.setItem(LOCAL_PASSKEYS_KEY, JSON.stringify(dir));
    }
  } catch {
    // Ignore
  }

  await syncAcceptedPasskeysSignal(serverRpId, toUnpaddedBase64Url(cloud.userId), next);
  return next;
}

export async function renameRegisteredPasskey(credentialId: string, newName: string): Promise<StoredPasskeyItem[]> {
  const cloud = await readCloudSecurityMeta();
  if (!cloud) return [];
  const trimmed = newName.trim();
  if (!trimmed) return cloud.meta.passkeys ?? [];
  const next = (cloud.meta.passkeys ?? []).map((p) =>
    p.id === credentialId ? { ...p, name: trimmed } : p
  );
  await writeCloudSecurityMeta(cloud.userId, { passkeys: next });
  return next;
}

let activePasskeyAbort: AbortController | null = null;

export async function authenticateWithPasskeyButton(): Promise<{
  ok: boolean;
  user?: { id: string; email: string; displayName: string };
  message?: string;
}> {
  if (!(await isPlatformPasskeyAvailable())) {
    return { ok: false, message: 'Trình duyệt/thiết bị này chưa hỗ trợ đăng nhập bằng Passkey.' };
  }

  // Abort any ongoing Conditional Get before triggering explicit Passkey prompt
  activePasskeyAbort?.abort();
  activePasskeyAbort = new AbortController();

  const serverJson = await fetchWebAuthnApi({ action: 'auth-options' });
  const requestOptionsJSON = serverJson ?? {
    challenge: toUnpaddedBase64Url(randomBytes(32)),
    rpId: 'localhost',
    allowCredentials: [],
    userVerification: 'preferred',
  };
  const serverRpId = String(requestOptionsJSON.rpId || 'papyrus-lyart-five.vercel.app');

  const pkcStatic = window.PublicKeyCredential as unknown as {
    parseRequestOptionsFromJSON?: (json: any) => PublicKeyCredentialRequestOptions;
    signalUnknownCredential?: (opts: { rpId: string; credentialId: string }) => Promise<void>;
  };

  const publicKey: PublicKeyCredentialRequestOptions =
    typeof pkcStatic.parseRequestOptionsFromJSON === 'function'
      ? pkcStatic.parseRequestOptionsFromJSON(requestOptionsJSON)
      : {
          rpId: serverRpId,
          userVerification: 'preferred',
          challenge: base64UrlToUint8Array(String(requestOptionsJSON.challenge)).buffer as ArrayBuffer,
          allowCredentials: [],
        };

  let assertion: PublicKeyCredential | null = null;
  try {
    assertion = (await navigator.credentials.get({
      publicKey,
      signal: activePasskeyAbort.signal,
    })) as PublicKeyCredential | null;
  } catch (err: any) {
    if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
      return { ok: false, message: 'Đã hủy xác thực Passkey.' };
    }
    return { ok: false, message: 'Chưa tìm thấy Passkey đã lưu trên thiết bị này. Hãy đăng nhập bằng mật khẩu và tạo Passkey trong Cài đặt!' };
  }

  if (!assertion) {
    return { ok: false, message: 'Không nhận được thông tin xác thực Passkey.' };
  }

  const assertionWithJson = assertion as PublicKeyCredential & { toJSON?: () => Record<string, any> };
  const encoded =
    typeof assertionWithJson.toJSON === 'function'
      ? assertionWithJson.toJSON()
      : { id: toUnpaddedBase64Url(new Uint8Array(assertion.rawId)) };
  const credId = isValidBase64Url(encoded.id)
    ? encoded.id
    : toUnpaddedBase64Url(new Uint8Array(assertion.rawId));

  const rawDir = await preferenceStorage.getItem(LOCAL_PASSKEYS_KEY);
  const dir: StoredPasskeyItem[] = rawDir ? JSON.parse(rawDir) : [];
  const matched = dir.find((d) => d.id === credId);

  if (!matched) {
    if (typeof pkcStatic.signalUnknownCredential === 'function') {
      await pkcStatic
        .signalUnknownCredential({ rpId: serverRpId, credentialId: credId })
        .catch((e) => console.warn('signalUnknownCredential warning:', e));
    }
    return {
      ok: false,
      message: 'Passkey này chưa được liên kết với phiên trên trình duyệt hiện tại. Vui lòng đăng nhập bằng Email một lần để đồng bộ!',
    };
  }

  return {
    ok: true,
    user: {
      id: matched.userId,
      email: matched.email,
      displayName: matched.displayName,
    },
  };
}

// ── 2FA (TOTP AUTHENTICATOR + BACKUP CODES) ──

export interface PendingTotpEnrollment {
  mode: 'supabase-mfa' | 'rfc6238-cloud';
  factorId?: string;
  secret: string;
  otpauthUri: string;
}

export async function beginTotpEnrollment(): Promise<PendingTotpEnrollment> {
  const cloud = await readCloudSecurityMeta();
  const email = cloud?.email || 'scholar@papyrus.app';

  if (supabase) {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Papyrus (${new Date().toISOString().slice(0, 10)})`,
      });
      if (!error && data?.totp?.secret && data?.totp?.uri) {
        return {
          mode: 'supabase-mfa',
          factorId: data.id,
          secret: data.totp.secret,
          otpauthUri: data.totp.uri,
        };
      }
    } catch {
      // Fallback to built-in RFC-6238 cloud TOTP
    }
  }

  const secret = generateTotpSecretBase32(20);
  const label = encodeURIComponent(`Papyrus:${email}`);
  const otpauthUri = `otpauth://totp/${label}?secret=${secret}&issuer=Papyrus&algorithm=SHA1&digits=6&period=30`;
  return {
    mode: 'rfc6238-cloud',
    secret,
    otpauthUri,
  };
}

export async function confirmTotpEnrollment(
  enrollment: PendingTotpEnrollment,
  code: string
): Promise<{ ok: boolean; backupCodes?: string[]; message: string }> {
  const clean = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) {
    return { ok: false, message: 'Vui lòng nhập đúng mã gồm 6 chữ số từ ứng dụng Authenticator.' };
  }

  const cloud = await readCloudSecurityMeta();
  if (!cloud) {
    return { ok: false, message: 'Phiên đăng nhập không hợp lệ.' };
  }

  if (enrollment.mode === 'supabase-mfa' && enrollment.factorId && supabase) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: clean,
    });
    if (error) {
      return { ok: false, message: 'Mã xác thực 6 số chưa chính xác hoặc đã hết hạn 30 giây.' };
    }
  } else {
    if (!verifyTotpWindow(enrollment.secret, clean)) {
      return { ok: false, message: 'Mã xác thực 6 số chưa khớp. Hãy kiểm tra giờ điện thoại và nhập mã mới nhất!' };
    }
  }

  const backupCodes = Array.from({ length: 4 }, () =>
    String(100000 + (randomBytes(3)[0]! * 3511 + randomBytes(2)[1]! * 97) % 900000)
  );

  await writeCloudSecurityMeta(cloud.userId, {
    totpEnabled: true,
    totpSecret: enrollment.secret,
    totpBackupCodes: backupCodes,
  });

  return {
    ok: true,
    backupCodes,
    message: '🛡️ Đã bật Bảo mật 2 lớp (2FA Authenticator) thành công!',
  };
}

export async function disableTotp2FA(): Promise<boolean> {
  const cloud = await readCloudSecurityMeta();
  if (!cloud) return false;
  if (supabase) {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      for (const f of data?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => undefined);
      }
    } catch {
      // Ignore
    }
  }
  await writeCloudSecurityMeta(cloud.userId, {
    totpEnabled: false,
    totpSecret: '',
    totpBackupCodes: [],
  });
  return true;
}

export async function checkSignInRequires2FA(): Promise<{ required: boolean; factorId?: string }> {
  if (supabase) {
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2') {
        const factors = await supabase.auth.mfa.listFactors();
        const verified = factors.data?.totp?.find((f) => f.status === 'verified');
        if (verified) return { required: true, factorId: verified.id };
      }
    } catch {
      // Check cloud metadata TOTP
    }
  }
  const cloud = await readCloudSecurityMeta();
  if (cloud?.meta.totpEnabled && cloud?.meta.totpSecret) {
    return { required: true };
  }
  return { required: false };
}

export async function verifySignIn2FACode(code: string, factorId?: string): Promise<{ ok: boolean; message?: string }> {
  const clean = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) {
    return { ok: false, message: 'Vui lòng nhập mã xác thực 6 chữ số.' };
  }

  if (factorId && supabase) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
    if (!error) return { ok: true };
  }

  const cloud = await readCloudSecurityMeta();
  if (cloud?.meta.totpSecret && verifyTotpWindow(cloud.meta.totpSecret, clean)) {
    return { ok: true };
  }
  if (cloud?.meta.totpBackupCodes?.includes(clean)) {
    const remaining = cloud.meta.totpBackupCodes.filter((c) => c !== clean);
    await writeCloudSecurityMeta(cloud.userId, { totpBackupCodes: remaining });
    return { ok: true };
  }

  return { ok: false, message: 'Mã xác thực 2FA không đúng. Hãy nhập mã 6 số hiện tại trên ứng dụng Authenticator hoặc mã dự phòng!' };
}
