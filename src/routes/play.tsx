import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { WorldMap } from "@/components/WorldMap";
import { useGame, ARMY_COST, INCOME_PER_GDP_T } from "@/lib/gameStore";
import { Button } from "@/components/ui/button";
import { Coins, Crown, Shield, Swords, Home, Plus, Minus } from "lucide-react";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [{ title: "Empire Shift — Campaign" }],
  }),
  component: Play,
});

function Play() {
  const navigate = useNavigate();
  const initialized = useGame((s) => s.initialized);
  const countries = useGame((s) => s.countries);
  const empires = useGame((s) => s.empires);
  const playerEmpireId = useGame((s) => s.playerEmpireId);
  const doTick = useGame((s) => s.doTick);
  const buyArmies = useGame((s) => s.buyArmies);
  const attack = useGame((s) => s.attack);
  const log = useGame((s) => s.log);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [attackSize, setAttackSize] = useState(10);
  const [buyQty, setBuyQty] = useState(10);

  useEffect(() => {
    if (!initialized) navigate({ to: "/" });
  }, [initialized, navigate]);

  useEffect(() => {
    const id = setInterval(() => doTick(), 1000);
    return () => clearInterval(id);
  }, [doTick]);

  const player = playerEmpireId ? empires[playerEmpireId] : null;
  const owned = useMemo(
    () => Object.values(countries).filter((c) => c.ownerId === playerEmpireId),
    [countries, playerEmpireId],
  );
  const income = owned.reduce((sum, c) => sum + c.gdpT * INCOME_PER_GDP_T, 0);
  const totalArmies = owned.reduce((s, c) => s + c.armies, 0);
  const totalGdp = owned.reduce((s, c) => s + c.gdpT, 0);

  const selected = selectedId ? countries[selectedId] : null;
  const target = targetId ? countries[targetId] : null;

  // ranking
  const ranking = useMemo(() => {
    const map = new Map<string, { empire: typeof empires[string]; count: number; gdp: number; armies: number }>();
    for (const e of Object.values(empires)) map.set(e.id, { empire: e, count: 0, gdp: 0, armies: 0 });
    for (const c of Object.values(countries)) {
      const r = map.get(c.ownerId);
      if (r) {
        r.count++;
        r.gdp += c.gdpT;
        r.armies += c.armies;
      }
    }
    return Array.from(map.values()).filter((r) => r.count > 0).sort((a, b) => b.gdp - a.gdp).slice(0, 8);
  }, [countries, empires]);

  const fillFor = (id: string) => {
    const c = countries[id];
    if (!c) return "oklch(0.5 0.04 80)";
    const e = empires[c.ownerId];
    return e?.color ?? "oklch(0.5 0.04 80)";
  };

  if (!player) return null;

  const selectionOwned = selected?.ownerId === playerEmpireId;

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      {/* HUD */}
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-md flex items-center justify-center" style={{ background: player.color }}>
            <Crown className="size-5 text-background" />
          </div>
          <div>
            <div className="text-sm font-semibold">{player.name}</div>
            <div className="text-xs text-muted-foreground">Empire of {player.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <Stat icon={<Coins className="size-4 text-primary" />} label="Coins" value={Math.floor(player.coins).toLocaleString()} sub={`+${income.toFixed(0)}/s`} />
          <Stat icon={<Shield className="size-4 text-primary" />} label="Armies" value={totalArmies.toLocaleString()} />
          <Stat icon={<Crown className="size-4 text-primary" />} label="Territory" value={`${owned.length} · $${totalGdp.toFixed(1)}T`} />
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
          <Home className="size-4 mr-1" /> Menu
        </Button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <main className="flex-1 relative bg-background">
          <WorldMap
            fillFor={fillFor}
            selectedId={selectedId}
            highlightId={targetId}
            onCountryClick={(c) => {
              const country = countries[c.id];
              if (!country) return;
              if (!selectedId) {
                setSelectedId(c.id);
                setTargetId(null);
              } else if (selectedId === c.id) {
                setSelectedId(null);
                setTargetId(null);
              } else {
                // if selected is mine and clicked is not mine → set target
                const sel = countries[selectedId];
                if (sel && sel.ownerId === playerEmpireId && country.ownerId !== playerEmpireId) {
                  setTargetId(c.id);
                } else {
                  setSelectedId(c.id);
                  setTargetId(null);
                }
              }
            }}
          />

          {/* Selection overlay */}
          {selected && (
            <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-[420px] rounded-lg border border-border bg-card/95 backdrop-blur p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Selected</div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    <span className="inline-block size-3 rounded-sm" style={{ background: empires[selected.ownerId]?.color }} />
                    {selected.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ruled by {empires[selected.ownerId]?.name} · ${selected.gdpT.toFixed(2)}T · {(selected.gdpT * INCOME_PER_GDP_T).toFixed(0)}/s
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{selected.armies}</div>
                  <div className="text-xs text-muted-foreground">armies</div>
                </div>
              </div>

              {selectionOwned && !target && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="text-xs text-muted-foreground mb-2">Recruit armies — {ARMY_COST} coins each</div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => setBuyQty(Math.max(1, buyQty - 5))}><Minus className="size-4" /></Button>
                    <div className="flex-1 text-center font-mono text-lg">{buyQty}</div>
                    <Button size="icon" variant="outline" onClick={() => setBuyQty(buyQty + 5)}><Plus className="size-4" /></Button>
                    <Button
                      onClick={() => buyArmies(selected.id, buyQty)}
                      disabled={player.coins < buyQty * ARMY_COST}
                    >
                      Buy · {buyQty * ARMY_COST}c
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Click an enemy country to plan an invasion.</p>
                </div>
              )}

              {selectionOwned && target && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="text-xs text-muted-foreground mb-1">Invading</div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold flex items-center gap-2">
                      <span className="inline-block size-3 rounded-sm" style={{ background: empires[target.ownerId]?.color }} />
                      {target.name}
                    </div>
                    <div className="text-sm"><Shield className="inline size-3 mr-1" />{target.armies}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => setAttackSize(Math.max(1, attackSize - 5))}><Minus className="size-4" /></Button>
                    <input
                      type="range"
                      min={1}
                      max={selected.armies}
                      value={Math.min(attackSize, selected.armies)}
                      onChange={(e) => setAttackSize(Number(e.target.value))}
                      className="flex-1"
                    />
                    <Button size="icon" variant="outline" onClick={() => setAttackSize(Math.min(selected.armies, attackSize + 5))}><Plus className="size-4" /></Button>
                  </div>
                  <div className="mt-1 text-center text-sm font-mono">{Math.min(attackSize, selected.armies)} / {selected.armies}</div>
                  <Button
                    className="w-full mt-2"
                    variant="destructive"
                    disabled={selected.armies < 1}
                    onClick={() => {
                      attack(selected.id, target.id, Math.min(attackSize, selected.armies));
                      setTargetId(null);
                    }}
                  >
                    <Swords className="size-4 mr-2" /> Attack
                  </Button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-80 border-l border-border bg-card/60 backdrop-blur">
          <div className="p-4 border-b border-border">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">World Powers</div>
            <div className="space-y-2">
              {ranking.map((r) => (
                <div key={r.empire.id} className="flex items-center gap-2 text-sm">
                  <span className="inline-block size-3 rounded-sm shrink-0" style={{ background: r.empire.color }} />
                  <span className={`flex-1 truncate ${r.empire.isPlayer ? "font-bold text-primary" : ""}`}>{r.empire.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">${r.gdp.toFixed(1)}T</span>
                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">War Log</div>
            <div className="space-y-1.5 text-xs">
              {log.length === 0 && <div className="text-muted-foreground">No events yet.</div>}
              {log.map((l, i) => (
                <div key={i} className="text-muted-foreground border-l-2 border-border pl-2 py-0.5">{l}</div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="font-mono font-semibold tabular-nums">{value}</span>
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}{sub ? ` · ${sub}` : ""}
      </div>
    </div>
  );
}
