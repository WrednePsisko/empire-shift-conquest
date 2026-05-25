import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { WorldMap, type MapMarker, type MapMovement, type MapViewTarget } from "@/components/WorldMap";
import {
  useGame,
  UNIT_STATS,
  UNIT_TYPES,
  INCOME_PER_GDP_T,
  unitPower,
  unitTotal,
  gameDateLabel,
  type UnitType,
  type Units,
} from "@/lib/gameStore";
import { Button } from "@/components/ui/button";
import {
  Coins, Crown, Shield, Swords, Home, Pause, Play as PlayIcon,
  FastForward, Handshake, Flag, X, Calendar, Users,
} from "lucide-react";

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
  const tick = useGame((s) => s.tick);
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const relations = useGame((s) => s.relations);
  const movements = useGame((s) => s.movements);
  const proposeAlliance = useGame((s) => s.proposeAlliance);
  const breakAlliance = useGame((s) => s.breakAlliance);
  const declareWar = useGame((s) => s.declareWar);
  const makePeace = useGame((s) => s.makePeace);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [sendFraction, setSendFraction] = useState(0.75);
  const [focus, setFocus] = useState<MapViewTarget | null>(null);
  const [panel, setPanel] = useState<"selected" | "diplomacy" | "log" | null>("selected");

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
    if (speed === 0) return;
    const interval = Math.max(150, 1000 / speed);
    const id = setInterval(() => doTick(), interval);
    return () => clearInterval(id);
  }, [doTick, speed]);

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
      if (r) { r.count++; r.gdp += c.gdpT; r.armies += unitTotal(c.units); }
    }
    return Array.from(map.values()).filter((r) => r.count > 0).sort((a, b) => b.gdp - a.gdp);
  }, [countries, empires]);

  const topRanking = ranking.slice(0, 10);

  const fillFor = (id: string) => {
    const c = countries[id];
    if (!c) return "#3d4a3a";
    const e = empires[c.ownerId];
    return e?.color ?? "#3d4a3a";
  };

  const markers: MapMarker[] = useMemo(() => {
    const arr: MapMarker[] = [];
    for (const c of Object.values(countries)) {
      const total = unitTotal(c.units);
      if (total <= 0) continue;
      const empire = empires[c.ownerId];
      if (!empire) continue;
      let dominant: UnitType = "infantry";
      let best = -1;
      for (const t of UNIT_TYPES) {
        const score = c.units[t] * UNIT_STATS[t].power;
        if (score > best) { best = score; dominant = t; }
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

  const mapMovements: MapMovement[] = useMemo(
    () =>
      movements.map((m) => ({
        id: m.id,
        fromId: m.fromId,
        toId: m.toId,
        startMs: m.startMs,
        durationMs: m.durationMs,
        color: empires[m.attackerEmpireId]?.color ?? "#fff",
      })),
    [movements, empires],
  );

  if (!player) return null;

  const selectionOwned = selected?.ownerId === playerEmpireId;
  const relWithTarget = selected && playerEmpireId ? relations[playerEmpireId]?.[selected.ownerId] ?? "neutral" : "neutral";

  const handleCountryClick = (id: string) => {
    const country = countries[id];
    if (!country) return;
    setPanel("selected");
    if (!selectedId) {
      setSelectedId(id);
      setTargetId(null);
    } else if (selectedId === id) {
      setSelectedId(null);
      setTargetId(null);
    } else {
      const sel = countries[selectedId];
      if (sel && sel.ownerId === playerEmpireId && country.ownerId !== playerEmpireId) {
        const r = relations[playerEmpireId!]?.[country.ownerId] ?? "neutral";
        if (r === "ally") {
          setSelectedId(id); setTargetId(null);
        } else {
          setTargetId(id);
        }
      } else {
        setSelectedId(id); setTargetId(null);
      }
    }
  };

  const launchAttack = () => {
    if (!selected || !target) return;
    const send: Units = { ...emptyUnits() };
    for (const t of UNIT_TYPES) send[t] = Math.floor(selected.units[t] * sendFraction);
    if (unitTotal(send) < 1) return;
    attack(selected.id, target.id, send);
    setTargetId(null);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col">
      {/* Top HUD */}
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-card/70 backdrop-blur z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-8 rounded-md flex items-center justify-center shrink-0" style={{ background: player.color }}>
            <Crown className="size-4 text-background" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate leading-tight">{player.name}</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 leading-tight">
              <Calendar className="size-3" /> {gameDateLabel(tick)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Stat icon={<Coins className="size-3.5 text-primary" />} value={Math.floor(player.coins).toLocaleString()} sub={`+${income.toFixed(0)}/s`} />
          <Stat icon={<Shield className="size-3.5 text-primary" />} value={totalArmies.toLocaleString()} />
          <Stat icon={<Crown className="size-3.5 text-primary" />} value={`${owned.length}`} sub={`$${totalGdp.toFixed(1)}T`} />
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })} aria-label="Menu">
          <Home className="size-4" />
        </Button>
      </header>

      {/* Time controls */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-card/50 backdrop-blur z-10">
        <SpeedBtn active={speed === 0} onClick={() => setSpeed(0)} icon={<Pause className="size-3.5" />} label="Pause" />
        <SpeedBtn active={speed === 1} onClick={() => setSpeed(1)} icon={<PlayIcon className="size-3.5" />} label="1×" />
        <SpeedBtn active={speed === 2} onClick={() => setSpeed(2)} icon={<FastForward className="size-3.5" />} label="2×" />
        <SpeedBtn active={speed === 4} onClick={() => setSpeed(4)} icon={<FastForward className="size-3.5" />} label="4×" />
        <div className="flex-1" />
        <Button
          size="sm"
          variant={panel === "diplomacy" ? "default" : "outline"}
          className="h-8 px-2 text-xs"
          onClick={() => setPanel(panel === "diplomacy" ? null : "diplomacy")}
        >
          <Handshake className="size-3.5 mr-1" /> Diplomacy
        </Button>
        <Button
          size="sm"
          variant={panel === "log" ? "default" : "outline"}
          className="h-8 px-2 text-xs"
          onClick={() => setPanel(panel === "log" ? null : "log")}
        >
          <Users className="size-3.5 mr-1" /> Log
        </Button>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        <main className="flex-1 relative bg-background min-w-0">
          <WorldMap
            fillFor={fillFor}
            selectedId={selectedId}
            highlightId={targetId}
            markers={markers}
            movements={mapMovements}
            focusOn={focus}
            onCountryClick={(c) => handleCountryClick(c.id)}
          />

          {/* Selected country panel */}
          {selected && panel === "selected" && (
            <div className="absolute bottom-3 left-3 right-3 md:right-auto md:w-[440px] rounded-xl border border-border bg-card/95 backdrop-blur-xl p-3 shadow-2xl max-h-[60dvh] overflow-y-auto">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Selected</div>
                  <div className="text-base font-bold flex items-center gap-2">
                    <span className="inline-block size-3 rounded-sm shrink-0" style={{ background: empires[selected.ownerId]?.color }} />
                    <span className="truncate">{selected.name}</span>
                    {!selectionOwned && (
                      <RelationBadge relation={relWithTarget} />
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {empires[selected.ownerId]?.name} · ${selected.gdpT.toFixed(2)}T · {(selected.gdpT * INCOME_PER_GDP_T).toFixed(0)}/s
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setFocus({ countryId: selected.id, scale: 6 })}>
                    Focus
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setSelectedId(null); setTargetId(null); }}>
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-6 gap-1 text-center text-xs">
                {UNIT_TYPES.map((t) => (
                  <div key={t} className="rounded-md border border-border/60 bg-background/40 p-1.5">
                    <div className="text-base leading-none">{UNIT_STATS[t].icon}</div>
                    <div className="font-mono font-semibold text-xs">{selected.units[t]}</div>
                  </div>
                ))}
              </div>
              <div className="text-center text-[10px] text-muted-foreground mt-1">
                Total power <span className="font-mono text-foreground">{unitPower(selected.units)}</span>
              </div>

              {selectionOwned && !target && (
                <div className="mt-3 border-t border-border pt-2 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Recruit</div>
                  {UNIT_TYPES.map((t) => (
                    <div key={t} className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 w-[120px] shrink-0">
                        <span className="text-base">{UNIT_STATS[t].icon}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-medium leading-none truncate">{UNIT_STATS[t].label}</div>
                          <div className="text-[10px] text-muted-foreground">{UNIT_STATS[t].cost}c·⚔{UNIT_STATS[t].power}</div>
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
                              className="px-1.5 h-7 text-[11px] min-w-[34px]"
                              disabled={disabled}
                              onClick={() => buyUnits(selected.id, t, q)}
                            >
                              +{q}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="pt-1 text-[11px] text-muted-foreground">Tap an enemy country to invade.</p>
                </div>
              )}

              {selectionOwned && target && (
                <div className="mt-3 border-t border-border pt-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Invading</div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold flex items-center gap-2 min-w-0">
                      <span className="inline-block size-3 rounded-sm shrink-0" style={{ background: empires[target.ownerId]?.color }} />
                      <span className="truncate">{target.name}</span>
                    </div>
                    <div className="text-xs">Power <span className="font-mono">{unitPower(target.units)}</span></div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-1">
                    Deploy {Math.round(sendFraction * 100)}% of garrison
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={Math.round(sendFraction * 100)}
                    onChange={(e) => setSendFraction(Number(e.target.value) / 100)}
                    className="w-full accent-primary"
                  />
                  <div className="mt-1 grid grid-cols-6 gap-1 text-center text-[11px]">
                    {UNIT_TYPES.map((t) => (
                      <div key={t} className="rounded bg-background/40 py-1">
                        <div>{UNIT_STATS[t].icon}</div>
                        <div className="font-mono">{Math.floor(selected.units[t] * sendFraction)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button variant="ghost" className="flex-1 h-10" onClick={() => setTargetId(null)}>Cancel</Button>
                    <Button className="flex-1 h-10" variant="destructive" onClick={launchAttack}>
                      <Swords className="size-4 mr-1.5" /> Launch
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diplomacy panel */}
          {panel === "diplomacy" && (
            <div className="absolute bottom-3 left-3 right-3 md:right-auto md:w-[440px] rounded-xl border border-border bg-card/95 backdrop-blur-xl p-3 shadow-2xl max-h-[65dvh] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Handshake className="size-4 text-primary" /> Diplomatic Relations
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPanel("selected")}>
                  <X className="size-4" />
                </Button>
              </div>
              <div className="space-y-1.5">
                {topRanking
                  .filter((r) => !r.empire.isPlayer)
                  .map((r) => {
                    const rel = relations[playerEmpireId!]?.[r.empire.id] ?? "neutral";
                    return (
                      <div key={r.empire.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 p-2">
                        <span className="inline-block size-3 rounded-sm shrink-0" style={{ background: r.empire.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{r.empire.name}</div>
                          <div className="text-[10px] text-muted-foreground tabular-nums">
                            {r.count} territories · ${r.gdp.toFixed(1)}T · ⚔{r.armies}
                          </div>
                        </div>
                        <RelationBadge relation={rel} />
                        <div className="flex gap-1">
                          {rel === "neutral" && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => proposeAlliance(r.empire.id)}>
                                <Handshake className="size-3 mr-1" /> Ally
                              </Button>
                              <Button size="sm" variant="destructive" className="h-7 px-2 text-[11px]" onClick={() => declareWar(r.empire.id)}>
                                <Flag className="size-3 mr-1" /> War
                              </Button>
                            </>
                          )}
                          {rel === "ally" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => breakAlliance(r.empire.id)}>
                              Break
                            </Button>
                          )}
                          {rel === "war" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => makePeace(r.empire.id)}>
                              Peace
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Log panel */}
          {panel === "log" && (
            <div className="absolute bottom-3 left-3 right-3 md:right-auto md:w-[440px] rounded-xl border border-border bg-card/95 backdrop-blur-xl p-3 shadow-2xl max-h-[55dvh] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">War Log</div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPanel("selected")}>
                  <X className="size-4" />
                </Button>
              </div>
              <div className="space-y-1 text-xs">
                {log.length === 0 && <div className="text-muted-foreground">No events yet.</div>}
                {log.map((l, i) => (
                  <div key={i} className="text-muted-foreground border-l-2 border-border pl-2 py-0.5">{l}</div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Desktop side rail */}
        <aside className="hidden lg:flex flex-col w-80 border-l border-border bg-card/60 backdrop-blur">
          <div className="p-4 border-b border-border">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">World Powers</div>
            <div className="space-y-2">
              {topRanking.map((r) => {
                const rel = r.empire.isPlayer ? null : relations[playerEmpireId!]?.[r.empire.id] ?? "neutral";
                return (
                  <div key={r.empire.id} className="flex items-center gap-2 text-sm">
                    <span className="inline-block size-3 rounded-sm shrink-0" style={{ background: r.empire.color }} />
                    <span className={`flex-1 truncate ${r.empire.isPlayer ? "font-bold text-primary" : ""}`}>{r.empire.name}</span>
                    {rel && <RelationBadge relation={rel} small />}
                    <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">${r.gdp.toFixed(1)}T</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function emptyUnits(): Units {
  return { infantry: 0, tank: 0, artillery: 0, aircraft: 0, navy: 0, missile: 0 };
}

function Stat({ icon, value, sub }: { icon: React.ReactNode; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <div className="flex items-center gap-1">
        {icon}
        <span className="font-mono font-semibold tabular-nums text-xs">{value}</span>
      </div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SpeedBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-2 rounded-md text-xs flex items-center gap-1 transition-colors ${
        active ? "bg-primary text-primary-foreground font-semibold" : "bg-card border border-border hover:bg-accent"
      }`}
    >
      {icon}
      <span className="hidden xs:inline">{label}</span>
    </button>
  );
}

function RelationBadge({ relation, small = false }: { relation: "war" | "neutral" | "ally"; small?: boolean }) {
  const styles =
    relation === "ally"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : relation === "war"
      ? "bg-red-500/20 text-red-300 border-red-500/40"
      : "bg-muted text-muted-foreground border-border";
  const label = relation === "ally" ? "Allied" : relation === "war" ? "At War" : "Neutral";
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 ${small ? "text-[9px] py-0" : "text-[10px] py-0.5"} font-semibold uppercase tracking-wider ${styles}`}>
      {label}
    </span>
  );
}
