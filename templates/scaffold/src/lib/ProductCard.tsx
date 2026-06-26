import { useState } from "react";
import {
  useCart,
  useLocalization,
  useShop,
  type Product,
} from "@numueg/theme-sdk";
import { openCart } from "./cartUI";

/**
 * Empire product card — monochrome, square media with a hover "quick add"
 * pill, a category badge (top-start) and a discount badge (accent blue,
 * top-end). Shared by the featured rail and the products grid so the card
 * looks identical everywhere. Writes to the live SDK cart and pops the drawer.
 */
export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { formatMoney } = useLocalization();
  const shop = useShop();
  const [pending, setPending] = useState(false);

  const image = product.images?.[0];
  const currency = product.currency || shop?.currency;
  // Coerce — some endpoints return price/compare_at_price as strings, which
  // breaks numeric comparison (lexicographic) and arithmetic.
  const priceNum = Number(product.price) || 0;
  const compareNum = Number(product.compare_at_price) || 0;
  const price = formatMoney(priceNum, currency);
  const hasCompare = compareNum > priceNum;
  const compareAt = hasCompare ? formatMoney(compareNum, currency) : null;
  const discountPct = hasCompare
    ? Math.round((1 - priceNum / compareNum) * 100)
    : 0;
  const categoryBadge = product.tags?.[0] || product.category;
  const variantId = product.variants?.[0]?.id;
  const href = `/products/${product.slug}`;

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    if (pending || !product.in_stock) return;
    setPending(true);
    try {
      await addItem(product.id, variantId, 1);
      openCart();
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="nt-card">
      <div className="nt-card__media">
        <a href={href} aria-label={product.name}>
          {image?.url ? (
            <img
              src={image.url}
              alt={image.alt || product.name}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="nt-card__placeholder" aria-hidden="true" />
          )}
        </a>
        {categoryBadge ? (
          <span className="nt-badge">{categoryBadge}</span>
        ) : null}
        {discountPct > 0 ? (
          <span className="nt-badge nt-badge--blue">-{discountPct}%</span>
        ) : null}
        {product.in_stock ? (
          <button
            className="nt-card__add"
            type="button"
            disabled={pending}
            onClick={handleAdd}
          >
            {pending ? "..." : "أضف للسلة"}
          </button>
        ) : (
          <span className="nt-card__add" style={{ opacity: 1 }}>
            نفذ المخزون
          </span>
        )}
      </div>
      <a href={href} className="nt-card__body">
        <h3 className="nt-card__name">{product.name}</h3>
        <p className="nt-card__price">
          {price}
          {compareAt ? (
            <span className="nt-card__compare">{compareAt}</span>
          ) : null}
        </p>
      </a>
    </article>
  );
}
