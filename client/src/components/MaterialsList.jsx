import { splitTrays, matText } from '../util';

// A product's (or preset's) materials with the tray on its own "Tray" line
// above the regular materials. Pass `catalog` for unsaved drafts (names and
// tray flags come from it); saved records carry their own.
export default function MaterialsList({ materials, catalog, limit, open, onToggle, empty = 'No materials' }) {
  const nameOf = catalog
    ? (m) => (catalog.find((c) => c.id === m.material_id) || {}).name || `#${m.material_id}`
    : (m) => m.material_name;
  const { trays, rest } = splitTrays(materials, catalog);
  const long = limit && rest.length > limit;
  const shown = long && !open ? rest.slice(0, limit) : rest;

  return (
    <span className="mat-list">
      {trays.length > 0 && (
        <span className="mat-line">
          <span className="tray-tag">Tray</span> {matText(trays, nameOf)}
        </span>
      )}
      <span className="mat-line">
        {trays.length > 0 && <span className="mat-tag">Materials</span>}{' '}
        {rest.length ? matText(shown, nameOf) : trays.length ? 'none' : empty}
        {long && (
          <>
            {open ? '  ' : ' … '}
            <button type="button" className="linkbtn" onClick={onToggle}>
              {open ? 'show less' : `show all ${rest.length}`}
            </button>
          </>
        )}
      </span>
    </span>
  );
}
