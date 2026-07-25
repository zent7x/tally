const _enc = new TextEncoder();
const _dec = new TextDecoder();

function _b64(buf: ArrayBuffer | ArrayBufferView): string {
  const b = new Uint8Array(buf as ArrayBuffer);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

function _unb64(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export async function deriveKey(
  pass: string,
  salt: BufferSource,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    _enc.encode(pass),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptWith(
  key: CryptoKey,
  salt: BufferSource,
  obj: unknown,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    _enc.encode(JSON.stringify(obj)),
  );
  return JSON.stringify({
    v: 1,
    enc: true,
    salt: _b64(salt),
    iv: _b64(iv),
    ct: _b64(ct),
  });
}

export async function decryptWith<T = unknown>(
  key: CryptoKey,
  envelope: { iv: string; ct: string },
): Promise<T> {
  const iv = _unb64(envelope.iv);
  const ct = _unb64(envelope.ct);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return JSON.parse(_dec.decode(pt)) as T;
}

export function isEncryptedEnvelope(value: unknown): value is {
  v: number;
  enc: true;
  salt: string;
  iv: string;
  ct: string;
} {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.enc === true && typeof v.salt === "string" && typeof v.iv === "string" && typeof v.ct === "string";
}

export function envelopeSalt(envelope: { salt: string }): Uint8Array {
  return _unb64(envelope.salt);
}

export { _b64, _unb64 };
