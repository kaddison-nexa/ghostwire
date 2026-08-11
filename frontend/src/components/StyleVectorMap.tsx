import { useEffect, useState } from "react";
import { getStyleVectorMap } from "../lib/api";
import type { Platform, StyleVectorMapResult, VectorPoint2D } from "../lib/types";

const PLATFORM_COLOR: Record<Platform, string> = {
  linkedin: "var(--color-cyan)",
  x: "var(--color-magenta)",
};

const WIDTH = 480;
const HEIGHT = 160;
const PADDING = 16;

function buildScale(points: VectorPoint2D[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  return (p: VectorPoint2D) => ({
    x: PADDING + ((p.x - minX) / rangeX) * (WIDTH - 2 * PADDING),
    // SVG y grows downward; flip so "up" in the data reads as up on screen.
    y: HEIGHT - (PADDING + ((p.y - minY) / rangeY) * (HEIGHT - 2 * PADDING)),
  });
}

export function StyleVectorMap(props: { handle: string; refreshKey: number }) {
  const [data, setData] = useState<StyleVectorMapResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStyleVectorMap(props.handle)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [props.handle, props.refreshKey]);

  if (error) {
    return <p className="text-[10px] text-[var(--color-critical)]">{error}</p>;
  }
  if (!data || data.edits.length === 0) {
    return (
      <p className="text-[10px] text-[var(--color-muted)]">
        voice vector map — no edits yet for this persona; save one to see the first point.
      </p>
    );
  }

  const allPoints: VectorPoint2D[] = [...data.edits, ...Object.values(data.current)];
  const scale = buildScale(allPoints);

  const byPlatform: Partial<Record<Platform, typeof data.edits>> = {};
  for (const e of data.edits) {
    (byPlatform[e.platform] ??= []).push(e);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          voice vector map — {data.edits.length} sample{data.edits.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-3 text-[9px] text-[var(--color-muted)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: PLATFORM_COLOR.linkedin }} />
            linkedin
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: PLATFORM_COLOR.x }} />x
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-void)]">
        {(Object.keys(byPlatform) as Platform[]).map((platform) => {
          const pts = byPlatform[platform]!.map(scale);
          const path = pts.map((p) => `${p.x},${p.y}`).join(" ");
          return (
            <g key={platform}>
              <polyline points={path} fill="none" stroke={PLATFORM_COLOR[platform]} strokeWidth={1} opacity={0.35} />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={PLATFORM_COLOR[platform]} opacity={0.6} />
              ))}
            </g>
          );
        })}

        {(Object.keys(data.current) as Platform[]).map((platform) => {
          const p = scale(data.current[platform]!);
          return (
            <circle
              key={platform}
              cx={p.x}
              cy={p.y}
              r={6}
              fill={PLATFORM_COLOR[platform]}
              stroke="var(--color-void)"
              strokeWidth={2}
              style={{ filter: `drop-shadow(0 0 6px ${PLATFORM_COLOR[platform]})` }}
            />
          );
        })}
      </svg>

      <p className="mt-1 text-[9px] text-[var(--color-muted)]">
        each small dot is one saved edit, projected from its real 1024-dim vector; the glowing dot is where the
        current voice profile sits. Closer points are more similar in the real vector space — the axes themselves
        don't mean anything individually.
      </p>
    </div>
  );
}
