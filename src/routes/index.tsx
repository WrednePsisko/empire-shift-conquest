import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { WorldMap } from "@/components/WorldMap";
import { useGame } from "@/lib/gameStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Play, Plus, Swords, Search } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Empire Shift: World Conquest" },
      { name: "description", content: "Conquer the world. Build empires. Shift history." },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  const navigate = useNavigate();
  const initialized = useGame((s) => s.initialized);
  const resetGame = useGame((s) => s.resetGame);
  const [mode, setMode] = useState<"menu" | "new">("menu");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <WorldMap fillFor={() => "oklch(0.5 0.04 80 / 0.5)"} interactive={false} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/10 to-background/90 pointer-events-none" />

      {mode === "menu" && (
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div className="mb-2 flex items-center gap-3 text-primary">
            <Swords className="size-8" />
            <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Grand Strategy</span>
            <Crown className="size-8" />
          </div>
          <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight text-foreground drop-shadow-[0_4px_30px_rgba(251,191,36,0.3)]">
            Empire <span className="text-primary">Shift</span>
          </h1>
          <p className="mt-3 text-base md:text-lg text-muted-foreground tracking-[0.3em] uppercase">World Conquest</p>

          <div className="mt-12 flex flex-col gap-3 w-full max-w-xs">
            <Button
              size="lg"
              disabled={!hydrated || !initialized}
              onClick={() => navigate({ to: "/play" })}
              className="h-14 text-base"
            >
              <Play className="mr-2 size-5" /> Resume
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                resetGame();
                setMode("new");
              }}
              className="h-14 text-base"
            >
              <Plus className="mr-2 size-5" /> Create New Game
            </Button>
          </div>
          <p className="mt-10 text-xs text-muted-foreground/70">Choose a nation. Build armies. Conquer the world.</p>
        </div>
      )}

      {mode === "new" && <CountryPicker onBack={() => setMode("menu")} />}
    </div>
  );
}

function CountryPicker({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const initGame = useGame((s) => s.initGame);
  const [countries, setCountries] = useState<{ id: string; name: string; gdpT: number }[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // Load list via hidden map (no render needed)
  // We render the map invisibly so it can fetch & emit countries.
  const filtered = useMemo(() => {
    const sorted = [...countries].sort((a, b) => b.gdpT - a.gdpT || a.name.localeCompare(b.name));
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((c) => c.name.toLowerCase().includes(q)) : sorted;
  }, [countries, query]);

  const selectedCountry = selected ? countries.find((c) => c.id === selected) ?? null : null;

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <div className="hidden">
        <WorldMap onCountriesLoaded={setCountries} interactive={false} />
      </div>

      <div className="flex items-center justify-between p-4 border-b border-border/40 backdrop-blur bg-background/60">
        <div>
          <h2 className="text-lg font-semibold">Choose your nation</h2>
          <p className="text-xs text-muted-foreground">Pick a country from the list to begin your campaign.</p>
        </div>
        <Button variant="ghost" onClick={onBack}>← Back</Button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_360px] gap-0">
        <div className="p-6 flex flex-col bg-background/40 backdrop-blur min-h-0">
          <div className="relative mb-3 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search countries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {countries.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Loading nations…</div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filtered.map((c) => {
                  const isSel = selected === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(c.id)}
                        className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                          isSel
                            ? "border-primary bg-primary/15 ring-1 ring-primary"
                            : "border-border bg-card/60 hover:bg-accent/40"
                        }`}
                      >
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          ${c.gdpT.toFixed(2)}T · +{Math.round(c.gdpT * 100)}/s
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <aside className="border-l border-border/40 bg-card/60 backdrop-blur p-6 flex flex-col">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Briefing</div>
          {selectedCountry ? (
            <>
              <h3 className="text-2xl font-bold">{selectedCountry.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Economy: ${selectedCountry.gdpT.toFixed(2)}T
                <br />
                Income: +{Math.round(selectedCountry.gdpT * 100)} coins / sec
              </p>
              <div className="flex-1" />
              <Button
                size="lg"
                className="mt-6 h-12"
                onClick={() => {
                  initGame(selectedCountry.id, selectedCountry.name, countries);
                  setTimeout(() => navigate({ to: "/play" }), 30);
                }}
              >
                <Crown className="mr-2 size-5" /> Lead {selectedCountry.name}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a country to view its briefing.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
