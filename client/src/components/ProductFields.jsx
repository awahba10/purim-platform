import { useId } from 'react';
import { money, round2, suggestedCostOf, presetToDraftPatch, DELIVERY_QUICK } from '../util';
import MaterialPicker from './MaterialPicker';
import PresetChip from './PresetChip';

function Addon({ label, hint, on, onToggle, children }) {
  return (
    <div className={on ? 'addon on' : 'addon'}>
      <button type="button" className="addon-btn" onClick={onToggle}>
        <span className="addon-mark">{on ? '−' : '+'}</span> {label}
      </button>
      {on && (
        <div className="addon-field">
          {hint && <div className="hint">{hint}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

// Editable fields for a single product, grouped into three sections.
// `value` is a product draft (see util.js).
export default function ProductFields({
  value,
  onChange,
  catalog,
  presets,
  deliveryLocations,
  onRemove,
  onDuplicate,
  title,
}) {
  const dlId = 'dl' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const set = (patch) => onChange({ ...value, ...patch });
  const suggested = suggestedCostOf(value.materials, catalog);
  const isPickup = value.fulfillment === 'Pickup';

  const setMaterials = (materials) => {
    const next = { ...value, materials };
    if (!value.costTouched) next.cost = String(round2(suggestedCostOf(materials, catalog)));
    onChange(next);
  };

  const costDiffers =
    String(round2(Number(value.cost) || 0)) !== String(round2(suggested));

  // Toggling an add-on off also clears its value so it can't linger hidden.
  const toggleAddon = (flag, field) =>
    onChange({
      ...value,
      [flag]: !value[flag],
      ...(value[flag] ? { [field]: '' } : {}),
    });

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

      {/* ---------- 1 · Product Details ---------- */}
      <div className="pf-section">
        <div className="pf-section-title">1 · Product Details</div>

        {presets && presets.length > 0 && (
          <div>
            <div className="fld-label">Start from a premade product</div>
            <PresetChip
              presets={presets}
              onPick={(preset) =>
                onChange({ ...value, ...presetToDraftPatch(preset) })
              }
            />
          </div>
        )}

        <label>
          Product name *
          <input
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Chocolate & wine tray"
          />
        </label>

        <div>
          <div className="fld-label">Materials used</div>
          <MaterialPicker
            catalog={catalog}
            value={value.materials}
            onChange={setMaterials}
          />
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
                  onClick={() =>
                    set({ cost: String(round2(suggested)), costTouched: false })
                  }
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

      {/* ---------- 2 · Fulfillment ---------- */}
      <div className="pf-section">
        <div className="pf-section-title">2 · Fulfillment</div>

        <div>
          <div className="fld-label">Pickup or delivery</div>
          <div className="pill-group">
            {['Delivery', 'Pickup'].map((f) => (
              <button
                type="button"
                key={f}
                className={value.fulfillment === f ? 'pill active' : 'pill'}
                onClick={() => set({ fulfillment: f })}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {!isPickup && (
          <>
            <label>
              Address *
              <textarea
                rows={2}
                value={value.address}
                onChange={(e) => set({ address: e.target.value })}
                placeholder="123 Main St, Apt 4 — can differ per product"
              />
            </label>

            <label>
              Delivery location *
              <input
                list={dlId}
                value={value.delivery_location}
                onChange={(e) => set({ delivery_location: e.target.value })}
                placeholder="Pick from the list or type a new one"
              />
              <datalist id={dlId}>
                {(deliveryLocations || []).map((l) => (
                  <option key={l.id} value={l.name} />
                ))}
              </datalist>
            </label>

            <label>
              Delivery instructions
              <textarea
                rows={2}
                value={value.delivery_instructions}
                onChange={(e) => set({ delivery_instructions: e.target.value })}
                placeholder="e.g. leave with the doorman"
              />
            </label>

            <div>
              <div className="fld-label">Delivery charge *</div>
              <div className="quickselect">
                {DELIVERY_QUICK.map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={
                      !value.dcOther && Number(value.delivery_charge) === n
                        ? 'qs active'
                        : 'qs'
                    }
                    onClick={() =>
                      set({ delivery_charge: String(n), dcOther: false })
                    }
                  >
                    ${n}
                  </button>
                ))}
                <button
                  type="button"
                  className={value.dcOther ? 'qs active' : 'qs'}
                  onClick={() => set({ dcOther: true })}
                >
                  Other
                </button>
              </div>
              {value.dcOther && (
                <input
                  type="number"
                  step="0.01"
                  value={value.delivery_charge}
                  onChange={(e) => set({ delivery_charge: e.target.value })}
                  placeholder="Custom amount"
                  style={{ marginTop: 8, maxWidth: 160 }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* ---------- 3 · Optional Add-ons ---------- */}
      <div className="pf-section">
        <div className="pf-section-title">3 · Optional Add-ons</div>

        <Addon
          label="Recipient name"
          on={value.recipientOn}
          onToggle={() => toggleAddon('recipientOn', 'recipient_name')}
        >
          <input
            value={value.recipient_name}
            onChange={(e) => set({ recipient_name: e.target.value })}
            placeholder="Who the tray is for"
          />
        </Addon>

        <Addon
          label="Gift message"
          hint="The message to include in the gift."
          on={value.giftOn}
          onToggle={() => toggleAddon('giftOn', 'gift_message')}
        >
          <textarea
            rows={3}
            value={value.gift_message}
            onChange={(e) => set({ gift_message: e.target.value })}
            placeholder="Chag Purim Sameach! With love, the Levy family"
          />
        </Addon>

        <Addon
          label="Notes for whoever makes this"
          hint="Instructions for the person assembling the product — separate from delivery instructions."
          on={value.notesOn}
          onToggle={() => toggleAddon('notesOn', 'notes')}
        >
          <textarea
            rows={2}
            value={value.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="e.g. swap the wine for something non-alcoholic"
          />
        </Addon>
      </div>
    </div>
  );
}
