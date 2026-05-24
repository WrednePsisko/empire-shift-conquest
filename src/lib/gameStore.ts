import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UnitType = "infantry" | "tank" | "aircraft";

export interface UnitStat {
  label: string;
  cost: number;
  power: number;
  icon: string; // emoji fallback used for map marker
}

export const UNIT_STATS: Record<UnitType, UnitStat> = {
  infantry: { label: "Infantry", cost: 10, power: 1, icon: "🪖" },
  tank: { label: "Tanks", cost: 50, power: 6, icon: "🛡" },
  aircraft: { label: "Aircraft", cost: 200, power: 25, icon: "✈" },
};

export const UNIT_TYPES: UnitType[] = ["infantry", "tank", "aircraft"];
export const INCOME_PER_GDP_T = 100;

export type Units = Record<UnitType, number>;

const emptyUnits = (): Units => ({ infantry: 0, tank: 0, aircraft: 0 });

export function unitPower(u: Units): number {
  return u.infantry * UNIT_STATS.infantry.power + u.tank * UNIT_STATS.tank.power + u.aircraft * UNIT_STATS.aircraft.power;
}

export function unitTotal(u: Units): number {
  return u.infantry + u.tank + u.aircraft;
}

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
}

export interface GameState {
  initialized: boolean;
  countries: Record<string, Country>;
  empires: Record<string, Empire>;
  playerEmpireId: string | null;
  playerCapitalId: string | null;
  tick: number;
  log: string[];

  initGame: (playerCountryId: string, playerCountryName: string, allCountries: { id: string; name: string; gdpT: number }[]) => void;
  resetGame: () => void;
  buyUnits: (countryId: string, type: UnitType, qty: number) => void;
  attack: (fromId: string, toId: string, sent: Units) => void;
  doTick: () => void;
  pushLog: (msg: string) => void;
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
    aircraft: Math.floor(base / 20 + Math.random() * 2),
  };
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
      log: [],

      initGame: (playerCountryId, playerCountryName, allCountries) => {
        const countries: Record<string, Country> = {};
        const empires: Record<string, Empire> = {};
        const playerEmpireId = `e_${playerCountryId}`;

        empires[playerEmpireId] = {
          id: playerEmpireId,
          name: playerCountryName,
          color: "#fbbf24",
          isPlayer: true,
          coins: 500,
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
          };
        }

        // Give the player a stronger starting force
        if (countries[playerCountryId]) {
          countries[playerCountryId].units = {
            infantry: 40,
            tank: 8,
            aircraft: 2,
          };
        }

        set({
          initialized: true,
          countries,
          empires,
          playerEmpireId,
          playerCapitalId: playerCountryId,
          tick: 0,
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
          log: [],
        }),

      pushLog: (msg) => set((s) => ({ log: [msg, ...s.log].slice(0, 40) })),

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
        if (!from || !to || from.ownerId === to.ownerId) return;
        const total = unitTotal(sent);
        if (total < 1) return;
        // can't send more than available
        for (const t of UNIT_TYPES) if (sent[t] > from.units[t]) return;

        const attackPower = unitPower(sent);
        const defendPower = unitPower(to.units);
        const attackerEmpire = s.empires[from.ownerId];
        const defenderEmpire = s.empires[to.ownerId];

        // Casualty model: each side loses a fraction proportional to the other's power.
        const atkLossRatio = Math.min(1, (defendPower + 1) / (attackPower + defendPower + 1));
        const defLossRatio = Math.min(1, (attackPower + 1) / (attackPower + defendPower + 1));

        const newSent: Units = {
          infantry: Math.max(0, Math.floor(sent.infantry * (1 - atkLossRatio))),
          tank: Math.max(0, Math.floor(sent.tank * (1 - atkLossRatio))),
          aircraft: Math.max(0, Math.floor(sent.aircraft * (1 - atkLossRatio))),
        };
        const newDef: Units = {
          infantry: Math.max(0, Math.floor(to.units.infantry * (1 - defLossRatio))),
          tank: Math.max(0, Math.floor(to.units.tank * (1 - defLossRatio))),
          aircraft: Math.max(0, Math.floor(to.units.aircraft * (1 - defLossRatio))),
        };

        const fromRemaining: Units = {
          infantry: from.units.infantry - sent.infantry,
          tank: from.units.tank - sent.tank,
          aircraft: from.units.aircraft - sent.aircraft,
        };

        const conquered = attackPower > defendPower;
        if (conquered) {
          // surviving attackers garrison the captured land
          set({
            countries: {
              ...s.countries,
              [fromId]: { ...from, units: fromRemaining },
              [toId]: { ...to, units: newSent, ownerId: from.ownerId },
            },
          });
          if (attackerEmpire.isPlayer) {
            get().pushLog(`Conquered ${to.name}! +${(to.gdpT * INCOME_PER_GDP_T).toFixed(0)}/s income.`);
          } else if (defenderEmpire?.isPlayer) {
            get().pushLog(`${attackerEmpire.name} invaded and took ${to.name} from you.`);
          }
        } else {
          // attackers fall back to source country with survivors
          set({
            countries: {
              ...s.countries,
              [fromId]: {
                ...from,
                units: {
                  infantry: fromRemaining.infantry + newSent.infantry,
                  tank: fromRemaining.tank + newSent.tank,
                  aircraft: fromRemaining.aircraft + newSent.aircraft,
                },
              },
              [toId]: { ...to, units: newDef },
            },
          });
          if (attackerEmpire.isPlayer) {
            get().pushLog(`Assault on ${to.name} repelled. Lost ${total - unitTotal(newSent)} troops.`);
          } else if (defenderEmpire?.isPlayer) {
            get().pushLog(`Repelled ${attackerEmpire.name}'s attack on ${to.name}.`);
          }
        }
      },

      doTick: () => {
        const s = get();
        const empires = { ...s.empires };

        for (const c of Object.values(s.countries)) {
          const e = empires[c.ownerId];
          if (e) empires[e.id] = { ...empires[e.id], coins: empires[e.id].coins + c.gdpT * INCOME_PER_GDP_T };
        }
        set({ empires, tick: s.tick + 1 });

        // AI
        for (const empire of Object.values(empires)) {
          if (empire.isPlayer) continue;
          if (Math.random() > 0.18) continue;
          const owned = Object.values(get().countries).filter((c) => c.ownerId === empire.id);
          if (owned.length === 0) continue;

          // buy a random unit type
          const buyCountry = owned[Math.floor(Math.random() * owned.length)];
          const type = UNIT_TYPES[Math.floor(Math.random() * UNIT_TYPES.length)];
          const e = get().empires[empire.id];
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
                  units: {
                    ...st.countries[buyCountry.id].units,
                    [type]: st.countries[buyCountry.id].units[type] + qty,
                  },
                },
              },
            }));
          }

          if (Math.random() < 0.55) {
            const myStrongest = owned.reduce((a, b) => (unitPower(a.units) > unitPower(b.units) ? a : b));
            const others = Object.values(get().countries).filter((c) => c.ownerId !== empire.id);
            if (others.length === 0) continue;
            const targets = others.sort((a, b) => unitPower(a.units) - unitPower(b.units)).slice(0, 6);
            const target = targets[Math.floor(Math.random() * targets.length)];
            const myPower = unitPower(myStrongest.units);
            const tgtPower = unitPower(target.units);
            if (myPower > tgtPower * 1.1) {
              // send ~75% of forces
              const send: Units = {
                infantry: Math.floor(myStrongest.units.infantry * 0.75),
                tank: Math.floor(myStrongest.units.tank * 0.75),
                aircraft: Math.floor(myStrongest.units.aircraft * 0.75),
              };
              if (unitTotal(send) > 0) get().attack(myStrongest.id, target.id, send);
            }
          }
        }
      },
    }),
    {
      name: "empire-shift-save-v2",
      partialize: (s) => ({
        initialized: s.initialized,
        countries: s.countries,
        empires: s.empires,
        playerEmpireId: s.playerEmpireId,
        playerCapitalId: s.playerCapitalId,
        tick: s.tick,
        log: s.log,
      }),
    },
  ),
);
