import { useEffect, useRef, useState } from "react";
import { checkHealth } from "../lib/api";

interface Ping {
  ok: boolean;
  latencyMs: number;
}

export function ResilienceMonitor() {
  const [pings, setPings] = useState<Ping[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    async function tick() {
      try {
        const res = await checkHealth();
        setPings((p) => [...p.slice(-29), { ok: res.ok, latencyMs: res.latencyMs }]);
      } catch {
        setPings((p) => [...p.slice(-29), { ok: false, latencyMs: 0 }]);
      }
    }
    tick();
    timer.current = window.setInterval(tick, 1500);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  const last = pings[pings.length - 1];
  // Three real states, not two — "no ping has resolved yet" is genuinely
  // different from "the last ping succeeded" and shouldn't render as if it
  // were confirmed online.
  const status: "pending" | "online" | "unreachable" = !last ? "pending" : last.ok ? "online" : "unreachable";
  const statusColor = {
    pending: "var(--color-muted)",
    online: "var(--color-green)",
    unreachable: "var(--color-critical)",
  }[status];

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-cyan)]">
          memory layer status
        </span>
        <div className="flex items-center gap-1.5">
          <span className="pulse-dot h-2 w-2 rounded-full" style={{ background: statusColor }} />
          <span className="text-[10px] font-semibold uppercase" style={{ color: statusColor }}>
            {status === "pending" ? "checking…" : status}
          </span>
        </div>
      </div>

      <p className="mt-1 text-[10px] text-[var(--color-muted)]">
        live read/write against CockroachDB · kill a node mid-demo, watch this keep ticking
      </p>

      <div className="mt-3 flex h-10 items-end gap-[3px]">
        {pings.length === 0 && <span className="text-[10px] text-[var(--color-muted)]">pinging…</span>}
        {pings.map((p, i) => (
          <div
            key={i}
            title={p.ok ? `${p.latencyMs}ms` : "failed"}
            className="w-2 flex-1 rounded-sm"
            style={{
              height: p.ok ? `${Math.min(100, 15 + p.latencyMs)}%` : "100%",
              background: p.ok ? "var(--color-cyan)" : "var(--color-critical)",
              opacity: p.ok ? 0.85 : 1,
            }}
          />
        ))}
      </div>
      {last && (
        <p className="mt-2 text-right text-[10px] tabular-nums text-[var(--color-muted)]">
          {last.ok ? `${last.latencyMs}ms` : "0ms"}
        </p>
      )}
    </div>
  );
}
