// Remaining trays for a preset: "4 left", or "Sold out" at zero or below.
export default function InventoryBadge({ value }) {
  if (value == null) return <span className="subtle">—</span>;
  if (value <= 0) {
    return (
      <span className="badge warn" title={value < 0 ? `${-value} oversold` : undefined}>
        Sold out{value < 0 ? ` (${value})` : ''}
      </span>
    );
  }
  return <span className="inv-count">{value} left</span>;
}
