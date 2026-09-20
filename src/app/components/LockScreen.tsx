import { Lock } from "lucide-react";
import { useState } from "react";
import { decryptWith, deriveKey, envelopeSalt } from "@/lib/finance/crypto";
import { migrate } from "@/lib/finance/storage";
import type { EncryptedEnvelope, FinanceState } from "@/lib/finance/types";
import logoUrl from "@/assets/logo/tally-icon.svg";

export interface LockScreenProps {
  envelope: EncryptedEnvelope;
  onUnlock: (state: FinanceState, key: CryptoKey, salt: BufferSource) => void;
  onErase: () => void;
}

export function LockScreen({ envelope, onUnlock, onErase }: LockScreenProps) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const tryUnlock = async () => {
    if (!passphrase || busy) return;
    setBusy(true);
    setError("");
    try {
      const salt = envelopeSalt(envelope);
      const key = await deriveKey(passphrase, salt as BufferSource);
      const raw = await decryptWith<FinanceState>(key, envelope);
      onUnlock(migrate(raw), key, salt as BufferSource);
      setPassphrase("");
    } catch {
      setError("Wrong passphrase — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-5">
      <div className="panel w-full max-w-sm p-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2 text-lg font-semibold">
          <img src={logoUrl} alt="" width={26} height={26} className="rounded-md" />
          Tally
        </div>
        <div className="mb-3 flex justify-center" style={{ color: "var(--accent)" }}>
          <Lock size={22} aria-hidden />
        </div>
        <p className="mb-5 text-sm" style={{ color: "var(--muted)" }}>
          Your Tally data is encrypted. Enter your passphrase to unlock it.
        </p>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => {
            setPassphrase(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void tryUnlock();
          }}
          placeholder="passphrase"
          autoComplete="current-password"
          aria-label="Passphrase"
          className="mb-2 w-full rounded-lg border px-3 py-2.5 text-center text-sm outline-none focus:ring-2"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
          }}
        />
        {error ? (
          <p className="mb-2 min-h-4 text-xs" style={{ color: "#b23423" }} role="alert">
            {error}
          </p>
        ) : (
          <div className="mb-2 min-h-4" />
        )}
        <button
          type="button"
          className="btn w-full"
          disabled={busy}
          onClick={() => void tryUnlock()}
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        <button
          type="button"
          className="ghost mt-4 text-xs"
          onClick={() => {
            if (window.confirm("Erase encrypted data and start over? This cannot be undone.")) {
              onErase();
            }
          }}
        >
          Forgot passphrase? Erase & start over
        </button>
      </div>
    </div>
  );
}
