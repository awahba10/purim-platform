import { PAYMENT_METHODS } from '../util';

// Chip picker for an order's payment method. `value` is { choice, other }.
// Clicking the active chip clears it (the field is optional). "Other" reveals
// a short text input that must be filled.
export default function PaymentMethodPicker({ value, onChange, disabled }) {
  const pick = (m) =>
    onChange({ choice: value.choice === m ? '' : m, other: value.other });
  return (
    <div className="pm-picker">
      <div className="pill-group">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            disabled={disabled}
            className={value.choice === m ? 'pill active' : 'pill'}
            onClick={() => pick(m)}
          >
            {m}
          </button>
        ))}
      </div>
      {value.choice === 'Other' && (
        <input
          className="pm-other"
          placeholder="Type the payment method…"
          value={value.other}
          disabled={disabled}
          maxLength={60}
          onChange={(e) => onChange({ choice: 'Other', other: e.target.value })}
        />
      )}
    </div>
  );
}
