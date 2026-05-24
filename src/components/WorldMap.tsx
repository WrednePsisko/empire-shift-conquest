import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { getGdp, isPlayableCountry } from "@/lib/countryData";

export interface MapCountry {
  id: string;
  name: string;
  gdpT: number;
}

export interface MapMarker {
  id: string; // country id
  label: string; // text shown (e.g. army count)
  color: string;
  icon?: string; // single character / emoji
}

export interface MapViewTarget {
  countryId: string;
  scale?: number;
}

interface Props {
  onCountryClick?: (c: MapCountry) => void;
  fillFor?: (id: string) => string | undefined;
  strokeFor?: (id: string) => string | undefined;
  selectedId?: string | null;
  highlightId?: string | null;
  onCountriesLoaded?: (countries: MapCountry[]) => void;
  width?: number;
  height?: number;
  showLabels?: boolean;
  markers?: MapMarker[];
  focusOn?: MapViewTarget | null;
  interactive?: boolean; // enable pan/zoom
}

const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MIN_SCALE = 1;
const MAX_SCALE = 20;

export function WorldMap({
  onCountryClick,
  fillFor,
  strokeFor,
  selectedId,
  highlightId,
  onCountriesLoaded,
  width = 960,
  height = 500,
  showLabels = false,
  markers,
  focusOn,
  interactive = true,
}: Props) {
  const [features, setFeatures] = useState<Feature<Geometry, { name: string }>[] | null>(null);
  const loadedRef = useRef(false);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((topo: Topology) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
        setFeatures(fc.features.filter((f) => isPlayableCountry(String(Number(f.id)))));
      })
      .catch((e) => console.error("map load failed", e));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (features && !loadedRef.current && onCountriesLoaded) {
      loadedRef.current = true;
      const list: MapCountry[] = features.map((f) => {
        const id = String(Number(f.id));
        return { id, name: f.properties.name, gdpT: getGdp(id) };
      });
      onCountriesLoaded(list);
    }
  }, [features, onCountriesLoaded]);

  const path = useMemo(() => {
    const projection = geoNaturalEarth1().fitSize([width, height], { type: "Sphere" } as never);
    return geoPath(projection);
  }, [width, height]);

  const featuresById = useMemo(() => {
    const m = new Map<string, Feature<Geometry, { name: string }>>();
    features?.forEach((f) => m.set(String(Number(f.id)), f));
    return m;
  }, [features]);

  // Auto-focus on a country
  useEffect(() => {
    if (!focusOn || !featuresById.size) return;
    const f = featuresById.get(focusOn.countryId);
    if (!f) return;
    const [cx, cy] = path.centroid(f);
    if (!isFinite(cx)) return;
    const k = Math.max(MIN_SCALE, Math.min(MAX_SCALE, focusOn.scale ?? 4));
    setView({
      k,
      tx: width / 2 - cx * k,
      ty: height / 2 - cy * k,
    });
  }, [focusOn, featuresById, path, width, height]);

  const clampView = useCallback(
    (v: { k: number; tx: number; ty: number }) => {
      const k = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.k));
      // keep map mostly in view
      const maxTx = width * (k - 1) / 2 + width * 0.4;
      const maxTy = height * (k - 1) / 2 + height * 0.4;
      return {
        k,
        tx: Math.max(-maxTx, Math.min(maxTx, v.tx)),
        ty: Math.max(-maxTy, Math.min(maxTy, v.ty)),
      };
    },
    [width, height],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      if (!interactive) return;
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // mouse position in viewBox coords
      const mx = ((e.clientX - rect.left) / rect.width) * width;
      const my = ((e.clientY - rect.top) / rect.height) * height;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => {
        const k = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.k * factor));
        const ratio = k / v.k;
        return clampView({
          k,
          tx: mx - (mx - v.tx) * ratio,
          ty: my - (my - v.ty) * ratio,
        });
      });
    },
    [interactive, width, height, clampView],
  );

  // Attach non-passive wheel handler so preventDefault works
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !interactive) return;
    const fn = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * width;
      const my = ((e.clientY - rect.top) / rect.height) * height;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => {
        const k = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.k * factor));
        const ratio = k / v.k;
        return clampView({
          k,
          tx: mx - (mx - v.tx) * ratio,
          ty: my - (my - v.ty) * ratio,
        });
      });
    };
    svg.addEventListener("wheel", fn, { passive: false });
    return () => svg.removeEventListener("wheel", fn);
  }, [interactive, width, height, clampView]);

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive) return;
    dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    movedRef.current = false;
  };
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - d.x) / rect.width) * width;
    const dy = ((e.clientY - d.y) / rect.height) * height;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) movedRef.current = true;
    setView((v) => clampView({ k: v.k, tx: d.tx + dx, ty: d.ty + dy }));
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const zoomBy = (factor: number) => {
    setView((v) => {
      const k = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.k * factor));
      const ratio = k / v.k;
      const cx = width / 2;
      const cy = height / 2;
      return clampView({ k, tx: cx - (cx - v.tx) * ratio, ty: cy - (cy - v.ty) * ratio });
    });
  };

  const reset = () => setView({ k: 1, tx: 0, ty: 0 });

  const labelScale = 1 / view.k;

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`w-full h-full block select-none ${dragRef.current ? "cursor-grabbing" : interactive ? "cursor-grab" : ""}`}
        onWheel={handleWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <defs>
          <radialGradient id="ocean" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="oklch(0.28 0.05 240)" />
            <stop offset="100%" stopColor="oklch(0.14 0.04 250)" />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill="url(#ocean)" />
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          <path d={path({ type: "Sphere" } as never) ?? ""} fill="none" stroke="oklch(0.4 0.05 240 / 0.3)" strokeWidth={1 / view.k} />
          {features?.map((f) => {
            const id = String(Number(f.id));
            const d = path(f) ?? "";
            const fill = fillFor?.(id) ?? "oklch(0.6 0.02 80)";
            const stroke = strokeFor?.(id) ?? "oklch(0.1 0 0 / 0.4)";
            const isSel = selectedId === id;
            const isHi = highlightId === id;
            return (
              <path
                key={id}
                d={d}
                fill={fill}
                stroke={isSel ? "#fbbf24" : isHi ? "#ffffff" : stroke}
                strokeWidth={(isSel ? 1.8 : isHi ? 1.4 : 0.4) / view.k}
                className="transition-[fill] duration-150 hover:brightness-125"
                style={{ cursor: onCountryClick ? "pointer" : "inherit" }}
                onClick={(e) => {
                  if (movedRef.current) return;
                  e.stopPropagation();
                  onCountryClick?.({ id, name: f.properties.name, gdpT: getGdp(id) });
                }}
              >
                <title>{f.properties.name}</title>
              </path>
            );
          })}
          {showLabels && features?.map((f) => {
            const id = String(Number(f.id));
            const c = path.centroid(f);
            if (!isFinite(c[0])) return null;
            return (
              <text
                key={`l-${id}`}
                x={c[0]}
                y={c[1]}
                fontSize={6 * labelScale}
                textAnchor="middle"
                fill="#fff"
                opacity={0.5}
                pointerEvents="none"
              >
                {f.properties.name}
              </text>
            );
          })}
          {markers?.map((m) => {
            const f = featuresById.get(m.id);
            if (!f) return null;
            const c = path.centroid(f);
            if (!isFinite(c[0])) return null;
            const r = 7 * labelScale;
            return (
              <g key={`m-${m.id}`} transform={`translate(${c[0]} ${c[1]})`} pointerEvents="none">
                <circle
                  r={r}
                  fill={m.color}
                  stroke="#0a0a0a"
                  strokeWidth={1.2 * labelScale}
                  opacity={0.95}
                />
                <text
                  y={r * 0.4}
                  textAnchor="middle"
                  fontSize={8 * labelScale}
                  fontWeight={700}
                  fill="#0a0a0a"
                  fontFamily="ui-monospace, monospace"
                >
                  {m.label}
                </text>
                {m.icon && (
                  <text
                    y={-r * 0.4}
                    textAnchor="middle"
                    fontSize={6 * labelScale}
                    fill="#0a0a0a"
                  >
                    {m.icon}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {interactive && (
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            type="button"
            onClick={() => zoomBy(1.4)}
            className="size-9 rounded-md bg-card/90 border border-border text-foreground hover:bg-accent text-lg font-bold backdrop-blur"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.4)}
            className="size-9 rounded-md bg-card/90 border border-border text-foreground hover:bg-accent text-lg font-bold backdrop-blur"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={reset}
            className="size-9 rounded-md bg-card/90 border border-border text-foreground hover:bg-accent text-xs backdrop-blur"
            aria-label="Reset view"
          >
            ⤢
          </button>
        </div>
      )}
    </div>
  );
}
