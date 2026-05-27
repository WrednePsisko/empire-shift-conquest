import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath, geoCentroid } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { getGdp, isPlayableCountry } from "@/lib/countryData";

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
  icon?: string;
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
  fillFor?: (id: string) => string | undefined;
  strokeFor?: (id: string) => string | undefined;
  selectedId?: string | null;
  highlightId?: string | null;
  onCountriesLoaded?: (countries: MapCountry[]) => void;
  width?: number;
  height?: number;
  showLabels?: boolean;
  markers?: MapMarker[];
  movements?: MapMovement[];
  focusOn?: MapViewTarget | null;
  interactive?: boolean;
}


const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MIN_SCALE = 1;
const MAX_SCALE = 24;

export function WorldMap({
  onCountryClick,
  onMarkerClick,
  fillFor,
  strokeFor,
  selectedId,
  highlightId,
  onCountriesLoaded,
  width = 960,
  height = 500,
  showLabels = false,
  markers,
  movements,
  focusOn,
  interactive = true,
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
        const c = geoCentroid(f) as [number, number];
        return { id, name: f.properties.name, gdpT: getGdp(id), centroid: c };
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
      const maxTx = (width * (k - 1)) / 2 + width * 0.4;
      const maxTy = (height * (k - 1)) / 2 + height * 0.4;
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
                <path
                  key={id}
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
              );
            })}
          </g>
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
                {m.icon && (
                  <text y={-r * 0.4} textAnchor="middle" fontSize={6 * labelScale} fill="#0a0a0a">
                    {m.icon}
                  </text>
                )}
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
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={r * 1.2}
                    transform={`rotate(${-angle})`}
                    fill="#0a0a0a"
                    fontWeight={700}
                  >
                    ⚔
                  </text>
                </g>
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
            className="size-10 rounded-md bg-card/90 border border-border text-foreground hover:bg-accent text-xl font-bold backdrop-blur shadow-lg"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.4)}
            className="size-10 rounded-md bg-card/90 border border-border text-foreground hover:bg-accent text-xl font-bold backdrop-blur shadow-lg"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={reset}
            className="size-10 rounded-md bg-card/90 border border-border text-foreground hover:bg-accent text-sm backdrop-blur shadow-lg"
            aria-label="Reset view"
          >
            ⤢
          </button>
        </div>
      )}
    </div>
  );
}
