import { useState } from "react";
import { useCart } from "@numueg/theme-sdk";

/**
 * Coupon / discount-code input wired to the live cart. Applies via the SDK's
 * `applyDiscount` (which re-fetches the cart with the dashboard-computed
 * discount); once a code is on the cart it shows an "applied" chip with a
 * remove action. Shared by the cart drawer and the full cart page.
 */
export function CouponForm({ compact = false }: { compact?: boolean }) {
  const { cart, applyDiscount, removeDiscount, loading } = useCart();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applied = cart?.discount_code;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (!value || busy || loading) return;
    setError(null);
    setBusy(true);
    try {
      await applyDiscount(value);
      setCode("");
    } catch {
      setError("تعذّر تطبيق الكود. تأكد من صحته وحاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || loading) return;
    setBusy(true);
    try {
      await removeDiscount();
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    return (
      <div className={`nt-coupon nt-coupon--applied${compact ? " is-compact" : ""}`}>
        <span className="nt-coupon__tag">
          كود الخصم: <strong>{applied}</strong>
        </span>
        <button
          type="button"
          className="nt-coupon__remove"
          onClick={remove}
          disabled={busy || loading}
        >
          إزالة
        </button>
      </div>
    );
  }

  return (
    <form
      className={`nt-coupon${compact ? " is-compact" : ""}`}
      onSubmit={submit}
    >
      <div className="nt-coupon__row">
        <input
          className="nt-input"
          type="text"
          value={code}
          placeholder="كود الخصم"
          aria-label="كود الخصم"
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
        />
        <button
          className="nt-btn-outline"
          type="submit"
          disabled={busy || loading || !code.trim()}
        >
          {busy ? "..." : "تطبيق"}
        </button>
      </div>
      {error ? <p className="nt-coupon__err">{error}</p> : null}
    </form>
  );
}
