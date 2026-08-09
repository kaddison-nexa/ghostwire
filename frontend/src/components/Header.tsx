import type { Persona } from "../lib/types";

export function Header(props: {
  personas: Persona[];
  activePersonaId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--color-line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">👻</span>
          <h1 className="text-2xl font-extrabold tracking-widest text-[var(--color-cyan)] text-glow">
            GHOSTWIRE
          </h1>
        </div>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          persistent voice memory · personalized triage on{" "}
          <span className="text-[var(--color-magenta)]">CockroachDB</span> + AWS Bedrock
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] p-1">
        {props.personas.map((p) => (
          <button
            key={p.id}
            onClick={() => props.onSelect(p.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              props.activePersonaId === p.id
                ? "bg-[var(--color-cyan)] text-[#001217]"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {p.label}
            <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ background: p.warm ? "var(--color-green)" : "var(--color-muted)" }}
            />
          </button>
        ))}
      </div>
    </header>
  );
}
