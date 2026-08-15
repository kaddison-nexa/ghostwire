import { useEffect, useState } from "react";
import { DraftPanel } from "./DraftPanel";
import { StyleVectorMap } from "./StyleVectorMap";
import type { FeedItem } from "../lib/types";

export function DraftModal(props: { handle: string; newsItem: FeedItem; onClose: () => void }) {
  const [mapRefreshKey, setMapRefreshKey] = useState(0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [props.onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-6 backdrop-blur-sm sm:items-center"
      onClick={props.onClose}
    >
      <div
        className="panel glow-cyan w-full max-w-3xl animate-[modal-pop_180ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky, not just top-of-content — the modal's own scroll container
            can grow taller than the viewport (the vector map made this
            visible in practice), and a merely-first-in-DOM header can end up
            scrolled above the fold with centered flex layout, making the
            close button unreachable without an unintuitive scroll-up.
            NOTE: no `overflow-hidden` (or any overflow other than visible) on
            this panel div or anything between here and the scroll container —
            that creates a clipping ancestor that silently breaks sticky,
            constraining it to this box instead of the real scroll container.
            Learned that the hard way; don't reintroduce it for rounded-corner
            polish. */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-xl border-b border-[var(--color-line)] bg-[var(--color-panel)] p-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-cyan)] text-glow">
              draft workspace
            </span>
            <p className="mt-1 text-sm font-medium text-[var(--color-text)]">{props.newsItem.headline}</p>
          </div>
          <button
            onClick={props.onClose}
            aria-label="close"
            className="shrink-0 rounded-md border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-muted)] hover:border-[var(--color-magenta)] hover:text-[var(--color-magenta)]"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DraftPanel
              handle={props.handle}
              platform="linkedin"
              newsItem={props.newsItem}
              onSaved={() => setMapRefreshKey((k) => k + 1)}
            />
            <DraftPanel
              handle={props.handle}
              platform="x"
              newsItem={props.newsItem}
              onSaved={() => setMapRefreshKey((k) => k + 1)}
            />
          </div>

          <div className="mt-4 border-t border-[var(--color-line)] pt-4">
            <StyleVectorMap handle={props.handle} refreshKey={mapRefreshKey} />
          </div>
        </div>
      </div>
    </div>
  );
}
