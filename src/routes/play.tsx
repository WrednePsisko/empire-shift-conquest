import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { WorldMap, type MapMarker, type MapViewTarget } from "@/components/WorldMap";
import {
  useGame,
  UNIT_STATS,
  UNIT_TYPES,
  INCOME_PER_GDP_T,
  unitPower,
  unitTotal,
  type UnitType,
  type Units,
} from "@/lib/gameStore";
import { Button } from "@/components/ui/button";
import { Coins, Crown, Shield, Swords, Home } from "lucide-react";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [{ title: "Empire Shift: World Conquest — Campaign" }],
  }),
  component: Play,
});

const BUY_AMOUNTS = [1, 5, 20, 100];

function Play() {
  const navigate = useNavigate();
  const initialized = useGame((s) => s.initialized);
  const countries = useGame((s) => s.countries);
  const empires = useGame((s) => s.empires);
  const playerEmpireId = useGame((s) => s.playerEmpireId);
  const playerCapitalId = useGame((s) => s.playerCapitalId);
  const doTick = useGame((s) => s.doTick);
  const buyUnits = useGame((s) => s.buyUnits);
  const attack = useGame((s) => s.attack);
  const log = useGame((s) => s.log);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [sendFraction, setSendFraction] = useState(0.75);
  const [focus, setFocus] = useState<MapViewTarget | null>(null);

  // Initial camera zoom on player's capital
  useEffect(() => {
    if (!initialized) {
      navigate({ to: "/" });
      return;
    }
    if (playerCapitalId) {
      setFocus({ countryId: playerCapitalId, scale: 5 });
      setSelectedId(playerCapitalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

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
  const totalArmies = owned.reduce((s, c) => s + unitTotal(c.units), 0);
  const totalGdp = owned.reduce((s, c) => s + c.gdpT, 0);

  const selected = selectedId ? countries[selectedId] : null;
  const target = targetId ? countries[targetId] : null;

  const ranking = useMemo(() => {
    const map = new Map<string, { empire: typeof empires[string]; count: number; gdp: number; armies: number }>();
    for (const e of Object.values(empires)) map.set(e.id, { empire: e, count: 0, gdp: 0, armies: 0 });
    for (const c of Object.values(countries)) {
      const r = map.get(c.ownerId);
      if (r) {
        r.count++;
        r.gdp += c.gdpT;
        r.armies += unitTotal(c.units);
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

  // Map markers for armies
  const markers: MapMarker[] = useMemo(() => {
    const arr: MapMarker[] = [];
    for (const c of Object.values(countries)) {
      const total = unitTotal(c.units);
      if (total <= 0) continue;
      const empire = empires[c.ownerId];
      if (!empire) continue;
      // Choose dominant unit icon
      let dominant: UnitType = "infantry";
      let best = -1;
      for (const t of UNIT_TYPES) {
        const score = c.units[t] * UNIT_STATS[t].power;
        if (score > best) {
          best = score;
          dominant = t;
        }
      }
      arr.push({
        id: c.id,
        label: total >= 1000 ? `${Math.floor(total / 1000)}k` : String(total),
        color: empire.color,
        icon: UNIT_STATS[dominant].icon,
      });
    }
    return arr;
  }, [countries, empires]);

  if (!player) return null;

  const selectionOwned = selected?.ownerId === playerEmpireId;

  const handleCountryClick = (id: string) => {
    const country = countries[id];
    if (!country) return;
    if (!selectedId) {
      setSelectedId(id);
      setTargetId(null);
    } else if (selectedId === id) {
      setSelectedId(null);
      setTargetId(null);
    } else {
      const sel = countries[selectedId];
      if (sel && sel.ownerId === playerEmpireId && country.ownerId !== playerEmpireId) {
        setTargetId(id);
      } else {
        setSelectedId(id);
        setTargetId(null);
      }
    }
  };

  const launchAttack = () => {
    if (!selected || !target) return;
    const send: Units = {
      infantry: Math.floor(selected.units.infantry * sendFraction),
      tank: Math.floor(selected.units.tank * sendFraction),
      aircraft: Math.floor(selected.units.aircraft * sendFraction),
    };
    if (unitTotal(send) < 1) return;
    attack(selected.id, target.id, send);
    setTargetId(null);
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
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
        <main className="flex-1 relative bg-background">
          <WorldMap
            fillFor={fillFor}
            selectedId={selectedId}
            highlightId={targetId}
            markers={markers}
            focusOn={focus}
            onCountryClick={(c) => handleCountryClick(c.id)}
          />

          {selected && (
            <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-[440px] rounded-lg border border-border bg-card/95 backdrop-blur p-4 shadow-2xl max-h-[70vh] overflow-y-auto">
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFocus({ countryId: selected.id, scale: 6 })}
                >
                  Focus
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                {UNIT_TYPES.map((t) => (
                  <div key={t} className="rounded-md border border-border/60 bg-background/40 p-2">
                    <div className="text-lg">{UNIT_STATS[t].icon}</div>
                    <div className="font-mono font-semibold">{selected.units[t]}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{UNIT_STATS[t].label}</div>
                  </div>
                ))}
              </div>
              <div className="text-center text-xs text-muted-foreground mt-1">
                Total power: <span className="font-mono text-foreground">{unitPower(selected.units)}</span>
              </div>

              {selectionOwned && !target && (
                <div className="mt-3 border-t border-border pt-3 space-y-2">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Recruit</div>
                  {UNIT_TYPES.map((t) => (
                    <div key={t} className="flex items-center gap-2">
                      <div className="flex items-center gap-2 w-28">
                        <span>{UNIT_STATS[t].icon}</span>
                        <div>
                          <div className="text-sm font-medium leading-none">{UNIT_STATS[t].label}</div>
                          <div className="text-[10px] text-muted-foreground">{UNIT_STATS[t].cost}c · ⚔{UNIT_STATS[t].power}</div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-1 justify-end">
                        {BUY_AMOUNTS.map((q) => {
                          const cost = q * UNIT_STATS[t].cost;
                          const disabled = player.coins < cost;
                          return (
                            <Button
                              key={q}
                              size="sm"
                              variant="outline"
                              className="px-2 h-8 text-xs"
                              disabled={disabled}
                              onClick={() => buyUnits(selected.id, t, q)}
                              title={`Buy ${q} for ${cost} coins`}
                            >
                              +{q}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-muted-foreground">Click an enemy country to plan an invasion.</p>
                </div>
              )}

              {selectionOwned && target && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Invading</div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold flex items-center gap-2">
                      <span className="inline-block size-3 rounded-sm" style={{ background: empires[target.ownerId]?.color }} />
                      {target.name}
                    </div>
                    <div className="text-sm">Power <span className="font-mono">{unitPower(target.units)}</span></div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Deploy {Math.round(sendFraction * 100)}% of garrison
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={Math.round(sendFraction * 100)}
                    onChange={(e) => setSendFraction(Number(e.target.value) / 100)}
                    className="w-full"
                  />
                  <div className="mt-1 grid grid-cols-3 gap-1 text-center text-xs">
                    {UNIT_TYPES.map((t) => (
                      <div key={t} className="rounded bg-background/40 py-1">
                        <span className="mr-1">{UNIT_STATS[t].icon}</span>
                        <span className="font-mono">{Math.floor(selected.units[t] * sendFraction)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setTargetId(null)}>Cancel</Button>
                    <Button className="flex-1" variant="destructive" onClick={launchAttack}>
                      <Swords className="size-4 mr-2" /> Attack
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

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
