import { useState } from 'react';

// Shares a link via the native share sheet where available (mobile), otherwise
// copies it to the clipboard and briefly shows "Copied!".
export default function ShareButton({
  path,
  title,
  label = 'Share',
  className = '',
}) {
  const [copied, setCopied] = useState(false);

  const doShare = async (e) => {
    e.stopPropagation();
    const url = window.location.origin + path;

    if (navigator.share) {
      try {
        await navigator.share({ title: title || document.title, url });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // user dismissed the sheet
        // otherwise fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  return (
    <button type="button" className={className} onClick={doShare}>
      {copied ? 'Copied!' : label}
    </button>
  );
}
