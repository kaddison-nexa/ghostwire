import { useState } from "react";
import { generateDraft, submitEdit } from "../lib/api";
import type { DraftResult, FeedItem, Platform } from "../lib/types";

const PLATFORM_LABEL: Record<Platform, string> = { linkedin: "LinkedIn", x: "X" };

export function DraftPanel(props: { handle: string; platform: Platform; newsItem: FeedItem }) {
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sampleCount, setSampleCount] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const { draft } = await generateDraft({
        handle: props.handle,
        newsItemId: props.newsItem.id,
        platform: props.platform,
      });
      setDraft(draft);
      setText(draft.generatedText);
      setSampleCount(draft.usedStyleSampleCount);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const { sampleCount } = await submitEdit({
        draftId: draft.id,
        handle: props.handle,
        platform: props.platform,
        editedText: text,
      });
      setSampleCount(sampleCount);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-magenta)]">
          {PLATFORM_LABEL[props.platform]}
        </span>
        {sampleCount !== null && (
          <span className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
            voice memory: {sampleCount} sample{sampleCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {!draft ? (
        <button className="btn-magenta btn self-start" onClick={handleGenerate} disabled={loading}>
          {loading ? "drafting…" : "generate draft"}
        </button>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={props.platform === "x" ? 4 : 7}
            className="w-full resize-none rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] p-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-cyan)]"
          />
          <div className="flex items-center gap-3">
            <button className="btn" onClick={handleSave} disabled={saving}>
              {saving ? "saving…" : "save edit → memory"}
            </button>
            {savedFlash && (
              <span className="text-xs text-[var(--color-green)] text-glow">
                ✓ style profile updated
              </span>
            )}
          </div>
        </>
      )}

      {error && <p className="text-xs text-[var(--color-critical)]">{error}</p>}
    </div>
  );
}
