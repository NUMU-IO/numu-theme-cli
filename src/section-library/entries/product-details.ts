import type { SectionLibraryEntry } from "../index";

export const productDetails: SectionLibraryEntry = {
  slug: "product-details",
  name: "Product Details",
  description:
    "PDP buy box: gallery, variant/size pickers (size-chart aware) that gate add-to-cart",
  component: `import { useState } from "react";
import type { SectionProps } from "@numueg/theme-sdk";
import {
  useProductOptional,
  useVariantSelection,
  useProductSizeChart,
  useCart,
  useLocalization,
  useShop,
  useLocale,
  defaultVariant,
} from "@numueg/theme-sdk";

// Bilingual AR/EN text without a shared import (keeps the snippet forkable).
function useT() {
  const locale = useLocale();
  const isAr =
    typeof locale === "string" && locale.toLowerCase().startsWith("ar");
  return (en: string, ar: string) => (isAr ? ar : en);
}
// Coerce API money (often string-decimals) before any math.
const toNum = (v: unknown) => Number(v) || 0;

/**
 * Product detail buy box. Renders the variant picker from real option axes
 * when present; otherwise derives required size buttons from the product's
 * size chart (common single-SKU case) and gates add-to-cart on a size pick —
 * recording the chosen size on the cart note so the merchant fulfils it.
 */
export default function ProductDetails({ settings }: SectionProps) {
  const t = useT();
  const product = useProductOptional();
  const { cart, addItem, updateNote } = useCart();
  const { formatMoney } = useLocalization();
  const shop = useShop();
  const chart = useProductSizeChart();
  const [qty, setQty] = useState(1);
  const [pickedSize, setPickedSize] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  const variantSel = useVariantSelection(
    product ?? { options: [], variants: [] },
    { autoSelect: true },
  );

  if (!product) {
    return (
      <section className="py-16 px-6 text-center text-gray-500">
        {t("Product not found.", "لم يتم العثور على المنتج.")}
      </section>
    );
  }

  const opts = product.options ?? [];
  const variants = product.variants ?? [];
  const hasOptions = opts.length > 0;
  const { selection, variant, select, availability, isComplete } = variantSel;

  const chartSizes = (chart?.rows ?? [])
    .map((r) => r.size)
    .filter((sz): sz is string => Boolean(sz));
  const needsSize = !hasOptions && variants.length <= 1 && chartSizes.length > 0;

  const activeVariant = hasOptions
    ? variant
    : (defaultVariant(product) ?? variants[0] ?? null);
  const currency = product.currency || shop?.currency;
  const price = toNum(activeVariant?.price ?? product.price);
  const images = product.images ?? [];
  const productName = product.name;
  const productId = product.id;

  // Cap the quantity stepper to the selected variant's stock (the backend
  // enforces this too). No per-variant stock ⇒ unbounded.
  const stockCap =
    activeVariant && typeof activeVariant.inventory_quantity === "number"
      ? Math.max(0, activeVariant.inventory_quantity)
      : Infinity;
  const maxQty = stockCap === Infinity ? Infinity : Math.max(1, stockCap);

  const purchasable =
    product.in_stock &&
    (activeVariant?.is_in_stock ?? true) &&
    (hasOptions ? isComplete : true) &&
    (needsSize ? Boolean(pickedSize) : true);

  async function handleAdd() {
    if (pending || !purchasable) return;
    setPending(true);
    try {
      if (needsSize && pickedSize) {
        const prefix = "• " + productName + " — ";
        const tag = prefix + t("Size", "المقاس") + ": ";
        const prev = cart?.note ?? "";
        const kept = prev
          .split("\\n")
          .filter((line) => line && !line.startsWith(prefix))
          .join("\\n");
        await updateNote((kept ? kept + "\\n" : "") + tag + pickedSize);
      }
      await addItem(productId, activeVariant?.id, Math.min(qty, maxQty));
    } finally {
      setPending(false);
    }
  }

  const box =
    "min-w-[3rem] h-12 px-3 inline-flex items-center justify-center border rounded-md text-sm font-medium";
  const boxActive = "bg-black text-white border-black";

  return (
    <section className="py-10 px-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
      <div>
        {images[0] ? (
          <img
            src={images[0].url}
            alt={images[0].alt || productName}
            className="w-full aspect-square object-cover rounded-lg bg-gray-100"
          />
        ) : (
          <div className="w-full aspect-square rounded-lg bg-gray-100" />
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-2">{productName}</h1>
        <p className="text-xl font-semibold mb-6">
          {formatMoney(price, currency)}
        </p>

        {opts.map((opt) => (
          <div key={opt.name} className="mb-5">
            <span className="block text-sm font-semibold mb-2">{opt.name}</span>
            <div className="flex flex-wrap gap-2">
              {opt.values.map((value) => {
                const sel = selection[opt.name] === value;
                const reachable = availability[opt.name]?.has(value) ?? true;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={!reachable && !sel}
                    onClick={() => select(opt.name, value)}
                    className={box + (sel ? " " + boxActive : "") + (!reachable && !sel ? " opacity-40 line-through" : "")}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {needsSize ? (
          <div className="mb-5">
            <span className="block text-sm font-semibold mb-2">
              {t("Size", "المقاس")}
            </span>
            <div className="flex flex-wrap gap-2">
              {chartSizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setPickedSize(sz)}
                  className={box + (pickedSize === sz ? " " + boxActive : "")}
                >
                  {sz}
                </button>
              ))}
            </div>
            {!pickedSize ? (
              <p className="text-xs text-red-600 mt-2">
                {t("Please select a size", "اختر المقاس من فضلك")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm font-semibold">{t("Quantity", "الكمية")}</span>
          <div className="inline-flex items-center border rounded-md">
            <button type="button" className="px-3 py-2 disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="px-3">{Math.min(qty, maxQty)}</span>
            <button type="button" className="px-3 py-2 disabled:opacity-40" disabled={qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={!purchasable || pending}
          onClick={handleAdd}
          className="w-full py-3 rounded-full bg-black text-white font-semibold disabled:opacity-50"
        >
          {pending
            ? "…"
            : !product.in_stock
              ? t("Sold out", "نفذ المخزون")
              : needsSize && !pickedSize
                ? t("Select a size", "اختر المقاس")
                : (settings.add_to_cart_label as string) ||
                  t("Add to cart", "أضف إلى السلة")}
        </button>
      </div>
    </section>
  );
}
`,
  schema: {
    type: "product-details",
    name: "Product Details",
    locales: { ar: { name: "تفاصيل المنتج" } },
    settings: [
      {
        type: "text",
        id: "add_to_cart_label",
        label: "Add-to-cart label",
        locales: { ar: { label: "نص زر الإضافة" } },
        default: "Add to cart",
      },
    ],
  },
};
