import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UnitType = "infantry" | "tank" | "artillery" | "aircraft" | "navy" | "missile";

export interface UnitStat {
  label: string;
  cost: number;
  power: number;
  icon: string;
  desc: string;
}

export const UNIT_STATS: Record<UnitType, UnitStat> = {
  infantry: { label: "Infantry", cost: 10, power: 1, icon: "🪖", desc: "Cheap boots on the ground." },
  tank: { label: "Tanks", cost: 50, power: 6, icon: "🛡", desc: "Armored ground assault." },
  artillery: { label: "Artillery", cost: 80, power: 10, icon: "💥", desc: "Long-range bombardment." },
  aircraft: { label: "Aircraft", cost: 200, power: 25, icon: "✈", desc: "Air superiority strike." },
  navy: { label: "Navy", cost: 300, power: 35, icon: "🚢", desc: "Project power across oceans." },
  missile: { label: "Missiles", cost: 600, power: 80, icon: "🚀", desc: "Devastating strategic weapon." },
};

export const UNIT_TYPES: UnitType[] = ["infantry", "tank", "artillery", "aircraft", "navy", "missile"];
export const INCOME_PER_GDP_T = 100;

export type Units = Record<UnitType, number>;

const emptyUnits = (): Units => ({ infantry: 0, tank: 0, artillery: 0, aircraft: 0, navy: 0, missile: 0 });

export function unitPower(u: Units): number {
  let p = 0;
  for (const t of UNIT_TYPES) p += u[t] * UNIT_STATS[t].power;
  return p;
}
export function unitTotal(u: Units): number {
  let n = 0;
  for (const t of UNIT_TYPES) n += u[t];
  return n;
}

export type Relation = "war" | "neutral" | "ally";

export interface Empire {
  id: string;
  name: string;
  color: string;
  isPlayer: boolean;
  coins: number;
}

export interface Country {
  id: string;
  name: string;
  gdpT: number;
  ownerId: string;
  units: Units;
  centroid: [number, number]; // [lon, lat]
}

export interface Movement {
  id: string;
  fromId: string;
  toId: string;
  sent: Units;
  attackerEmpireId: string;
  startMs: number;
  durationMs: number;
}

export type ProposalKind = "alliance" | "peace";
export interface Proposal {
  id: string;
  fromEmpireId: string;
  kind: ProposalKind;
  createdMs: number;
}

export interface GameState {
  initialized: boolean;
  countries: Record<string, Country>;
  empires: Record<string, Empire>;
  playerEmpireId: string | null;
  playerCapitalId: string | null;
  tick: number;
  startMs: number;
  speed: number; // 0 paused, 1, 2, 4
  prevSpeed: number; // used when auto-pausing for proposals
  log: string[];
  relations: Record<string, Record<string, Relation>>;
  opinions: Record<string, Record<string, number>>;
  movements: Movement[];
  pendingProposals: Proposal[];

  initGame: (playerCountryId: string, playerCountryName: string, allCountries: { id: string; name: string; gdpT: number; centroid: [number, number] }[]) => void;
  resetGame: () => void;
  setSpeed: (s: number) => void;
  buyUnits: (countryId: string, type: UnitType, qty: number) => void;
  attack: (fromId: string, toId: string, sent: Units) => void;
  doTick: () => void;
  pushLog: (msg: string) => void;
  getRelation: (a: string, b: string) => Relation;
  setRelation: (a: string, b: string, r: Relation) => void;
  getOpinion: (a: string, b: string) => number;
  adjustOpinion: (a: string, b: string, delta: number) => void;
  proposeAlliance: (targetEmpireId: string) => { accepted: boolean; reason: string };
  breakAlliance: (targetEmpireId: string) => void;
  declareWar: (targetEmpireId: string) => void;
  makePeace: (targetEmpireId: string) => void;
  resolveProposal: (id: string, accept: boolean) => void;
}


const EMPIRE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef",
  "#ec4899", "#f43f5e", "#a855f7", "#0ea5e9", "#10b981",
  "#f59e0b", "#6366f1", "#dc2626", "#7c3aed", "#0891b2",
];

function seedUnits(gdpT: number): Units {
  const base = Math.max(5, Math.floor(gdpT * 25 + Math.random() * 10));
  return {
    infantry: base,
    tank: Math.floor(base / 6 + Math.random() * 3),
    artillery: Math.floor(base / 10 + Math.random() * 2),
    aircraft: Math.floor(base / 20 + Math.random() * 2),
    navy: gdpT > 0.4 ? Math.floor(base / 25 + Math.random() * 2) : 0,
    missile: gdpT > 1 ? Math.floor(Math.random() * 2) : 0,
  };
}

function pairKey(state: GameState, a: string, b: string): Relation {
  return state.relations[a]?.[b] ?? "neutral";
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      initialized: false,
      countries: {},
      empires: {},
      playerEmpireId: null,
      playerCapitalId: null,
      tick: 0,
      startMs: 0,
      speed: 1,
      prevSpeed: 1,
      log: [],
      relations: {},
      opinions: {},
      movements: [],
      pendingProposals: [],


      initGame: (playerCountryId, playerCountryName, allCountries) => {
        const countries: Record<string, Country> = {};
        const empires: Record<string, Empire> = {};
        const playerEmpireId = `e_${playerCountryId}`;

        empires[playerEmpireId] = {
          id: playerEmpireId,
          name: playerCountryName,
          color: "#fbbf24",
          isPlayer: true,
          coins: 800,
        };

        let colorIdx = 0;
        for (const c of allCountries) {
          const empireId = c.id === playerCountryId ? playerEmpireId : `e_${c.id}`;
          if (!empires[empireId]) {
            empires[empireId] = {
              id: empireId,
              name: c.name,
              color: EMPIRE_COLORS[colorIdx % EMPIRE_COLORS.length],
              isPlayer: false,
              coins: 50 + Math.random() * 200,
            };
            colorIdx++;
          }
          countries[c.id] = {
            id: c.id,
            name: c.name,
            gdpT: c.gdpT,
            ownerId: empireId,
            units: seedUnits(c.gdpT),
            centroid: c.centroid,
          };
        }

        if (countries[playerCountryId]) {
          countries[playerCountryId].units = {
            infantry: 50, tank: 12, artillery: 6, aircraft: 4, navy: 2, missile: 0,
          };
        }

        set({
          initialized: true,
          countries,
          empires,
          playerEmpireId,
          playerCapitalId: playerCountryId,
          tick: 0,
          startMs: Date.now(),
          speed: 1,
          relations: {},
          opinions: {},
          movements: [],

          log: [`${playerCountryName} rises. Your empire begins.`],
        });
      },

      resetGame: () =>
        set({
          initialized: false,
          countries: {},
          empires: {},
          playerEmpireId: null,
          playerCapitalId: null,
          tick: 0,
          startMs: 0,
          speed: 1,
          log: [],
          relations: {},
          opinions: {},
          movements: [],
        }),


      setSpeed: (speed) => set({ speed }),

      pushLog: (msg) => set((s) => ({ log: [msg, ...s.log].slice(0, 60) })),

      getRelation: (a, b) => {
        if (a === b) return "ally";
        return get().relations[a]?.[b] ?? "neutral";
      },

      setRelation: (a, b, r) => {
        if (a === b) return;
        set((s) => {
          const next = { ...s.relations };
          next[a] = { ...(next[a] ?? {}), [b]: r };
          next[b] = { ...(next[b] ?? {}), [a]: r };
          return { relations: next };
        });
      },

      getOpinion: (a, b) => {
        if (a === b) return 100;
        return get().opinions[a]?.[b] ?? 0;
      },

      adjustOpinion: (a, b, delta) => {
        if (a === b || delta === 0) return;
        set((s) => {
          const cur = s.opinions[a]?.[b] ?? 0;
          const next = Math.max(-100, Math.min(100, cur + delta));
          const op = { ...s.opinions };
          op[a] = { ...(op[a] ?? {}), [b]: next };
          op[b] = { ...(op[b] ?? {}), [a]: next };
          return { opinions: op };
        });
      },

      proposeAlliance: (targetEmpireId) => {
        const s = get();
        const playerId = s.playerEmpireId!;
        if (targetEmpireId === playerId) return { accepted: false, reason: "Cannot ally with yourself." };
        const cur = pairKey(s, playerId, targetEmpireId);
        if (cur === "ally") return { accepted: false, reason: "Already allied." };
        if (cur === "war") return { accepted: false, reason: "End the war first." };

        // Acceptance odds: based on relative power + opinion
        const player = s.empires[playerId];
        const target = s.empires[targetEmpireId];
        if (!target) return { accepted: false, reason: "No such empire." };
        const playerPower =
          Object.values(s.countries).filter((c) => c.ownerId === playerId).reduce((a, c) => a + unitPower(c.units) + c.gdpT * 50, 0);
        const targetPower =
          Object.values(s.countries).filter((c) => c.ownerId === targetEmpireId).reduce((a, c) => a + unitPower(c.units) + c.gdpT * 50, 0);
        const ratio = playerPower / Math.max(1, targetPower);
        const opinion = s.opinions[playerId]?.[targetEmpireId] ?? 0;
        const accept = Math.random() < Math.min(0.95, 0.2 + ratio * 0.3 + opinion / 150);
        if (accept) {
          get().setRelation(playerId, targetEmpireId, "ally");
          get().adjustOpinion(playerId, targetEmpireId, 30);
          get().pushLog(`🤝 ${target.name} accepted an alliance with ${player.name}.`);
          return { accepted: true, reason: "Alliance signed." };
        }
        get().adjustOpinion(playerId, targetEmpireId, -5);
        get().pushLog(`✋ ${target.name} declined the alliance proposal.`);
        return { accepted: false, reason: `${target.name} declined.` };
      },

      breakAlliance: (targetEmpireId) => {
        const s = get();
        const playerId = s.playerEmpireId!;
        get().setRelation(playerId, targetEmpireId, "neutral");
        get().adjustOpinion(playerId, targetEmpireId, -25);
        get().pushLog(`💔 Alliance with ${s.empires[targetEmpireId]?.name} dissolved.`);
      },

      declareWar: (targetEmpireId) => {
        const s = get();
        const playerId = s.playerEmpireId!;
        get().setRelation(playerId, targetEmpireId, "war");
        get().adjustOpinion(playerId, targetEmpireId, -50);
        get().pushLog(`⚔️ You declared war on ${s.empires[targetEmpireId]?.name}!`);
      },

      makePeace: (targetEmpireId) => {
        const s = get();
        const playerId = s.playerEmpireId!;
        const opinion = s.opinions[playerId]?.[targetEmpireId] ?? 0;
        const chance = Math.max(0.2, Math.min(0.9, 0.5 + opinion / 200));
        if (Math.random() < chance) {
          get().setRelation(playerId, targetEmpireId, "neutral");
          get().adjustOpinion(playerId, targetEmpireId, 15);
          get().pushLog(`🕊 Peace agreed with ${s.empires[targetEmpireId]?.name}.`);
        } else {
          get().adjustOpinion(playerId, targetEmpireId, -5);
          get().pushLog(`${s.empires[targetEmpireId]?.name} refuses peace.`);
        }
      },



      buyUnits: (countryId, type, qty) => {
        if (qty <= 0) return;
        const s = get();
        const country = s.countries[countryId];
        if (!country) return;
        const empire = s.empires[country.ownerId];
        if (!empire?.isPlayer) return;
        const cost = qty * UNIT_STATS[type].cost;
        if (empire.coins < cost) return;
        set({
          empires: { ...s.empires, [empire.id]: { ...empire, coins: empire.coins - cost } },
          countries: {
            ...s.countries,
            [countryId]: { ...country, units: { ...country.units, [type]: country.units[type] + qty } },
          },
        });
      },

      attack: (fromId, toId, sent) => {
        const s = get();
        const from = s.countries[fromId];
        const to = s.countries[toId];
        if (!from || !to || fromId === toId) return;
        const sameOwner = from.ownerId === to.ownerId;
        // alliance check only matters for hostile movement
        if (!sameOwner && pairKey(s, from.ownerId, to.ownerId) === "ally") return;
        const total = unitTotal(sent);
        if (total < 1) return;
        for (const t of UNIT_TYPES) if (sent[t] > from.units[t]) return;


        // Deduct sent units from source immediately (they're en route)
        const fromRemaining: Units = { ...emptyUnits() };
        for (const t of UNIT_TYPES) fromRemaining[t] = from.units[t] - sent[t];

        // If attacker was at peace, this declares war (only on hostile moves)
        const attackerEmpire = s.empires[from.ownerId];
        const defenderEmpire = s.empires[to.ownerId];
        if (!sameOwner && attackerEmpire && defenderEmpire) {
          if (pairKey(s, attackerEmpire.id, defenderEmpire.id) !== "war") {
            get().setRelation(attackerEmpire.id, defenderEmpire.id, "war");
          }
          get().adjustOpinion(attackerEmpire.id, defenderEmpire.id, -30);
        }



        const movement: Movement = {
          id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          fromId,
          toId,
          sent,
          attackerEmpireId: from.ownerId,
          startMs: Date.now(),
          durationMs: 2200,
        };

        set({
          countries: { ...s.countries, [fromId]: { ...from, units: fromRemaining } },
          movements: [...s.movements, movement],
        });
      },

      doTick: () => {
        const s = get();
        if (s.speed === 0) return;

        // Resolve arrived movements
        const now = Date.now();
        const arrived: Movement[] = [];
        const stillMoving: Movement[] = [];
        for (const m of s.movements) {
          if (now - m.startMs >= m.durationMs) arrived.push(m);
          else stillMoving.push(m);
        }

        const empires = { ...s.empires };
        const countries = { ...s.countries };

        // Income
        for (const c of Object.values(countries)) {
          const e = empires[c.ownerId];
          if (e) empires[e.id] = { ...empires[e.id], coins: empires[e.id].coins + c.gdpT * INCOME_PER_GDP_T };
        }

        // Resolve battles
        for (const m of arrived) {
          const to = countries[m.toId];
          if (!to) continue;
          const attackerEmpire = empires[m.attackerEmpireId];
          const defenderEmpire = empires[to.ownerId];
          // owner may have changed in flight; if it's now ally, abort
          if (to.ownerId === m.attackerEmpireId) {
            // reinforce instead
            countries[m.toId] = {
              ...to,
              units: addUnits(to.units, m.sent),
            };
            continue;
          }
          const attackPower = unitPower(m.sent);
          const defendPower = unitPower(to.units);
          const atkLoss = Math.min(1, (defendPower + 1) / (attackPower + defendPower + 1));
          const defLoss = Math.min(1, (attackPower + 1) / (attackPower + defendPower + 1));
          const newSent: Units = scaleUnits(m.sent, 1 - atkLoss);
          const newDef: Units = scaleUnits(to.units, 1 - defLoss);
          const conquered = attackPower > defendPower;
          if (conquered) {
            countries[m.toId] = { ...to, units: newSent, ownerId: m.attackerEmpireId };
            if (attackerEmpire?.isPlayer) {
              get().pushLog(`⚔️ Conquered ${to.name}! +${(to.gdpT * INCOME_PER_GDP_T).toFixed(0)}/s.`);
            } else if (defenderEmpire?.isPlayer) {
              get().pushLog(`💀 ${attackerEmpire?.name} seized ${to.name} from you.`);
            }
          } else {
            countries[m.toId] = { ...to, units: newDef };
            const src = countries[m.fromId];
            if (src && src.ownerId === m.attackerEmpireId) {
              countries[m.fromId] = { ...src, units: addUnits(src.units, newSent) };
            }
            if (attackerEmpire?.isPlayer) {
              get().pushLog(`Attack on ${to.name} repelled.`);
            } else if (defenderEmpire?.isPlayer) {
              get().pushLog(`🛡 You repelled ${attackerEmpire?.name}'s attack on ${to.name}.`);
            }
          }
        }

        set({ empires, countries, tick: s.tick + 1, movements: stillMoving });

        // AI actions
        const aiRoll = 0.18 * s.speed;
        for (const empire of Object.values(get().empires)) {
          if (empire.isPlayer) continue;
          if (Math.random() > aiRoll) continue;
          const stNow = get();
          const owned = Object.values(stNow.countries).filter((c) => c.ownerId === empire.id);
          if (owned.length === 0) continue;

          // Buy
          const buyCountry = owned[Math.floor(Math.random() * owned.length)];
          const type = UNIT_TYPES[Math.floor(Math.random() * UNIT_TYPES.length)];
          const e = stNow.empires[empire.id];
          const affordable = Math.floor(e.coins / UNIT_STATS[type].cost);
          const qty = Math.min(affordable, Math.floor(3 + Math.random() * 15));
          if (qty > 0) {
            const cost = qty * UNIT_STATS[type].cost;
            set((st) => ({
              empires: { ...st.empires, [empire.id]: { ...st.empires[empire.id], coins: st.empires[empire.id].coins - cost } },
              countries: {
                ...st.countries,
                [buyCountry.id]: {
                  ...st.countries[buyCountry.id],
                  units: { ...st.countries[buyCountry.id].units, [type]: st.countries[buyCountry.id].units[type] + qty },
                },
              },
            }));
          }

          // Diplomacy: occasionally propose alliance with player
          if (stNow.playerEmpireId && Math.random() < 0.04) {
            const rel = pairKey(stNow, empire.id, stNow.playerEmpireId);
            if (rel === "neutral") {
              const playerOwned = Object.values(stNow.countries).filter((c) => c.ownerId === stNow.playerEmpireId).length;
              if (playerOwned > 0 && Math.random() < 0.5) {
                get().setRelation(empire.id, stNow.playerEmpireId, "ally");
                get().pushLog(`🤝 ${empire.name} proposes alliance — accepted.`);
              }
            }
          }

          // Attack
          if (Math.random() < 0.55) {
            const myStrongest = owned.reduce((a, b) => (unitPower(a.units) > unitPower(b.units) ? a : b));
            const stAttack = get();
            const others = Object.values(stAttack.countries).filter(
              (c) => c.ownerId !== empire.id && pairKey(stAttack, c.ownerId, empire.id) !== "ally",
            );
            if (others.length === 0) continue;
            const targets = others.sort((a, b) => unitPower(a.units) - unitPower(b.units)).slice(0, 6);
            const target = targets[Math.floor(Math.random() * targets.length)];
            const myPower = unitPower(myStrongest.units);
            const tgtPower = unitPower(target.units);
            if (myPower > tgtPower * 1.1) {
              const send: Units = scaleUnits(myStrongest.units, 0.75);
              if (unitTotal(send) > 0) get().attack(myStrongest.id, target.id, send);
            }
          }
        }
      },
    }),
    {
      name: "empire-shift-save-v4",
      partialize: (s) => ({
        initialized: s.initialized,
        countries: s.countries,
        empires: s.empires,
        playerEmpireId: s.playerEmpireId,
        playerCapitalId: s.playerCapitalId,
        tick: s.tick,
        startMs: s.startMs,
        speed: s.speed,
        log: s.log,
        relations: s.relations,
        opinions: s.opinions,
        movements: s.movements,
      }),

    },
  ),
);

function scaleUnits(u: Units, k: number): Units {
  const out = { ...u };
  for (const t of UNIT_TYPES) out[t] = Math.max(0, Math.floor(u[t] * k));
  return out;
}
function addUnits(a: Units, b: Units): Units {
  const out = { ...a };
  for (const t of UNIT_TYPES) out[t] = a[t] + b[t];
  return out;
}

// Date helpers: 1 tick = 1 day, starting Jan 1 2025
export function gameDateLabel(tick: number): string {
  const base = new Date(Date.UTC(2025, 0, 1));
  base.setUTCDate(base.getUTCDate() + tick);
  return base.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
