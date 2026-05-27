import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { WorldMap, type MapCountry } from "@/components/WorldMap";
import { useGame } from "@/lib/gameStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Play, Plus, Swords, Search, ChevronLeft } from "lucide-react";

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
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 opacity-50 pointer-events-none">
        <WorldMap fillFor={() => "#3d4a3a"} interactive={false} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background/95 pointer-events-none" />

      {mode === "menu" && (
        <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
          <div className="mb-2 flex items-center gap-3 text-primary">
            <Swords className="size-7" />
            <span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Grand Strategy</span>
            <Crown className="size-7" />
          </div>
          <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-foreground drop-shadow-[0_4px_30px_rgba(251,191,36,0.3)]">
            Empire <span className="text-primary">Shift</span>
          </h1>
          <p className="mt-3 text-sm md:text-lg text-muted-foreground tracking-[0.3em] uppercase">World Conquest</p>

          <div className="mt-10 flex flex-col gap-3 w-full max-w-xs">
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
          <p className="mt-8 text-xs text-muted-foreground/70 max-w-xs">
            Choose a nation. Forge alliances. Conquer the world.
          </p>
        </div>
      )}

      {mode === "new" && <CountryPicker onBack={() => setMode("menu")} />}
    </div>
  );
}

function CountryPicker({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const initGame = useGame((s) => s.initGame);
  const [countries, setCountries] = useState<MapCountry[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const sorted = [...countries].sort((a, b) => b.gdpT - a.gdpT || a.name.localeCompare(b.name));
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((c) => c.name.toLowerCase().includes(q)) : sorted;
  }, [countries, query]);

  const selectedCountry = selected ? countries.find((c) => c.id === selected) ?? null : null;

  const confirm = () => {
    if (!selectedCountry) return;
    initGame(selectedCountry.id, selectedCountry.name, countries);
    setTimeout(() => navigate({ to: "/play" }), 30);
  };

  return (
    <div className="relative z-10 flex min-h-[100dvh] flex-col">
      {/* hidden map loads country list */}
      <div className="hidden">
        <WorldMap onCountriesLoaded={setCountries} interactive={false} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 border-b border-border/60 backdrop-blur-xl bg-background/80">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ChevronLeft className="size-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">Choose your nation</h2>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {countries.length > 0 ? `${filtered.length} nations available` : "Loading nations…"}
          </p>
        </div>
      </header>

      {/* Centered list */}
      <div className="flex-1 overflow-y-auto pb-40">
        <div className="mx-auto w-full max-w-md px-4 pt-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search countries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-11 rounded-xl bg-card/70 backdrop-blur"
            />
          </div>

          {countries.length === 0 ? (
            <div className="text-sm text-muted-foreground py-16 text-center">Loading nations…</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((c) => {
                const isSel = selected === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(c.id)}
                      className={`group w-full text-left rounded-xl border px-4 py-3 transition-all active:scale-[0.99] ${
                        isSel
                          ? "border-primary bg-primary/15 ring-2 ring-primary shadow-[0_0_20px_-4px_rgba(251,191,36,0.4)]"
                          : "border-border/60 bg-card/70 hover:bg-accent/40 backdrop-blur"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate text-base">{c.name}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            ${c.gdpT.toFixed(2)}T economy
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-mono text-primary">
                            +{Math.round(c.gdpT * 100)}
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">coins/s</div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Sticky bottom confirmation bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
        <div className="mx-auto w-full max-w-md px-4">
          {selectedCountry ? (
            <>
              <div className="mb-2 text-center">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Briefing</div>
                <div className="text-lg font-bold leading-tight">{selectedCountry.name}</div>
                <div className="text-xs text-muted-foreground">
                  ${selectedCountry.gdpT.toFixed(2)}T · +{Math.round(selectedCountry.gdpT * 100)} coins/sec
                </div>
              </div>
              <Button size="lg" onClick={confirm} className="w-full h-14 text-base font-bold shadow-lg shadow-primary/30">
                <Crown className="mr-2 size-5" /> Lead {selectedCountry.name}
              </Button>
            </>
          ) : (
            <Button size="lg" disabled className="w-full h-14 text-base opacity-70">
              Select a nation to begin
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
