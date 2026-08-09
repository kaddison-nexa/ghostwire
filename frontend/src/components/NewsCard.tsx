import type { FeedItem } from "../lib/types";

const SEVERITY_STYLE: Record<FeedItem["severity"], string> = {
  critical: "text-[var(--color-critical)] border-[var(--color-critical)]",
  notable: "text-[var(--color-amber)] border-[var(--color-amber)]",
  info: "text-[var(--color-muted)] border-[var(--color-line)]",
};

export function NewsCard(props: {
  item: FeedItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const { item } = props;
  const pct = Math.round(item.relevance * 100);

  return (
    <button
      onClick={props.onSelect}
      className={`panel scanline w-full text-left p-4 transition-transform hover:-translate-y-0.5 ${
        props.selected ? "glow-cyan" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${SEVERITY_STYLE[item.severity]}`}
        >
          {item.severity}
        </span>
        <span className="text-[10px] text-[var(--color-muted)]">{item.source}</span>
      </div>

      <h3 className="mt-2 text-sm font-semibold leading-snug text-[var(--color-text)]">
        {item.headline}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{item.summary}</p>

      {item.personalized ? (
        <div
          className="mt-3 flex items-center gap-2"
          title="Relevance to you: blends topical similarity to your engagement history with this story's severity"
        >
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            relevance to you
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-cyan)] to-[var(--color-magenta)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-9 text-right text-[10px] font-semibold tabular-nums text-[var(--color-text)]">
            {pct}%
          </span>
        </div>
      ) : (
        <p
          className="mt-3 text-[10px] italic text-[var(--color-muted)]"
          title="No engagement history yet for this persona — nothing to personalize against"
        >
          no history yet — sorted by severity &amp; recency
        </p>
      )}
    </button>
  );
}
