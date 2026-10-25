import { createContext, useContext, useEffect, useState } from 'react';
import { api, setApiSeason } from './api';

// The season the whole app is showing. Defaults to the newest Active season;
// a choice made with the switcher is remembered for this browser tab (so
// refreshes and navigation keep it) but a fresh visit opens on Active again.
// "Unlocked" is never remembered: switching seasons or reloading relocks.
const Ctx = createContext(null);
const KEY = 'purim.seasonId';

const readStored = () => {
  try {
    return Number(sessionStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
};
const writeStored = (id) => {
  try {
    sessionStorage.setItem(KEY, String(id));
  } catch {
    /* storage unavailable — the choice just isn't remembered */
  }
};

export const seasonSlug = (s) =>
  ((s && s.name) || 'season').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function SeasonProvider({ children }) {
  const [seasons, setSeasons] = useState(null);
  const [currentId, setCurrentId] = useState(readStored);
  const [unlockedId, setUnlockedId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');

  const refresh = () =>
    api.get('/seasons').then((list) => {
      setSeasons(list);
      return list;
    });

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  // List is newest first, so the first Active one is the newest Active.
  const active = seasons ? seasons.find((s) => s.status === 'Active') || seasons[0] : null;
  const current = seasons ? seasons.find((s) => s.id === currentId) || active : null;
  const unlocked = !!current && current.status === 'Closed' && unlockedId === current.id;
  const readOnly = !!current && current.status === 'Closed' && !unlocked;

  // Set synchronously so every child request carries the right season.
  setApiSeason(current && current.id, unlocked);

  const switchTo = (id) => {
    setUnlockedId(null);
    setCurrentId(id);
    writeStored(id);
  };

  const createSeason = async (name) => {
    const s = await api.post('/seasons', { name });
    await refresh();
    switchTo(s.id);
    setNotice({ kind: 'new-season', name: s.name });
  };

  const reopen = async (id) => {
    await api.post(`/seasons/${id}/reopen`, {});
    await refresh();
    switchTo(id);
  };

  if (error) {
    return (
      <div className="panel">
        <div className="error">Couldn't load seasons: {error}</div>
      </div>
    );
  }
  if (!current) {
    return (
      <div className="panel">
        <p className="subtle">Loading…</p>
      </div>
    );
  }

  const value = {
    seasons,
    current,
    active,
    unlocked,
    readOnly,
    notice,
    dismissNotice: () => setNotice(null),
    switchTo,
    createSeason,
    reopen,
    refresh,
    unlock: () => setUnlockedId(current.id),
    lock: () => setUnlockedId(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSeason() {
  return useContext(Ctx);
}
