import { useEffect } from "react";
import { DraftPanel } from "./DraftPanel";
import type { FeedItem } from "../lib/types";

export function DraftModal(props: { handle: string; newsItem: FeedItem; onClose: () => void }) {
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
        className="panel glow-cyan w-full max-w-3xl animate-[modal-pop_180ms_ease-out] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
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

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DraftPanel handle={props.handle} platform="linkedin" newsItem={props.newsItem} />
          <DraftPanel handle={props.handle} platform="x" newsItem={props.newsItem} />
        </div>
      </div>
    </div>
  );
}
