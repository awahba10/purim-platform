import { money, round2, suggestedCostOf, presetToDraftPatch } from '../util';
import MaterialPicker from './MaterialPicker';

// Editable fields for a single product. `value` is a product draft (see util.js).
// Used by New Order, the Products tab, and the order detail view.
export default function ProductFields({
  value,
  onChange,
  catalog,
  presets,
  onRemove,
  onDuplicate,
  title,
}) {
  const set = (patch) => onChange({ ...value, ...patch });
  const suggested = suggestedCostOf(value.materials, catalog);

  const applyPreset = (id) => {
    const preset = (presets || []).find((p) => String(p.id) === String(id));
    if (preset) onChange({ ...value, ...presetToDraftPatch(preset) });
  };

  const setMaterials = (materials) => {
    const next = { ...value, materials };
    if (!value.costTouched) next.cost = String(round2(suggestedCostOf(materials, catalog)));
    onChange(next);
  };

  const costDiffers =
    String(round2(Number(value.cost) || 0)) !== String(round2(suggested));

  return (
    <div className="product-fields">
      {(title || onRemove || onDuplicate) && (
        <div className="pf-head">
          <strong>{title || 'Product'}</strong>
          <span className="pf-head-actions">
            {onDuplicate && (
              <button type="button" className="linkbtn" onClick={onDuplicate}>
                Duplicate
              </button>
            )}
            {onRemove && (
              <button type="button" className="link-danger" onClick={onRemove}>
                Remove
              </button>
            )}
          </span>
        </div>
      )}

      {presets && presets.length > 0 && (
        <label>
          Start from a premade product
          <select
            value=""
            onChange={(e) => {
              applyPreset(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">— pick a preset to fill this product —</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({money(p.price)})
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Product name *
        <input
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Chocolate & wine tray"
        />
      </label>

      <label>
        Delivery address for this product
        <textarea
          rows={2}
          value={value.address}
          onChange={(e) => set({ address: e.target.value })}
          placeholder="123 Main St, Apt 4 — can differ per product"
        />
      </label>

      <div className="row">
        <label>
          Notes
          <textarea
            rows={2}
            value={value.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Leave with doorman"
          />
        </label>
        <label>
          Gift message
          <textarea
            rows={2}
            value={value.gift_message}
            onChange={(e) => set({ gift_message: e.target.value })}
            placeholder="Chag Purim Sameach!"
          />
        </label>
      </div>

      <div className="pf-materials">
        <div className="subtle" style={{ marginBottom: 6 }}>Materials used</div>
        <MaterialPicker catalog={catalog} value={value.materials} onChange={setMaterials} />
      </div>

      <div className="row">
        <label>
          Cost to make
          <input
            type="number"
            step="0.01"
            value={value.cost}
            onChange={(e) => set({ cost: e.target.value, costTouched: true })}
            placeholder="0.00"
          />
          <span className="hint">
            Suggested from materials: {money(suggested)}
            {costDiffers && (
              <button
                type="button"
                className="linkbtn"
                onClick={() => set({ cost: String(round2(suggested)), costTouched: false })}
              >
                use this
              </button>
            )}
          </span>
        </label>
        <label>
          Charging (price) *
          <input
            type="number"
            step="0.01"
            value={value.price}
            onChange={(e) => set({ price: e.target.value })}
            placeholder="0.00"
          />
        </label>
      </div>
    </div>
  );
}
