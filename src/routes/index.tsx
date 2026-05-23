import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WorldMap } from "@/components/WorldMap";
import { useGame } from "@/lib/gameStore";
import { Button } from "@/components/ui/button";
import { Crown, Play, Plus, Swords } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Empire Shift: Strategy Map" },
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
      <div className="absolute inset-0 opacity-40">
        <WorldMap
          fillFor={() => "oklch(0.5 0.04 80 / 0.5)"}
          onCountryClick={mode === "new" ? undefined : undefined}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/10 to-background/90" />

      {mode === "menu" && (
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div className="mb-2 flex items-center gap-3 text-primary">
            <Swords className="size-8" />
            <span className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Grand Strategy</span>
            <Crown className="size-8" />
          </div>
          <h1 className="font-serif text-6xl md:text-8xl font-bold tracking-tight text-foreground drop-shadow-[0_4px_30px_rgba(251,191,36,0.3)]">
            Empire <span className="text-primary">Shift</span>
          </h1>
          <p className="mt-3 text-lg md:text-xl text-muted-foreground tracking-wide">Strategy Map — Rewrite the world.</p>

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
          <p className="mt-10 text-xs text-muted-foreground/70">Click a real country. Build armies. Conquer the world.</p>
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
  const [hover, setHover] = useState<{ id: string; name: string; gdpT: number } | null>(null);

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border/40 backdrop-blur bg-background/40">
        <div>
          <h2 className="text-lg font-semibold">Choose your nation</h2>
          <p className="text-xs text-muted-foreground">Click any country on the map to begin your empire.</p>
        </div>
        <Button variant="ghost" onClick={onBack}>← Back</Button>
      </div>

      <div className="flex-1 relative">
        <WorldMap
          onCountriesLoaded={setCountries}
          fillFor={(id) => (hover?.id === id ? "oklch(0.82 0.16 85)" : "oklch(0.55 0.04 80)")}
          onCountryClick={(c) => {
            if (countries.length === 0) return;
            initGame(c.id, c.name, countries);
            setTimeout(() => navigate({ to: "/play" }), 50);
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          onMouseMove={() => {}}
        />
      </div>

      {hover && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-card/90 px-4 py-2 text-sm backdrop-blur border border-border">
          <span className="font-semibold">{hover.name}</span>
          <span className="ml-3 text-muted-foreground">${hover.gdpT.toFixed(2)}T · {(hover.gdpT * 100).toFixed(0)}/s</span>
        </div>
      )}
      {/* suppress unused */}
      {void setHover}
    </div>
  );
}

