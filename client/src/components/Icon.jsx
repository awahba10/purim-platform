// Thin line icons (24×24, drawn with the current text colour), in the style of
// Apple's SF Symbols. Use: <Icon name="lock" />, optional size.
const PATHS = {
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9v10.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9" />
    </>
  ),
  'new-order': (
    <>
      <path d="M14 3.5H6.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9z" />
      <path d="M14 3.5V9h5.5" />
      <path d="M12 11.5v6M9 14.5h6" />
    </>
  ),
  orders: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.5" cy="6.5" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="17.5" r="1" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8" width="17" height="4" rx="1" />
      <path d="M12 8v12.5" />
      <path d="M19 12v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7" />
      <path d="M12 8S10.5 3.5 7.75 3.5a2.25 2.25 0 0 0 0 4.5M12 8s1.5-4.5 4.25-4.5a2.25 2.25 0 0 1 0 4.5" />
    </>
  ),
  box: (
    <>
      <path d="M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
      <path d="m7.75 5.25 8.5 4.5" />
    </>
  ),
  star: (
    <path d="m12 3.5 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z" />
  ),
  tag: (
    <>
      <path d="M3.5 4.5v7l9 9 8-8-9-9h-7a1 1 0 0 0-1 1z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  map: (
    <>
      <path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13l-5.5 2z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
  production: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3.5h6v1" />
      <path d="m9 13 2 2 4-4" />
    </>
  ),
  chart: (
    <>
      <path d="M3.5 3.5v17h17" />
      <path d="M8 16v-3M12 16V9M16 16v-5M20 16V6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.75" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.3 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5V13.5M12 17h.01" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  pencil: (
    <>
      <path d="M16.5 4a2.1 2.1 0 0 1 3 3L8 18.5l-4 1 1-4z" />
      <path d="m14.5 6 3 3" />
    </>
  ),
  // Inventory categories
  tray: (
    <>
      <path d="M3 13.5h18l-1.6 4.3a1.5 1.5 0 0 1-1.4 1H6a1.5 1.5 0 0 1-1.4-1z" />
      <path d="M5.5 13.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <path d="M12 7V5.2M10.5 5h3" />
    </>
  ),
  flower: (
    <>
      <path d="M12 13.5c-3 0-5-2.2-5-5.5V4.5l2.5 2 2.5-3 2.5 3 2.5-2V8c0 3.3-2 5.5-5 5.5z" />
      <path d="M12 13.5v7M12 18.5c-1.4-1.9-3.2-2.6-5-2.6.2 2 2.2 3.1 5 2.6z" />
    </>
  ),
  wine: (
    <>
      <path d="M7.5 3.5h9l-.3 4.2A4.2 4.2 0 0 1 12 11.6a4.2 4.2 0 0 1-4.2-3.9z" />
      <path d="M7.7 6.5h8.6M12 11.6v8.9M8.5 20.5h7" />
    </>
  ),
  basket: (
    <>
      <path d="M3.5 9.5h17l-1.7 9.2a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3z" />
      <path d="m8 9.5 3-6M16 9.5l-3-6M9.5 13v3.5M14.5 13v3.5" />
    </>
  ),
  receipt: (
    <>
      <path d="M5.5 3.5h13v17l-2.2-1.4-2.1 1.4-2.2-1.4-2.2 1.4-2.1-1.4-2.2 1.4z" />
      <path d="M9 8h6M9 11.5h6M9 15h4" />
    </>
  ),
  sparkles: (
    <>
      <path d="m11 3.5 1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z" />
      <path d="m18.5 14.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
};

// Which icon marks each inventory category.
export const CAT_ICON = {
  tray: 'tray',
  filler: 'flower',
  wine: 'wine',
  grocery: 'basket',
  expense: 'receipt',
};

export default function Icon({ name, size = 18, className = '', title }) {
  const p = PATHS[name];
  if (!p) return null;
  return (
    <svg
      className={'icon ' + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {p}
    </svg>
  );
}
