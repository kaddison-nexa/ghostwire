import { useCallback, useEffect, useState } from "react";
import { fetchFeed, ingestFeed, resetColdStart, restoreSignalGhost } from "./lib/api";
import type { FeedItem, Persona } from "./lib/types";
import { Header } from "./components/Header";
import { NewsCard } from "./components/NewsCard";
import { DraftModal } from "./components/DraftModal";
import { ResilienceMonitor } from "./components/ResilienceMonitor";

const PERSONAS: Persona[] = [
  { id: "signal_ghost", handle: "signal_ghost", label: "Signal Ghost (warmed up)", warm: true },
  { id: "new_analyst", handle: "new_analyst", label: "New Analyst (cold start)", warm: false },
];

export default function App() {
  const [activePersonaId, setActivePersonaId] = useState(PERSONAS[0].id);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [selected, setSelected] = useState<FeedItem | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);
  const [ingestHadErrors, setIngestHadErrors] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const activePersona = PERSONAS.find((p) => p.id === activePersonaId)!;

  const loadFeed = useCallback((handle: string) => {
    setLoadingFeed(true);
    setFeedError(null);
    fetchFeed(handle)
      .then(({ feed }) => {
        setFeed(feed);
        setSelected((prev) => feed.find((f) => f.id === prev?.id) ?? null);
      })
      .catch((e) => setFeedError((e as Error).message))
      .finally(() => setLoadingFeed(false));
  }, []);

  useEffect(() => {
    setSelected(null);
    loadFeed(activePersonaId);
  }, [activePersonaId, loadFeed]);

  async function handleIngest() {
    setIngesting(true);
    setIngestMessage(null);
    try {
      const { checked, inserted, insertedHeadlines, errors } = await ingestFeed();
      const base =
        inserted > 0
          ? `+${inserted} new — ${insertedHeadlines[0]}${inserted > 1 ? ` (+${inserted - 1} more)` : ""}`
          : `checked ${checked} entries across both feeds, nothing new`;
      setIngestMessage(errors.length > 0 ? `${base} (${errors.join("; ")})` : base);
      setIngestHadErrors(errors.length > 0);
      if (inserted > 0) loadFeed(activePersonaId);
    } catch (e) {
      setIngestMessage((e as Error).message);
      setIngestHadErrors(true);
    } finally {
      setIngesting(false);
    }
  }

  async function handleResetColdStart() {
    setResetting(true);
    try {
      await resetColdStart();
      loadFeed(activePersonaId);
    } catch (e) {
      setFeedError((e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  async function handleRestoreSignalGhost() {
    setRestoring(true);
    try {
      await restoreSignalGhost();
      loadFeed(activePersonaId);
    } catch (e) {
      setFeedError((e as Error).message);
    } finally {
      setRestoring(false);
    }
  }

  function handleCloseDraftModal() {
    // Generating a draft records engagement, which feeds the interest
    // vector future /feed calls rank against — so relevance scores on the
    // other cards can be stale the moment the modal closes. Re-fetch so the
    // list reflects whatever happened during the session without requiring
    // a manual page reload. setSelected(null) first so the refreshed feed's
    // re-sync logic in loadFeed doesn't re-select (and reopen) this item.
    setSelected(null);
    loadFeed(activePersonaId);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Header personas={PERSONAS} activePersonaId={activePersonaId} onSelect={setActivePersonaId} />

      <main className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
              personalized triage feed
            </h2>
            <div className="flex items-center gap-2">
              {!activePersona.warm && (
                <button
                  className="btn-magenta btn text-[10px] px-2.5 py-1"
                  onClick={handleResetColdStart}
                  disabled={resetting}
                  title="Wipe this demo persona's engagement history back to a genuine cold start — only ever affects New Analyst, never Signal Ghost"
                >
                  {resetting ? "resetting…" : "reset to cold start"}
                </button>
              )}
              {activePersona.warm && (
                <button
                  className="btn-magenta btn text-[10px] px-2.5 py-1"
                  onClick={handleRestoreSignalGhost}
                  disabled={restoring}
                  title="Re-seed this persona's curated voice history — undoes any drift from edits other visitors have saved, only ever affects Signal Ghost"
                >
                  {restoring ? "restoring…" : "restore curated voice"}
                </button>
              )}
              <button className="btn text-[10px] px-2.5 py-1" onClick={handleIngest} disabled={ingesting}>
                {ingesting ? "checking feeds…" : "check for new stories"}
              </button>
            </div>
          </div>
          {ingestMessage && (
            <p
              className="mb-3 text-[10px] text-glow"
              style={{ color: ingestHadErrors ? "var(--color-amber)" : "var(--color-green)" }}
            >
              {ingestMessage}
            </p>
          )}

          {feedError && (
            <p className="panel p-4 text-sm text-[var(--color-critical)]">
              {feedError} — is the backend running on VITE_API_URL?
            </p>
          )}
          {loadingFeed && <p className="text-sm text-[var(--color-muted)]">loading…</p>}

          <div className="flex flex-col gap-3">
            {feed.map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                selected={selected?.id === item.id}
                onSelect={() => setSelected(item)}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <p className="panel p-4 text-sm text-[var(--color-muted)]">
            select a story from the feed to draft against it.
          </p>

          <ResilienceMonitor />
        </section>
      </main>

      {selected && (
        <DraftModal handle={activePersonaId} newsItem={selected} onClose={handleCloseDraftModal} />
      )}
    </div>
  );
}
