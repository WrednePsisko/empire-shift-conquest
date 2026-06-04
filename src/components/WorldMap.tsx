import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath, geoCentroid } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { getGdp, getPopulation, isPlayableCountry, getCapital } from "@/lib/countryData";
import { getOrGenerateProvinces, type Province } from "@/lib/provinces";



export interface MapCountry {
  id: string;
  name: string;
  gdpT: number;
  centroid: [number, number]; // [lon, lat]
}

export interface MapMarker {
  id: string;
  label: string;
  color: string;
  /** Either an emoji/glyph (legacy) or a known unit-type key rendered as an SVG icon */
  icon?: string;
  iconKey?: "infantry" | "tank" | "artillery" | "aircraft" | "navy" | "missile";
  selectable?: boolean;
  selected?: boolean;
}


export interface MapMovement {
  id: string;
  fromId: string;
  toId: string;
  startMs: number;
  durationMs: number;
  color: string;
  label?: string;
}

export interface MapViewTarget {
  countryId: string;
  scale?: number;
}

interface Props {
  onCountryClick?: (c: MapCountry) => void;
  onMarkerClick?: (id: string) => void;
  onProvinceClick?: (countryId: string, province: Province) => void;
  fillFor?: (id: string) => string | undefined;
  strokeFor?: (id: string) => string | undefined;
  selectedId?: string | null;
  highlightId?: string | null;
  selectedProvinceId?: string | null;
  onCountriesLoaded?: (countries: MapCountry[]) => void;
  width?: number;
  height?: number;
  showLabels?: boolean;
  markers?: MapMarker[];
  movements?: MapMovement[];
  focusOn?: MapViewTarget | null;
  interactive?: boolean;
  showProvinces?: boolean;
  showHypsometric?: boolean;
}



const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MIN_SCALE = 1;
const MAX_SCALE = 40;

export function WorldMap({
  onCountryClick,
  onMarkerClick,
  onProvinceClick,
  fillFor,
  strokeFor,
  selectedId,
  highlightId,
  selectedProvinceId,
  onCountriesLoaded,
  width = 960,
  height = 500,
  showLabels = false,
  markers,
  movements,
  focusOn,
  interactive = true,
  showProvinces = true,
  showHypsometric = true,
}: Props) {


  const [features, setFeatures] = useState<Feature<Geometry, { name: string }>[] | null>(null);
  const loadedRef = useRef(false);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number; pointerId: number } | null>(null);
  const movedRef = useRef(false);
  // Re-render tick for animations (movements)
  const [, setAnimTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((topo: Topology) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
        setFeatures(fc.features.filter((f) => isFinite(Number(f.id)) && isPlayableCountry(String(Number(f.id)))));
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
        const c = geoCentroid(f) as [number, number];
        return { id, name: f.properties.name, gdpT: getGdp(id), centroid: c };
      });
      onCountriesLoaded(list);
    }
  }, [features, onCountriesLoaded]);

  const projection = useMemo(
    () => geoNaturalEarth1().fitSize([width, height], { type: "Sphere" } as never),
    [width, height],
  );
  const path = useMemo(() => geoPath(projection), [projection]);


  const featuresById = useMemo(() => {
    const m = new Map<string, Feature<Geometry, { name: string }>>();
    features?.forEach((f) => m.set(String(Number(f.id)), f));
    return m;
  }, [features]);

  // Precompute projected bounds per country (for province generation)
  const countryBounds = useMemo(() => {
    const m = new Map<string, [[number, number], [number, number]]>();
    if (!features) return m;
    for (const f of features) {
      const id = String(Number(f.id));
      const b = path.bounds(f);
      if (isFinite(b[0][0])) m.set(id, b as [[number, number], [number, number]]);
    }
    return m;
  }, [features, path]);

  // Generate provinces per country (memoized via cache in provinces.ts)
  const provincesByCountry = useMemo(() => {
    const m = new Map<string, Province[]>();
    if (!features) return m;
    for (const f of features) {
      const id = String(Number(f.id));
      const b = countryBounds.get(id);
      if (!b) continue;
      const [[minX, minY], [maxX, maxY]] = b;
      const w = maxX - minX, h = maxY - minY;
      const pixelArea = w * h;
      const pop = getPopulation(id) * 1000; // thousands
      const econ = getGdp(id) * 1000;       // billions
      m.set(id, getOrGenerateProvinces({
        countryId: id,
        bbox: { minX, minY, maxX, maxY },
        pixelArea,
        totalPopulation: pop,
        totalEconomy: econ,
      }));
    }
    return m;
  }, [features, countryBounds]);


  // rAF for movement animations
  useEffect(() => {
    if (!movements || movements.length === 0) return;
    let raf = 0;
    const loop = () => {
      setAnimTick((t) => (t + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [movements]);

  // Auto-focus
  useEffect(() => {
    if (!focusOn || !featuresById.size) return;
    const f = featuresById.get(focusOn.countryId);
    if (!f) return;
    const [cx, cy] = path.centroid(f);
    if (!isFinite(cx)) return;
    const k = Math.max(MIN_SCALE, Math.min(MAX_SCALE, focusOn.scale ?? 4));
    setView({ k, tx: width / 2 - cx * k, ty: height / 2 - cy * k });
  }, [focusOn, featuresById, path, width, height]);

  const clampView = useCallback(
    (v: { k: number; tx: number; ty: number }) => {
      const k = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.k));
      const maxTx = (width * (k - 1)) / 2 + width * 0.9;
      const maxTy = (height * (k - 1)) / 2 + height * 0.9;

      return {
        k,
        tx: Math.max(-maxTx, Math.min(maxTx, v.tx)),
        ty: Math.max(-maxTy, Math.min(maxTy, v.ty)),
      };
    },
    [width, height],
  );

  // Non-passive wheel zoom
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
        return clampView({ k, tx: mx - (mx - v.tx) * ratio, ty: my - (my - v.ty) * ratio });
      });
    };
    svg.addEventListener("wheel", fn, { passive: false });
    return () => svg.removeEventListener("wheel", fn);
  }, [interactive, width, height, clampView]);

  // Pointer (touch + mouse) pan + pinch zoom
  const pinchRef = useRef<{ d: number; cx: number; cy: number; k: number; tx: number; ty: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, pointerId: e.pointerId };
      movedRef.current = false;
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchRef.current = {
        d: Math.hypot(dx, dy),
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
        k: view.k,
        tx: view.tx,
        ty: view.ty,
      };
      dragRef.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const d = Math.hypot(dx, dy);
      const factor = d / pinchRef.current.d;
      const newK = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchRef.current.k * factor));
      const mx = ((pinchRef.current.cx - rect.left) / rect.width) * width;
      const my = ((pinchRef.current.cy - rect.top) / rect.height) * height;
      const ratio = newK / pinchRef.current.k;
      setView(
        clampView({
          k: newK,
          tx: mx - (mx - pinchRef.current.tx) * ratio,
          ty: my - (my - pinchRef.current.ty) * ratio,
        }),
      );
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const dx = ((e.clientX - d.x) / rect.width) * width;
    const dy = ((e.clientY - d.y) / rect.height) * height;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) movedRef.current = true;
    setView((v) => clampView({ k: v.k, tx: d.tx + dx, ty: d.ty + dy }));
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
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
  const now = Date.now();

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`w-full h-full block select-none touch-none ${dragRef.current ? "cursor-grabbing" : interactive ? "cursor-grab" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <radialGradient id="ocean" cx="50%" cy="55%" r="80%">
            <stop offset="0%" stopColor="#10355c" />
            <stop offset="55%" stopColor="#0a1f3a" />
            <stop offset="100%" stopColor="#040b1a" />
          </radialGradient>
          <filter id="landShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" />
            <feOffset dx="0" dy="0.8" result="off" />
            <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="landGrain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.08 0" />
            <feComposite in2="SourceGraphic" operator="in" />
            <feBlend in="SourceGraphic" mode="overlay" />
          </filter>
          <radialGradient id="markerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <pattern id="oceanGrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke="#2a4a72" strokeOpacity="0.16" strokeWidth="0.4" />
          </pattern>
          <pattern id="oceanWaves" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M0 20 Q20 14 40 20 T80 20" fill="none" stroke="#3a6aa0" strokeOpacity="0.08" strokeWidth="0.6" />
            <path d="M0 50 Q20 44 40 50 T80 50" fill="none" stroke="#3a6aa0" strokeOpacity="0.08" strokeWidth="0.6" />
          </pattern>
          <pattern id="landHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#000" strokeOpacity="0.05" strokeWidth="0.4" />
          </pattern>
          {/* Topographic contour overlay — subtle, applied over land */}
          <pattern id="topoContours" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M0 12 Q15 6 30 12 T60 12" fill="none" stroke="#1a0f08" strokeOpacity="0.18" strokeWidth="0.45" />
            <path d="M0 28 Q15 22 30 28 T60 28" fill="none" stroke="#1a0f08" strokeOpacity="0.14" strokeWidth="0.45" />
            <path d="M0 44 Q15 38 30 44 T60 44" fill="none" stroke="#1a0f08" strokeOpacity="0.12" strokeWidth="0.45" />
            <path d="M0 56 Q15 50 30 56 T60 56" fill="none" stroke="#1a0f08" strokeOpacity="0.16" strokeWidth="0.45" />
          </pattern>
          <filter id="topoNoise">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" seed="3" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          {/* Hypsometric (elevation) overlay: procedural noise mapped to a
              lowland→highland→peak color ramp, blended over land fills. */}
          <linearGradient id="hypsoRamp" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2f5d34" />
            <stop offset="0.25" stopColor="#6b8e3c" />
            <stop offset="0.5" stopColor="#c2a86a" />
            <stop offset="0.75" stopColor="#8a5a3b" />
            <stop offset="1" stopColor="#f5f0e6" />
          </linearGradient>
          <filter id="hypsoFill" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="11" result="noise" />
            <feComponentTransfer in="noise" result="elevation">
              <feFuncR type="table" tableValues="0.18 0.32 0.42 0.55 0.72 0.95" />
              <feFuncG type="table" tableValues="0.36 0.55 0.62 0.55 0.50 0.95" />
              <feFuncB type="table" tableValues="0.20 0.24 0.32 0.32 0.42 0.96" />
              <feFuncA type="linear" slope="1" />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>

          {/* Unit-type SVG glyphs (no emoji) */}
          <symbol id="g_infantry" viewBox="-10 -10 20 20">
            <path d="M0 -6 L4 -2 L4 6 L-4 6 L-4 -2 Z" fill="currentColor" />
            <circle cx="0" cy="-6" r="2.2" fill="currentColor" />
          </symbol>
          <symbol id="g_tank" viewBox="-10 -10 20 20">
            <rect x="-7" y="-1" width="14" height="6" rx="1" fill="currentColor" />
            <rect x="-4" y="-5" width="8" height="4" rx="0.8" fill="currentColor" />
            <rect x="3" y="-4" width="6" height="1.2" fill="currentColor" />
          </symbol>
          <symbol id="g_artillery" viewBox="-10 -10 20 20">
            <circle cx="-3" cy="3" r="3" fill="currentColor" />
            <rect x="-2" y="-6" width="11" height="2" rx="0.6" fill="currentColor" transform="rotate(-25 -2 -5)" />
          </symbol>
          <symbol id="g_aircraft" viewBox="-10 -10 20 20">
            <path d="M0 -7 L1.4 -1 L8 1 L1.4 2 L1 7 L-1 7 L-1.4 2 L-8 1 L-1.4 -1 Z" fill="currentColor" />
          </symbol>
          <symbol id="g_navy" viewBox="-10 -10 20 20">
            <path d="M-7 2 L7 2 L5 6 L-5 6 Z" fill="currentColor" />
            <rect x="-0.6" y="-7" width="1.2" height="9" fill="currentColor" />
            <path d="M0.6 -6 L6 -1 L0.6 -1 Z" fill="currentColor" />
          </symbol>
          <symbol id="g_missile" viewBox="-10 -10 20 20">
            <path d="M0 -8 L3 -2 L3 6 L-3 6 L-3 -2 Z" fill="currentColor" />
            <path d="M-3 4 L-6 7 L-3 6 Z M3 4 L6 7 L3 6 Z" fill="currentColor" />
          </symbol>
          <symbol id="g_arrow" viewBox="-10 -10 20 20">
            <path d="M-7 -5 L7 0 L-7 5 L-3 0 Z" fill="currentColor" />
          </symbol>
        </defs>
        <rect width={width} height={height} fill="url(#ocean)" />
        <rect width={width} height={height} fill="url(#oceanWaves)" />
        <rect width={width} height={height} fill="url(#oceanGrid)" />
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {/* graticule */}
          <g stroke="#5b7fb3" strokeOpacity={0.12} strokeWidth={0.5 / view.k} fill="none">
            {Array.from({ length: 11 }).map((_, i) => (
              <line key={`gh-${i}`} x1={0} x2={width} y1={(height * i) / 10} y2={(height * i) / 10} />
            ))}
            {Array.from({ length: 19 }).map((_, i) => (
              <line key={`gv-${i}`} y1={0} y2={height} x1={(width * i) / 18} x2={(width * i) / 18} />
            ))}
          </g>
          <path
            d={path({ type: "Sphere" } as never) ?? ""}
            fill="none"
            stroke="#7fa3d6"
            strokeOpacity={0.3}
            strokeWidth={1 / view.k}
          />

          <g filter="url(#landShadow)">
            {features?.map((f) => {
              const id = String(Number(f.id));
              const d = path(f) ?? "";
              const fill = fillFor?.(id) ?? "#3d4a3a";
              const stroke = strokeFor?.(id) ?? "rgba(8,12,20,0.55)";
              const isSel = selectedId === id;
              const isHi = highlightId === id;
              return (
                <g key={id}>
                  <path
                    d={d}
                    fill={fill}
                    stroke={isSel ? "#fbbf24" : isHi ? "#ffffff" : stroke}
                    strokeWidth={(isSel ? 1.8 : isHi ? 1.4 : 0.5) / view.k}
                    className="transition-[fill] duration-150 hover:brightness-125"
                    style={{ cursor: onCountryClick ? "pointer" : "inherit" }}
                    onClick={(e) => {
                      if (movedRef.current) return;
                      e.stopPropagation();
                      onCountryClick?.({ id, name: f.properties.name, gdpT: getGdp(id), centroid: geoCentroid(f) as [number, number] });
                    }}
                  >
                    <title>{f.properties.name}</title>
                  </path>
                  {/* topographic contour overlay clipped to country shape */}
                  <path d={d} fill="url(#topoContours)" pointerEvents="none" opacity={0.55} />
                  <path d={d} fill="url(#landHatch)" pointerEvents="none" />
                </g>
              );
            })}
          </g>

          {/* ClipPaths per country (used by hypsometric + provinces) */}
          <defs>
            {features?.map((f) => {
              const id = String(Number(f.id));
              const d = path(f) ?? "";
              return (
                <clipPath key={`cc-${id}`} id={`cc-${id}`}>
                  <path d={d} />
                </clipPath>
              );
            })}
          </defs>

          {/* Hypsometric elevation overlay, clipped to each country */}
          {showHypsometric && features?.map((f) => {
            const id = String(Number(f.id));
            const b = countryBounds.get(id);
            if (!b) return null;
            const [[minX, minY], [maxX, maxY]] = b;
            return (
              <g key={`hy-${id}`} clipPath={`url(#cc-${id})`} pointerEvents="none" opacity={0.42} style={{ mixBlendMode: "overlay" }}>
                <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="#888" filter="url(#hypsoFill)" />
              </g>
            );
          })}

          {/* Province cells — only visible when zoomed in */}
          {showProvinces && view.k >= 2.5 && features?.map((f) => {
            const id = String(Number(f.id));
            const provs = provincesByCountry.get(id);
            if (!provs || provs.length <= 1) return null;
            return (
              <g key={`pv-${id}`} clipPath={`url(#cc-${id})`}>
                {provs.map((p) => {
                  const isSel = selectedProvinceId === p.id;
                  return (
                    <path
                      key={p.id}
                      d={p.d}
                      fill={isSel ? "rgba(251,191,36,0.18)" : "transparent"}
                      stroke={isSel ? "#fbbf24" : "rgba(8,12,20,0.55)"}
                      strokeWidth={(isSel ? 1.4 : 0.6) / view.k}
                      strokeDasharray={isSel ? undefined : `${1.6 / view.k} ${1.2 / view.k}`}
                      style={{ cursor: onProvinceClick ? "pointer" : "inherit" }}
                      onClick={(e) => {
                        if (movedRef.current) return;
                        e.stopPropagation();
                        onProvinceClick?.(id, p);
                      }}
                    />
                  );
                })}
              </g>
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
                opacity={0.55}
                pointerEvents="none"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 1.2 * labelScale }}
              >
                {f.properties.name}
              </text>
            );
          })}
          {/* Static army garrison markers */}
          {markers?.map((m) => {
            const f = featuresById.get(m.id);
            if (!f) return null;
            const c = path.centroid(f);
            if (!isFinite(c[0])) return null;
            const r = 7 * labelScale;
            const clickable = m.selectable && !!onMarkerClick;
            return (
              <g
                key={`m-${m.id}`}
                transform={`translate(${c[0]} ${c[1]})`}
                pointerEvents={clickable ? "auto" : "none"}
                style={clickable ? { cursor: "pointer" } : undefined}
                onPointerDown={clickable ? (e) => e.stopPropagation() : undefined}
                onClick={
                  clickable
                    ? (e) => {
                        if (movedRef.current) return;
                        e.stopPropagation();
                        onMarkerClick?.(m.id);
                      }
                    : undefined
                }
              >
                {/* Larger invisible hit target for fingers */}
                {clickable && <circle r={r * 3} fill="transparent" />}
                {m.selected && (
                  <>
                    <circle
                      r={r * 2.2}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={1.8 * labelScale}
                      opacity={0.9}
                    >
                      <animate attributeName="r" values={`${r * 1.8};${r * 2.6};${r * 1.8}`} dur="1.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.4s" repeatCount="indefinite" />
                    </circle>
                    <circle r={r * 1.5} fill="none" stroke="#fbbf24" strokeWidth={1.4 * labelScale} />
                  </>
                )}
                <circle r={r * 1.6} fill="url(#markerGlow)" />
                <circle r={r} fill={m.color} stroke="#0a0a0a" strokeWidth={1.2 * labelScale} opacity={0.95} />
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
                {m.iconKey ? (
                  <g
                    transform={`translate(0 ${-r * 0.55}) scale(${labelScale * 0.9})`}
                    style={{ color: "#0a0a0a" }}
                  >
                    <use href={`#g_${m.iconKey}`} width={14} height={14} x={-7} y={-7} />
                  </g>
                ) : m.icon ? (
                  <text y={-r * 0.4} textAnchor="middle" fontSize={6 * labelScale} fill="#0a0a0a">
                    {m.icon}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* Animated troop movements */}
          {movements?.map((mv) => {
            const a = featuresById.get(mv.fromId);
            const b = featuresById.get(mv.toId);
            if (!a || !b) return null;
            const ca = path.centroid(a);
            const cb = path.centroid(b);
            if (!isFinite(ca[0]) || !isFinite(cb[0])) return null;
            const t = Math.min(1, Math.max(0, (now - mv.startMs) / mv.durationMs));
            // Arc the path slightly
            const mx = (ca[0] + cb[0]) / 2;
            const my = (ca[1] + cb[1]) / 2 - Math.hypot(cb[0] - ca[0], cb[1] - ca[1]) * 0.18;
            const x = (1 - t) * (1 - t) * ca[0] + 2 * (1 - t) * t * mx + t * t * cb[0];
            const y = (1 - t) * (1 - t) * ca[1] + 2 * (1 - t) * t * my + t * t * cb[1];
            const dx = 2 * (1 - t) * (mx - ca[0]) + 2 * t * (cb[0] - mx);
            const dy = 2 * (1 - t) * (my - ca[1]) + 2 * t * (cb[1] - my);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const r = 9 * labelScale;
            const arcPath = `M ${ca[0]} ${ca[1]} Q ${mx} ${my} ${cb[0]} ${cb[1]}`;
            return (
              <g key={`mv-${mv.id}`} pointerEvents="none">
                <path
                  d={arcPath}
                  fill="none"
                  stroke={mv.color}
                  strokeOpacity={0.55}
                  strokeWidth={1.4 * labelScale}
                  strokeDasharray={`${3 * labelScale} ${3 * labelScale}`}
                />
                <g transform={`translate(${x} ${y}) rotate(${angle})`}>
                  <circle r={r * 1.6} fill={mv.color} opacity={0.25} />
                  <circle r={r} fill={mv.color} stroke="#0a0a0a" strokeWidth={1.4 * labelScale} />
                  <g style={{ color: "#0a0a0a" }}>
                    <use href="#g_arrow" width={r * 1.6} height={r * 1.6} x={-r * 0.8} y={-r * 0.8} />
                  </g>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {interactive && (
        <div className="absolute top-2 right-2 flex flex-col items-center gap-1 z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-1 rounded-full bg-card/90 border border-border backdrop-blur shadow-lg p-1 pointer-events-auto">
            <button
              type="button"
              onClick={() => zoomBy(1.6)}
              className="size-8 rounded-full hover:bg-accent text-lg font-bold leading-none active:scale-95 transition-transform"
              aria-label="Zoom in"
            >
              +
            </button>
            <div className="text-[9px] font-mono text-muted-foreground">{view.k.toFixed(1)}×</div>
            <button
              type="button"
              onClick={() => zoomBy(1 / 1.6)}
              className="size-8 rounded-full hover:bg-accent text-lg font-bold leading-none active:scale-95 transition-transform"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={reset}
              className="size-7 rounded-full hover:bg-accent text-xs leading-none"
              aria-label="Reset view"
            >
              ⤢
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
