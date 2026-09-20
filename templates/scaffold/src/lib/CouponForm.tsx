import { useDiscountCode } from "@numueg/theme-sdk";

/**
 * Coupon / discount-code input wired to the live cart. The apply/remove state
 * machine is the SDK's `useDiscountCode`, so this file is markup.
 *
 * Writing that state by hand is how every existing theme got it wrong: the
 * SDK's `applyDiscount` REPORTS a rejection (`{ ok: false, message }`) rather
 * than throwing, so a `try/catch` around it never fires and a wrong code
 * clears the input while saying nothing at all — which a shopper reads as
 * "this store's codes don't work". `error` below is the backend's own
 * reason ("This coupon has expired", "does not apply to this cart").
 */
export function CouponForm({ compact = false }: { compact?: boolean }) {
  const { code, setCode, applied, busy, error, submit, remove } = useDiscountCode(
    "تعذّر تطبيق الكود. تأكد من صحته وحاول مرة أخرى.",
  );

  if (applied) {
    return (
      <div className={`nt-coupon nt-coupon--applied${compact ? " is-compact" : ""}`}>
        <span className="nt-coupon__tag">
          كود الخصم: <strong>{applied}</strong>
        </span>
        <button
          type="button"
          className="nt-coupon__remove"
          onClick={() => void remove()}
          disabled={busy}
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
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          className="nt-btn-outline"
          type="submit"
          disabled={busy || !code.trim()}
        >
          {busy ? "..." : "تطبيق"}
        </button>
      </div>
      {error ? <p className="nt-coupon__err">{error}</p> : null}
    </form>
  );
}
