import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { getGdp } from "@/lib/countryData";

export interface MapCountry {
  id: string;
  name: string;
  gdpT: number;
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
}

const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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
}: Props) {
  const [features, setFeatures] = useState<Feature<Geometry, { name: string }>[] | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((topo: Topology) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
        setFeatures(fc.features);
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

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full block select-none">
      <defs>
        <radialGradient id="ocean" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="oklch(0.28 0.05 240)" />
          <stop offset="100%" stopColor="oklch(0.14 0.04 250)" />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill="url(#ocean)" />
      <path d={path({ type: "Sphere" } as never) ?? ""} fill="none" stroke="oklch(0.4 0.05 240 / 0.3)" />
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
            strokeWidth={isSel ? 1.8 : isHi ? 1.4 : 0.4}
            className="cursor-pointer transition-[fill,stroke] duration-150 hover:brightness-125"
            onClick={() => onCountryClick?.({ id, name: f.properties.name, gdpT: getGdp(id) })}
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
          <text key={`l-${id}`} x={c[0]} y={c[1]} fontSize={6} textAnchor="middle" fill="#fff" opacity={0.5} pointerEvents="none">
            {f.properties.name}
          </text>
        );
      })}
    </svg>
  );
}
