import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Empire {
  id: string;
  name: string;
  color: string;
  isPlayer: boolean;
  coins: number;
}

export interface Country {
  id: string; // ISO numeric as string
  name: string;
  gdpT: number;
  ownerId: string;
  armies: number;
}

export interface GameState {
  initialized: boolean;
  countries: Record<string, Country>;
  empires: Record<string, Empire>;
  playerEmpireId: string | null;
  tick: number;
  log: string[];

  initGame: (playerCountryId: string, playerCountryName: string, allCountries: { id: string; name: string; gdpT: number }[]) => void;
  resetGame: () => void;
  buyArmies: (countryId: string, qty: number) => void;
  attack: (fromId: string, toId: string, armies: number) => void;
  doTick: () => void;
  pushLog: (msg: string) => void;
}

const EMPIRE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef",
  "#ec4899", "#f43f5e", "#a855f7", "#0ea5e9", "#10b981",
  "#f59e0b", "#6366f1", "#dc2626", "#7c3aed", "#0891b2",
];

export const ARMY_COST = 10;
export const INCOME_PER_GDP_T = 100;

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      initialized: false,
      countries: {},
      empires: {},
      playerEmpireId: null,
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
            armies: Math.max(5, Math.floor(c.gdpT * 30 + Math.random() * 10)),
          };
        }

        set({
          initialized: true,
          countries,
          empires,
          playerEmpireId,
          tick: 0,
          log: [`${playerCountryName} rises. Your empire begins.`],
        });
      },

      resetGame: () => set({ initialized: false, countries: {}, empires: {}, playerEmpireId: null, tick: 0, log: [] }),

      pushLog: (msg) => set((s) => ({ log: [msg, ...s.log].slice(0, 30) })),

      buyArmies: (countryId, qty) => {
        const s = get();
        const country = s.countries[countryId];
        if (!country) return;
        const empire = s.empires[country.ownerId];
        if (!empire?.isPlayer) return;
        const cost = qty * ARMY_COST;
        if (empire.coins < cost) return;
        set({
          empires: { ...s.empires, [empire.id]: { ...empire, coins: empire.coins - cost } },
          countries: { ...s.countries, [countryId]: { ...country, armies: country.armies + qty } },
        });
      },

      attack: (fromId, toId, armies) => {
        const s = get();
        const from = s.countries[fromId];
        const to = s.countries[toId];
        if (!from || !to || from.ownerId === to.ownerId) return;
        if (from.armies < armies || armies < 1) return;

        const survivors = armies - to.armies;
        if (survivors > 0) {
          // conquered
          const attackerEmpire = s.empires[from.ownerId];
          set({
            countries: {
              ...s.countries,
              [fromId]: { ...from, armies: from.armies - armies },
              [toId]: { ...to, armies: survivors, ownerId: from.ownerId },
            },
          });
          if (attackerEmpire.isPlayer) get().pushLog(`Conquered ${to.name}! +${(to.gdpT * INCOME_PER_GDP_T).toFixed(0)}/s income.`);
          else if (s.empires[to.ownerId]?.isPlayer) get().pushLog(`${attackerEmpire.name} invaded and took ${to.name} from you.`);
        } else {
          // failed
          set({
            countries: {
              ...s.countries,
              [fromId]: { ...from, armies: from.armies - armies },
              [toId]: { ...to, armies: to.armies - armies },
            },
          });
          const attackerEmpire = s.empires[from.ownerId];
          if (attackerEmpire.isPlayer) get().pushLog(`Failed assault on ${to.name}. Lost ${armies} troops.`);
        }
      },

      doTick: () => {
        const s = get();
        const empires = { ...s.empires };

        // income
        for (const c of Object.values(s.countries)) {
          const e = empires[c.ownerId];
          if (e) empires[e.id] = { ...empires[e.id], coins: empires[e.id].coins + c.gdpT * INCOME_PER_GDP_T };
        }

        set({ empires, tick: s.tick + 1 });

        // AI actions: each AI empire takes a chance to buy + attack
        for (const empire of Object.values(empires)) {
          if (empire.isPlayer) continue;
          if (Math.random() > 0.15) continue;
          const owned = Object.values(get().countries).filter((c) => c.ownerId === empire.id);
          if (owned.length === 0) continue;

          // buy armies in random owned country
          const buyCountry = owned[Math.floor(Math.random() * owned.length)];
          const e = get().empires[empire.id];
          const affordable = Math.floor(e.coins / ARMY_COST);
          const qty = Math.min(affordable, Math.floor(5 + Math.random() * 20));
          if (qty > 0) {
            const cost = qty * ARMY_COST;
            set((st) => ({
              empires: { ...st.empires, [empire.id]: { ...st.empires[empire.id], coins: st.empires[empire.id].coins - cost } },
              countries: { ...st.countries, [buyCountry.id]: { ...st.countries[buyCountry.id], armies: st.countries[buyCountry.id].armies + qty } },
            }));
          }

          // maybe attack
          if (Math.random() < 0.5) {
            const myStrongest = owned.reduce((a, b) => (a.armies > b.armies ? a : b));
            const others = Object.values(get().countries).filter((c) => c.ownerId !== empire.id);
            if (others.length === 0) continue;
            // pick a weaker target with bias toward weakness
            const targets = others.sort((a, b) => a.armies - b.armies).slice(0, 5);
            const target = targets[Math.floor(Math.random() * targets.length)];
            if (myStrongest.armies > target.armies + 2) {
              const send = Math.min(myStrongest.armies - 1, target.armies + 5 + Math.floor(Math.random() * 10));
              get().attack(myStrongest.id, target.id, send);
            }
          }
        }
      },
    }),
    {
      name: "empire-shift-save",
      partialize: (s) => ({
        initialized: s.initialized,
        countries: s.countries,
        empires: s.empires,
        playerEmpireId: s.playerEmpireId,
        tick: s.tick,
        log: s.log,
      }),
    },
  ),
);
