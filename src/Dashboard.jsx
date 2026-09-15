import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, ReferenceLine, ComposedChart
} from "recharts";

// ─── LEAFLET MAP COMPONENT ───────────────────────────────────────────
function LeafletMap({ sites, selectedSite, onSiteClick, defectFilter, hoveredSite, onSiteHover }) {
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef({});
  const mapInstanceRef = useRef(null);
  const [leafletReady, setLeafletReady] = useState(false);

  // Load Leaflet CSS + JS from CDN once
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }

    // Inject CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Inject JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Initialize map once Leaflet is ready and container is mounted
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstanceRef.current) return;
    const L = window.L;

    const map = L.map(mapRef.current, {
      center: [42.5, 12.5],
      zoom: 6,
      zoomControl: true,
      attributionControl: true,
    });

    // ESRI World Dark Gray Base — free, no API key required
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 16,
    }).addTo(map);

    // ESRI reference labels layer on top
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      opacity: 0.8,
    }).addTo(map);

    mapInstanceRef.current = map;
    leafletRef.current = L;
  }, [leafletReady]);

  // Update markers when data/filter changes
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    // Remove old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    const DEPOT_C = { UIT4:"#f59e0b", UIT1:"#22c55e", UBA1:"#3b82f6", UIL7:"#a855f7" };
    const COORDS  = { UIT4:[41.90, 12.49], UIT1:[45.46, 9.19], UBA1:[44.49, 11.34], UIL7:[41.47, 12.90] };

    const maxCount = Math.max(...sites.map(s => {
      return defectFilter.reduce((sum, dt) => sum + (s.defects[dt] || 0), 0);
    }));

    sites.forEach(site => {
      const filtCount = defectFilter.reduce((sum, dt) => sum + (site.defects[dt] || 0), 0);
      const radius = Math.max(12, (filtCount / maxCount) * 55);
      const color = DEPOT_C[site.key] || "#8b5cf6";
      const isSel = selectedSite === site.key;
      const isHov = hoveredSite === site.key;
      const coords = COORDS[site.key];
      if (!coords) return;

      const circle = L.circleMarker(coords, {
        radius,
        fillColor: color,
        color: isSel ? "#fff" : color,
        weight: isSel ? 3 : 1.5,
        opacity: 1,
        fillOpacity: isSel ? 0.85 : isHov ? 0.7 : 0.5,
      });

      // Tooltip
      circle.bindTooltip(`
        <div style="font-family:monospace;font-size:12px;line-height:1.6;padding:4px;">
          <strong style="color:${color}">${site.key}</strong> — ${site.label}<br/>
          <span style="color:#aaa">Defects:</span> <strong>${filtCount.toLocaleString()}</strong><br/>
          ${defectFilter.map(dt => `<span style="color:#888">${dt}:</span> ${site.defects[dt]||0}`).join("  ")}
        </div>`, { permanent:false, direction:"top", className:"leaflet-dsptip" });

      circle.on("click", () => onSiteClick(site.key));
      circle.on("mouseover", () => onSiteHover(site.key));
      circle.on("mouseout",  () => onSiteHover(null));

      // Station label
      const label = L.divIcon({
        html: `<div style="font-family:monospace;font-size:11px;font-weight:700;color:${color};text-shadow:0 1px 3px #000,0 0 8px #000;white-space:nowrap;pointer-events:none">${site.key}<br><span style="font-size:9px;color:#ccc">${filtCount}</span></div>`,
        className: "",
        iconAnchor: [-radius - 4, radius / 2],
      });
      const labelMarker = L.marker(coords, { icon: label, interactive: false });

      circle.addTo(map);
      labelMarker.addTo(map);
      markersRef.current[site.key] = { circle, labelMarker };
    });
  }, [leafletReady, sites, selectedSite, defectFilter, hoveredSite]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  }, []);

  return (
    <div style={{ position: "relative", height: "100%", minHeight: 360 }}>
      {!leafletReady && (
        <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0f1a",zIndex:10,borderRadius:10 }}>
          <div style={{ fontSize:11,color:"#475569",fontFamily:"'DM Mono',monospace" }}>Loading map…</div>
        </div>
      )}
      <div ref={mapRef} style={{ width:"100%", height:"100%", minHeight:360, borderRadius:10 }}/>
      <style>{`
        .leaflet-dsptip { background:#0f172a!important; border:1px solid #334155!important; border-radius:6px!important; color:#e2e8f0!important; box-shadow:0 8px 32px rgba(0,0,0,0.6)!important; }
        .leaflet-dsptip::before { border-top-color:#334155!important; }
        .leaflet-container { background:#030712!important; }
        .leaflet-bar a { background:#0f172a!important; color:#e2e8f0!important; border-color:#334155!important; }
        .leaflet-bar a:hover { background:#1e293b!important; }
        .leaflet-control-attribution { background:#0a0f1a!important; color:#334155!important; font-size:8px!important; }
        .leaflet-control-attribution a { color:#475569!important; }
      `}</style>
    </div>
  );
}

// ─── RESPONSIVE HOOK ────────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

// ─── TRANSLATIONS ───────────────────────────────────────────────────
const T = {
  "en": {
    brand: "Last Mile DSP — Italy", title: "Delivery Performance", latestInRange: "Latest in Range",
    stations: "stations", station: "station",
    tabOverview: "Overview", tabDepots: "Depot Deep-Dive", tabUpstream: "Upstream vs Controllable",
    tabCycles: "UIT4 Cycles", tabNcc: "NCC Drivers", tabLate: "Late Drivers", tabScorecard: "Driver Scorecard", tabProductivity: "Productivity",
    sprTitle: "Stops per route — weekly", sprUnit: "stops / route", sprAvg: "avg", sprTarget: "target", sprOrders: "Orders", sprRoutes: "Routes", sprValues: "Values", sprNetwork: "Network", sprTable: "Stops per route by station — weekly",
    sprNote: "Stops per route = delivered orders ÷ routes accepted (Amazon Lighthouse › Business Metrics, weekly by station). Target = 75th percentile of the loaded weeks; amber below 90% of target, red below 80%.",
    year: "Year", weeks: "Weeks", reset: "Reset",
    // Heatmap
    depot: "Depot", week: "Week", latePlus15: "Late +15", fondCtrl: "FOND Ctrl", ftfdf: "FTFDF",
    ftpdf: "FTPDF", pdnr: "PDNR", fdnr: "FDNR", pp: "PP", status: "Status",
    w4Baseline: "W4'25 baseline", networkLate: "Network Late +15", perfHeatmap: "Performance Heatmap",
    // Depot Deep-Dive
    lateTrendSelected: "Late +15 Trend — Selected Stations", fondTrend: "FOND Controllable %",
    ftfdfBreakdown: "FTFDF: DSP vs Upstream — Selected Stations",
    // Upstream
    dspCtrl: "DSP ctrl", upstream: "Upstream", total: "Total",
    networkFtfdf: "Network FTFDF Breakdown",
    // Cycles
    trough: "TROUGH", peak: "PEAK",
    // NCC
    totalNccDefects: "Total NCC Defects", uniqueDrivers: "Unique Drivers",
    worstStation: "Worst Station", topOffender: "Top Offender",
    nccByStationWeekly: "NCC Defects by Station — Weekly",
    minDefects: "Min defects", driversShown: "drivers", weeksShown: "weeks",
    driver: "Driver", city: "City",
    // Late
    totalLateDefects: "Total Late Defects", latePlus15min: "Late +15min",
    opsControllable: "Ops Controllable", severeDefects: "severe defects",
    ofTotal: "of total", lateByStationWeekly: "Late Deliveries by Station — Weekly",
    allLate: "All Late", latePlus15Only: "Late +15 Only",
    driverId: "Driver", gt15: "+15", pct: "%",
    keyInsight: "KEY INSIGHT", keyInsightText: "was catastrophic — {n} late deliveries network-wide ({m} UIT4). {w2} repeated the pattern with {n2}.",
    gt15Rate: "GT15 RATE", gt15RateText: "of lates are >15min — UIT4 has {n}/{m} of all severe lates.",
    attribution: "ATTRIBUTION", attributionText: "100% classified as 'Late Batch Ops Controllable' — these are DSP-owned.",
    // Scorecard
    combinedDefects: "Combined Defects", nccDefects: "NCC Defects", lateDefects: "Late Defects",
    notCallCompliant: "Not Call Compliant", severe15min: "severe (+15min)",
    dualOffenders: "Dual Offenders", driversWithBoth: "drivers with both NCC + Late",
    minCombined: "Min combined", severity: "Severity", defectMix: "Defect Mix",
    ncc: "NCC", late: "Late", latePlus15Label: "Late +15",
    severityLegend: "Severity: CRITICAL = 15+ GT15 defects · HIGH = 40+ combined · MEDIUM = 20+ combined",
    tabGeo: "Geo View",
    geoTitle: "Defects by Site & Attribution",
    geoMap: "Defect Map — Italy",
    geoFilter: "Defect Type Filter",
    geoAttribTable: "Defect × Attribution",
    geoDriverMatrix: "Driver Defect Matrix",
    geoTotal: "Total",
    geoAllDefects: "All Defect Types",
    // Flow
    tabFlow: "Defect Flow", flowSnap: "W8 2026 Snapshot", flowInstr: "← Click to drill down: defect → attribution → site → driver",
    flowDefectType: "Defect Type", flowAttribution: "Root Cause", flowSite: "Site", flowDriver: "Driver",
    flowSelectHint: "Select a defect type to explore root causes",
    // Footer
    footer: "LAST MILE DSP ITALY", generated: "GENERATED",
    // Shared
    defects: "defects", across: "across",
  },
  "it": {
    brand: "Ultimo Miglio DSP — Italia", title: "Performance di Consegna", latestInRange: "Ultima nel Range",
    stations: "stazioni", station: "stazione",
    tabOverview: "Panoramica", tabDepots: "Analisi Depositi", tabUpstream: "Upstream vs Controllabile",
    tabCycles: "Cicli UIT4", tabNcc: "Autisti NCC", tabLate: "Autisti in Ritardo", tabScorecard: "Scorecard Autisti", tabProductivity: "Produttività",
    sprTitle: "Stop per route — settimanale", sprUnit: "stop / route", sprAvg: "media", sprTarget: "target", sprOrders: "Ordini", sprRoutes: "Route", sprValues: "Valori", sprNetwork: "Rete", sprTable: "Stop per route per stazione — settimanale",
    sprNote: "Stop per route = ordini consegnati ÷ route accettate (Amazon Lighthouse › Business Metrics, settimanale per stazione). Target = 75° percentile delle settimane caricate; ambra sotto il 90% del target, rosso sotto l'80%.",
    year: "Anno", weeks: "Settimane", reset: "Resetta",
    depot: "Deposito", week: "Sett.", latePlus15: "Ritardo +15", fondCtrl: "FOND Ctrl", ftfdf: "FTFDF",
    ftpdf: "FTPDF", pdnr: "PDNR", fdnr: "FDNR", pp: "PP", status: "Stato",
    w4Baseline: "Baseline S4'25", networkLate: "Ritardi +15 — Rete", perfHeatmap: "Mappa Prestazioni",
    lateTrendSelected: "Trend Ritardi +15 — Stazioni Selezionate", fondTrend: "FOND Controllabile %",
    ftfdfBreakdown: "FTFDF: DSP vs Upstream — Stazioni Selezionate",
    dspCtrl: "DSP ctrl", upstream: "Upstream", total: "Totale",
    networkFtfdf: "FTFDF Rete — Ripartizione",
    trough: "MINIMO", peak: "MASSIMO",
    totalNccDefects: "Totale Difetti NCC", uniqueDrivers: "Autisti Unici",
    worstStation: "Stazione Peggiore", topOffender: "Peggior Autista",
    nccByStationWeekly: "Difetti NCC per Stazione — Settimanale",
    minDefects: "Min difetti", driversShown: "autisti", weeksShown: "settimane",
    driver: "Autista", city: "Città",
    totalLateDefects: "Totale Difetti Ritardo", latePlus15min: "Ritardo +15min",
    opsControllable: "Controllabile Ops", severeDefects: "difetti gravi",
    ofTotal: "del totale", lateByStationWeekly: "Ritardi per Stazione — Settimanale",
    allLate: "Tutti i Ritardi", latePlus15Only: "Solo Ritardo +15",
    driverId: "Autista", gt15: "+15", pct: "%",
    keyInsight: "DATO CHIAVE", keyInsightText: "è stato catastrofico — {n} ritardi nella rete ({m} UIT4). {w2} ha ripetuto con {n2}.",
    gt15Rate: "TASSO GT15", gt15RateText: "dei ritardi sono >15min — UIT4 ha {n}/{m} dei ritardi gravi.",
    attribution: "ATTRIBUZIONE", attributionText: "100% classificati come 'Late Batch Ops Controllable' — responsabilità DSP.",
    combinedDefects: "Difetti Combinati", nccDefects: "Difetti NCC", lateDefects: "Difetti Ritardo",
    notCallCompliant: "Non Conforme Chiamata", severe15min: "gravi (+15min)",
    dualOffenders: "Doppi Trasgressori", driversWithBoth: "autisti con NCC + Ritardo",
    minCombined: "Min combinati", severity: "Gravità", defectMix: "Mix Difetti",
    ncc: "NCC", late: "Ritardo", latePlus15Label: "Ritardo +15",
    severityLegend: "Gravità: CRITICO = 15+ difetti GT15 · ALTO = 40+ combinati · MEDIO = 20+ combinati",
    tabGeo: "Vista Geo",
    geoTitle: "Difetti per Stazione e Attribuzione",
    geoMap: "Mappa Difetti — Italia",
    geoFilter: "Filtro Tipo Difetto",
    geoAttribTable: "Difetto × Attribuzione",
    geoDriverMatrix: "Matrice Difetti Autisti",
    geoTotal: "Totale",
    geoAllDefects: "Tutti i Tipi",
    tabFlow: "Flusso Difetti", flowSnap: "Snapshot S8 2026", flowInstr: "← Clicca per esplorare: difetto → causa → stazione → autista",
    flowDefectType: "Tipo Difetto", flowAttribution: "Causa Radice", flowSite: "Stazione", flowDriver: "Autista",
    flowSelectHint: "Seleziona un tipo di difetto per esplorare le cause",
    footer: "ULTIMO MIGLIO DSP ITALIA", generated: "GENERATO",
    defects: "difetti", across: "su",
  },
  "es": {
    brand: "Última Milla DSP — Italia", title: "Rendimiento de Entrega", latestInRange: "Última en Rango",
    stations: "estaciones", station: "estación",
    tabOverview: "Resumen", tabDepots: "Análisis de Depósitos", tabUpstream: "Upstream vs Controlable",
    tabCycles: "Ciclos UIT4", tabNcc: "Conductores NCC", tabLate: "Conductores con Retraso", tabScorecard: "Scorecard Conductores", tabProductivity: "Productividad",
    sprTitle: "Paradas por ruta — semanal", sprUnit: "paradas / ruta", sprAvg: "media", sprTarget: "objetivo", sprOrders: "Pedidos", sprRoutes: "Rutas", sprValues: "Valores", sprNetwork: "Red", sprTable: "Paradas por ruta por estación — semanal",
    sprNote: "Paradas por ruta = pedidos entregados ÷ rutas aceptadas (Amazon Lighthouse › Business Metrics, semanal por estación). Objetivo = percentil 75 de las semanas cargadas; ámbar por debajo del 90 % del objetivo, rojo por debajo del 80 %.",
    year: "Año", weeks: "Semanas", reset: "Reiniciar",
    depot: "Depósito", week: "Sem.", latePlus15: "Retraso +15", fondCtrl: "FOND Ctrl", ftfdf: "FTFDF",
    ftpdf: "FTPDF", pdnr: "PDNR", fdnr: "FDNR", pp: "PP", status: "Estado",
    w4Baseline: "Línea base S4'25", networkLate: "Retrasos +15 — Red", perfHeatmap: "Mapa de Rendimiento",
    lateTrendSelected: "Tendencia Retrasos +15 — Estaciones Seleccionadas", fondTrend: "FOND Controlable %",
    ftfdfBreakdown: "FTFDF: DSP vs Upstream — Estaciones Seleccionadas",
    dspCtrl: "DSP ctrl", upstream: "Upstream", total: "Total",
    networkFtfdf: "FTFDF Red — Desglose",
    trough: "MÍNIMO", peak: "MÁXIMO",
    totalNccDefects: "Total Defectos NCC", uniqueDrivers: "Conductores Únicos",
    worstStation: "Peor Estación", topOffender: "Peor Conductor",
    nccByStationWeekly: "Defectos NCC por Estación — Semanal",
    minDefects: "Mín defectos", driversShown: "conductores", weeksShown: "semanas",
    driver: "Conductor", city: "Ciudad",
    totalLateDefects: "Total Defectos Retraso", latePlus15min: "Retraso +15min",
    opsControllable: "Controlable Ops", severeDefects: "defectos graves",
    ofTotal: "del total", lateByStationWeekly: "Retrasos por Estación — Semanal",
    allLate: "Todos los Retrasos", latePlus15Only: "Solo Retraso +15",
    driverId: "Conductor", gt15: "+15", pct: "%",
    keyInsight: "DATO CLAVE", keyInsightText: "fue catastrófico — {n} retrasos en la red ({m} UIT4). {w2} repitió con {n2}.",
    gt15Rate: "TASA GT15", gt15RateText: "de los retrasos son >15min — UIT4 tiene {n}/{m} de retrasos graves.",
    attribution: "ATRIBUCIÓN", attributionText: "100% clasificados como 'Late Batch Ops Controllable' — responsabilidad DSP.",
    combinedDefects: "Defectos Combinados", nccDefects: "Defectos NCC", lateDefects: "Defectos Retraso",
    notCallCompliant: "No Conforme Llamada", severe15min: "graves (+15min)",
    dualOffenders: "Dobles Infractores", driversWithBoth: "conductores con NCC + Retraso",
    minCombined: "Mín combinados", severity: "Severidad", defectMix: "Mix Defectos",
    ncc: "NCC", late: "Retraso", latePlus15Label: "Retraso +15",
    severityLegend: "Severidad: CRÍTICO = 15+ defectos GT15 · ALTO = 40+ combinados · MEDIO = 20+ combinados",
    tabGeo: "Vista Geo",
    geoTitle: "Defectos por Sitio y Atribución",
    geoMap: "Mapa Defectos — Italia",
    geoFilter: "Filtro Tipo Defecto",
    geoAttribTable: "Defecto × Atribución",
    geoDriverMatrix: "Matriz Defectos Conductores",
    geoTotal: "Total",
    geoAllDefects: "Todos los Tipos",
    tabFlow: "Flujo Defectos", flowSnap: "Instantánea S8 2026", flowInstr: "← Clic para profundizar: defecto → atribución → sitio → conductor",
    flowDefectType: "Tipo Defecto", flowAttribution: "Causa Raíz", flowSite: "Sitio", flowDriver: "Conductor",
    flowSelectHint: "Selecciona un tipo de defecto para explorar causas",
    footer: "ÚLTIMA MILLA DSP ITALIA", generated: "GENERADO",
    defects: "defectos", across: "en",
  }
};
const LANGS = [{code:"en",label:"EN"},{code:"it",label:"IT"},{code:"es",label:"ES"}];

// ─── NETWORK DATA (with year) ──────────────────────────────────────
const NETWORK = [
  { year:2025,week:"W4",late:2.4,fond:0.4,pdnr:0.30,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W5",late:3.2,fond:0.5,pdnr:0.45,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W6",late:4.6,fond:0.6,pdnr:0.50,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W7",late:3.5,fond:0.5,pdnr:0.67,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W8",late:2.2,fond:0.35,pdnr:0.90,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W20",late:2.5,fond:0.4,pdnr:0.5,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W22",late:3.0,fond:0.5,pdnr:0.5,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W24",late:2.97,fond:0.4,pdnr:0.55,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W25",late:3.60,fond:0.4,pdnr:0.63,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W26",late:2.67,fond:0.4,pdnr:0.53,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W27",late:3.01,fond:0.35,pdnr:0.49,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W28",late:1.86,fond:0.33,pdnr:0.61,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W29",late:1.86,fond:0.29,pdnr:0.34,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W30",late:1.86,fond:0.30,pdnr:0.54,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W31",late:1.02,fond:0.35,pdnr:0.28,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W33",late:0.70,fond:null,pdnr:null,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W34",late:0.77,fond:0.17,pdnr:0.43,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W35",late:0.85,fond:0.23,pdnr:0.45,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W36",late:3.13,fond:0.66,pdnr:0.42,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W37",late:3.25,fond:0.70,pdnr:0.34,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W38",late:3.71,fond:0.50,pdnr:0.54,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W39",late:4.02,fond:0.82,pdnr:0.45,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W40",late:2.30,fond:2.32,pdnr:0.58,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W41",late:2.48,fond:0.70,pdnr:0.56,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W43",late:3.30,fond:null,pdnr:null,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W44",late:2.92,fond:0.65,pdnr:0.56,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W45",late:2.42,fond:null,pdnr:0.60,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W46",late:2.54,fond:0.74,pdnr:0.35,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W47",late:2.50,fond:0.56,pdnr:0.45,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W48",late:2.69,fond:0.84,pdnr:0.58,ftfdf:2.35,ftfdfOC:0.85 },
  { year:2025,week:"W49",late:2.50,fond:null,pdnr:null,ftfdf:null,ftfdfOC:null },
  { year:2025,week:"W50",late:4.56,fond:0.85,pdnr:0.53,ftfdf:1.75,ftfdfOC:0.85 },
  { year:2025,week:"W51",late:5.15,fond:0.86,pdnr:0.56,ftfdf:2.44,ftfdfOC:0.86 },
  // 2026
  { year:2026,week:"W1",late:0.80,fond:0.57,pdnr:0.47,ftfdf:2.12,ftfdfOC:0.57 },
  { year:2026,week:"W2",late:2.67,fond:1.30,pdnr:0.51,ftfdf:null,ftfdfOC:1.30 },
  { year:2026,week:"W3",late:2.41,fond:0.91,pdnr:0.53,ftfdf:2.80,ftfdfOC:0.91 },
  { year:2026,week:"W4",late:1.99,fond:0.87,pdnr:0.32,ftfdf:1.92,ftfdfOC:0.87 },
  { year:2026,week:"W5",late:3.56,fond:1.80,pdnr:0.57,ftfdf:2.92,ftfdfOC:1.80 },
  { year:2026,week:"W6",late:5.01,fond:2.60,pdnr:0.50,ftfdf:3.69,ftfdfOC:2.60 },
  { year:2026,week:"W7",late:3.44,fond:1.72,pdnr:0.67,ftfdf:null,ftfdfOC:1.72 },
  {year:2026,week:"W27",late:2.77,fond:0.7,pdnr:1.07,ftfdf:2.16,ftfdfOC:0.7},
  {year:2026,week:"W28",late:1.64,fond:0.73,pdnr:0.89,ftfdf:1.99,ftfdfOC:0.73},
  {year:2026,week:"W29",late:2.18,fond:0.66,pdnr:0.6,ftfdf:1.96,ftfdfOC:0.66},
  {year:2026,week:"W30",late:1.04,fond:0.77,pdnr:0.83,ftfdf:2.06,ftfdfOC:0.77},
  {year:2026,week:"W31",late:1.41,fond:0.69,pdnr:1.09,ftfdf:1.94,ftfdfOC:0.69},
  {year:2026,week:"W32",late:1.7,fond:0.65,pdnr:0.98,ftfdf:2.15,ftfdfOC:0.65},
  {year:2026,week:"W33",late:0.35,fond:0.29,pdnr:0.55,ftfdf:1.87,ftfdfOC:0.29},
  {year:2026,week:"W34",late:0.77,fond:0.39,pdnr:1.21,ftfdf:2.07,ftfdfOC:0.39},
  {year:2026,week:"W35",late:0.9,fond:0.53,pdnr:1.41,ftfdf:1.8,ftfdfOC:0.53},
  {year:2026,week:"W36",late:2.98,fond:0.72,pdnr:1.14,ftfdf:2.1,ftfdfOC:0.72},
  {year:2026,week:"W37",late:4.16,fond:1.29,pdnr:0.33,ftfdf:2.78,ftfdfOC:1.29},
];

// ─── ALL DEPOT DATA (with year) ────────────────────────────────────
const ALL_DEPOT_DATA = {
  UIT4: [
    // 2025
    {year:2025,week:"W4",late:2.11,fondCtrl:1.04,ftfdf:2.05,pdnr:0.41,fdnr:0.14,ftdc:0.08,pondFP:null,pondPP:null,ftpdf:1.62},
    {year:2025,week:"W5",late:4.19,fondCtrl:2.32,ftfdf:3.42,pdnr:0.84,fdnr:0.24,ftdc:0.18,pondFP:null,pondPP:null,ftpdf:2.47},
    {year:2025,week:"W6",late:6.34,fondCtrl:2.75,ftfdf:3.91,pdnr:0.62,fdnr:0.13,ftdc:0.37,pondFP:null,pondPP:null,ftpdf:2.02},
    {year:2025,week:"W7",late:3.66,fondCtrl:1.25,ftfdf:2.61,pdnr:0.85,fdnr:0.22,ftdc:0.16,pondFP:null,pondPP:null,ftpdf:1.83},
    {year:2025,week:"W8",late:2.50,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W24",late:3.78,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W25",late:4.35,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W26",late:4.05,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W27",late:3.62,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W28",late:1.27,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W29",late:2.79,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W30",late:2.79,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W31",late:1.29,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W33",late:0.97,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W34",late:0.89,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W35",late:0.44,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W36",late:2.21,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W37",late:3.46,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W38",late:5.37,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W39",late:5.53,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W40",late:3.15,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W41",late:3.28,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W43",late:3.38,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W44",late:3.62,fondCtrl:0.77,ftfdf:null,pdnr:0.68,fdnr:0.17,ftdc:0.10,pondFP:0.52,pondPP:0.54,ftpdf:null},
    {year:2025,week:"W45",late:2.09,fondCtrl:0.45,ftfdf:null,pdnr:0.79,fdnr:0.17,ftdc:0.08,pondFP:0.33,pondPP:0.52,ftpdf:null},
    {year:2025,week:"W46",late:3.23,fondCtrl:0.93,ftfdf:null,pdnr:0.46,fdnr:0.10,ftdc:0.05,pondFP:0.40,pondPP:0.55,ftpdf:null},
    {year:2025,week:"W47",late:2.56,fondCtrl:0.77,ftfdf:null,pdnr:0.46,fdnr:0.14,ftdc:0.14,pondFP:0.62,pondPP:0.39,ftpdf:null},
    {year:2025,week:"W48",late:2.98,fondCtrl:0.79,ftfdf:2.47,pdnr:0.70,fdnr:0.20,ftdc:0.08,pondFP:0.51,pondPP:0.48,ftpdf:1.01},
    {year:2025,week:"W49",late:2.37,fondCtrl:0.61,ftfdf:2.54,pdnr:0.61,fdnr:0.11,ftdc:0.17,pondFP:0.77,pondPP:0.55,ftpdf:1.38},
    {year:2025,week:"W50",late:6.93,fondCtrl:1.20,ftfdf:3.15,pdnr:0.68,fdnr:0.20,ftdc:0.23,pondFP:0.68,pondPP:1.25,ftpdf:2.05},
    {year:2025,week:"W51",late:7.03,fondCtrl:1.19,ftfdf:3.41,pdnr:0.83,fdnr:0.28,ftdc:0.13,pondFP:0.66,pondPP:1.19,ftpdf:1.91},
    // 2026
    {year:2026,week:"W1",late:1.06,fondCtrl:0.72,ftfdf:2.54,pdnr:0.67,fdnr:0.05,ftdc:0.05,pondFP:0.51,pondPP:1.20,ftpdf:1.92},
    {year:2026,week:"W2",late:2.45,fondCtrl:1.60,ftfdf:null,pdnr:0.64,fdnr:0.09,ftdc:0.05,pondFP:0.81,pondPP:1.24,ftpdf:2.09},
    {year:2026,week:"W3",late:2.32,fondCtrl:2.19,ftfdf:3.45,pdnr:0.76,fdnr:0.15,ftdc:0.26,pondFP:0.63,pondPP:1.34,ftpdf:2.08},
    {year:2026,week:"W4",late:2.11,fondCtrl:1.04,ftfdf:2.05,pdnr:0.41,fdnr:0.14,ftdc:0.08,pondFP:0.65,pondPP:0.91,ftpdf:1.62},
    {year:2026,week:"W5",late:4.19,fondCtrl:2.32,ftfdf:3.42,pdnr:0.84,fdnr:0.24,ftdc:0.18,pondFP:0.79,pondPP:1.59,ftpdf:2.47},
    {year:2026,week:"W6",late:6.34,fondCtrl:2.75,ftfdf:3.91,pdnr:0.62,fdnr:0.13,ftdc:0.37,pondFP:0.47,pondPP:1.42,ftpdf:2.02},
    {year:2026,week:"W7",late:3.66,fondCtrl:1.25,ftfdf:2.61,pdnr:0.85,fdnr:0.22,ftdc:0.16,pondFP:0.51,pondPP:1.23,ftpdf:1.83},
    // 2026 — Lighthouse export 2026-09-14
    {year:2026,week:"W27",late:2.73,fondCtrl:0.71,ftfdf:2.57,pdnr:1.43,fdnr:0.25,ftdc:0.22,pondFP:0.77,pondPP:0.9,ftpdf:1.67},
    {year:2026,week:"W28",late:1.73,fondCtrl:0.83,ftfdf:2.34,pdnr:0.96,fdnr:0.19,ftdc:0.06,pondFP:0.77,pondPP:0.49,ftpdf:1.27},
    {year:2026,week:"W29",late:1.39,fondCtrl:0.63,ftfdf:2.28,pdnr:0.86,fdnr:0.07,ftdc:0.3,pondFP:0.69,pondPP:0.56,ftpdf:1.26},
    {year:2026,week:"W30",late:0.37,fondCtrl:0.87,ftfdf:2.36,pdnr:0.87,fdnr:0.24,ftdc:0.07,pondFP:0.64,pondPP:0.4,ftpdf:1.04},
    {year:2026,week:"W31",late:0.92,fondCtrl:0.71,ftfdf:2.38,pdnr:1.21,fdnr:0.11,ftdc:0.04,pondFP:0.43,pondPP:0.18,ftpdf:0.6},
    {year:2026,week:"W32",late:1.31,fondCtrl:0.54,ftfdf:2.62,pdnr:1.18,fdnr:0.23,ftdc:0.0,pondFP:0.68,pondPP:0.5,ftpdf:1.18},
    {year:2026,week:"W33",late:0.22,fondCtrl:0.27,ftfdf:2.16,pdnr:0.48,fdnr:0.27,ftdc:0.11,pondFP:0.32,pondPP:0.75,ftpdf:1.08},
    {year:2026,week:"W34",late:0.25,fondCtrl:0.42,ftfdf:2.38,pdnr:1.51,fdnr:0.08,ftdc:0.04,pondFP:0.38,pondPP:0.92,ftpdf:1.3},
    {year:2026,week:"W35",late:0.4,fondCtrl:0.4,ftfdf:1.82,pdnr:1.45,fdnr:0.13,ftdc:0.0,pondFP:0.67,pondPP:0.94,ftpdf:1.62},
    {year:2026,week:"W36",late:2.38,fondCtrl:0.66,ftfdf:2.18,pdnr:1.6,fdnr:0.15,ftdc:0.63,pondFP:0.86,pondPP:2.13,ftpdf:2.99},
    {year:2026,week:"W37",late:4.86,fondCtrl:1.21,ftfdf:3.18,pdnr:0.44,fdnr:0.04,ftdc:0.44,pondFP:0.6,pondPP:1.57,ftpdf:2.17},
  ],
  UIT1: [
    // 2025
    {year:2025,week:"W4",late:1.18,fondCtrl:0.74,ftfdf:1.65,pdnr:0.15,fdnr:0.11,ftdc:0.11,pondFP:null,pondPP:null,ftpdf:0.55},
    {year:2025,week:"W5",late:1.51,fondCtrl:1.13,ftfdf:2.53,pdnr:0.24,fdnr:0.10,ftdc:0,pondFP:null,pondPP:null,ftpdf:0.62},
    {year:2025,week:"W6",late:3.09,fondCtrl:2.24,ftfdf:3.37,pdnr:0.35,fdnr:0.11,ftdc:0.07,pondFP:null,pondPP:null,ftpdf:0.81},
    {year:2025,week:"W7",late:1.91,fondCtrl:1.63,ftfdf:3.12,pdnr:0.43,fdnr:0.07,ftdc:0.11,pondFP:null,pondPP:null,ftpdf:0.64},
    {year:2025,week:"W8",late:1.23,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W24",late:1.50,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W25",late:2.05,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W26",late:1.80,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W27",late:1.70,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W28",late:0.93,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W29",late:0.71,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W30",late:0.35,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W31",late:0.64,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W33",late:0.84,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W34",late:0.47,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W35",late:0.53,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W36",late:1.32,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W37",late:1.23,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W38",late:0.97,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W39",late:1.83,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W40",late:0.81,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W41",late:1.22,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W43",late:1.31,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W44",late:1.25,fondCtrl:0.36,ftfdf:null,pdnr:0.36,fdnr:0.04,ftdc:0,pondFP:0.32,pondPP:0.21,ftpdf:null},
    {year:2025,week:"W45",late:1.60,fondCtrl:0.14,ftfdf:null,pdnr:0.37,fdnr:0.11,ftdc:0,pondFP:0.41,pondPP:0.30,ftpdf:null},
    {year:2025,week:"W46",late:0.61,fondCtrl:0.51,ftfdf:null,pdnr:0.24,fdnr:0.10,ftdc:0.10,pondFP:0.03,pondPP:0.20,ftpdf:null},
    {year:2025,week:"W47",late:1.29,fondCtrl:0.62,ftfdf:null,pdnr:0.35,fdnr:0.09,ftdc:0.06,pondFP:0.13,pondPP:0.31,ftpdf:null},
    {year:2025,week:"W48",late:2.19,fondCtrl:0.97,ftfdf:2.55,pdnr:0.61,fdnr:0.10,ftdc:0.05,pondFP:0.05,pondPP:0.41,ftpdf:0.46},
    {year:2025,week:"W49",late:1.08,fondCtrl:0.49,ftfdf:1.18,pdnr:0.49,fdnr:null,ftdc:0.10,pondFP:0.30,pondPP:0.30,ftpdf:0.79},
    {year:2025,week:"W50",late:1.69,fondCtrl:0.38,ftfdf:1.83,pdnr:0.42,fdnr:null,ftdc:0.09,pondFP:0.28,pondPP:0.05,ftpdf:0.33},
    {year:2025,week:"W51",late:2.20,fondCtrl:0.66,ftfdf:1.68,pdnr:0.31,fdnr:0.17,ftdc:0.03,pondFP:0.31,pondPP:0.21,ftpdf:0.59},
    // 2026
    {year:2026,week:"W1",late:0.21,fondCtrl:0.37,ftfdf:1.74,pdnr:0.16,fdnr:null,ftdc:null,pondFP:0.16,pondPP:0.21,ftpdf:0.42},
    {year:2026,week:"W2",late:3.16,fondCtrl:0.95,ftfdf:null,pdnr:0.43,fdnr:null,ftdc:0.03,pondFP:0.30,pondPP:0.82,ftpdf:1.18},
    {year:2026,week:"W3",late:1.91,fondCtrl:0.69,ftfdf:1.98,pdnr:0.30,fdnr:0.13,ftdc:null,pondFP:0.13,pondPP:0.66,ftpdf:0.92},
    {year:2026,week:"W4",late:1.18,fondCtrl:0.74,ftfdf:1.65,pdnr:0.15,fdnr:0.11,ftdc:0.11,pondFP:0.26,pondPP:0.26,ftpdf:0.55},
    {year:2026,week:"W5",late:1.51,fondCtrl:1.13,ftfdf:2.53,pdnr:0.24,fdnr:0.10,ftdc:null,pondFP:0.21,pondPP:0.38,ftpdf:0.62},
    {year:2026,week:"W6",late:3.09,fondCtrl:2.24,ftfdf:3.37,pdnr:0.35,fdnr:0.11,ftdc:0.07,pondFP:0.25,pondPP:0.53,ftpdf:0.81},
    {year:2026,week:"W7",late:1.91,fondCtrl:1.63,ftfdf:3.12,pdnr:0.43,fdnr:0.07,ftdc:0.11,pondFP:0.21,pondPP:0.43,ftpdf:0.64},
    // 2026 — Lighthouse export 2026-09-14
    {year:2026,week:"W27",late:1.04,fondCtrl:0.71,ftfdf:2.07,pdnr:0.44,fdnr:0.16,ftdc:0.11,pondFP:0.11,pondPP:0.22,ftpdf:0.33},
    {year:2026,week:"W28",late:0.62,fondCtrl:0.87,ftfdf:2.04,pdnr:0.43,fdnr:0.0,ftdc:0.0,pondFP:0.19,pondPP:0.06,ftpdf:0.25},
    {year:2026,week:"W29",late:1.21,fondCtrl:0.27,ftfdf:1.34,pdnr:0.13,fdnr:0.07,ftdc:0.07,pondFP:0.13,pondPP:0.13,ftpdf:0.27},
    {year:2026,week:"W30",late:0.89,fondCtrl:0.52,ftfdf:1.56,pdnr:0.74,fdnr:0.15,ftdc:0.07,pondFP:0.15,pondPP:0.22,ftpdf:0.37},
    {year:2026,week:"W31",late:0.63,fondCtrl:0.47,ftfdf:1.49,pdnr:0.47,fdnr:0.16,ftdc:0.0,pondFP:0.39,pondPP:0.16,ftpdf:0.55},
    {year:2026,week:"W32",late:1.79,fondCtrl:0.99,ftfdf:1.79,pdnr:0.6,fdnr:0.1,ftdc:0.0,pondFP:0.1,pondPP:0.0,ftpdf:0.1},
    {year:2026,week:"W33",late:0.44,fondCtrl:0.29,ftfdf:1.76,pdnr:0.29,fdnr:0.15,ftdc:0.0,pondFP:0.0,pondPP:0.15,ftpdf:0.15},
    {year:2026,week:"W34",late:0.97,fondCtrl:0.32,ftfdf:1.83,pdnr:0.43,fdnr:0.0,ftdc:0.0,pondFP:0.0,pondPP:0.11,ftpdf:0.11},
    {year:2026,week:"W35",late:0.96,fondCtrl:0.88,ftfdf:2.13,pdnr:0.74,fdnr:0.0,ftdc:0.07,pondFP:0.44,pondPP:0.07,ftpdf:0.51},
    {year:2026,week:"W36",late:3.43,fondCtrl:0.99,ftfdf:2.39,pdnr:0.45,fdnr:0.05,ftdc:0.05,pondFP:0.63,pondPP:0.45,ftpdf:1.08},
    {year:2026,week:"W37",late:2.36,fondCtrl:1.21,ftfdf:2.21,pdnr:0.21,fdnr:0.0,ftdc:0.07,pondFP:0.36,pondPP:0.36,ftpdf:0.71},
  ],
  UIT7: [
    // 2025
    {year:2025,week:"W4",late:1.29,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W7",late:0.14,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W27",late:3.74,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W28",late:1.64,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W29",late:0.86,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W30",late:1.44,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W31",late:0.84,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W33",late:0.39,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W34",late:0.53,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W35",late:2.63,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W36",late:9.37,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W37",late:6.77,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W38",late:3.03,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W39",late:2.95,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W40",late:2.30,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W41",late:1.74,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W43",late:1.57,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W44",late:2.75,fondCtrl:0.44,ftfdf:null,pdnr:0.53,fdnr:null,ftdc:null,pondFP:0.09,pondPP:0.80,ftpdf:null},
    {year:2025,week:"W46",late:1.59,fondCtrl:0.42,ftfdf:null,pdnr:0.17,fdnr:0.08,ftdc:0,pondFP:0.08,pondPP:0.33,ftpdf:null},
    {year:2025,week:"W47",late:4.80,fondCtrl:0.59,ftfdf:null,pdnr:0.58,fdnr:null,ftdc:0.13,pondFP:null,pondPP:0.80,ftpdf:null},
    {year:2025,week:"W48",late:4.58,fondCtrl:0.13,ftfdf:0.65,pdnr:0.79,fdnr:null,ftdc:0.13,pondFP:null,pondPP:0.92,ftpdf:1.05},
    {year:2025,week:"W49",late:2.82,fondCtrl:0.70,ftfdf:2.11,pdnr:null,fdnr:null,ftdc:null,pondFP:0.23,pondPP:0.94,ftpdf:1.17},
    {year:2025,week:"W50",late:1.92,fondCtrl:0.34,ftfdf:1.47,pdnr:0.34,fdnr:0.23,ftdc:null,pondFP:0.23,pondPP:0.79,ftpdf:1.35},
    {year:2025,week:"W51",late:2.36,fondCtrl:0.09,ftfdf:0.45,pdnr:0.18,fdnr:0,ftdc:0,pondFP:0.36,pondPP:0.91,ftpdf:1.27},
    // 2026
    {year:2026,week:"W1",late:0.27,fondCtrl:0.40,ftfdf:1.07,pdnr:0.27,fdnr:0.13,ftdc:null,pondFP:null,pondPP:0.40,ftpdf:0.40},
    {year:2026,week:"W2",late:2.39,fondCtrl:0.60,ftfdf:null,pdnr:0.20,fdnr:0.10,ftdc:null,pondFP:0.60,pondPP:1.00,ftpdf:1.60},
    {year:2026,week:"W3",late:3.22,fondCtrl:0.46,ftfdf:1.66,pdnr:0.46,fdnr:null,ftdc:null,pondFP:0.09,pondPP:0.64,ftpdf:0.74},
    {year:2026,week:"W4",late:1.29,fondCtrl:0.45,ftfdf:1.19,pdnr:0.32,fdnr:null,ftdc:null,pondFP:0.11,pondPP:0.22,ftpdf:0.32},
    {year:2026,week:"W5",late:4.46,fondCtrl:1.78,ftfdf:2.67,pdnr:0.59,fdnr:0.15,ftdc:null,pondFP:0.30,pondPP:0.59,ftpdf:1.19},
  ],
  UBA1: [
    // 2025
    {year:2025,week:"W4",late:5.26,fondCtrl:0.92,ftfdf:3.15,pdnr:0.45,fdnr:0.90,ftdc:0,pondFP:null,pondPP:null,ftpdf:2.10},
    {year:2025,week:"W5",late:5.38,fondCtrl:1.15,ftfdf:1.92,pdnr:0.13,fdnr:0.13,ftdc:0,pondFP:null,pondPP:null,ftpdf:1.92},
    {year:2025,week:"W6",late:4.13,fondCtrl:4.13,ftfdf:4.65,pdnr:0.52,fdnr:0.52,ftdc:0,pondFP:null,pondPP:null,ftpdf:1.03},
    {year:2025,week:"W7",late:8.81,fondCtrl:6.25,ftfdf:7.05,pdnr:0.48,fdnr:0.48,ftdc:0.16,pondFP:null,pondPP:null,ftpdf:0.48},
    {year:2025,week:"W8",late:2.92,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W25",late:0.31,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W27",late:2.74,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W28",late:0.53,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W29",late:1.40,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W30",late:1.09,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W31",late:0.71,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W33",late:0.00,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W34",late:1.39,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W36",late:1.98,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W37",late:1.44,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W38",late:3.55,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W39",late:2.77,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W40",late:2.49,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W41",late:3.31,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W43",late:4.90,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W44",late:5.17,fondCtrl:1.62,ftfdf:null,pdnr:0.59,fdnr:0.15,ftdc:null,pondFP:1.18,pondPP:0.30,ftpdf:null},
    {year:2025,week:"W45",late:6.80,fondCtrl:null,ftfdf:null,pdnr:0.21,fdnr:0.21,ftdc:0,pondFP:0.41,pondPP:0,ftpdf:null},
    {year:2025,week:"W46",late:5.98,fondCtrl:0.70,ftfdf:null,pdnr:0.35,fdnr:0,ftdc:0,pondFP:null,pondPP:0.35,ftpdf:null},
    {year:2025,week:"W47",late:1.83,fondCtrl:0.78,ftfdf:null,pdnr:0.42,fdnr:0.28,ftdc:null,pondFP:0.71,pondPP:0.28,ftpdf:null},
    {year:2025,week:"W48",late:1.24,fondCtrl:0.75,ftfdf:1.49,pdnr:0.75,fdnr:null,ftdc:null,pondFP:null,pondPP:0.25,ftpdf:0.25},
    {year:2025,week:"W49",late:0.46,fondCtrl:0.91,ftfdf:1.37,pdnr:0.91,fdnr:0.46,ftdc:null,pondFP:null,pondPP:0.46,ftpdf:0.46},
    {year:2025,week:"W50",late:2.87,fondCtrl:0.61,ftfdf:1.64,pdnr:0.41,fdnr:0.82,ftdc:null,pondFP:null,pondPP:0.20,ftpdf:0.41},
    {year:2025,week:"W51",late:5.91,fondCtrl:0.61,ftfdf:1.67,pdnr:0.30,fdnr:0.15,ftdc:0,pondFP:0.30,pondPP:0.30,ftpdf:0.61},
    // 2026
    {year:2026,week:"W1",late:1.50,fondCtrl:0.56,ftfdf:2.06,pdnr:null,fdnr:0.19,ftdc:null,pondFP:0.19,pondPP:null,ftpdf:0.19},
    {year:2026,week:"W2",late:2.46,fondCtrl:1.64,ftfdf:null,pdnr:0.41,fdnr:0.14,ftdc:null,pondFP:0.82,pondPP:0.27,ftpdf:1.23},
    {year:2026,week:"W3",late:3.32,fondCtrl:2.80,ftfdf:3.57,pdnr:0.13,fdnr:0.51,ftdc:null,pondFP:0.26,pondPP:0.26,ftpdf:0.51},
    {year:2026,week:"W4",late:5.26,fondCtrl:0.92,ftfdf:3.15,pdnr:0.45,fdnr:0.90,ftdc:null,pondFP:1.05,pondPP:0.90,ftpdf:2.10},
    {year:2026,week:"W5",late:5.38,fondCtrl:1.15,ftfdf:1.92,pdnr:0.13,fdnr:0.13,ftdc:null,pondFP:0.77,pondPP:1.02,ftpdf:1.92},
    {year:2026,week:"W6",late:4.13,fondCtrl:4.13,ftfdf:4.65,pdnr:0.52,fdnr:0.52,ftdc:null,pondFP:0.52,pondPP:0.52,ftpdf:1.03},
    {year:2026,week:"W7",late:8.81,fondCtrl:6.25,ftfdf:7.05,pdnr:0.48,fdnr:0.48,ftdc:0.16,pondFP:0.16,pondPP:0.16,ftpdf:0.48},
    // 2026 — Lighthouse export 2026-09-14
    {year:2026,week:"W27",late:3.53,fondCtrl:0.0,ftfdf:0.56,pdnr:1.48,fdnr:0.0,ftdc:0.0,pondFP:0.37,pondPP:0.0,ftpdf:0.37},
    {year:2026,week:"W28",late:0.2,fondCtrl:0.2,ftfdf:1.17,pdnr:1.76,fdnr:0.0,ftdc:0.0,pondFP:0.39,pondPP:0.0,ftpdf:0.39},
    {year:2026,week:"W29",late:5.26,fondCtrl:1.14,ftfdf:1.83,pdnr:0.92,fdnr:0.23,ftdc:0.92,pondFP:0.0,pondPP:0.23,ftpdf:0.23},
    {year:2026,week:"W30",late:0.0,fondCtrl:0.25,ftfdf:0.99,pdnr:0.49,fdnr:0.0,ftdc:0.74,pondFP:0.49,pondPP:0.0,ftpdf:0.49},
    {year:2026,week:"W31",late:0.23,fondCtrl:0.23,ftfdf:0.46,pdnr:1.85,fdnr:0.23,ftdc:0.0,pondFP:0.69,pondPP:0.69,ftpdf:1.39},
    {year:2026,week:"W32",late:0.0,fondCtrl:0.29,ftfdf:1.47,pdnr:1.18,fdnr:0.0,ftdc:0.0,pondFP:0.29,pondPP:0.0,ftpdf:0.29},
    {year:2026,week:"W33",late:0.0,fondCtrl:0.0,ftfdf:1.71,pdnr:1.71,fdnr:0.0,ftdc:0.0,pondFP:0.0,pondPP:0.0,ftpdf:0.0},
    {year:2026,week:"W34",late:0.61,fondCtrl:0.0,ftfdf:0.0,pdnr:1.83,fdnr:0.0,ftdc:0.0,pondFP:1.22,pondPP:0.0,ftpdf:1.22},
    {year:2026,week:"W35",late:1.06,fondCtrl:0.35,ftfdf:1.42,pdnr:3.19,fdnr:1.42,ftdc:0.0,pondFP:0.35,pondPP:0.0,ftpdf:0.35},
    {year:2026,week:"W36",late:1.57,fondCtrl:0.22,ftfdf:0.67,pdnr:1.12,fdnr:0.0,ftdc:0.0,pondFP:0.45,pondPP:0.45,ftpdf:0.9},
    {year:2026,week:"W37",late:0.0,fondCtrl:1.33,ftfdf:1.66,pdnr:0.33,fdnr:0.0,ftdc:0.0,pondFP:1.33,pondPP:0.66,ftpdf:1.99},
  ],
  UIL7: [
    // 2025
    {year:2025,week:"W4",late:2.35,fondCtrl:0.33,ftfdf:1.57,pdnr:0,fdnr:0,ftdc:0,pondFP:null,pondPP:null,ftpdf:0.39},
    {year:2025,week:"W41",late:1.17,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W43",late:5.96,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W44",late:2.80,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W45",late:9.48,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W46",late:5.81,fondCtrl:null,ftfdf:null,pdnr:0,fdnr:0,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W47",late:6.00,fondCtrl:0.63,ftfdf:null,pdnr:0.80,fdnr:null,ftdc:null,pondFP:0.40,pondPP:null,ftpdf:null},
    {year:2025,week:"W48",late:null,fondCtrl:1.89,ftfdf:3.14,pdnr:null,fdnr:null,ftdc:null,pondFP:0.63,pondPP:null,ftpdf:0.63},
    {year:2025,week:"W49",late:4.94,fondCtrl:1.23,ftfdf:1.23,pdnr:1.23,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W50",late:3.53,fondCtrl:1.76,ftfdf:2.35,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2025,week:"W51",late:7.89,fondCtrl:null,ftfdf:0.75,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    // 2026
    {year:2026,week:"W1",late:1.02,fondCtrl:null,ftfdf:0.51,pdnr:1.02,fdnr:null,ftdc:null,pondFP:null,pondPP:0.51,ftpdf:0.51},
    {year:2026,week:"W2",late:3.55,fondCtrl:null,ftfdf:null,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:0.35,ftpdf:0.35},
    {year:2026,week:"W3",late:3.82,fondCtrl:0.76,ftfdf:1.15,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:null},
    {year:2026,week:"W4",late:2.35,fondCtrl:0.33,ftfdf:1.57,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:null,ftpdf:0.39},
    {year:2026,week:"W5",late:5.40,fondCtrl:0.36,ftfdf:0.72,pdnr:null,fdnr:null,ftdc:null,pondFP:null,pondPP:0.36,ftpdf:0.36},
    {year:2026,week:"W6",late:4.42,fondCtrl:1.20,ftfdf:1.36,pdnr:null,fdnr:null,ftdc:null,pondFP:0.34,pondPP:null,ftpdf:0.34},
    {year:2026,week:"W7",late:3.13,fondCtrl:0.35,ftfdf:2.43,pdnr:0.69,fdnr:null,ftdc:null,pondFP:0.35,pondPP:0.69,ftpdf:1.39},
    // 2026 — Lighthouse export 2026-09-14
    {year:2026,week:"W27",late:7.98,fondCtrl:1.24,ftfdf:1.6,pdnr:0.71,fdnr:0.0,ftdc:0.0,pondFP:0.71,pondPP:0.0,ftpdf:0.71},
    {year:2026,week:"W28",late:5.75,fondCtrl:0.2,ftfdf:0.4,pdnr:0.99,fdnr:0.0,ftdc:0.0,pondFP:0.0,pondPP:0.4,ftpdf:0.4},
    {year:2026,week:"W29",late:7.21,fondCtrl:1.6,ftfdf:2.0,pdnr:0.2,fdnr:0.0,ftdc:0.0,pondFP:0.6,pondPP:0.0,ftpdf:0.6},
    {year:2026,week:"W30",late:6.54,fondCtrl:1.27,ftfdf:2.53,pdnr:1.05,fdnr:0.0,ftdc:0.21,pondFP:0.0,pondPP:0.42,ftpdf:0.42},
    {year:2026,week:"W31",late:6.88,fondCtrl:1.53,ftfdf:1.91,pdnr:1.34,fdnr:0.0,ftdc:0.0,pondFP:0.57,pondPP:0.19,ftpdf:0.76},
    {year:2026,week:"W32",late:4.83,fondCtrl:0.69,ftfdf:1.15,pdnr:0.69,fdnr:0.46,ftdc:0.0,pondFP:0.23,pondPP:0.23,ftpdf:0.46},
    {year:2026,week:"W33",late:1.04,fondCtrl:0.52,ftfdf:0.78,pdnr:0.78,fdnr:0.0,ftdc:0.0,pondFP:0.26,pondPP:0.26,ftpdf:0.52},
    {year:2026,week:"W34",late:3.58,fondCtrl:0.51,ftfdf:1.53,pdnr:1.02,fdnr:0.0,ftdc:0.0,pondFP:0.26,pondPP:0.51,ftpdf:0.77},
    {year:2026,week:"W35",late:3.56,fondCtrl:0.4,ftfdf:0.99,pdnr:1.98,fdnr:0.0,ftdc:0.0,pondFP:0.59,pondPP:1.98,ftpdf:2.57},
    {year:2026,week:"W36",late:6.4,fondCtrl:0.52,ftfdf:1.56,pdnr:0.69,fdnr:0.0,ftdc:0.0,pondFP:0.52,pondPP:1.73,ftpdf:2.25},
    {year:2026,week:"W37",late:9.52,fondCtrl:2.12,ftfdf:3.17,pdnr:0.0,fdnr:0.0,ftdc:0.26,pondFP:0.53,pondPP:2.65,ftpdf:3.17},
  ],
};

// ─── CONSTANTS ──────────────────────────────────────────────────────
const ALL_YEARS = [2025, 2026];
const ALL_DEPOTS = ["UIT4","UIT1","UIT7","UBA1","UIL7"];
const DEPOT_COLORS = {UIT4:"#60a5fa",UIT1:"#34d399",UIT7:"#a78bfa",UBA1:"#fb923c",UIL7:"#f472b6"};
const DEPOT_LABELS = {UIT4:"Roma",UIT1:"Milano",UIT7:"Milano",UBA1:"Bologna",UIL7:"Milano"};
const weekNum = w => parseInt(w.slice(1));
const sortKey = (year, week) => year * 100 + weekNum(week);

// Build ordered week list per year
const WEEKS_BY_YEAR = {};
ALL_YEARS.forEach(y => {
  const s = new Set();
  NETWORK.filter(d => d.year === y).forEach(d => s.add(d.week));
  Object.values(ALL_DEPOT_DATA).forEach(arr => arr.filter(d => d.year === y).forEach(d => s.add(d.week)));
  WEEKS_BY_YEAR[y] = [...s].sort((a, b) => weekNum(a) - weekNum(b));
});

const CYCLES = [{id:1,trough:"W4",peak:"W6",troughVal:2.11,peakVal:6.34},{id:2,trough:"W28",peak:"W25",troughVal:1.27,peakVal:4.35},{id:3,trough:"W35",peak:"W39",troughVal:0.44,peakVal:5.53},{id:4,trough:"W45",peak:"W51",troughVal:2.09,peakVal:7.03}];
const UPSTREAM_DATA = [{depot:"UIT7",ctrl:0.09,upstream:0.36,total:0.45},{depot:"UIT1",ctrl:0.66,upstream:1.02,total:1.68},{depot:"UBA1",ctrl:0.61,upstream:1.06,total:1.67},{depot:"UIT4",ctrl:1.19,upstream:2.22,total:3.41},{depot:"UIL7",ctrl:0.75,upstream:0.00,total:0.75}];

// ─── NCC (NOT CALL COMPLIANT) DATA ─────────────────────────────────
const NCC_WEEKS = ["2025-W47","2025-W48","2025-W49","2025-W50","2025-W51","2025-W52","2026-W1","2026-W2","2026-W3","2026-W4","2026-W5","2026-W6","2026-W7","2026-W8","2026-W27","2026-W28","2026-W29","2026-W30","2026-W31","2026-W32","2026-W33","2026-W34","2026-W35","2026-W36","2026-W37"];
const NCC_STATION_WEEKLY = {"UIT1":{"2025-W47":7,"2025-W48":12,"2025-W49":11,"2025-W50":19,"2025-W51":12,"2025-W52":6,"2026-W1":7,"2026-W2":19,"2026-W3":7,"2026-W4":22,"2026-W5":15,"2026-W6":31,"2026-W7":29,"2026-W8":21,"2026-W37":15,"2026-W36":15,"2026-W35":4,"2026-W33":3,"2026-W32":1,"2026-W31":3,"2026-W30":4,"2026-W29":2,"2026-W28":3,"2026-W27":5,"2026-W34":0},"UIT4":{"2025-W47":2,"2025-W48":25,"2025-W49":28,"2025-W50":46,"2025-W51":51,"2025-W52":28,"2026-W1":24,"2026-W2":28,"2026-W3":27,"2026-W4":39,"2026-W5":40,"2026-W6":29,"2026-W7":15,"2026-W8":20,"2026-W37":9,"2026-W36":12,"2026-W35":9,"2026-W34":5,"2026-W33":1,"2026-W32":8,"2026-W31":4,"2026-W30":8,"2026-W29":11,"2026-W28":7,"2026-W27":5},"UBA1":{"2025-W47":0,"2025-W48":3,"2025-W49":3,"2025-W50":0,"2025-W51":1,"2025-W52":1,"2026-W1":0,"2026-W2":3,"2026-W3":6,"2026-W4":3,"2026-W5":2,"2026-W6":3,"2026-W7":9,"2026-W8":7,"2026-W37":1,"2026-W29":2,"2026-W28":1,"2026-W27":1,"2026-W30":0,"2026-W31":0,"2026-W32":0,"2026-W33":0,"2026-W34":0,"2026-W35":0,"2026-W36":0},"UIL7":{"2025-W47":1,"2025-W48":0,"2025-W49":2,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":1,"2026-W6":1,"2026-W7":0,"2026-W8":0,"2026-W37":2,"2026-W35":1,"2026-W34":1,"2026-W31":4,"2026-W29":8,"2026-W27":0,"2026-W28":0,"2026-W30":0,"2026-W32":0,"2026-W33":0,"2026-W36":0},"UIT7":{"2025-W47":1,"2025-W48":3,"2025-W49":1,"2025-W50":0,"2025-W51":0,"2025-W52":2,"2026-W1":1,"2026-W2":1,"2026-W3":2,"2026-W4":3,"2026-W5":3,"2026-W6":0,"2026-W7":0,"2026-W8":0,"2026-W27":0,"2026-W28":0,"2026-W29":0,"2026-W30":0,"2026-W31":0,"2026-W32":0,"2026-W33":0,"2026-W34":0,"2026-W35":0,"2026-W36":0,"2026-W37":0}};
const NCC_DRIVERS = [
  {name:"De Souza Nunes, Thassio",loc:"Milano",stations:["UIT1","UIT7"],total:55,w:{"2025-W47":1,"2025-W48":6,"2025-W49":4,"2025-W50":1,"2025-W51":2,"2025-W52":5,"2026-W1":3,"2026-W2":3,"2026-W3":2,"2026-W4":6,"2026-W5":3,"2026-W6":1,"2026-W7":2,"2026-W8":0,"2026-W37":2,"2026-W36":8,"2026-W33":3,"2026-W32":1,"2026-W31":1,"2026-W27":1}},
  {name:"Wilson Frometa, Ernesto",loc:"Roma",stations:["UIT4"],total:54,w:{"2025-W47":0,"2025-W48":6,"2025-W49":3,"2025-W50":2,"2025-W51":2,"2025-W52":7,"2026-W1":1,"2026-W2":4,"2026-W3":1,"2026-W4":3,"2026-W5":2,"2026-W6":2,"2026-W7":2,"2026-W8":3,"2026-W37":3,"2026-W34":2,"2026-W32":5,"2026-W31":1,"2026-W30":2,"2026-W29":1,"2026-W28":1,"2026-W27":1}},
  {name:"Lagrotta, Pietro",loc:"Roma",stations:["UIT4"],total:39,w:{"2025-W47":0,"2025-W48":4,"2025-W49":1,"2025-W50":3,"2025-W51":3,"2025-W52":3,"2026-W1":2,"2026-W2":1,"2026-W3":1,"2026-W4":4,"2026-W5":8,"2026-W6":2,"2026-W7":1,"2026-W8":6}},
  {name:"Farag, Francesco",loc:"Roma",stations:["UIT4"],total:37,w:{"2025-W47":0,"2025-W48":1,"2025-W49":1,"2025-W50":5,"2025-W51":8,"2025-W52":4,"2026-W1":5,"2026-W2":4,"2026-W3":3,"2026-W4":4,"2026-W5":0,"2026-W6":0,"2026-W7":0,"2026-W8":1,"2026-W28":1}},
  {name:"Miranda Mendez, Jhonny E.",loc:"Milano",stations:["UIT1"],total:30,w:{"2025-W47":0,"2025-W48":2,"2025-W49":2,"2025-W50":3,"2025-W51":0,"2025-W52":0,"2026-W1":2,"2026-W2":5,"2026-W3":3,"2026-W4":8,"2026-W5":4,"2026-W6":1,"2026-W7":0,"2026-W8":0}},
  {name:"Cimarosa, Mirko",loc:"Roma",stations:["UIT4"],total:27,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":7,"2025-W51":1,"2025-W52":0,"2026-W1":1,"2026-W2":1,"2026-W3":4,"2026-W4":5,"2026-W5":4,"2026-W6":1,"2026-W7":1,"2026-W8":1,"2026-W28":1}},
  {name:"Cipriani, Giorgia",loc:"Roma",stations:["UIT4"],total:27,w:{"2025-W47":0,"2025-W48":2,"2025-W49":2,"2025-W50":4,"2025-W51":5,"2025-W52":3,"2026-W1":4,"2026-W2":1,"2026-W3":0,"2026-W4":1,"2026-W5":0,"2026-W6":1,"2026-W7":1,"2026-W8":0,"2026-W36":2,"2026-W30":1}},
  {name:"ID:A1HBAD70KF4B",loc:"?",stations:["UIT1"],total:25,w:{"2025-W47":0,"2025-W48":1,"2025-W49":1,"2025-W50":11,"2025-W51":3,"2025-W52":1,"2026-W1":2,"2026-W2":3,"2026-W3":1,"2026-W4":1,"2026-W5":1,"2026-W6":0,"2026-W7":0,"2026-W8":0}},
  {name:"Mitri, Giovanni",loc:"Roma",stations:["UIT4"],total:17,w:{"2025-W47":0,"2025-W48":1,"2025-W49":1,"2025-W50":1,"2025-W51":2,"2025-W52":1,"2026-W1":0,"2026-W2":2,"2026-W3":1,"2026-W4":1,"2026-W5":6,"2026-W6":0,"2026-W7":0,"2026-W8":0,"2026-W36":1}},
  {name:"Pozzi, Manuel",loc:"Roma",stations:["UIT4"],total:16,w:{"2025-W47":0,"2025-W48":3,"2025-W49":0,"2025-W50":2,"2025-W51":3,"2025-W52":1,"2026-W1":2,"2026-W2":2,"2026-W3":2,"2026-W4":0,"2026-W5":0,"2026-W6":0,"2026-W7":0,"2026-W8":0,"2026-W37":1}},
  {name:"Salvadori, Giancarlo",loc:"Roma",stations:["UIT4"],total:15,w:{"2025-W47":0,"2025-W48":0,"2025-W49":1,"2025-W50":1,"2025-W51":0,"2025-W52":2,"2026-W1":0,"2026-W2":2,"2026-W3":3,"2026-W4":0,"2026-W5":1,"2026-W6":1,"2026-W7":0,"2026-W8":0,"2026-W29":3,"2026-W28":1}},
  {name:"Quinde, Luis Jaziel",loc:"Milano",stations:["UIT1"],total:15,w:{"2025-W47":1,"2025-W48":0,"2025-W49":1,"2025-W50":0,"2025-W51":2,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":3,"2026-W6":1,"2026-W7":2,"2026-W8":1,"2026-W37":1,"2026-W36":1,"2026-W35":2}},
  {name:"El Farmawy, Mohamed",loc:"Roma",stations:["UIT4"],total:12,w:{"2025-W47":0,"2025-W48":0,"2025-W49":2,"2025-W50":2,"2025-W51":2,"2025-W52":1,"2026-W1":1,"2026-W2":1,"2026-W3":1,"2026-W4":0,"2026-W5":1,"2026-W6":0,"2026-W7":1,"2026-W8":0}},
  {name:"Haruna, Habib",loc:"Milano",stations:["UBA1"],total:12,w:{"2025-W47":0,"2025-W48":2,"2025-W49":3,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":1,"2026-W4":1,"2026-W5":1,"2026-W6":1,"2026-W7":2,"2026-W8":1}},
  {name:"Barsoum, Adel",loc:"Roma",stations:["UIT4"],total:12,w:{"2025-W47":0,"2025-W48":2,"2025-W49":0,"2025-W50":2,"2025-W51":1,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":1,"2026-W5":2,"2026-W6":2,"2026-W7":1,"2026-W8":1}},
  {name:"Bedoya Loor, Jose Eduardo",loc:"Milano",stations:["UIT1"],total:12,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":1,"2026-W4":0,"2026-W5":0,"2026-W6":1,"2026-W7":3,"2026-W8":2,"2026-W37":4,"2026-W36":1}},
  {name:"ZYKA, GERTI",loc:"Roma",stations:["UIT4"],total:10,w:{"2025-W47":1,"2025-W48":2,"2025-W49":2,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":1,"2026-W3":0,"2026-W4":3,"2026-W5":1,"2026-W6":0,"2026-W7":0,"2026-W8":0}},
  {name:"Parisi, Luca",loc:"Roma",stations:["UIT4"],total:10,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":0,"2025-W51":2,"2025-W52":0,"2026-W1":0,"2026-W2":1,"2026-W3":0,"2026-W4":5,"2026-W5":2,"2026-W6":0,"2026-W7":0,"2026-W8":0}},
  {name:"Pezzi, Paolo",loc:"Roma",stations:["UIT4"],total:10,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":1,"2025-W51":1,"2025-W52":3,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":3,"2026-W6":0,"2026-W7":1,"2026-W8":0,"2026-W30":1}},
  {name:"Elhaidadi, Salah",loc:"Milano",stations:["UIT1"],total:10,w:{"2025-W47":0,"2025-W48":0,"2025-W49":1,"2025-W50":0,"2025-W51":1,"2025-W52":1,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":0,"2026-W6":3,"2026-W7":1,"2026-W8":2,"2026-W27":1}},
  {name:"Martins, Wesley",loc:"Milano",stations:["UIT1"],total:10,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":0,"2025-W51":1,"2025-W52":1,"2026-W1":1,"2026-W2":2,"2026-W3":0,"2026-W4":0,"2026-W5":0,"2026-W6":2,"2026-W7":0,"2026-W8":3}},
  {name:"Hamza, Uzman",loc:"Milano",stations:["UBA1"],total:10,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":1,"2026-W3":0,"2026-W4":0,"2026-W5":1,"2026-W6":1,"2026-W7":1,"2026-W8":4,"2026-W37":1,"2026-W27":1}},
  {name:"ID:A315HN3KMOW8",loc:"?",stations:["UIT4"],total:9,w:{"2025-W47":0,"2025-W48":0,"2025-W49":1,"2025-W50":0,"2025-W51":3,"2025-W52":0,"2026-W1":0,"2026-W2":2,"2026-W3":0,"2026-W4":0,"2026-W5":1,"2026-W6":2,"2026-W7":0,"2026-W8":0}},
  {name:"Parsolea, Daniela",loc:"Roma",stations:["UIT4"],total:9,w:{"2025-W47":0,"2025-W48":0,"2025-W49":1,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":2,"2026-W2":0,"2026-W3":1,"2026-W4":0,"2026-W5":2,"2026-W6":3,"2026-W7":0,"2026-W8":0}},
  {name:"Ravegnini, Alessandro",loc:"Roma",stations:["UIT4"],total:9,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":2,"2025-W51":2,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":3,"2026-W4":0,"2026-W5":0,"2026-W6":0,"2026-W7":1,"2026-W8":1}},
  {name:"Ornatelli, Massimiliano",loc:"Roma",stations:["UIT4"],total:9,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":1,"2025-W51":0,"2025-W52":1,"2026-W1":2,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":0,"2026-W6":1,"2026-W7":0,"2026-W8":1,"2026-W36":1,"2026-W28":2}},
  {name:"De Martino, Vincenzo",loc:"Milano",stations:["UBA1"],total:8,w:{"2025-W47":0,"2025-W48":1,"2025-W49":0,"2025-W50":0,"2025-W51":1,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":4,"2026-W4":1,"2026-W5":0,"2026-W6":0,"2026-W7":1,"2026-W8":0}},
  {name:"Dnibi, Walid",loc:"Milano",stations:["UIT1"],total:8,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":1,"2026-W3":0,"2026-W4":0,"2026-W5":0,"2026-W6":4,"2026-W7":3,"2026-W8":0}},
  {name:"Serpietri, Gabriele",loc:"Roma",stations:["UIT4"],total:8,w:{"2025-W47":0,"2025-W48":0,"2025-W49":1,"2025-W50":1,"2025-W51":0,"2025-W52":1,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":1,"2026-W5":0,"2026-W6":0,"2026-W7":0,"2026-W8":1,"2026-W29":2,"2026-W27":1}},
  {name:"Maddalon, Tiago",loc:"Milano",stations:["UIT1"],total:8,w:{"2026-W37":4,"2026-W36":2,"2026-W30":1,"2026-W29":1}},
  {name:"De Souza Henrique, Tiago J.",loc:"Milano",stations:["UIT1"],total:7,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":0,"2026-W6":0,"2026-W7":5,"2026-W8":2}},
  {name:"Cimatti, Claudio",loc:"Milano",stations:["UIT1"],total:7,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":1,"2026-W6":3,"2026-W7":1,"2026-W8":1,"2026-W30":1}},
  {name:"Cau, Tiziano",loc:"Roma",stations:["UIT4"],total:7,w:{"2026-W8":1,"2026-W35":2,"2026-W33":1,"2026-W29":2,"2026-W28":1}},
  {name:"Vasquez Flores, Derex",loc:"Roma",stations:["UIT4"],total:6,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":1,"2026-W5":0,"2026-W6":4,"2026-W7":1,"2026-W8":0}},
  {name:"Dinellari, Mikele",loc:"Roma",stations:["UIT4"],total:6,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":1,"2025-W51":4,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":0,"2026-W6":0,"2026-W7":0,"2026-W8":0,"2026-W34":1}},
  {name:"El Sayed, Sami",loc:"Milano",stations:["UIT1","UIL7"],total:6,w:{"2026-W8":2,"2026-W35":1,"2026-W31":2,"2026-W29":1}},
  {name:"ID:A29XO7CRN7MH",loc:"Milano",stations:["UIL7"],total:6,w:{"2026-W29":6}},
  {name:"Dal Pozzo, Marcio",loc:"Milano",stations:["UIT1"],total:5,w:{"2025-W47":0,"2025-W48":1,"2025-W49":0,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":1,"2026-W5":1,"2026-W6":1,"2026-W7":1,"2026-W8":0}},
  {name:"Raiser Bolzan, Leonardo",loc:"Milano",stations:["UIT1"],total:5,w:{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":0,"2026-W6":0,"2026-W7":5,"2026-W8":0}},
  {name:"Raiser Bolzan, Renato",loc:"Milano",stations:["UIL7","UIT1"],total:5,w:{"2025-W47":0,"2025-W48":0,"2025-W49":1,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":0,"2026-W6":4,"2026-W7":0,"2026-W8":0}},
  {name:"Zandonato, Luiz Carlos",loc:"Milano",stations:["UBA1","UIT1","UIT7"],total:4,w:{"2025-W47":0,"2025-W48":2,"2025-W49":0,"2025-W50":0,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":1,"2026-W3":0,"2026-W4":0,"2026-W5":0,"2026-W6":1,"2026-W7":0,"2026-W8":0}},
  {name:"Arben, Selimaj",loc:"Roma",stations:["UIT4"],total:4,w:{"2026-W37":1,"2026-W36":1,"2026-W35":1,"2026-W27":1}},
  {name:"Zyka, Gerti",loc:"Roma",stations:["UIT4"],total:4,w:{"2026-W35":1,"2026-W34":2,"2026-W29":1}},
  {name:"Piza, Crisley Camila",loc:"Milano",stations:["UIT1"],total:3,w:{"2026-W7":2,"2026-W8":1}},
  {name:"Fernandes Dias, Patrick",loc:"Milano",stations:["UIT1"],total:3,w:{"2026-W8":3}},
  {name:"Marcelo, Chirico",loc:"Roma",stations:["UIT4"],total:3,w:{"2026-W8":2,"2026-W37":1}},
  {name:"ID:A1NIE3GKC42IM",loc:"?",stations:["UBA1"],total:3,w:{"2026-W7":3,"2026-W8":0}},
  {name:"Dolofan, Florin",loc:"Milano",stations:["UBA1"],total:3,w:{"2026-W7":2,"2026-W8":0,"2026-W29":1}},
  {name:"ID:A22N4B9F17CJ",loc:"Roma",stations:["UIT4"],total:3,w:{"2026-W37":1,"2026-W31":1,"2026-W30":1}},
  {name:"ID:A37QIPNRMFHW6E",loc:"Roma",stations:["UIT4"],total:3,w:{"2026-W36":1,"2026-W30":2}},
  {name:"ID:A2N5WVPV21WE",loc:"Roma",stations:["UIT4"],total:3,w:{"2026-W36":3}},
  {name:"ID:A88NGBVO9JRUL",loc:"Milano",stations:["UIT1"],total:3,w:{"2026-W36":1,"2026-W35":1,"2026-W29":1}},
  {name:"Fikri, Soufiane",loc:"Milano",stations:["UIT1"],total:3,w:{"2026-W35":1,"2026-W30":1,"2026-W27":1}},
  {name:"ID:A2CRUQRFUPOH",loc:"Roma",stations:["UIT4"],total:3,w:{"2026-W35":3}},
  {name:"Belletti, Alex",loc:"Milano",stations:["UBA1"],total:2,w:{"2026-W8":2}},
  {name:"Kumarsamy Perumal, Manoj A.",loc:"Milano",stations:["UIT1"],total:2,w:{"2026-W8":1,"2026-W37":1}},
  {name:"ID:A16TPO0SUHU8",loc:"Milano",stations:["UIL7"],total:2,w:{"2026-W37":1,"2026-W29":1}},
  {name:"ID:A2KSRE64V0YV",loc:"Milano",stations:["UIT1"],total:2,w:{"2026-W37":2}},
  {name:"Levendi, Gentian",loc:"Roma",stations:["UIT4"],total:2,w:{"2026-W37":1,"2026-W30":1}},
  {name:"Nunez Flores, Cesar Augusto",loc:"Milano",stations:["UIT1"],total:2,w:{"2026-W36":1,"2026-W27":1}},
  {name:"Palma, Maicol",loc:"Roma",stations:["UIT4"],total:2,w:{"2026-W36":2}},
  {name:"ID:A2SH0J04PT99",loc:"Milano",stations:["UIL7"],total:2,w:{"2026-W34":1,"2026-W31":1}},
  {name:"ID:A14HNFYUNNWI",loc:"Roma",stations:["UIT4"],total:2,w:{"2026-W32":2}},
  {name:"ID:AW3STBJS8T4R",loc:"Milano",stations:["UIT1"],total:2,w:{"2026-W31":1,"2026-W27":1}},
  {name:"ID:A2KZIZCT0B70",loc:"Roma",stations:["UIT4"],total:2,w:{"2026-W29":1,"2026-W27":1}},
  {name:"ID:A2WWY1LKJC88",loc:"Bologna",stations:["UBA1"],total:2,w:{"2026-W29":1,"2026-W28":1}},
  {name:"Da Silva Santos, Andre",loc:"Milano",stations:["UIT1"],total:2,w:{"2026-W28":2}},
  {name:"Onofri, Mattia",loc:"Roma",stations:["UIT4"],total:1,w:{"2026-W8":1}},
  {name:"Da Cruz De Souza, Ismar",loc:"Milano",stations:["UIT1"],total:1,w:{"2026-W8":1}},
  {name:"Rodriguez Quijije, Stefano D.",loc:"Milano",stations:["UIT1"],total:1,w:{"2026-W8":1}},
  {name:"Proietti, Ivano",loc:"Roma",stations:["UIT4"],total:1,w:{"2026-W8":1}},
  {name:"ID:A3RAM736Z7WF4",loc:"?",stations:["UIT1"],total:1,w:{"2026-W8":1}},
  {name:"Moreira de Souza, Kaio E.",loc:"Milano",stations:["UIT1"],total:1,w:{"2026-W37":1}},
  {name:"Medici, Sergio",loc:"Roma",stations:["UIT4"],total:1,w:{"2026-W37":1}},
  {name:"Sanchez Garcia, Luiz A.",loc:"Milano",stations:["UIL7"],total:1,w:{"2026-W37":1}},
  {name:"ID:AGU7AJNNH2UX",loc:"Roma",stations:["UIT4"],total:1,w:{"2026-W36":1}},
  {name:"ID:A2JCNQ8Z92MZ",loc:"Milano",stations:["UIT1"],total:1,w:{"2026-W36":1}},
  {name:"ID:A2IV77PY8N1O",loc:"Roma",stations:["UIT4"],total:1,w:{"2026-W35":1}},
  {name:"Romdhani, Sami",loc:"Roma",stations:["UIT4"],total:1,w:{"2026-W35":1}},
  {name:"Turcanu, Yevhen",loc:"Roma",stations:["UIT4"],total:1,w:{"2026-W32":1}},
  {name:"ID:AIBL7UZKQBFK",loc:"Milano",stations:["UIL7"],total:1,w:{"2026-W31":1}},
  {name:"Ruggeri, Ruggero",loc:"Roma",stations:["UIT4"],total:1,w:{"2026-W31":1}},
  {name:"De Souza Henrique, Tiago Jose",loc:"Milano",stations:["UIT1"],total:1,w:{"2026-W31":1}},
  {name:"Nafia, Adil",loc:"Roma",stations:["UIT4"],total:1,w:{"2026-W31":1}},
  {name:"Giannitto, Michele",loc:"Milano",stations:["UIT1"],total:1,w:{"2026-W30":1}},
  {name:"Tawfiq, Nafia",loc:"Roma",stations:["UIT4"],total:1,w:{"2026-W29":1}},
  {name:"Iqbal, Ghazanfar",loc:"Milano",stations:["UIT1"],total:1,w:{"2026-W28":1}},
  {name:"ID:A25FQMJHC1SY",loc:"Roma",stations:["UIT4"],total:1,w:{"2026-W27":1}}
];
function NCCCell({val}) {
  if (!val) return <td style={{padding:"3px 6px",textAlign:"center",fontSize:10,fontFamily:"'DM Mono',monospace",color:"#1e293b"}}>·</td>;
  const bg = val >= 5 ? "#dc2626" : val >= 3 ? "#ea580c" : val >= 2 ? "#d97706" : "#ca8a04";
  const op = Math.min(0.15 + (val / 10) * 0.85, 1);
  return <td style={{padding:"3px 6px",textAlign:"center",fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace",color:"#fff",background:bg,opacity:op,borderRadius:2}}>{val}</td>;
}

// ─── LATE DELIVERY DATA (Order-Level, W47/25–W37/26) ──────────────────
const LATE_WEEKS = ["2025-W47","2025-W48","2025-W49","2025-W50","2025-W51","2025-W52","2026-W1","2026-W2","2026-W3","2026-W4","2026-W5","2026-W6","2026-W7","2026-W8","2026-W27","2026-W28","2026-W29","2026-W30","2026-W31","2026-W32","2026-W33","2026-W34","2026-W35","2026-W36","2026-W37"];
const LATE_STN_WEEKLY = {"UIT4":{"2025-W47":0,"2025-W48":49,"2025-W49":71,"2025-W50":409,"2025-W51":157,"2025-W52":125,"2026-W1":20,"2026-W2":214,"2026-W3":38,"2026-W4":107,"2026-W5":113,"2026-W6":27,"2026-W7":20,"2026-W8":14,"2026-W37":12,"2026-W36":11,"2026-W35":4,"2026-W32":3,"2026-W31":2,"2026-W30":1,"2026-W29":2,"2026-W27":7,"2026-W28":0,"2026-W33":0,"2026-W34":0},"UIT1":{"2025-W47":0,"2025-W48":40,"2025-W49":23,"2025-W50":18,"2025-W51":17,"2025-W52":11,"2026-W1":6,"2026-W2":66,"2026-W3":36,"2026-W4":16,"2026-W5":25,"2026-W6":30,"2026-W7":21,"2026-W8":8,"2026-W37":14,"2026-W36":22,"2026-W34":7,"2026-W32":2,"2026-W29":1,"2026-W28":3,"2026-W27":0,"2026-W30":0,"2026-W31":0,"2026-W33":0,"2026-W35":0},"UIT7":{"2025-W47":29,"2025-W48":0,"2025-W49":2,"2025-W50":15,"2025-W51":0,"2025-W52":0,"2026-W1":4,"2026-W2":7,"2026-W3":8,"2026-W4":9,"2026-W5":3,"2026-W6":0,"2026-W7":0,"2026-W8":0,"2026-W27":0,"2026-W28":0,"2026-W29":0,"2026-W30":0,"2026-W31":0,"2026-W32":0,"2026-W33":0,"2026-W34":0,"2026-W35":0,"2026-W36":0,"2026-W37":0},"UBA1":{"2025-W47":0,"2025-W48":2,"2025-W49":0,"2025-W50":0,"2025-W51":7,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":9,"2026-W6":0,"2026-W7":5,"2026-W8":0,"2026-W27":0,"2026-W28":0,"2026-W29":0,"2026-W30":0,"2026-W31":0,"2026-W32":0,"2026-W33":0,"2026-W34":0,"2026-W35":0,"2026-W36":0,"2026-W37":0},"UIL7":{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":0,"2025-W51":0,"2025-W52":2,"2026-W1":2,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":0,"2026-W6":1,"2026-W7":3,"2026-W8":0,"2026-W36":10,"2026-W33":3,"2026-W32":2,"2026-W31":5,"2026-W27":4,"2026-W28":0,"2026-W29":0,"2026-W30":0,"2026-W34":0,"2026-W35":0,"2026-W37":0}};
const LATE_GT15_STN = {"UIT4":{"2025-W47":0,"2025-W48":11,"2025-W49":16,"2025-W50":135,"2025-W51":48,"2025-W52":41,"2026-W1":7,"2026-W2":64,"2026-W3":10,"2026-W4":34,"2026-W5":28,"2026-W6":4,"2026-W7":5,"2026-W8":1,"2026-W37":1,"2026-W36":3,"2026-W35":1,"2026-W32":1,"2026-W29":1,"2026-W27":1,"2026-W28":0,"2026-W30":0,"2026-W31":0,"2026-W33":0,"2026-W34":0},"UIT1":{"2025-W47":0,"2025-W48":13,"2025-W49":5,"2025-W50":8,"2025-W51":3,"2025-W52":3,"2026-W1":1,"2026-W2":19,"2026-W3":11,"2026-W4":5,"2026-W5":8,"2026-W6":10,"2026-W7":5,"2026-W8":2,"2026-W37":4,"2026-W36":8,"2026-W34":1,"2026-W32":1,"2026-W27":0,"2026-W28":0,"2026-W29":0,"2026-W30":0,"2026-W31":0,"2026-W33":0,"2026-W35":0},"UIT7":{"2025-W47":11,"2025-W48":0,"2025-W49":0,"2025-W50":2,"2025-W51":0,"2025-W52":0,"2026-W1":0,"2026-W2":2,"2026-W3":2,"2026-W4":3,"2026-W5":1,"2026-W6":0,"2026-W7":0,"2026-W8":0,"2026-W27":0,"2026-W28":0,"2026-W29":0,"2026-W30":0,"2026-W31":0,"2026-W32":0,"2026-W33":0,"2026-W34":0,"2026-W35":0,"2026-W36":0,"2026-W37":0},"UBA1":{"2025-W47":0,"2025-W48":1,"2025-W49":0,"2025-W50":0,"2025-W51":3,"2025-W52":0,"2026-W1":0,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":3,"2026-W6":0,"2026-W7":2,"2026-W8":0,"2026-W27":0,"2026-W28":0,"2026-W29":0,"2026-W30":0,"2026-W31":0,"2026-W32":0,"2026-W33":0,"2026-W34":0,"2026-W35":0,"2026-W36":0,"2026-W37":0},"UIL7":{"2025-W47":0,"2025-W48":0,"2025-W49":0,"2025-W50":0,"2025-W51":0,"2025-W52":1,"2026-W1":1,"2026-W2":0,"2026-W3":0,"2026-W4":0,"2026-W5":0,"2026-W6":0,"2026-W7":1,"2026-W8":0,"2026-W36":4,"2026-W32":1,"2026-W31":2,"2026-W27":1,"2026-W28":0,"2026-W29":0,"2026-W30":0,"2026-W33":0,"2026-W34":0,"2026-W35":0,"2026-W37":0}};
const LATE_DRIVERS = [
  {tid:"AGECZO3FHG9JX",s:["UIT4"],l:36,g:25,t:61,w:{"2025-W50":12,"2025-W51":3,"2025-W52":13,"2026-W2":15,"2026-W3":2,"2026-W4":12,"2026-W5":3,"2026-W8":1}},
  {tid:"A2VN2H0236SIOC",s:["UIT4"],l:40,g:21,t:61,w:{"2025-W49":2,"2025-W50":15,"2026-W2":17,"2026-W4":1,"2026-W5":3,"2026-W7":1,"2026-W8":1,"2026-W37":1,"2026-W35":4,"2026-W29":2}},
  {tid:"AMDQHZ3LZK9PR",s:["UIT4"],l:37,g:21,t:58,w:{"2025-W49":9,"2025-W50":15,"2025-W51":6,"2025-W52":11,"2026-W2":11,"2026-W4":6}},
  {tid:"A4V93M3EYBI46",s:["UIT4"],l:42,g:15,t:57,w:{"2025-W49":3,"2025-W50":14,"2025-W51":4,"2026-W2":16,"2026-W4":3,"2026-W5":9,"2026-W6":1,"2026-W8":1,"2026-W37":2}},
  {tid:"A282LJ5XHQUCN6",s:["UIT4"],l:36,g:18,t:54,w:{"2025-W50":24,"2025-W51":13,"2025-W52":8,"2026-W4":6,"2026-W5":3}},
  {tid:"A1VVE91GJOIDMR",s:["UIT4"],l:34,g:18,t:52,w:{"2025-W48":10,"2025-W49":3,"2025-W50":17,"2025-W51":4,"2026-W2":12,"2026-W3":1,"2026-W4":3,"2026-W5":1,"2026-W6":1}},
  {tid:"APTV7Y5N77N0J",s:["UIT4"],l:33,g:16,t:49,w:{"2025-W51":7,"2025-W52":8,"2026-W2":1,"2026-W4":9,"2026-W5":15,"2026-W36":3}},
  {tid:"AVG0Z3EKUPTYE",s:["UIT4"],l:38,g:11,t:49,w:{"2025-W48":1,"2025-W49":2,"2025-W50":13,"2025-W51":5,"2026-W2":7,"2026-W5":2,"2026-W6":1,"2026-W36":2,"2026-W32":3,"2026-W27":1}},
  {tid:"AE5QJFCD0PTFU",s:["UIT4"],l:32,g:16,t:48,w:{"2025-W48":4,"2025-W49":9,"2025-W50":15,"2025-W52":5,"2026-W2":6,"2026-W37":1,"2026-W36":2}},
  {tid:"A3N5ILEKGGQQUR",s:["UIT4"],l:26,g:20,t:46,w:{"2025-W48":3,"2025-W50":17,"2025-W51":4,"2026-W2":11,"2026-W4":2,"2026-W5":5,"2026-W7":4}},
  {tid:"A2BRNMGQ1R89G7",s:["UIT4"],l:33,g:12,t:45,w:{"2025-W48":5,"2025-W50":20,"2025-W51":1,"2025-W52":8,"2026-W1":4,"2026-W2":6,"2026-W4":1}},
  {tid:"A3UD94Q70561NT",s:["UIT1","UIT7"],l:31,g:8,t:39,w:{"2025-W48":2,"2025-W50":5,"2025-W51":4,"2025-W52":1,"2026-W1":4,"2026-W2":7,"2026-W5":1,"2026-W6":8,"2026-W7":4,"2026-W37":1}},
  {tid:"A26QCN2R3RHUL0",s:["UIT4"],l:24,g:13,t:37,w:{"2025-W50":13,"2025-W51":7,"2025-W52":6,"2026-W2":4,"2026-W3":1,"2026-W36":2}},
  {tid:"AH60BA77IO1NM",s:["UIT4"],l:22,g:13,t:35,w:{"2025-W49":2,"2025-W50":11,"2025-W51":13,"2026-W5":3,"2026-W7":6}},
  {tid:"A3HASZK5EP9RI3",s:["UIT4"],l:25,g:10,t:35,w:{"2025-W50":2,"2025-W51":11,"2025-W52":11,"2026-W6":6,"2026-W7":1,"2026-W8":3}},
  {tid:"A12RS30DTIRY4F",s:["UIL7","UIT1","UIT7"],l:22,g:13,t:35,w:{"2025-W52":2,"2026-W2":11,"2026-W3":3,"2026-W4":1,"2026-W5":3,"2026-W7":6,"2026-W36":3}},
  {tid:"A1QVBCU0UM920I",s:["UIT4"],l:26,g:8,t:34,w:{"2025-W48":2,"2025-W50":6,"2025-W51":11,"2026-W2":3,"2026-W5":3,"2026-W31":1,"2026-W27":2}},
  {tid:"AW075GUQVI8S0",s:["UIT4"],l:23,g:9,t:32,w:{"2025-W48":2,"2025-W50":6,"2025-W51":1,"2025-W52":12,"2026-W2":7,"2026-W4":1,"2026-W5":1,"2026-W8":2}},
  {tid:"A88NGBVO9JRUL",s:["UIT1"],l:21,g:11,t:32,w:{"2025-W49":2,"2026-W3":6,"2026-W5":9,"2026-W37":1,"2026-W36":2,"2026-W34":2}},
  {tid:"AXF6DOVKJAJOP",s:["UIT1"],l:19,g:12,t:31,w:{"2025-W48":1,"2025-W49":2,"2025-W50":1,"2025-W51":1,"2026-W2":6,"2026-W6":8,"2026-W36":4}},
  {tid:"AHWNMVNKEB1FS",s:["UIT4"],l:20,g:8,t:28,w:{"2025-W50":8,"2025-W52":10,"2026-W1":1,"2026-W2":1,"2026-W5":8}},
  {tid:"AWF7GO53ALI75",s:["UIT4"],l:17,g:10,t:27,w:{"2025-W49":5,"2025-W50":11,"2026-W2":2,"2026-W4":8,"2026-W5":1}},
  {tid:"A1VBK3NCA1KUB6",s:["UIT4"],l:18,g:9,t:27,w:{"2025-W50":7,"2025-W51":12,"2026-W3":1,"2026-W5":4,"2026-W37":1}},
  {tid:"A1KAYXHWHSMPZA",s:["UIT4"],l:20,g:6,t:26,w:{"2025-W48":1,"2025-W49":1,"2025-W50":3,"2025-W51":1,"2025-W52":2,"2026-W2":15,"2026-W5":1,"2026-W6":2}},
  {tid:"AU6QWQ72H340O",s:["UIT4"],l:17,g:9,t:26,w:{"2025-W50":9,"2026-W1":11,"2026-W2":3,"2026-W4":2,"2026-W8":1}},
  {tid:"A97DJBAAIAEXE",s:["UIT4"],l:19,g:7,t:26,w:{"2025-W48":1,"2025-W50":15,"2026-W4":1,"2026-W5":6,"2026-W37":1}},
  {tid:"A2ETP4LPBDPCI7",s:["UIT4"],l:16,g:8,t:24,w:{"2025-W49":6,"2025-W50":5,"2026-W1":1,"2026-W2":11,"2026-W5":1}},
  {tid:"AAXP32AWYXD0S",s:["UIT1","UIT7"],l:17,g:7,t:24,w:{"2025-W47":6,"2025-W48":5,"2025-W49":3,"2025-W52":4,"2026-W3":6}},
  {tid:"ACWZU4JMSMOOL",s:["UIT4"],l:17,g:7,t:24,w:{"2025-W50":9,"2025-W51":1,"2026-W3":7,"2026-W4":2,"2026-W5":3,"2026-W6":1,"2026-W8":1}},
  {tid:"A35KO91NJ8ZSL8",s:["UIT4"],l:15,g:8,t:23,w:{"2025-W50":8,"2025-W51":14,"2026-W5":1}},
  {tid:"A3E7636W999QQA",s:["UIT1","UIT7"],l:15,g:8,t:23,w:{"2025-W47":6,"2025-W48":1,"2026-W1":1,"2026-W2":6,"2026-W4":9}},
  {tid:"A35T9P10PKPSF7",s:["UIT1"],l:13,g:9,t:22,w:{"2025-W49":1,"2025-W50":6,"2025-W51":2,"2026-W2":1,"2026-W3":2,"2026-W4":5,"2026-W6":5}},
  {tid:"A16TPO0SUHU8I2",s:["UIL7"],l:12,g:9,t:21,w:{"2026-W36":7}},
  {tid:"A34LGXU73LL9BM",s:["UIT4"],l:16,g:4,t:20,w:{"2025-W50":9,"2026-W2":2,"2026-W3":2,"2026-W4":2,"2026-W6":4,"2026-W8":1}},
  {tid:"A35T5XCFYQTKPZ",s:["UIT4"],l:14,g:5,t:19,w:{"2025-W49":3,"2026-W2":3,"2026-W3":8,"2026-W5":5}},
  {tid:"A37QIPNRMFHW6E",s:["UIT4"],l:12,g:7,t:19,w:{"2025-W48":3,"2025-W49":6,"2025-W50":5,"2026-W5":5}},
  {tid:"A7LUMWFCCJKDL",s:["UIT4"],l:15,g:4,t:19,w:{"2025-W48":1,"2025-W50":1,"2025-W51":1,"2025-W52":1,"2026-W4":12,"2026-W5":3}},
  {tid:"ATW6H2SY8PT9I",s:["UIT4"],l:16,g:3,t:19,w:{"2025-W49":1,"2025-W50":7,"2025-W51":7,"2026-W2":2,"2026-W7":1,"2026-W8":1}},
  {tid:"A3RMHPGM74KVUJ",s:["UIT1"],l:10,g:9,t:19,w:{"2026-W7":1,"2026-W36":6}},
  {tid:"A1E4N9160LZCJA",s:["UIT1"],l:12,g:6,t:18,w:{"2026-W8":3,"2026-W37":5}},
  {tid:"A2SH0J04PT9934",s:["UIL7"],l:9,g:9,t:18,w:{"2026-W32":2,"2026-W31":4}},
  {tid:"A36OXLLD8DZUBB",s:["UIT4"],l:14,g:3,t:17,w:{"2025-W48":1,"2025-W49":1,"2025-W50":2,"2025-W51":3,"2025-W52":3,"2026-W2":4,"2026-W5":3}},
  {tid:"A26NKN80OE6DV1",s:["UIT1","UIL7"],l:13,g:3,t:16,w:{"2026-W7":4,"2026-W31":1,"2026-W27":3}},
  {tid:"A2MGPR3KLEMC1A",s:["UIT1"],l:9,g:3,t:12,w:{"2026-W37":3,"2026-W36":1}},
  {tid:"AMTECUI0XY11T",s:["UIT1"],l:12,g:0,t:12,w:{"2026-W29":1,"2026-W28":3}},
  {tid:"A8E1OB66TNUSO",s:["UIT4"],l:7,g:3,t:10,w:{"2026-W8":1,"2026-W37":3}},
  {tid:"A2G2BQMDZK22FB",s:["UIT1"],l:5,g:4,t:9,w:{"2026-W7":3,"2026-W36":2}},
  {tid:"A2W61QFD0UM92J",s:["UIT1","UIL7"],l:9,g:0,t:9,w:{"2026-W7":3,"2026-W34":2}},
  {tid:"A24QXY3T6QD6HI",s:["UIT4"],l:6,g:3,t:9,w:{"2026-W27":3}},
  {tid:"A3116G3MEA2IX5",s:["UIT1","UIL7"],l:7,g:0,t:7,w:{"2026-W8":1,"2026-W33":1,"2026-W27":1}},
  {tid:"ANWEDYH2UUXUI",s:["UIT1"],l:3,g:3,t:6,w:{"2026-W37":2}},
  {tid:"AP5YJG0BUXJ9O",s:["UIT1"],l:6,g:0,t:6,w:{"2026-W37":1,"2026-W36":1}},
  {tid:"A315HN3KMOW80N",s:["UIT4"],l:6,g:0,t:6,w:{"2026-W37":2}},
  {tid:"A3RAM736Z7WF43",s:["UIT1"],l:3,g:3,t:6,w:{"2026-W36":2}},
  {tid:"A887OQHXEMN1O",s:["UIT1"],l:6,g:0,t:6,w:{"2026-W36":2}},
  {tid:"AW3STBJS8T4RJ",s:["UIT1"],l:6,g:0,t:6,w:{"2026-W34":2}},
  {tid:"A1X46PBP3JSLH0",s:["UIT1"],l:3,g:3,t:6,w:{"2026-W32":2}},
  {tid:"A5RCJALTYW9J7",s:["UBA1"],l:3,g:2,t:5,w:{"2026-W7":5}},
  {tid:"AAHWPKIHARD9Y",s:["UIT1"],l:4,g:1,t:5,w:{"2026-W8":2,"2026-W36":1}},
  {tid:"AG6T008EE2QH6",s:["UIT4"],l:4,g:0,t:4,w:{"2026-W7":1,"2026-W36":1}},
  {tid:"A37QNZXGYFKA07",s:["UIT4"],l:3,g:0,t:3,w:{"2026-W37":1}},
  {tid:"A1YBTZWSCR0T6A",s:["UIT1"],l:3,g:0,t:3,w:{"2026-W37":1}},
  {tid:"AIBL7UZKQBFKX",s:["UIT1"],l:3,g:0,t:3,w:{"2026-W36":1}},
  {tid:"A3HJVV8X9PFVFE",s:["UIT4"],l:3,g:0,t:3,w:{"2026-W36":1}},
  {tid:"A3S118S8BD258G",s:["UIT1"],l:3,g:0,t:3,w:{"2026-W34":1}},
  {tid:"A29XO7CRN7MHCW",s:["UIL7"],l:3,g:0,t:3,w:{"2026-W33":1}},
  {tid:"A2WU7G4QB2KEM6",s:["UIL7"],l:3,g:0,t:3,w:{"2026-W33":1}},
  {tid:"A2KZIZCT0B70EK",s:["UIT4"],l:3,g:0,t:3,w:{"2026-W31":1}},
  {tid:"A3V0WHAK317PM9",s:["UIT4"],l:3,g:0,t:3,w:{"2026-W30":1}},
  {tid:"A14HNFYUNNWIOM",s:["UIT4"],l:3,g:0,t:3,w:{"2026-W27":1}},
  {tid:"A2KI4J54TJVRD1",s:["UIT1"],l:1,g:1,t:2,w:{"2026-W8":2}},
  {tid:"AWPKQW2HKLE5I",s:["UIL7"],l:1,g:1,t:2,w:{"2026-W7":2}},
  {tid:"A36ATUOKYN2N4A",s:["UIT4"],l:1,g:0,t:1,w:{"2026-W8":1}},
  {tid:"AJBGQ35XQAHQ2",s:["UIT1"],l:1,g:0,t:1,w:{"2026-W7":1}},
  {tid:"ADR55ODP5WOJ7",s:["UIT4"],l:1,g:0,t:1,w:{"2026-W7":1}},
  {tid:"A20GNNM65U5LV1",s:["UIT4"],l:1,g:0,t:1,w:{"2026-W7":1}},
  {tid:"A3OSZ1G9ERRUK6",s:["UIT4"],l:1,g:0,t:1,w:{"2026-W7":1}}
];
function LateCell({val,isGt15}) {
  if (!val) return <td style={{padding:"3px 5px",textAlign:"center",fontSize:10,fontFamily:"'DM Mono',monospace",color:"#1e293b"}}>·</td>;
  const bg = isGt15 ? (val>=8?"#dc2626":val>=4?"#ea580c":"#d97706") : (val>=10?"#dc2626":val>=5?"#ea580c":val>=3?"#d97706":"#ca8a04");
  const op = Math.min(0.2+(val/(isGt15?15:20))*0.8, 1);
  return <td style={{padding:"3px 5px",textAlign:"center",fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace",color:"#fff",background:bg,opacity:op,borderRadius:2}}>{val}</td>;
}
// TID->Name lookup (from staff roster cross-reference)
const TID_NAME = {
  "A12RS30DTIRY4F":"Raiser Bolzan, Renato","A1HBAD70KF4BJS":"ID:A1HBAD70KF4B","A1IXQUV0C1M8OW":"Cimarosa, Mirko",
  "A1KAYXHWHSMPZA":"Otmani, Idris","A1QVBCU0UM920I":"Levendi, Gentian","A1VBK3NCA1KUB6":"Zyka, Gerti",
  "A1VVE91GJOIDMR":"Nuredini, Artur","A1X46PBP3JSLH0":"Bedoya Loor, Jose Eduardo","A1YBTZWSCR0T6A":"Cimatti, Claudio",
  "A23U41T334C07B":"Miranda Mendez, Jhonny E.","A26QCN2R3RHUL0":"Serpietri, Gabriele","A282LJ5XHQUCN6":"Barsoum, Adel",
  "A2BRNMGQ1R89G7":"Vasquez Flores, Derex","A2ETP4LPBDPCI7":"Maftei, Florin","A2G2BQMDZK22FB":"Dnibi, Walid",
  "A2RY6GYLSHUGWL":"Martins, Wesley","A2VN2H0236SIOC":"Cau, Tiziano","A2WN8CP6YGA3ZP":"Salvadori, Giancarlo",
  "A30OVVX99QXV9V":"De Martino, Vincenzo","A3116G3MEA2IX5":"Zandonato, Luiz Carlos","A315HN3KMOW80N":"ID:A315HN3KMOW8",
  "A31O1VTQ5ESZYI":"Wilson Frometa, Ernesto","A31OWXX727M9MX":"Dal Pozzo, Marcio","A34LGXU73LL9BM":"Pezzi, Paolo",
  "A35KO91NJ8ZSL8":"Haroun, Elias","A35T5XCFYQTKPZ":"Reinke, Nicolau","A35T9P10PKPSF7":"De Souza Nunes, Thassio",
  "A36OXLLD8DZUBB":"El Farmawy, Mohamed","A37QIPNRMFHW6E":"ID:A37QIPNRMFHW6E","A383SP0Z8SFZI7":"De Souza Henrique, Tiago Jose",
  "A3D09BNUW5T9CR":"Hamza, Uzman","A3E7636W999QQA":"Iqbal, Ghazanfar","A3HASZK5EP9RI3":"Pereira Vitoria, Danilo",
  "A3K0K8C2ORQY98":"Haruna, Habib","A3L09I7LOYMGGE":"Ravegnini, Alessandro","A3N5ILEKGGQQUR":"Romdhani, Sami",
  "A3UD94Q70561NT":"ID:A3UD94Q70561NT","A4V93M3EYBI46":"Subhani, Shafqat","A51IQJF8MWPLT":"Parsolea, Daniela",
  "A7LUMWFCCJKDL":"Parisi, Luca","A88NGBVO9JRUL":"ID:A88NGBVO9JRUL","A8E1OB66TNUSO":"Mitri, Giovanni",
  "A97DJBAAIAEXE":"Elezi, Julian","AAXP32AWYXD0S":"Sanchez Garcia, Luiz A.","ACWZU4JMSMOOL":"Arben, Selimaj",
  "ADR55ODP5WOJ7":"Pozzi, Manuel","AE5QJFCD0PTFU":"Palma, Maicol","AENG310AAIC9N":"Dinellari, Mikele",
  "AF06IBA6Q5CUT":"Ornatelli, Massimiliano","AGECZO3FHG9JX":"Ruggeri, Ruggero","AH60BA77IO1NM":"Turcanu, Yevhen",
  "AHLZ4D2QV0N33":"Farag, Francesco","AHWNMVNKEB1FS":"Nafia, Adil","AJBGQ35XQAHQ2":"Quinde, Luis Jaziel",
  "AMDQHZ3LZK9PR":"Medici, Sergio","AMTECUI0XY11T":"Elhaidadi, Salah","APAZ4218J54SY":"Cipriani, Giorgia",
  "APTV7Y5N77N0J":"Strada Junior, Eduardo","ATW6H2SY8PT9I":"Della Serra, Davide","AU6QWQ72H340O":"De Oliveira, Mozar",
  "AVG0Z3EKUPTYE":"Marcelo, Chirico","AW075GUQVI8S0":"Lagrotta, Pietro","AWF7GO53ALI75":"Ciurar, Jan",
  "AXF6DOVKJAJOP":"Giannitto, Michele",
  "A26NKN80OE6DV1":"Raiser Bolzan, Leonardo",
  "A127IE8J8294B0":"Lourenço Da Silva Santos, Pedro H.","A1E4N9160LZCJA":"Fikri, Soufiane",
  "A1N3RQEFTHMW7X":"Onofri, Mattia","A1NIE3GKC42IME":"ID:A1NIE3GKC42IM","A1R2P4OYDQRVHO":"El Sayed, Sami",
  "A20GNNM65U5LV1":"Tawfiq, Nafia","A2AOL7HEQEK9FT":"Zerrad, El Mahdi","A2DBSDQ4VKYICF":"Proietti, Ivano",
  "A2KI4J54TJVRD1":"Piza, Crisley Camila","A2KS581UOJ6CD":"Da Cruz De Souza, Ismar",
  "A2W61QFD0UM92J":"Kumarsamy Perumal, Manoj A.","A36ATUOKYN2N4A":"Brahmi, Achraf",
  "A3CAYUHBIPYIK7":"Fernandes Dias, Patrick","A3CNXES3ZAANCQ":"Moreira de Souza, Kaio E.",
  "A3K2BGR7A110UB":"Belletti, Alex","A3OSZ1G9ERRUK6":"Torres, Miguel Angel",
  "A3RAM736Z7WF43":"ID:A3RAM736Z7WF4","A3RMHPGM74KVUJ":"Maddalon, Tiago",
  "A3S118S8BD258G":"Da Silva Santos, Andre","A5RCJALTYW9J7":"Dolofan, Florin",
  "AAHWPKIHARD9Y":"Kouam, Pascal","AG6T008EE2QH6":"Moustafa, Mohamed",
  "AHD1SZOR5VLMU":"Nunez Flores, Cesar Augusto","AWPKQW2HKLE5I":"Rodriguez Quijije, Stefano D.",
};
function resolveName(tid){return TID_NAME[tid]||tid;}
// NCC TID map (NCC driver name -> TID from order data cross-ref)
const NCC_TID_MAP = {
  "De Souza Nunes, Thassio":"A35T9P10PKPSF7","Farag, Francesco":"AHLZ4D2QV0N33","Lagrotta, Pietro":"AW075GUQVI8S0",
  "Miranda Mendez, Jhonny E.":"A23U41T334C07B","Cimarosa, Mirko":"A1IXQUV0C1M8OW","Cipriani, Giorgia":"APAZ4218J54SY",
  "Mitri, Giovanni":"A8E1OB66TNUSO","Pozzi, Manuel":"ADR55ODP5WOJ7","El Farmawy, Mohamed":"A36OXLLD8DZUBB",
  "Haruna, Habib":"A3K0K8C2ORQY98","Barsoum, Adel":"A282LJ5XHQUCN6","Salvadori, Giancarlo":"A2WN8CP6YGA3ZP",
  "Quinde, Luis Jaziel":"AJBGQ35XQAHQ2","ZYKA, GERTI":"A1VBK3NCA1KUB6","Parisi, Luca":"A7LUMWFCCJKDL",
  "Pezzi, Paolo":"A34LGXU73LL9BM","Parsolea, Daniela":"A51IQJF8MWPLT","Ravegnini, Alessandro":"A3L09I7LOYMGGE",
  "De Martino, Vincenzo":"A30OVVX99QXV9V","Dnibi, Walid":"A2G2BQMDZK22FB","Elhaidadi, Salah":"AMTECUI0XY11T",
  "Martins, Wesley":"A2RY6GYLSHUGWL","Vasquez Flores, Derex":"A2BRNMGQ1R89G7","Dal Pozzo, Marcio":"A31OWXX727M9MX",
  "De Souza Henrique, Tiago J.":"A383SP0Z8SFZI7","Raiser Bolzan, Leonardo":"A26NKN80OE6DV1",
  "Bedoya Loor, Jose Eduardo":"A1X46PBP3JSLH0","Cimatti, Claudio":"A1YBTZWSCR0T6A",
  "Raiser Bolzan, Renato":"A12RS30DTIRY4F","Ornatelli, Massimiliano":"AF06IBA6Q5CUT",
  "Dinellari, Mikele":"AENG310AAIC9N","Hamza, Uzman":"A3D09BNUW5T9CR","Zandonato, Luiz Carlos":"A3116G3MEA2IX5",
  "Serpietri, Gabriele":"A26QCN2R3RHUL0","Wilson Frometa, Ernesto":"A31O1VTQ5ESZYI","ID:A31O1VTQ5ESZ":"A31O1VTQ5ESZYI","ID:A1HBAD70KF4B":"A1HBAD70KF4BJS",
  "ID:A315HN3KMOW8":"A315HN3KMOW80N",
  "Piza, Crisley Camila":"A2KI4J54TJVRD1","Fernandes Dias, Patrick":"A3CAYUHBIPYIK7",
  "El Sayed, Sami":"A1R2P4OYDQRVHO","Marcelo, Chirico":"AVG0Z3EKUPTYE",
  "Belletti, Alex":"A3K2BGR7A110UB","Kumarsamy Perumal, Manoj A.":"A2W61QFD0UM92J",
  "Onofri, Mattia":"A1N3RQEFTHMW7X","Cau, Tiziano":"A2VN2H0236SIOC",
  "Da Cruz De Souza, Ismar":"A2KS581UOJ6CD","Rodriguez Quijije, Stefano D.":"AWPKQW2HKLE5I",
  "Proietti, Ivano":"A2DBSDQ4VKYICF","ID:A3RAM736Z7WF4":"A3RAM736Z7WF43",
  "ID:A1NIE3GKC42IM":"A1NIE3GKC42IME","Dolofan, Florin":"A5RCJALTYW9J7",
  "ID:A16TPO0SUHU8":"A16TPO0SUHU8I2","Moreira de Souza, Kaio E.":"A3CNXES3ZAANCQ","Maddalon, Tiago":"A3RMHPGM74KVUJ","Arben, Selimaj":"ACWZU4JMSMOOL","ID:A2KSRE64V0YV":"A2KSRE64V0YVMI","Levendi, Gentian":"A1QVBCU0UM920I","ID:A22N4B9F17CJ":"A22N4B9F17CJ0Q","Medici, Sergio":"AMDQHZ3LZK9PR","Sanchez Garcia, Luiz A.":"AAXP32AWYXD0S","ID:AGU7AJNNH2UX":"AGU7AJNNH2UX8","ID:A2JCNQ8Z92MZ":"A2JCNQ8Z92MZNC","Nunez Flores, Cesar Augusto":"AHD1SZOR5VLMU","ID:A37QIPNRMFHW6E":"A37QIPNRMFHW6E","Palma, Maicol":"AE5QJFCD0PTFU","ID:A2N5WVPV21WE":"A2N5WVPV21WEDW","ID:A88NGBVO9JRUL":"A88NGBVO9JRUL","Fikri, Soufiane":"A1E4N9160LZCJA","ID:A2CRUQRFUPOH":"A2CRUQRFUPOHN1","Zyka, Gerti":"A1VBK3NCA1KUB6","ID:A2IV77PY8N1O":"A2IV77PY8N1OKQ","Romdhani, Sami":"A3N5ILEKGGQQUR","ID:A2SH0J04PT99":"A2SH0J04PT9934","Turcanu, Yevhen":"AH60BA77IO1NM","ID:A14HNFYUNNWI":"A14HNFYUNNWIOM","ID:AIBL7UZKQBFK":"AIBL7UZKQBFKX","ID:AW3STBJS8T4R":"AW3STBJS8T4RJ","Ruggeri, Ruggero":"AGECZO3FHG9JX","De Souza Henrique, Tiago Jose":"A383SP0Z8SFZI7","Nafia, Adil":"AHWNMVNKEB1FS","Giannitto, Michele":"AXF6DOVKJAJOP","ID:A29XO7CRN7MH":"A29XO7CRN7MHCW","ID:A2KZIZCT0B70":"A2KZIZCT0B70EK","ID:A2WWY1LKJC88":"A2WWY1LKJC88P8","Tawfiq, Nafia":"A20GNNM65U5LV1","Da Silva Santos, Andre":"A3S118S8BD258G","Iqbal, Ghazanfar":"A3E7636W999QQA","ID:A25FQMJHC1SY":"A25FQMJHC1SYC5",
};


// ─── GEO / Q-ORD DATA (2026 cumulative) ─────────────────────────────
const GEO_DATA = {
  year: "2026",
  grandTotal: 2937,
  defectTypes: ["late","late_gt15","ftfdf","ftpdf","pdnr","fdnr","ftdc"],
  defectTotals: {
    late:     { label:"late",     count:1455 },
    late_gt15:{ label:"late_gt15",count:613  },
    ftfdf:    { label:"ftfdf",    count:430  },
    ftpdf:    { label:"ftpdf",    count:258  },
    pdnr:     { label:"pdnr",     count:125  },
    fdnr:     { label:"fdnr",     count:28   },
    ftdc:     { label:"ftdc",     count:28   },
  },
  sites: [
    { key:"UIT4", label:"Roma",    cx:115, cy:252, defects:{late:850,late_gt15:380,ftfdf:240,ftpdf:140,pdnr:72,fdnr:14,ftdc:16}, total:1712 },
    { key:"UIT1", label:"Milano",  cx:72,  cy:52,  defects:{late:360,late_gt15:140,ftfdf:110,ftpdf:72,pdnr:36,fdnr:10,ftdc:8},  total:736  },
    { key:"UBA1", label:"Bologna", cx:112, cy:115, defects:{late:185,late_gt15:72,ftfdf:60,ftpdf:32,pdnr:14,fdnr:3,ftdc:3},    total:369  },
    { key:"UIL7", label:"Latina",  cx:120, cy:278, defects:{late:60,late_gt15:21,ftfdf:20,ftpdf:14,pdnr:3,fdnr:1,ftdc:1},     total:120  },
  ],
  attributions: [
    { defect:"late",      attribution:"Pickup Delay",                            count:1204 },
    { defect:"late_gt15", attribution:"Pickup Delay",                            count:531  },
    { defect:"ftpdf",     attribution:"Non CSPU FTPDF PP - Object Missing Other",count:162  },
    { defect:"ftfdf",     attribution:"Customer called CS",                      count:86   },
    { defect:"ftfdf",     attribution:"Road closures",                           count:80   },
    { defect:"pdnr",      attribution:"Unclear",                                 count:77   },
    { defect:"ftfdf",     attribution:"Not call compliant",                       count:69   },
    { defect:"late",      attribution:"OTR - Route Non Compliant",               count:65   },
    { defect:"late",      attribution:"Late Batch Ops Controllable",             count:60   },
    { defect:"ftfdf",     attribution:"Access issue/no safe location",           count:52   },
    { defect:"late",      attribution:"Assignment Delay - Others",               count:51   },
    { defect:"ftfdf",     attribution:"** Root cause attribution in progress",   count:43   },
    { defect:"late_gt15", attribution:"Assignment Delay - Others",               count:40   },
    { defect:"pdnr",      attribution:"Customer unavailable",                    count:28   },
    { defect:"ftpdf",     attribution:"Pickup Delay",                            count:25   },
    { defect:"late_gt15", attribution:"OTR - Route Non Compliant",               count:21   },
    { defect:"fdnr",      attribution:"Customer unavailable",                    count:16   },
    { defect:"ftdc",      attribution:"DSP controllable",                        count:18   },
    { defect:"late",      attribution:"Access issue/no safe location",           count:15   },
  ],
  drivers: [
    { name:"Medici, Sergio",          fdnr:2,  ftdc:2,  ftfdf:4,  ftpdf:60, late:40,  late_gt15:2,  pdnr:0,  total:110 },
    { name:"Ruggeri, Ruggero",        fdnr:0,  ftdc:1,  ftfdf:9,  ftpdf:3,  late:60,  late_gt15:32, pdnr:4,  total:109 },
    { name:"(Blank / Unknown)",       fdnr:0,  ftdc:0,  ftfdf:17, ftpdf:8,  late:49,  late_gt15:22, pdnr:4,  total:100 },
    { name:"Marcelo, Chirico",        fdnr:0,  ftdc:2,  ftfdf:10, ftpdf:6,  late:48,  late_gt15:27, pdnr:1,  total:94  },
    { name:"Subhani, Shafqat",        fdnr:0,  ftdc:1,  ftfdf:10, ftpdf:7,  late:50,  late_gt15:24, pdnr:2,  total:94  },
    { name:"Parisi, Luca",            fdnr:0,  ftdc:2,  ftfdf:8,  ftpdf:5,  late:42,  late_gt15:18, pdnr:1,  total:76  },
    { name:"Arben, Selimaj",          fdnr:0,  ftdc:1,  ftfdf:9,  ftpdf:4,  late:38,  late_gt15:15, pdnr:2,  total:69  },
    { name:"Ornatelli, Massimiliano", fdnr:1,  ftdc:1,  ftfdf:7,  ftpdf:4,  late:36,  late_gt15:14, pdnr:0,  total:63  },
    { name:"Palma, Maicol",           fdnr:0,  ftdc:0,  ftfdf:6,  ftpdf:4,  late:32,  late_gt15:12, pdnr:1,  total:55  },
    { name:"Cau, Daniele",            fdnr:0,  ftdc:1,  ftfdf:5,  ftpdf:3,  late:28,  late_gt15:10, pdnr:1,  total:48  },
    { name:"Zandonato, Luiz Carlos",  fdnr:0,  ftdc:1,  ftfdf:6,  ftpdf:5,  late:22,  late_gt15:8,  pdnr:2,  total:44  },
    { name:"Dnibi, Walid",            fdnr:0,  ftdc:1,  ftfdf:5,  ftpdf:4,  late:20,  late_gt15:9,  pdnr:1,  total:40  },
    { name:"TOTALS",                  fdnr:28, ftdc:28, ftfdf:430,ftpdf:258,late:1455,late_gt15:613, pdnr:125,total:2937,isTotal:true },
  ],
};

// ─── PRODUCTIVITY — stops per route (Orders ÷ Routes) por estación y semana ─
// Fuente: QuickSight Lighthouse › Business Metrics (Show By = Station Code, semanal).
// Lo rellena scripts/lighthouse_to_dashboard.py — no editar a mano.
const PRODUCTIVITY = {
  UIT4: [
    {year:2026,week:"W27",orders:3228,routes:710},
    {year:2026,week:"W28",orders:3241,routes:703},
    {year:2026,week:"W29",orders:3027,routes:671},
    {year:2026,week:"W30",orders:2972,routes:649},
    {year:2026,week:"W31",orders:2813,routes:635},
    {year:2026,week:"W32",orders:2211,routes:487},
    {year:2026,week:"W33",orders:1856,routes:397},
    {year:2026,week:"W34",orders:2390,routes:543},
    {year:2026,week:"W35",orders:2964,routes:706},
    {year:2026,week:"W36",orders:3949,routes:883},
    {year:2026,week:"W37",orders:2488,routes:580},
  ],
  UIT1: [
    {year:2026,week:"W27",orders:1832,routes:368},
    {year:2026,week:"W28",orders:1614,routes:329},
    {year:2026,week:"W29",orders:1493,routes:307},
    {year:2026,week:"W30",orders:1347,routes:275},
    {year:2026,week:"W31",orders:1273,routes:272},
    {year:2026,week:"W32",orders:1006,routes:213},
    {year:2026,week:"W33",orders:683,routes:172},
    {year:2026,week:"W34",orders:929,routes:223},
    {year:2026,week:"W35",orders:1360,routes:299},
    {year:2026,week:"W36",orders:2215,routes:456},
    {year:2026,week:"W37",orders:1401,routes:303},
  ],
  UIT7: [
  ],
  UBA1: [
    {year:2026,week:"W27",orders:539,routes:111},
    {year:2026,week:"W28",orders:511,routes:111},
    {year:2026,week:"W29",orders:437,routes:82},
    {year:2026,week:"W30",orders:406,routes:85},
    {year:2026,week:"W31",orders:433,routes:87},
    {year:2026,week:"W32",orders:340,routes:70},
    {year:2026,week:"W33",orders:175,routes:34},
    {year:2026,week:"W34",orders:164,routes:31},
    {year:2026,week:"W35",orders:282,routes:52},
    {year:2026,week:"W36",orders:445,routes:94},
    {year:2026,week:"W37",orders:301,routes:72},
  ],
  UIL7: [
    {year:2026,week:"W27",orders:564,routes:67},
    {year:2026,week:"W28",orders:504,routes:65},
    {year:2026,week:"W29",orders:499,routes:62},
    {year:2026,week:"W30",orders:474,routes:63},
    {year:2026,week:"W31",orders:523,routes:67},
    {year:2026,week:"W32",orders:435,routes:55},
    {year:2026,week:"W33",orders:386,routes:46},
    {year:2026,week:"W34",orders:391,routes:48},
    {year:2026,week:"W35",orders:506,routes:66},
    {year:2026,week:"W36",orders:578,routes:74},
    {year:2026,week:"W37",orders:378,routes:43},
  ],
};
// Objetivo stops/route por estación (P75 de las semanas cargadas al crearse; editable a mano)
const SPR_TARGET = {UIT4:4.6,UIT1:4.9,UBA1:5.2,UIL7:8.3};

// ─── PRODUCTIVITY: tooltip y etiquetas (valores sin «%») ────────────
function SprTooltip({active,payload,label}) {
  if (!active||!payload?.length) return null;
  return (<div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:6,padding:"8px 12px",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
    <p style={{color:"#64748b",fontSize:10,margin:"0 0 4px",fontFamily:"'DM Mono',monospace"}}>{label}</p>
    {payload.filter(p=>p.value!=null).map((p,i)=>{const row=p.payload||{};const o=row[p.name+"_o"],r=row[p.name+"_r"];return(<p key={i} style={{color:p.stroke||p.color,fontSize:11,margin:"2px 0",fontFamily:"'DM Mono',monospace"}}>{p.name}: <strong>{Number(p.value).toFixed(2)}</strong>{o!=null&&<span style={{color:"#64748b"}}> · {o.toLocaleString()} / {r}</span>}</p>);})}
  </div>);
}
function SprLabel({x,y,value,color}) {
  if (value==null||x==null) return null;
  return <text x={x} y={y-7} fill={color} fontSize={9} fontFamily="DM Mono" textAnchor="middle" opacity={0.9}>{Number(value).toFixed(1)}</text>;
}

// ─── DEFECT FLOW por semana — generado por scripts/lighthouse_to_dashboard.py ──
// FLOW_WEEKS[semana] = { o: pedidos por estación, d: pedidos con defecto por estación,
//   r: [[defecto, idxFLOW_ATTR, estación, idxFLOW_TID, nº defectos], …] }
const FLOW_ATTR = ["Non CSPU FTPDF PP - Object Missing - Late Batch", "Geocode accuracy", "OTR - Route Non Complaint", "Non CSPU FTPDF PP - Object Missing - Other", "Early", "Pickup Delay", "Not call compliant", "Missing OTR", "Non CSPU FTPDF FP - Object Missing - Package Missing", "Non CSPU FTPDF FP - Item Damage", "OTR-Others", "Open", "Customer unavailable", "Assignment Delay - Others", "Customer called CS", "Access issue/no safe location", "Open Order", "Road closures", "Late Batch Ops Controllable", "Late", "Late slam/batch", "ONP", "Route Split", "Order Not Picked Up (DSP)", "OTR SDS Non Compliant", "Non CSPU FTPDF FP - Object Missing - Delivered to Wrong Customer", "Missing Items", "Multiple statuses", "Damaged Items", "Non CSPU FTPDF FP - Object Missing - Other", "Orders Unplanned", "Non CSPU FTPDF FP - Other", "Customer Did Not Receive From Recipient", "Not geocompliant", "Unclear", "Other", "Non CSPU FTPDF FP - Object Missing - POND Before Arrival", "Driver Delivered Wrong Shipment", "SDS Possibly Missing", "Unclear Delivery Recepient", "Late Batch Non-Ops Controllable", "Package Not Physically Delivered By Driver", "Suspicious Driver", "Shipment Switcheroo On Route", "Late Slam", "Not Deliverred With Other Shipments", "Non CSPU FTPDF PP - Object Missing - Scan Before Batch", "Unclear Scan", "Suspicious Customer", "Driver out of time", "Unattended Order Lost", "Damaged OTR", "Non CSPU FTPDF PP - Other", "Late Slam/ Late Batch", "Order Cancelled After Final Scan", "Order Never Assigned", "**root cause attribution in progress"];
const FLOW_TID = ["A3K2BGR7A110UB", "A127IE8J8294B0", "A16TPO0SUHU8I2", "A1E4N9160LZCJA", "A26NKN80OE6DV1", "A3S118S8BD258G", "AAHWPKIHARD9Y", "AAXP32AWYXD0S", "A1X46PBP3JSLH0", "A1YBTZWSCR0T6A", "A2G2BQMDZK22FB", "A2N5431KRN4LDL", "A2TQYBOLDOU29F", "A2W61QFD0UM92J", "A383SP0Z8SFZI7", "A3CNXES3ZAANCQ", "A3RMHPGM74KVUJ", "A3UD94Q70561NT", "A887OQHXEMN1O", "AHD1SZOR5VLMU", "AKW9P1LX6ETK5", "AP5YJG0BUXJ9O", "AW3STBJS8T4RJ", "A18RARJCLX2YNM", "A1DRK7DNWLVTBK", "A1N3RQEFTHMW7X", "A1VBK3NCA1KUB6", "A22N4B9F17CJ0Q", "A25ASXCQ28Q9Q5", "A25FQMJHC1SYC5", "A2ETP4LPBDPCI7", "A2ILBEXX6DDHHL", "A2KZIZCT0B70EK", "A31O1VTQ5ESZYI", "A35T5XCFYQTKPZ", "A37QNZXGYFKA07", "A3HASZK5EP9RI3", "A3HJVV8X9PFVFE", "A3N5ILEKGGQQUR", "A3OSZ1G9ERRUK6", "A4V93M3EYBI46", "A51IQJF8MWPLT", "A97DJBAAIAEXE", "ACWZU4JMSMOOL", "ADR55ODP5WOJ7", "AE5QJFCD0PTFU", "AENG310AAIC9N", "AF06IBA6Q5CUT", "AHWNMVNKEB1FS", "APTV7Y5N77N0J", "ATW6H2SY8PT9I", "AWF7GO53ALI75", "A135ULCUPP44LE", "A2WWY1LKJC88P8", "A5RCJALTYW9J7", "A2RY6GYLSHUGWL", "A2SH0J04PT9934", "A3EUZQWT85EFPS", "A2KI4J54TJVRD1", "A2KSRE64V0YVMI", "A2MGPR3KLEMC1A", "A35T9P10PKPSF7", "AJBGQ35XQAHQ2", "ANWEDYH2UUXUI", "AXF6DOVKJAJOP", "A14HNFYUNNWIOM", "A19YV06RG6KFS1", "A1KAYXHWHSMPZA", "A1QVBCU0UM920I", "A20GNNM65U5LV1", "A24QXY3T6QD6HI", "A26QCN2R3RHUL0", "A2IV77PY8N1OKQ", "A2VN2H0236SIOC", "A2WEPZW80LIMA0", "A2WN8CP6YGA3ZP", "A35KO91NJ8ZSL8", "A36ATUOKYN2N4A", "A3L09I7LOYMGGE", "A8E1OB66TNUSO", "AMDQHZ3LZK9PR", "ATU172NW5KXQW", "AVG0Z3EKUPTYE", "A3D09BNUW5T9CR", "A29XO7CRN7MHCW", "A2WU7G4QB2KEM6", "A20V48R4W0KYRW", "A2KS581UOJ6CD", "A3116G3MEA2IX5", "A3RAM736Z7WF43", "A88NGBVO9JRUL", "AIBL7UZKQBFKX", "A1VVE91GJOIDMR", "A282LJ5XHQUCN6", "A2M3COATPHIUMK", "A2N5WVPV21WEDW", "A2WQE16UYDF1A", "A315HN3KMOW80N", "A34LGXU73LL9BM", "A37QIPNRMFHW6E", "AGU7AJNNH2UX8", "APAZ4218J54SY", "A2L1ECIZ3GKSD2", "A3DY09H79H9YKJ", "A12RS30DTIRY4F", "A2BRNMGQ1R89G7", "A3V0WHAK317PM9", "AG6T008EE2QH6", "A31OWXX727M9MX", "A3E7636W999QQA", "A2CRUQRFUPOHN1", "A3K0K8C2ORQY98", "A23U41T334C07B", "A2JCNQ8Z92MZNC", "AH60BA77IO1NM", "A2DBSDQ4VKYICF", "A14SDCEDAIND8Q", "AHLZ4D2QV0N33", "A1R2P4OYDQRVHO", "A1IXQUV0C1M8OW", "AGECZO3FHG9JX", "AMTECUI0XY11T", "A3Q9NS2XEI8N26"];
const FLOW_WEEKS = {
"2026-W27":{"o":{"UIT4":3228,"UIT1":1832,"UBA1":539,"UIL7":564},"d":{"UBA1":56,"UIL7":96,"UIT1":132,"UIT4":494},"r":[["late",5,"UIT4",82,16],["late",5,"UIL7",104,15],["item_miss",26,"UIT4",110,14],["late_gt15",5,"UIL7",104,13],["late",5,"UIT4",92,12],["late",5,"UIT4",70,12],["late",5,"UIT4",68,12],["late_gt15",5,"UIT4",82,11],["late",5,"UIT4",69,10],["late",5,"UIT4",37,10],["item_miss",26,"UBA1",0,9],["late",5,"UIT4",30,9],["late",5,"UIL7",4,8],["late",2,"UIL7",104,8],["late",2,"UIT1",61,8],["late",5,"UBA1",54,7],["late_gt15",5,"UIT4",70,7],["late",13,"UIT1",64,7],["late",5,"UIT4",120,7],["late_gt15",5,"UIL7",4,6],["late",5,"UIT4",96,6],["item_miss",26,"UIT4",97,6],["late_gt15",5,"UIT4",37,6],["late",5,"UIT4",38,6],["item_qual",28,"UIT4",101,6],["item_qual",28,"UIL7",118,6],["late_gt15",13,"UIT1",64,6],["late_gt15",5,"UIT4",68,6],["item_miss",26,"UIT4",68,6],["late_gt15",5,"UIT4",69,5],["item_miss",26,"UIT4",69,5],["late",5,"UIL7",2,5],["late",10,"UIL7",56,5],["item_miss",26,"UIT4",77,5],["item_qual",28,"UIT4",43,5],["item_miss",26,"UIT4",45,5],["late",5,"UIT4",117,5],["late_gt15",5,"UIT4",92,5],["late",5,"UIT4",97,5],["item_qual",28,"UIT4",107,5],["late_gt15",5,"UIT4",30,5],["item_qual",28,"UIT4",77,5],["item_qual",28,"UIT4",82,5],["late",2,"UBA1",52,5],["late_gt15",2,"UBA1",52,5],["item_qual",28,"UIT4",110,5],["late",5,"UBA1",102,5],["pdnr",34,"UBA1",0,4],["ftfdf",12,"UIT1",62,4],["item_qual",28,"UIT4",37,4],["ftpdf",3,"UIT4",106,4],["ftfdf",12,"UIT4",101,4],["item_miss",26,"UIT4",101,4],["late_gt15",5,"UIL7",2,4],["item_miss",26,"UIT4",25,4],["item_miss",26,"UIT4",43,4],["item_qual",28,"UIT4",117,4],["late",5,"UIL7",84,4],["ftfdf",17,"UIT1",8,4],["late",5,"UIT4",29,4],["late_gt15",2,"UIL7",104,4],["item_miss",26,"UIL7",118,4],["late",13,"UIL7",88,4],["late",22,"UBA1",52,4],["late_gt15",5,"UBA1",102,4],["late",2,"UIL7",56,3],["ftfdf",14,"UIT1",3,3],["late",5,"UIT1",3,3],["ftfdf",14,"UIT4",92,3],["item_qual",28,"UIT4",92,3],["item_miss",26,"UIT4",93,3],["item_qual",28,"UIT4",93,3],["late",5,"UIT4",34,3],["item_miss",26,"UIT4",106,3],["ftfdf",12,"UIT4",41,3],["item_qual",28,"UIT4",41,3],["item_qual",28,"UIT4",48,3],["late",2,"UIT4",49,3],["late_gt15",10,"UIL7",56,3],["item_miss",26,"UIT1",5,3],["item_miss",26,"UIT1",121,3],["item_miss",26,"UIT4",105,3],["late",5,"UIT4",51,3],["item_miss",26,"UIT4",51,3],["item_qual",28,"UIT4",51,3],["late",13,"UIT1",57,3],["late",5,"UIT1",64,3],["ftpdf",3,"UIT4",29,3],["ftpdf",3,"UIT4",71,3],["item_qual",28,"UIT4",32,3],["late_gt15",5,"UIT4",97,3],["ftpdf",9,"UIT4",43,3],["item_qual",28,"UIT4",44,3],["late",5,"UIT4",45,3],["pdnr",34,"UIT4",117,3],["ftpdf",3,"UIT4",48,3],["late",13,"UIT4",80,3],["late_gt15",5,"UBA1",54,3],["late",2,"UIT1",64,3],["item_qual",28,"UIT4",68,3],["item_miss",26,"UIT4",70,3],["late_gt15",5,"UIT4",38,3],["late",5,"UIT4",42,3],["late_gt15",5,"UIT4",120,3],["ftdc",55,"UIT4",101,3],["late",5,"UIT4",101,3],["late",5,"UBA1",0,3],["late_gt15",13,"UIL7",88,3],["pdnr",42,"UIT4",110,3],["item_qual",28,"UBA1",102,3],["late_gt15",2,"UIT1",61,3],["late_gt15",2,"UIL7",56,2],["item_miss",26,"UIT4",92,2],["item_qual",28,"UIT4",27,2],["late",18,"UIT4",70,2],["item_qual",28,"UIT4",29,2],["pdnr",34,"UIT4",93,2],["item_miss",26,"UIT4",37,2],["late",2,"UIT4",37,2],["pdnr",34,"UIT4",101,2],["late_gt15",2,"UIT4",49,2],["item_miss",26,"UIT4",82,2],["ftpdf",9,"UIL7",2,2],["late",18,"UIL7",4,2],["ftfdf",15,"UIL7",7,2],["ftfdf",17,"UIT1",16,2],["item_qual",28,"UIT1",5,2],["item_miss",26,"UIT1",64,2],["item_qual",28,"UIT4",25,2],["item_qual",28,"UIT4",26,2],["late",5,"UIT4",115,2],["item_qual",28,"UIT4",30,2],["ftfdf",14,"UIT4",97,2],["item_qual",28,"UIT4",106,2],["ftfdf",19,"UIT4",45,2],["pdnr",34,"UIT4",45,2],["item_qual",28,"UIT4",120,2],["pdnr",34,"UIT4",120,2],["late_gt15",5,"UIT4",117,2],["late",2,"UIT4",48,2],["item_miss",26,"UIT4",80,2],["item_qual",28,"UIT4",49,2],["late",5,"UIT1",9,2],["ftfdf",17,"UIT1",57,2],["item_qual",28,"UIT1",57,2],["ftfdf",12,"UIT1",5,2],["item_miss",26,"UIT1",22,2],["item_qual",28,"UIT1",22,2],["late",5,"UIT1",22,2],["ftfdf",12,"UIT4",25,2],["late",18,"UIT4",68,2],["ftpdf",3,"UIT4",92,2],["item_miss",26,"UIT4",29,2],["ftpdf",3,"UIT4",115,2],["ftpdf",29,"UIT4",31,2],["pdnr",34,"UIT4",31,2],["item_miss",26,"UIT4",36,2],["item_miss",26,"UIT4",44,2],["item_qual",28,"UIT4",45,2],["item_miss",26,"UIT4",114,2],["late",2,"UIT4",117,2],["ftfdf",14,"UIT4",117,2],["late",5,"UIT4",48,2],["late_gt15",5,"UIT4",48,2],["item_qual",28,"UBA1",52,2],["item_qual",28,"UBA1",0,2],["item_qual",28,"UIL7",2,2],["late_gt15",5,"UIL7",84,2],["item_qual",28,"UIT1",58,2],["item_qual",28,"UIT1",19,2],["late_gt15",2,"UIT1",64,2],["ftfdf",14,"UIT4",25,2],["ftpdf",3,"UIT4",68,2],["late",5,"UIT4",26,2],["ftpdf",8,"UIT4",27,2],["pdnr",43,"UIT4",27,2],["pdnr",34,"UIT4",70,2],["late",2,"UIT4",32,2],["pdnr",43,"UIT4",32,2],["late_gt15",5,"UIT4",96,2],["item_miss",26,"UIT4",34,2],["ftfdf",12,"UIT4",42,2],["ftpdf",3,"UIT4",42,2],["item_miss",26,"UIT4",120,2],["ftdc",24,"UIT4",120,2],["late_gt15",5,"UIT4",101,2],["late_gt15",5,"UBA1",0,2],["pdnr",34,"UIL7",104,2],["item_qual",28,"UIL7",104,2],["late",40,"UIL7",118,2],["item_qual",28,"UIL7",56,2],["late",2,"UIL7",85,2],["late_gt15",2,"UIL7",85,2],["late",56,"UIL7",88,2],["late_gt15",5,"UIT1",3,2],["ftfdf",14,"UIT1",19,2],["late_gt15",5,"UIT4",29,2],["item_miss",26,"UIT4",32,2],["late",5,"UIT4",49,2],["late_gt15",22,"UBA1",52,2],["item_miss",26,"UBA1",54,2],["late",5,"UIL7",118,2],["late",5,"UIT4",65,2],["late",5,"UIT4",107,2],["ftfdf",14,"UIT4",80,2],["item_qual",28,"UBA1",54,2],["late",2,"UIL7",2,2],["pdnr",34,"UIT1",58,2],["late",5,"UBA1",103,1],["ftfdf",14,"UBA1",111,1],["ftfdf",7,"UIL7",56,1],["ftfdf",35,"UIL7",6,1],["item_qual",28,"UIT1",1,1],["ftfdf",6,"UIT1",3,1],["pdnr",34,"UIT1",3,1],["pdnr",34,"UIT1",8,1],["item_qual",28,"UIT1",8,1],["late",5,"UIT1",108,1],["ftfdf",12,"UIT1",90,1],["ftfdf",17,"UIT1",19,1],["ftfdf",15,"UIT1",121,1],["ftpdf",9,"UIT4",26,1],["fdnr",39,"UIT4",69,1],["ftpdf",3,"UIT4",69,1],["item_qual",28,"UIT4",69,1],["pdnr",34,"UIT4",27,1],["late_gt15",18,"UIT4",70,1],["late",2,"UIT4",70,1],["late",5,"UIT4",105,1],["ftpdf",31,"UIT4",96,1],["item_qual",28,"UIT4",96,1],["pdnr",34,"UIT4",97,1],["item_qual",28,"UIT4",97,1],["ftpdf",3,"UIT4",33,1],["pdnr",38,"UIT4",33,1],["ftfdf",15,"UIT4",33,1],["late",13,"UIT4",33,1],["ftfdf",6,"UIT4",33,1],["item_qual",28,"UIT4",33,1],["item_miss",26,"UIT4",98,1],["item_qual",28,"UIT4",98,1],["late_gt15",5,"UIT4",34,1],["late_gt15",2,"UIT4",37,1],["late",5,"UIT4",41,1],["item_miss",26,"UIT4",41,1],["ftfdf",51,"UIT4",47,1],["ftpdf",9,"UIT4",101,1],["pdnr",34,"UIT4",49,1],["fdnr",39,"UIT4",82,1],["late",10,"UBA1",53,1],["late",22,"UBA1",54,1],["late_gt15",22,"UBA1",54,1],["ftfdf",19,"UIL7",2,1],["pdnr",37,"UIL7",2,1],["late_gt15",18,"UIL7",4,1],["pdnr",34,"UIT1",1,1],["item_qual",28,"UIT1",3,1],["late",2,"UIT1",9,1],["ftpdf",3,"UIT1",112,1],["late",5,"UIT1",58,1],["late",13,"UIT1",108,1],["item_miss",26,"UIT1",108,1],["item_miss",26,"UIT1",62,1],["late",2,"UIT1",22,1],["ftpdf",9,"UIT4",25,1],["late",5,"UIT4",25,1],["ftpdf",25,"UIT4",25,1],["ftfdf",17,"UIT4",26,1],["ftfdf",49,"UIT4",92,1],["ftfdf",12,"UIT4",70,1],["ftfdf",14,"UIT4",93,1],["ftfdf",14,"UIT4",30,1],["fdnr",39,"UIT4",31,1],["late",5,"UIT4",32,1],["late",5,"UIT4",33,1],["late_gt15",5,"UIT4",33,1],["item_miss",26,"UIT4",33,1],["late",5,"UIT4",98,1],["late_gt15",5,"UIT4",98,1],["item_qual",28,"UIT4",34,1],["ftfdf",15,"UIT4",36,1],["late",10,"UIT4",37,1],["ftfdf",33,"UIT4",43,1],["ftfdf",12,"UIT4",45,1],["late",13,"UIT4",45,1],["late_gt15",13,"UIT4",45,1],["pdnr",41,"UIT4",48,1],["late",13,"UIT4",48,1],["item_miss",26,"UIT4",48,1],["late_gt15",2,"UIT4",48,1],["late",2,"UIT4",80,1],["ftfdf",15,"UIT4",101,1],["late",10,"UIT4",101,1],["late_gt15",5,"UIT4",51,1],["late",22,"UBA1",53,1],["item_miss",26,"UBA1",83,1],["ftfdf",33,"UBA1",54,1],["late",2,"UIL7",118,1],["ftfdf",33,"UIL7",118,1],["pdnr",34,"UIL7",84,1],["late",5,"UIL7",55,1],["late",5,"UIL7",6,1],["late_gt15",5,"UIL7",6,1],["late",2,"UIL7",7,1],["late",5,"UIT1",8,1],["late_gt15",5,"UIT1",8,1],["item_miss",26,"UIT1",8,1],["late",5,"UIT1",112,1],["ftfdf",14,"UIT1",112,1],["ftpdf",3,"UIT1",60,1],["late_gt15",13,"UIT1",57,1],["fdnr",39,"UIT1",16,1],["item_qual",28,"UIT1",121,1],["ftfdf",12,"UIT1",22,1],["ftfdf",4,"UIT1",22,1],["ftfdf",14,"UIT1",64,1],["ftdc",24,"UIT1",64,1],["ftpdf",29,"UIT4",68,1],["fdnr",39,"UIT4",92,1],["ftfdf",33,"UIT4",27,1],["pdnr",38,"UIT4",29,1],["ftfdf",14,"UIT4",29,1],["ftfdf",6,"UIT4",71,1],["item_miss",26,"UIT4",71,1],["pdnr",37,"UIT4",71,1],["ftfdf",49,"UIT4",105,1],["item_miss",26,"UIT4",115,1],["ftpdf",3,"UIT4",30,1],["item_miss",26,"UIT4",30,1],["ftfdf",6,"UIT4",32,1],["ftfdf",15,"UIT4",97,1],["late",2,"UIT4",98,1],["late_gt15",2,"UIT4",98,1],["ftfdf",14,"UIT4",98,1],["ftpdf",3,"UIT4",34,1],["late",13,"UIT4",77,1],["late_gt15",13,"UIT4",77,1],["late",5,"UIT4",36,1],["late",13,"UIT4",37,1],["pdnr",34,"UIT4",37,1],["ftfdf",6,"UIT4",43,1],["late",13,"UIT4",43,1],["ftfdf",33,"UIT4",44,1],["late_gt15",5,"UIT4",45,1],["ftfdf",14,"UIT4",47,1],["late",5,"UIT4",47,1],["late_gt15",5,"UIT4",47,1],["ftfdf",15,"UIT4",107,1],["late_gt15",13,"UIT4",80,1],["ftpdf",31,"UIT4",82,1],["ftpdf",25,"UIT4",82,1],["late",5,"UBA1",83,1],["late",5,"UBA1",111,1],["late_gt15",5,"UBA1",111,1],["late",2,"UBA1",111,1],["late_gt15",2,"UBA1",111,1],["ftfdf",14,"UIL7",104,1],["late",5,"UIL7",7,1],["item_qual",28,"UIT1",60,1],["item_qual",28,"UIT1",108,1],["ftfdf",6,"UIT1",61,1],["item_miss",26,"UIT1",16,1],["ftfdf",14,"UIT1",6,1],["ftpdf",3,"UIT1",19,1],["ftfdf",6,"UIT1",19,1],["ftfdf",33,"UIT4",68,1],["ftfdf",49,"UIT4",68,1],["item_miss",26,"UIT4",26,1],["item_qual",28,"UIT4",70,1],["pdnr",34,"UIT4",29,1],["late",10,"UIT4",29,1],["late_gt15",10,"UIT4",29,1],["ftfdf",49,"UIT4",71,1],["ftfdf",17,"UIT4",71,1],["pdnr",38,"UIT4",71,1],["late",5,"UIT4",71,1],["late_gt15",5,"UIT4",71,1],["ftfdf",27,"UIT4",93,1],["fdnr",48,"UIT4",31,1],["item_qual",28,"UIT4",31,1],["pdnr",34,"UIT4",72,1],["late",2,"UIT4",72,1],["ftfdf",14,"UIT4",96,1],["ftfdf",19,"UIT4",96,1],["ftfdf",12,"UIT4",97,1],["ftpdf",3,"UIT4",76,1],["pdnr",38,"UIT4",76,1],["ftpdf",8,"UIT4",34,1],["pdnr",34,"UIT4",34,1],["ftpdf",8,"UIT4",77,1],["late",5,"UIT4",77,1],["late_gt15",5,"UIT4",77,1],["pdnr",34,"UIT4",106,1],["late_gt15",5,"UIT4",42,1],["pdnr",38,"UIT4",42,1],["late",5,"UIT4",43,1],["ftpdf",31,"UIT4",120,1],["ftfdf",12,"UIT4",120,1],["ftfdf",12,"UIT4",114,1],["item_miss",26,"UIT4",117,1],["ftdc",24,"UIT4",101,1],["late",2,"UIT4",82,1],["late_gt15",2,"UIT4",82,1],["ftpdf",8,"UIT4",82,1],["ftfdf",6,"UBA1",83,1],["ftpdf",9,"UIL7",104,1],["late_gt15",40,"UIL7",118,1],["ftfdf",19,"UIL7",56,1],["late",18,"UIL7",88,1],["late_gt15",56,"UIL7",88,1],["late",40,"UIL7",6,1],["ftfdf",15,"UIT1",1,1],["late",5,"UIT1",1,1],["item_miss",26,"UIT1",3,1],["ftpdf",25,"UIT1",3,1],["ftfdf",15,"UIT1",112,1],["late",2,"UIT1",60,1],["late_gt15",2,"UIT1",60,1],["late",56,"UIT1",60,1],["item_miss",26,"UIT1",88,1],["pdnr",47,"UIT1",88,1],["ftdc",30,"UIT1",61,1],["late",5,"UIT1",61,1],["late_gt15",5,"UIT1",61,1],["item_miss",26,"UIT1",14,1],["fdnr",50,"UIT1",5,1],["item_qual",28,"UIT1",6,1],["ftfdf",6,"UIT1",121,1],["ftfdf",17,"UIT4",119,1],["ftfdf",14,"UIT4",119,1],["ftfdf",15,"UIT4",119,1],["ftfdf",15,"UIT4",25,1],["ftfdf",12,"UIT4",26,1],["ftfdf",19,"UIT4",92,1],["late",2,"UIT4",92,1],["late",56,"UIT4",69,1],["ftpdf",29,"UIT4",70,1],["ftfdf",14,"UIT4",71,1],["ftfdf",15,"UIT4",93,1],["ftpdf",3,"UIT4",110,1],["late",5,"UIT4",110,1],["pdnr",34,"UIT4",115,1],["late_gt15",5,"UIT4",115,1],["late",5,"UIT4",31,1],["ftdc",30,"UIT4",72,1],["fdnr",39,"UIT4",72,1],["pdnr",34,"UIT4",32,1],["ftfdf",7,"UIT4",32,1],["pdnr",37,"UIT4",32,1],["ftpdf",3,"UIT4",32,1],["item_qual",28,"UIT4",76,1],["item_miss",26,"UIT4",76,1],["ftpdf",31,"UIT4",34,1],["pdnr",34,"UIT4",77,1],["item_miss",26,"UIT4",42,1],["fdnr",48,"UIT4",43,1],["pdnr",34,"UIT4",43,1],["ftfdf",14,"UIT4",44,1],["ftfdf",12,"UIT4",44,1],["ftfdf",27,"UIT4",120,1],["pdnr",38,"UIT4",120,1],["ftpdf",25,"UIT4",120,1],["ftfdf",33,"UIT4",117,1],["ftfdf",15,"UIT4",117,1],["late",2,"UIT4",101,1],["late_gt15",2,"UIT4",101,1],["ftfdf",33,"UIT4",101,1],["late",18,"UIT4",82,1],["pdnr",48,"UBA1",52,1],["item_qual",28,"UBA1",83,1],["ftpdf",8,"UBA1",111,1],["item_qual",28,"UBA1",111,1],["late",56,"UIL7",56,1],["late_gt15",56,"UIL7",56,1],["ftpdf",8,"UIL7",56,1],["late",56,"UIT1",8,1],["ftfdf",14,"UIT1",60,1],["late",13,"UIT1",88,1],["late",5,"UIT1",88,1],["pdnr",45,"UIT1",61,1],["late",56,"UIT1",61,1],["fdnr",39,"UIT1",109,1],["item_miss",26,"UIT1",57,1],["item_qual",28,"UIT1",62,1],["ftfdf",6,"UIT1",22,1],["ftpdf",3,"UIT1",22,1],["late",56,"UIT4",65,1],["late_gt15",56,"UIT4",65,1],["late",18,"UIT4",65,1],["late",13,"UIT4",68,1],["ftpdf",8,"UIT4",68,1],["item_miss",26,"UIT4",27,1],["ftfdf",12,"UIT4",27,1],["ftfdf",17,"UIT4",32,1],["ftfdf",14,"UIT4",32,1],["fdnr",39,"UIT4",32,1],["ftfdf",15,"UIT4",98,1],["late",13,"UIT4",98,1],["ftfdf",15,"UIT4",106,1],["late",5,"UIT4",106,1],["late_gt15",5,"UIT4",107,1],["pdnr",34,"UIT4",80,1],["ftfdf",12,"UIT4",49,1],["item_miss",26,"UIT4",49,1],["ftfdf",15,"UIT4",51,1],["ftpdf",8,"UBA1",102,1],["pdnr",34,"UBA1",102,1],["item_miss",26,"UBA1",53,1],["pdnr",34,"UBA1",53,1],["pdnr",34,"UBA1",54,1],["ftfdf",17,"UIL7",2,1],["late",56,"UIL7",118,1],["late_gt15",56,"UIL7",118,1],["item_qual",28,"UIT1",9,1],["late_gt15",5,"UIT1",9,1],["ftpdf",25,"UIT1",85,1],["pdnr",34,"UIT1",88,1],["ftfdf",15,"UIT1",88,1],["ftfdf",14,"UIT1",109,1],["late",5,"UIT1",5,1],["ftfdf",14,"UIT1",22,1],["late_gt15",5,"UIT1",64,1],["late",2,"UIT4",65,1],["pdnr",34,"UIT4",23,1],["ftpdf",9,"UIT4",68,1],["ftfdf",6,"UIT4",29,1],["ftfdf",12,"UIT4",110,1],["ftpdf",25,"UIT4",38,1],["pdnr",34,"UIT4",38,1],["ftfdf",14,"UIT4",38,1],["ftpdf",3,"UIT4",38,1],["item_qual",28,"UIT4",38,1],["ftfdf",17,"UIT4",41,1],["item_miss",26,"UIT4",79,1]]},
"2026-W28":{"o":{"UIT4":3241,"UIT1":1614,"UBA1":511,"UIL7":504},"d":{"UBA1":31,"UIL7":68,"UIT1":104,"UIT4":425},"r":[["late",2,"UIL7",56,13],["late",5,"UIT4",70,12],["late",5,"UIT4",82,11],["item_miss",26,"UBA1",0,10],["late_gt15",2,"UIL7",56,9],["late_gt15",5,"UIT4",70,9],["item_miss",26,"UIT4",78,7],["late",5,"UIT4",48,7],["late",5,"UIT4",92,7],["late",5,"UIT4",75,7],["item_miss",26,"UIT4",101,6],["item_qual",28,"UIT4",101,6],["late",13,"UIT4",48,6],["late",2,"UIL7",6,6],["late",5,"UIT4",49,6],["item_miss",26,"UIT4",119,5],["late",5,"UIT4",105,5],["item_qual",28,"UIT4",51,5],["late",5,"UIT4",36,5],["late_gt15",5,"UIT4",82,5],["late",5,"UIT4",38,5],["late_gt15",5,"UIT4",75,5],["late",5,"UIL7",4,4],["item_qual",28,"UIT1",5,4],["ftfdf",14,"UIT4",119,4],["item_qual",28,"UIT4",92,4],["late",5,"UIT4",96,4],["item_miss",26,"UIL7",56,4],["late",5,"UIT4",73,4],["item_miss",26,"UIT4",73,4],["item_qual",28,"UIT4",78,4],["item_miss",26,"UIT4",106,4],["item_qual",28,"UIT4",41,4],["ftfdf",19,"UIT4",70,4],["item_miss",26,"UIT4",32,4],["late",13,"UIT4",97,4],["late_gt15",13,"UIT4",48,4],["item_qual",28,"UIT4",117,4],["item_qual",28,"UIT4",115,4],["late",5,"UIL7",7,4],["pdnr",34,"UBA1",0,3],["item_miss",26,"UIL7",6,3],["late",18,"UIT1",121,3],["item_qual",28,"UIT4",33,3],["item_qual",28,"UIT4",77,3],["ftfdf",14,"UIT4",41,3],["ftfdf",15,"UIT4",101,3],["item_miss",26,"UIT4",82,3],["item_miss",26,"UBA1",52,3],["late",5,"UIL7",118,3],["late_gt15",5,"UIL7",118,3],["pdnr",34,"UIL7",56,3],["late",5,"UIT1",3,3],["item_qual",28,"UIT4",27,3],["item_miss",26,"UIT4",72,3],["late",5,"UIT4",42,3],["late",5,"UIL7",104,3],["late",10,"UIT1",6,3],["late",13,"UIT4",71,3],["item_qual",28,"UIT4",32,3],["ftfdf",17,"UIT4",77,3],["late",5,"UIT4",106,3],["late",13,"UIT4",43,3],["item_qual",28,"UIT4",43,3],["item_miss",26,"UIT1",5,3],["item_miss",26,"UIT1",62,3],["late_gt15",5,"UIT4",48,3],["item_qual",28,"UBA1",0,3],["late_gt15",5,"UIT4",92,3],["late",5,"UIT4",47,3],["item_miss",26,"UIT4",117,3],["item_qual",28,"UIT4",48,3],["late_gt15",5,"UIT4",49,3],["late",5,"UIL7",88,3],["late",5,"UIL7",6,3],["item_qual",28,"UIT4",75,3],["item_miss",26,"UIT4",75,3],["item_miss",26,"UIT4",43,3],["late_gt15",2,"UIL7",6,3],["late",2,"UIL7",7,2],["ftpdf",3,"UIL7",7,2],["ftfdf",15,"UIT1",3,2],["item_qual",28,"UIT1",14,2],["item_qual",28,"UIT1",90,2],["late",5,"UIT4",26,2],["item_qual",28,"UIT4",96,2],["late",5,"UIT4",34,2],["late",10,"UIT4",34,2],["item_miss",26,"UIT4",77,2],["item_qual",28,"UIT4",47,2],["item_miss",26,"UIT4",120,2],["item_miss",26,"UIL7",118,2],["item_qual",28,"UIT1",9,2],["ftfdf",15,"UIT1",112,2],["item_miss",26,"UIT1",61,2],["item_qual",28,"UIT4",119,2],["pdnr",34,"UIT4",70,2],["item_miss",26,"UIT4",70,2],["late",5,"UIT4",97,2],["item_miss",26,"UIT4",34,2],["item_qual",28,"UIT4",37,2],["late",5,"UIT4",78,2],["ftfdf",17,"UIT4",46,2],["ftfdf",12,"UIT4",46,2],["item_miss",26,"UIT4",48,2],["pdnr",34,"UIT4",101,2],["late",5,"UIT4",101,2],["late",2,"UIT4",49,2],["item_qual",28,"UIT4",49,2],["item_miss",26,"UIT4",49,2],["ftfdf",14,"UIT1",113,2],["item_miss",26,"UIT1",108,2],["item_qual",28,"UIT1",61,2],["late_gt15",10,"UIT1",6,2],["late",2,"UIT1",22,2],["ftpdf",29,"UIT4",119,2],["item_miss",26,"UIT4",26,2],["ftpdf",3,"UIT4",105,2],["item_miss",26,"UIT4",42,2],["item_miss",26,"UIT4",46,2],["item_qual",28,"UIT4",114,2],["late",13,"UIT4",49,2],["late",13,"UIT4",50,2],["item_miss",26,"UIT4",51,2],["late",2,"UIL7",85,2],["item_qual",28,"UIL7",7,2],["late",5,"UIT1",1,2],["late_gt15",5,"UIT1",1,2],["ftfdf",6,"UIT1",5,2],["late",5,"UIT1",90,2],["ftfdf",14,"UIT1",62,2],["ftfdf",17,"UIT4",119,2],["ftfdf",14,"UIT4",25,2],["item_miss",26,"UIT4",25,2],["ftfdf",14,"UIT4",97,2],["late_gt15",13,"UIT4",97,2],["late",5,"UIT4",98,2],["ftfdf",14,"UIT4",77,2],["late_gt15",5,"UIT4",42,2],["item_qual",28,"UIT4",46,2],["late",5,"UIT4",46,2],["late",2,"UIT4",46,2],["ftpdf",25,"UIT4",48,2],["late",5,"UIT4",80,2],["late",2,"UIL7",104,2],["late_gt15",2,"UIL7",104,2],["late",5,"UIT1",121,2],["item_miss",26,"UIT4",27,2],["item_qual",28,"UIT4",31,2],["item_qual",28,"UIT4",73,2],["item_miss",26,"UIT4",33,2],["late_gt15",5,"UIT4",38,2],["ftfdf",6,"UIT4",47,2],["ftfdf",17,"UIT4",47,2],["late",2,"UIT4",82,2],["late",2,"UIL7",4,2],["late_gt15",5,"UIL7",88,2],["late",2,"UIL7",15,2],["late_gt15",2,"UIL7",15,2],["ftfdf",14,"UIT4",92,2],["late",2,"UIT4",32,2],["fdnr",39,"UIT4",32,2],["ftpdf",25,"UIT4",75,2],["item_miss",26,"UIT4",41,2],["late",2,"UIT4",117,2],["pdnr",43,"UBA1",0,2],["late_gt15",5,"UIL7",7,2],["pdnr",34,"UIT4",72,2],["ftpdf",9,"UIT4",43,2],["ftpdf",3,"UIT4",82,2],["item_qual",28,"UBA1",52,1],["ftfdf",17,"UBA1",53,1],["item_qual",28,"UBA1",53,1],["pdnr",34,"UIL7",104,1],["pdnr",41,"UIL7",6,1],["item_qual",28,"UIL7",6,1],["ftfdf",14,"UIT1",8,1],["late",5,"UIT1",9,1],["late",5,"UIT1",113,1],["late",10,"UIT1",113,1],["late_gt15",10,"UIT1",113,1],["late",5,"UIT1",88,1],["item_qual",28,"UIT1",88,1],["ftfdf",14,"UIT1",109,1],["item_qual",28,"UIT1",109,1],["late",5,"UIT1",16,1],["item_miss",26,"UIT1",121,1],["fdnr",39,"UIT4",119,1],["ftfdf",15,"UIT4",119,1],["ftpdf",31,"UIT4",119,1],["pdnr",47,"UIT4",119,1],["late_gt15",5,"UIT4",26,1],["item_qual",28,"UIT4",26,1],["late",2,"UIT4",26,1],["ftpdf",36,"UIT4",27,1],["ftfdf",12,"UIT4",105,1],["item_miss",26,"UIT4",105,1],["pdnr",48,"UIT4",72,1],["pdnr",41,"UIT4",77,1],["pdnr",47,"UIT4",78,1],["ftpdf",29,"UIT4",38,1],["item_qual",28,"UIT4",39,1],["ftpdf",3,"UIT4",41,1],["item_miss",26,"UIT4",47,1],["ftfdf",14,"UIT4",120,1],["item_qual",28,"UIT4",120,1],["ftpdf",3,"UIT4",120,1],["ftpdf",25,"UIT4",114,1],["ftfdf",14,"UIT4",117,1],["ftpdf",31,"UIT4",80,1],["ftfdf",14,"UIT4",80,1],["pdnr",47,"UBA1",52,1],["late",5,"UBA1",54,1],["late_gt15",5,"UBA1",54,1],["item_miss",26,"UIL7",84,1],["item_miss",26,"UIL7",85,1],["ftpdf",9,"UIT1",3,1],["item_qual",28,"UIT1",3,1],["pdnr",37,"UIT1",3,1],["pdnr",34,"UIT1",8,1],["ftfdf",1,"UIT1",9,1],["ftfdf",14,"UIT1",112,1],["ftpdf",3,"UIT1",14,1],["ftfdf",14,"UIT1",19,1],["ftfdf",1,"UIT1",22,1],["ftfdf",6,"UIT4",119,1],["ftpdf",3,"UIT4",26,1],["ftfdf",17,"UIT4",26,1],["ftpdf",29,"UIT4",69,1],["late",2,"UIT4",72,1],["late_gt15",2,"UIT4",72,1],["late_gt15",5,"UIT4",73,1],["ftpdf",29,"UIT4",97,1],["late_gt15",5,"UIT4",97,1],["pdnr",37,"UIT4",97,1],["ftpdf",25,"UIT4",78,1],["late_gt15",5,"UIT4",78,1],["ftpdf",3,"UIT4",78,1],["ftfdf",17,"UIT4",41,1],["ftfdf",33,"UIT4",42,1],["item_miss",26,"UIT4",80,1],["late_gt15",5,"UIT4",101,1],["ftpdf",3,"UIT4",49,1],["ftfdf",6,"UBA1",53,1],["item_qual",28,"UBA1",83,1],["ftpdf",25,"UBA1",54,1],["late_gt15",5,"UIL7",4,1],["late",5,"UIT1",61,1],["item_miss",26,"UIT1",6,1],["ftfdf",14,"UIT1",6,1],["ftfdf",15,"UIT1",6,1],["late",5,"UIT1",19,1],["late_gt15",5,"UIT1",19,1],["late",2,"UIT1",19,1],["ftfdf",12,"UIT1",62,1],["ftpdf",3,"UIT4",119,1],["late",13,"UIT4",119,1],["late_gt15",13,"UIT4",119,1],["late",2,"UIT4",119,1],["late",5,"UIT4",119,1],["item_qual",28,"UIT4",69,1],["late",13,"UIT4",69,1],["late_gt15",13,"UIT4",69,1],["late",10,"UIT4",71,1],["late_gt15",13,"UIT4",71,1],["ftfdf",17,"UIT4",71,1],["late_gt15",5,"UIT4",105,1],["fdnr",39,"UIT4",73,1],["ftfdf",1,"UIT4",73,1],["item_miss",26,"UIT4",97,1],["item_qual",28,"UIT4",34,1],["late",2,"UIT4",77,1],["late_gt15",5,"UIT4",106,1],["item_miss",26,"UIT4",79,1],["pdnr",34,"UIT4",42,1],["fdnr",39,"UIT4",42,1],["ftfdf",12,"UIT4",42,1],["ftpdf",3,"UIT4",42,1],["item_miss",26,"UIT4",114,1],["ftfdf",12,"UIT4",101,1],["late",5,"UIT4",50,1],["late",13,"UIT4",51,1],["ftfdf",14,"UBA1",54,1],["late",22,"UBA1",54,1],["item_qual",28,"UIL7",104,1],["ftfdf",14,"UIL7",85,1],["late_gt15",2,"UIL7",85,1],["item_miss",26,"UIT1",1,1],["ftfdf",14,"UIT1",1,1],["ftfdf",15,"UIT1",8,1],["item_qual",28,"UIT1",60,1],["late",5,"UIT1",14,1],["ftfdf",14,"UIT1",14,1],["late",13,"UIT1",109,1],["item_miss",26,"UIT1",109,1],["late",5,"UIT1",109,1],["pdnr",34,"UIT1",16,1],["ftfdf",14,"UIT1",16,1],["item_qual",28,"UIT1",16,1],["late",2,"UIT1",16,1],["ftfdf",15,"UIT1",19,1],["ftfdf",15,"UIT1",62,1],["late",13,"UIT4",23,1],["ftfdf",14,"UIT4",23,1],["late",5,"UIT4",23,1],["pdnr",34,"UIT4",119,1],["ftfdf",14,"UIT4",70,1],["ftfdf",14,"UIT4",93,1],["item_qual",28,"UIT4",93,1],["pdnr",38,"UIT4",105,1],["late",13,"UIT4",105,1],["late",5,"UIT4",72,1],["late_gt15",5,"UIT4",72,1],["ftfdf",12,"UIT4",97,1],["ftpdf",3,"UIT4",97,1],["item_qual",28,"UIT4",97,1],["ftfdf",17,"UIT4",33,1],["pdnr",34,"UIT4",98,1],["ftfdf",1,"UIT4",98,1],["pdnr",34,"UIT4",77,1],["late",13,"UIT4",37,1],["late",13,"UIT4",38,1],["item_miss",26,"UIT4",39,1],["ftfdf",17,"UIT4",106,1],["ftfdf",14,"UIT4",43,1],["ftpdf",3,"UIT4",80,1],["late_gt15",5,"UIT4",80,1],["ftfdf",14,"UIT4",101,1],["ftfdf",17,"UIT4",82,1],["late",2,"UIT4",51,1],["ftdc",24,"UIT4",51,1],["ftfdf",14,"UBA1",52,1],["ftfdf",15,"UBA1",54,1],["ftfdf",7,"UIL7",118,1],["item_qual",28,"UIL7",118,1],["item_miss",26,"UIL7",5,1],["pdnr",47,"UIT1",3,1],["late",5,"UIT1",58,1],["late_gt15",5,"UIT1",58,1],["ftfdf",6,"UIT1",109,1],["ftpdf",9,"UIT1",90,1],["ftfdf",12,"UIT4",26,1],["item_miss",26,"UIT4",92,1],["ftdc",24,"UIT4",69,1],["item_miss",26,"UIT4",69,1],["pdnr",34,"UIT4",27,1],["ftpdf",3,"UIT4",27,1],["item_qual",28,"UIT4",71,1],["ftfdf",15,"UIT4",71,1],["item_miss",26,"UIT4",31,1],["pdnr",34,"UIT4",32,1],["ftfdf",12,"UIT4",33,1],["ftfdf",6,"UIT4",33,1],["pdnr",48,"UIT4",33,1],["late_gt15",5,"UIT4",98,1],["late_gt15",5,"UIT4",36,1],["item_miss",26,"UIT4",38,1],["late_gt15",5,"UIT4",47,1],["ftpdf",8,"UIT4",47,1],["ftfdf",6,"UIT4",117,1],["ftpdf",9,"UIT4",117,1],["item_qual",28,"UIT4",50,1],["pdnr",34,"UIT4",50,1],["late_gt15",2,"UIT4",82,1],["ftfdf",14,"UIT4",82,1],["ftfdf",15,"UBA1",52,1],["pdnr",48,"UBA1",0,1],["pdnr",37,"UBA1",0,1],["ftpdf",9,"UBA1",0,1],["late_gt15",5,"UIL7",104,1],["late_gt15",2,"UIL7",4,1],["late",40,"UIL7",6,1],["late_gt15",40,"UIL7",6,1],["late",5,"UIT1",8,1],["late_gt15",5,"UIT1",8,1],["late",2,"UIT1",9,1],["late_gt15",2,"UIT1",9,1],["ftfdf",14,"UIT1",9,1],["item_miss",26,"UIT1",9,1],["pdnr",48,"UIT1",9,1],["late",40,"UIT1",9,1],["item_qual",28,"UIT1",113,1],["late",2,"UIT1",88,1],["ftfdf",14,"UIT1",108,1],["ftfdf",14,"UIT1",90,1],["late",5,"UIT1",22,1],["item_miss",26,"UIT1",22,1],["pdnr",34,"UIT4",26,1],["late",5,"UIT4",69,1],["late",2,"UIT4",69,1],["fdnr",48,"UIT4",93,1],["item_miss",26,"UIT4",115,1],["ftfdf",6,"UIT4",73,1],["pdnr",37,"UIT4",75,1],["ftpdf",8,"UIT4",75,1],["late_gt15",5,"UIT4",96,1],["late",13,"UIT4",34,1],["item_qual",28,"UIT4",36,1],["pdnr",34,"UIT4",78,1],["ftfdf",15,"UIT4",122,1],["pdnr",47,"UIT4",41,1],["pdnr",32,"UIT4",43,1],["ftfdf",12,"UIT4",43,1],["pdnr",34,"UIT4",107,1],["pdnr",34,"UIT4",117,1],["ftpdf",8,"UIT4",80,1],["ftfdf",33,"UIT4",50,1],["item_miss",26,"UIT4",50,1],["pdnr",34,"UBA1",52,1],["late_gt15",5,"UIL7",6,1],["ftfdf",12,"UIT1",112,1],["ftfdf",15,"UIT1",58,1],["pdnr",34,"UIT1",61,1],["ftfdf",33,"UIT1",19,1],["ftfdf",17,"UIT1",19,1],["ftpdf",9,"UIT1",22,1],["item_qual",28,"UIT1",22,1],["late_gt15",2,"UIT1",22,1],["pdnr",34,"UIT1",22,1],["item_qual",28,"UIT4",25,1],["ftfdf",17,"UIT4",92,1],["ftpdf",9,"UIT4",27,1],["ftfdf",1,"UIT4",105,1],["pdnr",34,"UIT4",115,1],["item_qual",28,"UIT4",72,1],["ftpdf",29,"UIT4",72,1],["ftfdf",15,"UIT4",32,1],["pdnr",47,"UIT4",32,1],["ftfdf",14,"UIT4",73,1],["ftpdf",29,"UIT4",75,1],["ftfdf",6,"UIT4",75,1],["pdnr",34,"UIT4",75,1],["ftpdf",9,"UIT4",33,1],["ftfdf",15,"UIT4",33,1],["pdnr",34,"UIT4",33,1],["ftpdf",3,"UIT4",77,1],["ftfdf",14,"UIT4",78,1],["ftpdf",3,"UIT4",43,1],["ftpdf",9,"UIT4",114,1],["ftfdf",14,"UIT4",51,1]]},
"2026-W29":{"o":{"UIT4":3027,"UIT1":1493,"UBA1":437,"UIL7":499},"d":{"UBA1":62,"UIL7":81,"UIT1":90,"UIT4":360},"r":[["late",5,"UBA1",54,11],["item_miss",26,"UBA1",0,9],["late",5,"UBA1",52,9],["late_gt15",5,"UBA1",52,9],["late",5,"UIT4",80,8],["late",5,"UIL7",104,8],["late",5,"UIT4",82,8],["late_gt15",5,"UBA1",54,8],["late",2,"UIL7",104,7],["late",5,"UIL7",2,7],["late",5,"UIT4",98,7],["late_gt15",2,"UIL7",104,6],["item_miss",26,"UIT4",75,6],["late_gt15",5,"UIT4",80,6],["item_miss",26,"UIT4",101,6],["late",13,"UIT1",16,6],["ftfdf",6,"UIL7",84,6],["late",5,"UIT4",30,6],["late",2,"UIL7",56,5],["late",5,"UIT4",65,5],["late",40,"UIL7",104,5],["item_miss",26,"UIT4",78,5],["late_gt15",5,"UIL7",104,5],["late",5,"UIT4",69,5],["late",5,"UIL7",4,5],["late_gt15",5,"UIT4",98,5],["late",2,"UIL7",6,4],["late_gt15",2,"UIL7",6,4],["late",5,"UIT4",92,4],["item_miss",26,"UIT4",73,4],["item_miss",26,"UIT4",26,4],["item_miss",26,"UIT4",31,4],["late",2,"UIT4",48,4],["late_gt15",5,"UIL7",2,4],["late_gt15",13,"UIT1",16,4],["late",5,"UIT1",64,4],["late_gt15",5,"UIT4",82,4],["item_qual",28,"UIT4",117,4],["item_qual",28,"UIT4",101,4],["late",5,"UIT4",73,4],["pdnr",34,"UIT4",117,4],["ftdc",53,"UBA1",52,4],["late_gt15",5,"UIT4",30,4],["item_miss",26,"UIT4",107,4],["late",13,"UBA1",53,4],["pdnr",34,"UBA1",0,3],["ftfdf",14,"UIT1",108,3],["item_qual",28,"UIT4",25,3],["ftfdf",14,"UIT4",31,3],["item_qual",28,"UIT4",73,3],["ftfdf",6,"UIT4",75,3],["late",5,"UIT4",106,3],["ftdc",24,"UIT4",51,3],["item_qual",28,"UIT4",51,3],["item_qual",28,"UBA1",0,3],["late_gt15",40,"UIL7",104,3],["late",2,"UIL7",7,3],["item_miss",26,"UIT4",33,3],["ftfdf",14,"UIT4",76,3],["item_miss",26,"UIT4",43,3],["item_qual",28,"UIT4",48,3],["late",10,"UIL7",2,3],["item_qual",28,"UIL7",118,3],["late",13,"UIT1",60,3],["late",13,"UIT1",109,3],["item_qual",28,"UIT4",70,3],["ftfdf",15,"UIT4",70,3],["late",5,"UIT4",34,3],["item_miss",26,"UIT4",117,3],["item_qual",28,"UBA1",52,3],["item_miss",26,"UIT4",69,3],["late",5,"UIT4",38,3],["late_gt15",5,"UIL7",4,3],["late_gt15",2,"UIL7",56,3],["item_miss",26,"UIT4",72,3],["late",5,"UIT4",114,3],["late",5,"UIT4",48,3],["item_qual",28,"UIT1",113,3],["late",5,"UIT4",75,3],["late",13,"UIT4",34,3],["late_gt15",13,"UBA1",53,3],["late",5,"UIT4",36,3],["late",2,"UIL7",4,2],["item_qual",28,"UIL7",56,2],["item_qual",28,"UIT1",1,2],["item_qual",28,"UIT1",109,2],["item_qual",28,"UIT1",5,2],["late_gt15",5,"UIT4",65,2],["item_miss",26,"UIT4",65,2],["late",10,"UIT4",65,2],["late_gt15",5,"UIT4",92,2],["pdnr",34,"UIT4",32,2],["ftpdf",3,"UIT4",98,2],["item_miss",26,"UIT4",98,2],["item_qual",28,"UIT4",77,2],["item_qual",28,"UIT4",38,2],["item_qual",28,"UIT4",39,2],["item_miss",26,"UIT4",106,2],["ftpdf",9,"UIT4",101,2],["item_miss",26,"UIT4",49,2],["late",5,"UIT4",49,2],["item_miss",26,"UIT4",51,2],["late",5,"UIL7",118,2],["item_miss",26,"UIT1",9,2],["item_miss",26,"UIT1",5,2],["item_miss",26,"UIT4",110,2],["item_qual",28,"UIT4",110,2],["item_miss",26,"UIT4",32,2],["item_qual",28,"UIT4",76,2],["item_qual",28,"UBA1",54,2],["late_gt15",10,"UIL7",2,2],["item_miss",26,"UIL7",2,2],["ftfdf",12,"UIT1",9,2],["late",13,"UIT1",9,2],["late_gt15",5,"UIT1",64,2],["late",13,"UIT1",64,2],["ftfdf",12,"UIT4",26,2],["ftfdf",6,"UIT4",71,2],["ftfdf",6,"UIT4",73,2],["item_miss",26,"UIT4",76,2],["ftfdf",14,"UIT4",43,2],["pdnr",34,"UIT4",43,2],["item_qual",28,"UIT4",46,2],["item_qual",28,"UIT4",107,2],["late",5,"UIT4",107,2],["ftdc",24,"UIT4",80,2],["item_miss",26,"UIT4",82,2],["late",22,"UBA1",0,2],["late_gt15",22,"UBA1",0,2],["item_qual",28,"UIL7",84,2],["late",5,"UIT1",1,2],["late",5,"UIT1",16,2],["late_gt15",5,"UIT1",16,2],["late",5,"UIT4",26,2],["item_qual",28,"UIT4",69,2],["ftpdf",29,"UIT4",69,2],["item_qual",28,"UIT4",71,2],["ftfdf",12,"UIT4",33,2],["item_qual",28,"UIT4",43,2],["ftpdf",3,"UIT4",82,2],["item_qual",28,"UIT4",82,2],["late",5,"UBA1",53,2],["late",5,"UIL7",84,2],["late",2,"UIT1",1,2],["late_gt15",2,"UIT1",1,2],["item_miss",26,"UIT1",121,2],["late_gt15",5,"UIT4",69,2],["late_gt15",5,"UIT4",73,2],["late",13,"UIT4",47,2],["item_miss",26,"UIT4",80,2],["ftfdf",17,"UBA1",53,2],["late",5,"UIT4",71,2],["ftfdf",14,"UIT4",75,2],["late_gt15",5,"UIT4",75,2],["late",13,"UIT4",98,2],["ftfdf",14,"UIT4",41,2],["item_qual",28,"UIT4",114,2],["ftpdf",3,"UIT4",80,2],["ftfdf",12,"UIT4",101,2],["late",2,"UIT4",70,2],["ftdc",54,"UIT4",32,2],["late",5,"UIT4",96,2],["item_qual",28,"UIT4",120,2],["ftfdf",17,"UBA1",0,1],["late_gt15",2,"UIL7",4,1],["ftfdf",4,"UIL7",84,1],["late",40,"UIL7",56,1],["item_qual",28,"UIL7",6,1],["ftdc",24,"UIT1",1,1],["ftfdf",17,"UIT1",58,1],["item_qual",28,"UIT1",88,1],["item_qual",28,"UIT4",65,1],["ftfdf",1,"UIT4",65,1],["ftfdf",12,"UIT4",25,1],["late",2,"UIT4",25,1],["ftpdf",9,"UIT4",27,1],["item_qual",28,"UIT4",27,1],["pdnr",34,"UIT4",27,1],["item_qual",28,"UIT4",29,1],["item_qual",28,"UIT4",31,1],["item_qual",28,"UIT4",32,1],["ftpdf",25,"UIT4",75,1],["ftfdf",1,"UIT4",98,1],["item_qual",28,"UIT4",98,1],["pdnr",34,"UIT4",77,1],["ftpdf",29,"UIT4",106,1],["ftfdf",19,"UIT4",80,1],["ftpdf",25,"UIT4",101,1],["ftpdf",25,"UIT4",51,1],["late",2,"UIT4",51,1],["ftfdf",20,"UIT4",51,1],["ftfdf",27,"UIT4",51,1],["late",22,"UBA1",111,1],["late",5,"UIL7",85,1],["item_qual",28,"UIT1",2,1],["late",5,"UIT1",58,1],["late_gt15",5,"UIT1",58,1],["item_qual",28,"UIT1",57,1],["ftfdf",6,"UIT1",90,1],["late",2,"UIT1",64,1],["late_gt15",2,"UIT1",64,1],["pdnr",34,"UIT4",26,1],["late",10,"UIT4",92,1],["ftfdf",14,"UIT4",29,1],["pdnr",34,"UIT4",29,1],["pdnr",42,"UIT4",110,1],["item_miss",26,"UIT4",115,1],["pdnr",34,"UIT4",115,1],["ftfdf",14,"UIT4",30,1],["late",2,"UIT4",32,1],["ftpdf",8,"UIT4",75,1],["fdnr",50,"UIT4",33,1],["pdnr",34,"UIT4",33,1],["ftpdf",8,"UIT4",76,1],["pdnr",37,"UIT4",76,1],["ftfdf",14,"UIT4",77,1],["ftpdf",3,"UIT4",78,1],["item_qual",28,"UIT4",78,1],["ftfdf",14,"UIT4",78,1],["ftfdf",15,"UIT4",46,1],["ftpdf",3,"UIT4",46,1],["late",13,"UIT4",114,1],["item_qual",28,"UIT4",80,1],["pdnr",34,"UIT4",82,1],["ftpdf",25,"UIT4",82,1],["ftpdf",3,"UBA1",0,1],["late",5,"UBA1",0,1],["fdnr",39,"UBA1",0,1],["ftpdf",8,"UIL7",2,1],["late",2,"UIL7",118,1],["late_gt15",2,"UIL7",7,1],["late_gt15",13,"UIT1",9,1],["late",13,"UIT1",4,1],["item_miss",26,"UIT1",60,1],["item_qual",28,"UIT1",60,1],["item_miss",26,"UIT1",85,1],["late",13,"UIT1",88,1],["late",5,"UIT1",109,1],["late_gt15",13,"UIT1",109,1],["late",5,"UIT1",90,1],["late",5,"UIT1",6,1],["item_miss",26,"UIT1",22,1],["late_gt15",13,"UIT1",64,1],["ftpdf",3,"UIT4",26,1],["fdnr",39,"UIT4",73,1],["pdnr",34,"UIT4",78,1],["ftpdf",31,"UIT4",117,1],["late",5,"UIT4",101,1],["ftfdf",14,"UIT4",101,1],["ftpdf",3,"UIT4",49,1],["pdnr",47,"UIT4",51,1],["ftfdf",17,"UBA1",54,1],["ftfdf",6,"UIL7",2,1],["late",2,"UIL7",2,1],["late_gt15",2,"UIL7",2,1],["item_miss",26,"UIL7",85,1],["item_miss",26,"UIL7",6,1],["pdnr",47,"UIL7",6,1],["ftfdf",19,"UIL7",6,1],["ftpdf",9,"UIT1",1,1],["ftfdf",15,"UIT1",58,1],["late",5,"UIT1",121,1],["late",2,"UIT1",121,1],["late_gt15",5,"UIT4",26,1],["ftfdf",6,"UIT4",26,1],["item_miss",26,"UIT4",70,1],["late",5,"UIT4",70,1],["ftfdf",12,"UIT4",70,1],["late",5,"UIT4",115,1],["pdnr",37,"UIT4",31,1],["ftpdf",25,"UIT4",31,1],["pdnr",41,"UIT4",32,1],["ftfdf",6,"UIT4",32,1],["item_qual",28,"UIT4",33,1],["ftpdf",3,"UIT4",33,1],["ftfdf",6,"UIT4",33,1],["late",5,"UIT4",77,1],["late_gt15",5,"UIT4",77,1],["late_gt15",5,"UIT4",107,1],["ftfdf",14,"UIT4",114,1],["pdnr",34,"UIT4",101,1],["late",5,"UIT4",50,1],["late",10,"UIT4",51,1],["ftfdf",15,"UBA1",52,1],["ftfdf",6,"UBA1",53,1],["ftfdf",15,"UBA1",111,1],["ftfdf",6,"UBA1",54,1],["late",13,"UIL7",104,1],["late_gt15",13,"UIL7",104,1],["ftfdf",6,"UIL7",118,1],["item_miss",26,"UIL7",118,1],["late",13,"UIL7",4,1],["late_gt15",13,"UIL7",4,1],["item_qual",28,"UIT1",112,1],["ftfdf",14,"UIT1",112,1],["late",5,"UIT1",60,1],["late_gt15",5,"UIT1",60,1],["item_miss",26,"UIT1",88,1],["pdnr",34,"UIT1",88,1],["item_qual",28,"UIT1",108,1],["pdnr",34,"UIT1",6,1],["ftfdf",14,"UIT1",6,1],["ftfdf",49,"UIT4",26,1],["ftfdf",6,"UIT4",69,1],["ftpdf",29,"UIT4",72,1],["late",18,"UIT4",73,1],["late_gt15",18,"UIT4",73,1],["ftfdf",49,"UIT4",33,1],["pdnr",34,"UIT4",76,1],["item_miss",26,"UIT4",77,1],["ftpdf",3,"UIT4",47,1],["ftfdf",14,"UIT4",47,1],["late_gt15",13,"UIT4",47,1],["late",5,"UIT4",47,1],["late_gt15",5,"UIT4",47,1],["late_gt15",5,"UIT4",48,1],["ftfdf",14,"UIT4",80,1],["ftdc",24,"UIT4",49,1],["late",13,"UIT4",50,1],["ftfdf",15,"UIT4",50,1],["late_gt15",5,"UBA1",53,1],["item_miss",26,"UBA1",54,1],["ftpdf",9,"UIL7",104,1],["item_qual",28,"UIL7",104,1],["late_gt15",5,"UIL7",84,1],["item_miss",26,"UIT1",1,1],["ftfdf",15,"UIT1",1,1],["item_miss",26,"UIT1",113,1],["ftpdf",9,"UIT1",113,1],["ftfdf",14,"UIT1",60,1],["ftfdf",15,"UIT1",108,1],["late",5,"UIT1",57,1],["late_gt15",5,"UIT1",57,1],["ftfdf",27,"UIT1",16,1],["ftfdf",6,"UIT1",16,1],["ftpdf",3,"UIT1",16,1],["ftfdf",14,"UIT1",19,1],["late",18,"UIT1",121,1],["ftfdf",14,"UIT1",64,1],["ftfdf",14,"UIT4",26,1],["ftfdf",21,"UIT4",92,1],["late",13,"UIT4",69,1],["late",13,"UIT4",70,1],["ftpdf",3,"UIT4",70,1],["ftpdf",8,"UIT4",70,1],["pdnr",34,"UIT4",70,1],["late_gt15",5,"UIT4",71,1],["late",13,"UIT4",30,1],["ftfdf",19,"UIT4",30,1],["ftpdf",3,"UIT4",75,1],["ftfdf",17,"UIT4",75,1],["late_gt15",13,"UIT4",98,1],["late_gt15",13,"UIT4",34,1],["late_gt15",5,"UIT4",38,1],["ftpdf",9,"UIT4",43,1],["ftfdf",15,"UIT4",107,1],["ftfdf",27,"UIT4",117,1],["late",2,"UIT4",80,1],["ftfdf",17,"UIT4",101,1],["item_miss",26,"UBA1",53,1],["pdnr",34,"UBA1",54,1],["ftpdf",9,"UIL7",84,1],["ftfdf",14,"UIT1",9,1],["late",5,"UIT1",9,1],["late_gt15",5,"UIT1",9,1],["fdnr",39,"UIT1",9,1],["ftpdf",3,"UIT1",4,1],["item_miss",26,"UIT1",4,1],["ftfdf",14,"UIT1",4,1],["item_qual",28,"UIT1",90,1],["ftfdf",12,"UIT1",64,1],["item_miss",26,"UIT4",23,1],["ftpdf",9,"UIT4",23,1],["late",5,"UIT4",23,1],["ftfdf",17,"UIT4",23,1],["item_miss",26,"UIT4",92,1],["ftfdf",14,"UIT4",70,1],["late_gt15",2,"UIT4",70,1],["ftpdf",46,"UIT4",70,1],["ftfdf",19,"UIT4",70,1],["ftfdf",15,"UIT4",105,1],["item_qual",28,"UIT4",105,1],["item_qual",28,"UIT4",72,1],["late_gt15",5,"UIT4",96,1],["ftpdf",3,"UIT4",76,1],["ftpdf",9,"UIT4",77,1],["item_qual",28,"UIT4",36,1],["ftfdf",14,"UIT4",38,1],["pdnr",47,"UIT4",39,1],["ftfdf",12,"UIT4",106,1],["ftfdf",12,"UIT4",41,1],["ftdc",30,"UIT4",41,1],["ftfdf",15,"UIT4",42,1],["late",2,"UIT4",46,1],["ftpdf",3,"UIT4",107,1],["ftfdf",14,"UIT4",107,1],["pdnr",37,"UIT4",107,1],["ftpdf",8,"UIT4",107,1],["ftpdf",9,"UIT4",117,1],["ftfdf",14,"UIT4",117,1],["item_miss",26,"UIT4",50,1],["ftfdf",14,"UIT4",51,1]]},
"2026-W30":{"o":{"UIT4":2972,"UIT1":1347,"UBA1":406,"UIL7":474},"d":{"UBA1":28,"UIL7":82,"UIT1":100,"UIT4":303},"r":[["late",5,"UIL7",104,11],["late",5,"UIT4",65,10],["late_gt15",5,"UIL7",104,10],["item_miss",26,"UIT4",78,9],["late",2,"UIL7",4,7],["item_miss",26,"UBA1",0,6],["item_miss",26,"UIT1",5,5],["item_miss",26,"UIT4",43,5],["item_miss",26,"UIT4",101,5],["late",5,"UIL7",55,5],["late",5,"UIT1",88,5],["ftfdf",17,"UIT4",98,5],["item_miss",26,"UIT4",50,5],["late",2,"UIL7",104,5],["late",2,"UIL7",56,4],["item_qual",28,"UIT1",22,4],["item_miss",26,"UIT4",68,4],["item_qual",28,"UIT4",78,4],["ftfdf",14,"UIT4",78,4],["late",5,"UIT1",61,4],["item_qual",28,"UIT4",31,4],["late",5,"UIT4",97,4],["item_qual",28,"UIT4",107,4],["item_miss",26,"UIT4",33,4],["late",5,"UIT4",82,4],["late_gt15",2,"UIL7",104,4],["late",5,"UIL7",2,3],["late_gt15",5,"UIL7",2,3],["ftfdf",15,"UIT1",9,3],["item_miss",26,"UIT1",22,3],["late",5,"UIT4",92,3],["pdnr",34,"UIT4",69,3],["item_qual",28,"UIT4",43,3],["item_qual",28,"UIT4",117,3],["late",5,"UIT4",48,3],["item_miss",26,"UBA1",52,3],["late",5,"UIL7",4,3],["late",5,"UIL7",6,3],["late",5,"UIT1",3,3],["late",5,"UIT4",68,3],["item_qual",28,"UIT4",73,3],["fdnr",39,"UIT4",73,3],["item_qual",28,"UIT4",34,3],["item_qual",28,"UIT4",77,3],["late",5,"UIT4",106,3],["item_miss",26,"UIT4",51,3],["pdnr",34,"UIL7",84,3],["late_gt15",5,"UIT1",88,3],["late",5,"UIT1",90,3],["item_qual",28,"UIT4",69,3],["item_qual",28,"UIT4",32,3],["item_qual",28,"UBA1",53,3],["item_miss",26,"UIT1",9,3],["ftfdf",14,"UIT1",88,3],["late",5,"UIT1",64,3],["late",5,"UIT4",77,3],["ftdc",53,"UBA1",52,3],["late",2,"UIT4",96,3],["item_qual",28,"UIT4",96,3],["late",5,"UIT4",96,3],["item_qual",28,"UIT4",48,3],["late_gt15",2,"UIL7",56,3],["item_miss",26,"UIT4",82,3],["item_qual",28,"UIL7",6,2],["late",2,"UIL7",7,2],["item_qual",28,"UIT4",68,2],["ftpdf",3,"UIT4",68,2],["ftfdf",14,"UIT4",92,2],["late",5,"UIT4",69,2],["ftpdf",3,"UIT4",27,2],["item_qual",28,"UIT4",33,2],["ftfdf",6,"UIT4",33,2],["item_miss",26,"UIT4",39,2],["item_qual",28,"UIT4",39,2],["ftpdf",9,"UIT4",43,2],["ftpdf",8,"UIT4",46,2],["ftfdf",15,"UIT4",101,2],["ftpdf",9,"UIT4",101,2],["item_qual",28,"UIT4",101,2],["pdnr",34,"UIT4",101,2],["late_gt15",2,"UIL7",4,2],["late",40,"UIL7",11,2],["late_gt15",5,"UIL7",55,2],["item_qual",28,"UIL7",55,2],["late_gt15",5,"UIL7",6,2],["late_gt15",5,"UIT1",61,2],["item_miss",26,"UIT1",90,2],["late",5,"UIT1",22,2],["item_qual",28,"UIT4",115,2],["item_miss",26,"UIT4",30,2],["ftpdf",3,"UIT4",73,2],["item_miss",26,"UIT4",73,2],["item_qual",28,"UBA1",0,2],["item_qual",28,"UIL7",2,2],["ftpdf",3,"UIT1",58,2],["late",13,"UIT1",88,2],["pdnr",34,"UIT1",16,2],["item_qual",28,"UIT1",5,2],["late_gt15",5,"UIT1",90,2],["late",13,"UIT1",90,2],["late_gt15",5,"UIT4",65,2],["ftfdf",17,"UIT4",26,2],["item_miss",26,"UIT4",69,2],["ftfdf",14,"UIT4",30,2],["pdnr",34,"UIT4",33,2],["ftfdf",12,"UIT4",43,2],["pdnr",34,"UIT4",43,2],["ftfdf",12,"UIT4",117,2],["item_qual",28,"UBA1",52,2],["ftfdf",14,"UBA1",52,2],["late",5,"UIL7",56,2],["late_gt15",5,"UIL7",56,2],["pdnr",34,"UIT1",9,2],["item_qual",28,"UIT1",61,2],["late",5,"UIT1",19,2],["pdnr",34,"UIT4",73,2],["item_miss",26,"UIT4",107,2],["item_qual",28,"UIL7",84,2],["late",13,"UIT1",61,2],["late_gt15",13,"UIT1",61,2],["item_qual",28,"UIT4",92,2],["item_miss",26,"UIT4",92,2],["late_gt15",5,"UIT4",96,2],["ftfdf",17,"UIT4",99,2],["ftfdf",6,"UIT4",99,2],["item_miss",26,"UIT4",38,2],["item_miss",26,"UIT4",48,2],["pdnr",43,"UIT4",80,2],["item_qual",28,"UIT4",49,2],["late",2,"UIT4",49,2],["pdnr",34,"UIT4",50,2],["item_qual",28,"UIL7",104,2],["late",5,"UIT1",9,2],["item_qual",28,"UIT4",29,2],["item_qual",28,"UIT4",46,2],["item_qual",28,"UIT4",82,2],["item_qual",28,"UIT1",90,2],["item_miss",26,"UIT4",45,2],["pdnr",34,"UBA1",0,1],["ftfdf",17,"UIL7",2,1],["item_miss",26,"UIL7",4,1],["pdnr",34,"UIL7",4,1],["late",2,"UIL7",61,1],["item_miss",26,"UIL7",61,1],["late",10,"UIL7",61,1],["pdnr",34,"UIL7",6,1],["ftfdf",15,"UIL7",7,1],["ftfdf",6,"UIT1",3,1],["ftfdf",15,"UIT1",14,1],["late",2,"UIT1",5,1],["pdnr",34,"UIT1",5,1],["pdnr",34,"UIT1",22,1],["item_miss",26,"UIT4",25,1],["ftpdf",8,"UIT4",68,1],["late_gt15",5,"UIT4",92,1],["item_miss",26,"UIT4",27,1],["ftfdf",15,"UIT4",30,1],["ftdc",24,"UIT4",46,1],["ftpdf",25,"UIT4",48,1],["ftfdf",12,"UIT4",101,1],["ftfdf",19,"UIT4",49,1],["ftfdf",15,"UIT4",49,1],["late",5,"UIT4",51,1],["late_gt15",5,"UIL7",4,1],["late_gt15",40,"UIL7",11,1],["ftfdf",1,"UIL7",55,1],["ftfdf",35,"UIL7",7,1],["item_miss",26,"UIL7",7,1],["item_qual",28,"UIT1",3,1],["item_miss",26,"UIT1",61,1],["late",5,"UIT1",14,1],["late_gt15",5,"UIT1",22,1],["ftfdf",14,"UIT4",68,1],["pdnr",34,"UIT4",27,1],["ftfdf",12,"UIT4",27,1],["ftfdf",6,"UIT4",27,1],["ftfdf",33,"UIT4",110,1],["item_miss",26,"UIT4",110,1],["item_miss",26,"UIT4",115,1],["ftpdf",29,"UIT4",30,1],["item_miss",26,"UIT4",31,1],["item_qual",28,"UIT4",97,1],["item_qual",28,"UIT4",98,1],["late",2,"UIT4",34,1],["late",2,"UIT4",77,1],["pdnr",34,"UIT4",99,1],["item_miss",26,"UIT4",99,1],["ftpdf",3,"UIT4",38,1],["ftfdf",14,"UIT4",38,1],["late",13,"UIT4",38,1],["late",2,"UIT4",106,1],["late",18,"UIT4",106,1],["late",5,"UIT4",107,1],["fdnr",50,"UIT4",117,1],["item_qual",28,"UIT4",80,1],["pdnr",34,"UIT4",80,1],["ftfdf",6,"UIT4",101,1],["late",2,"UIT4",50,1],["late_gt15",2,"UIT4",50,1],["item_qual",28,"UIT4",50,1],["ftpdf",9,"UBA1",0,1],["ftfdf",17,"UBA1",54,1],["ftfdf",15,"UBA1",54,1],["ftfdf",14,"UIL7",2,1],["ftfdf",1,"UIL7",2,1],["ftfdf",14,"UIL7",4,1],["item_miss",26,"UIL7",84,1],["late",5,"UIL7",84,1],["late_gt15",5,"UIL7",84,1],["ftpdf",3,"UIL7",7,1],["ftfdf",14,"UIT1",3,1],["ftdc",24,"UIT1",3,1],["fdnr",50,"UIT1",86,1],["item_qual",28,"UIT1",113,1],["pdnr",34,"UIT1",61,1],["ftfdf",14,"UIT1",61,1],["ftfdf",49,"UIT1",16,1],["item_qual",28,"UIT4",65,1],["ftfdf",14,"UIT4",31,1],["ftfdf",15,"UIT4",72,1],["item_qual",28,"UIT4",72,1],["ftfdf",15,"UIT4",32,1],["ftfdf",12,"UIT4",33,1],["ftfdf",15,"UIT4",33,1],["late",5,"UIT4",38,1],["item_miss",26,"UIT4",46,1],["fdnr",39,"UIT4",50,1],["item_qual",28,"UIT4",51,1],["ftfdf",15,"UIT4",51,1],["ftfdf",19,"UIL7",104,1],["ftfdf",1,"UIL7",104,1],["ftpdf",3,"UIL7",55,1],["late",2,"UIL7",55,1],["item_miss",26,"UIT1",3,1],["pdnr",41,"UIT1",3,1],["item_miss",26,"UIT1",88,1],["item_qual",28,"UIT1",88,1],["item_miss",26,"UIT1",14,1],["item_miss",26,"UIT1",62,1],["late",5,"UIT1",121,1],["ftfdf",14,"UIT1",22,1],["item_miss",26,"UIT1",64,1],["item_miss",26,"UIT4",65,1],["ftfdf",6,"UIT4",68,1],["ftfdf",17,"UIT4",68,1],["ftfdf",12,"UIT4",69,1],["ftfdf",15,"UIT4",69,1],["pdnr",34,"UIT4",31,1],["ftpdf",0,"UIT4",72,1],["late",2,"UIT4",73,1],["ftfdf",6,"UIT4",98,1],["ftfdf",14,"UIT4",76,1],["item_qual",28,"UIT4",76,1],["fdnr",39,"UIT4",114,1],["ftpdf",29,"UIT4",114,1],["item_miss",26,"UIT4",117,1],["ftfdf",14,"UIT4",117,1],["pdnr",47,"UBA1",0,1],["item_miss",26,"UBA1",54,1],["ftfdf",15,"UIL7",2,1],["ftfdf",33,"UIT1",19,1],["item_qual",28,"UIT1",19,1],["late",13,"UIT1",19,1],["late_gt15",13,"UIT1",19,1],["ftfdf",6,"UIT1",64,1],["late",2,"UIT4",65,1],["item_miss",26,"UIT4",26,1],["ftfdf",15,"UIT4",27,1],["ftpdf",25,"UIT4",27,1],["ftfdf",14,"UIT4",29,1],["ftfdf",35,"UIT4",32,1],["late_gt15",2,"UIT4",96,1],["ftfdf",12,"UIT4",97,1],["late",5,"UIT4",34,1],["ftpdf",8,"UIT4",77,1],["ftfdf",27,"UIT4",99,1],["ftpdf",31,"UIT4",99,1],["ftfdf",15,"UIT4",38,1],["late",5,"UIT4",80,1],["ftpdf",25,"UIT4",49,1],["late_gt15",2,"UIT4",49,1],["ftfdf",14,"UIT4",50,1],["ftfdf",12,"UIT4",50,1],["item_miss",26,"UBA1",53,1],["item_miss",26,"UIL7",104,1],["late",2,"UIL7",2,1],["ftdc",23,"UIL7",56,1],["ftfdf",14,"UIL7",56,1],["pdnr",34,"UIT1",3,1],["ftfdf",49,"UIT1",3,1],["ftpdf",3,"UIT1",9,1],["pdnr",38,"UIT1",9,1],["ftfdf",6,"UIT1",9,1],["ftfdf",14,"UIT1",113,1],["fdnr",39,"UIT1",61,1],["late",13,"UIT1",16,1],["ftpdf",25,"UIT1",16,1],["late",2,"UIT1",16,1],["ftfdf",6,"UIT1",16,1],["late_gt15",5,"UIT1",64,1],["late",10,"UIT4",65,1],["item_qual",28,"UIT4",26,1],["ftdc",24,"UIT4",69,1],["ftpdf",3,"UIT4",69,1],["late",2,"UIT4",69,1],["late",5,"UIT4",29,1],["ftfdf",19,"UIT4",30,1],["item_miss",26,"UIT4",32,1],["ftpdf",8,"UIT4",96,1],["ftpdf",9,"UIT4",33,1],["ftfdf",12,"UIT4",98,1],["ftfdf",12,"UIT4",76,1],["ftpdf",3,"UIT4",76,1],["item_miss",26,"UIT4",76,1],["pdnr",34,"UIT4",76,1],["item_miss",26,"UIT4",77,1],["pdnr",34,"UIT4",39,1],["late",5,"UIT4",43,1],["pdnr",34,"UIT4",48,1],["ftfdf",14,"UIT4",80,1],["pdnr",41,"UIT4",82,1],["ftpdf",8,"UBA1",111,1],["item_qual",28,"UBA1",111,1],["item_miss",26,"UIL7",2,1],["item_qual",28,"UIL7",56,1],["item_miss",26,"UIL7",6,1],["ftfdf",14,"UIL7",7,1],["ftfdf",12,"UIT1",9,1],["ftfdf",14,"UIT1",14,1],["item_qual",28,"UIT1",57,1],["ftpdf",8,"UIT1",16,1],["item_miss",26,"UIT1",19,1],["ftfdf",15,"UIT1",64,1],["ftfdf",12,"UIT4",25,1],["ftpdf",9,"UIT4",69,1],["pdnr",38,"UIT4",27,1],["item_qual",28,"UIT4",27,1],["ftfdf",15,"UIT4",31,1],["late_gt15",5,"UIT4",97,1],["ftfdf",27,"UIT4",97,1],["ftfdf",1,"UIT4",76,1],["item_miss",26,"UIT4",106,1],["late_gt15",5,"UIT4",106,1],["late",5,"UIT4",45,1],["late_gt15",5,"UIT4",45,1],["pdnr",37,"UIT4",46,1],["ftpdf",9,"UIT4",46,1],["ftpdf",3,"UIT4",46,1],["ftpdf",9,"UIT4",107,1],["ftfdf",17,"UIT4",107,1],["fdnr",39,"UIT4",80,1],["ftfdf",14,"UIT4",101,1],["ftfdf",17,"UIT4",101,1],["pdnr",34,"UIT4",82,1],["ftpdf",3,"UIT4",82,1],["ftfdf",49,"UIT4",51,1]]},
"2026-W31":{"o":{"UIT4":2813,"UIT1":1273,"UBA1":433,"UIL7":523},"d":{"UBA1":37,"UIL7":83,"UIT1":82,"UIT4":293},"r":[["item_miss",26,"UBA1",0,14],["late",5,"UIT4",82,9],["late",5,"UIL7",4,8],["late",5,"UIT4",65,8],["item_miss",26,"UIT4",33,7],["late",2,"UIL7",56,7],["item_miss",26,"UIT4",78,7],["item_miss",26,"UIT4",110,7],["item_miss",26,"UIT4",106,6],["late_gt15",2,"UIL7",56,6],["late_gt15",5,"UIL7",4,5],["late",5,"UIL7",6,5],["item_miss",26,"UIT4",43,5],["late",5,"UIL7",104,5],["item_miss",26,"UIT4",45,5],["late",5,"UIT4",48,5],["late",5,"UIT4",42,5],["late",13,"UIL7",56,4],["late_gt15",13,"UIL7",56,4],["item_miss",26,"UIT4",97,4],["item_qual",28,"UIT4",33,4],["pdnr",43,"UBA1",0,4],["late_gt15",5,"UIT4",65,4],["late_gt15",5,"UIT4",82,4],["item_miss",26,"UIL7",2,4],["item_qual",28,"UIT4",48,4],["late",5,"UIL7",2,4],["late",40,"UIL7",84,4],["late_gt15",40,"UIL7",84,4],["late_gt15",5,"UIL7",6,3],["item_qual",28,"UIT1",57,3],["late",5,"UIT1",90,3],["item_miss",26,"UIT4",27,3],["late",5,"UIT4",70,3],["late",5,"UIT4",40,3],["item_miss",26,"UIT4",42,3],["item_qual",28,"UIT4",80,3],["ftfdf",12,"UIT4",101,3],["ftfdf",14,"UIT4",101,3],["item_qual",28,"UIT4",101,3],["late_gt15",5,"UIL7",104,3],["item_miss",26,"UIL7",55,3],["late",5,"UIT1",3,3],["late",5,"UIT1",61,3],["item_qual",28,"UIT4",107,3],["item_miss",26,"UIT4",107,3],["item_miss",26,"UBA1",111,3],["item_qual",28,"UBA1",0,3],["item_qual",28,"UIT1",8,3],["item_miss",26,"UIT1",22,3],["late",2,"UIT4",70,3],["item_qual",28,"UIT4",76,3],["item_qual",28,"UIT4",117,3],["item_qual",28,"UIT4",82,3],["item_miss",26,"UIT4",31,3],["item_miss",26,"UIT4",73,3],["late_gt15",5,"UIT4",42,3],["late",40,"UIL7",118,3],["late",5,"UIT4",31,3],["late",2,"UIL7",7,3],["item_miss",26,"UBA1",54,2],["ftfdf",19,"UIL7",6,2],["item_qual",28,"UIT1",14,2],["late_gt15",5,"UIT1",90,2],["item_miss",26,"UIT4",39,2],["ftpdf",9,"UIT4",101,2],["pdnr",34,"UIT4",50,2],["pdnr",34,"UBA1",0,2],["late",5,"UIL7",89,2],["late_gt15",5,"UIL7",89,2],["late",5,"UIL7",91,2],["late_gt15",5,"UIL7",91,2],["ftfdf",15,"UIT1",9,2],["ftfdf",14,"UIT1",22,2],["pdnr",43,"UIT4",27,2],["pdnr",34,"UIT4",27,2],["late",5,"UIT4",33,2],["item_miss",26,"UIT4",40,2],["late",5,"UIT4",45,2],["ftfdf",17,"UIT4",46,2],["item_qual",28,"UIT4",120,2],["late_gt15",5,"UIT4",48,2],["item_miss",26,"UIT4",80,2],["item_miss",26,"UIT4",101,2],["ftfdf",15,"UIT4",101,2],["item_miss",26,"UIT4",25,2],["late",2,"UIT4",97,2],["ftfdf",14,"UIT4",77,2],["ftfdf",15,"UIT4",77,2],["ftfdf",14,"UIT4",107,2],["ftfdf",49,"UIT4",80,2],["item_miss",26,"UIT1",57,2],["ftfdf",14,"UIT4",92,2],["item_qual",28,"UIT4",31,2],["late",5,"UIT4",117,2],["late_gt15",5,"UIT4",117,2],["ftfdf",12,"UIT4",117,2],["late",2,"UIT4",48,2],["item_qual",28,"UIT4",49,2],["pdnr",34,"UIT4",82,2],["late_gt15",5,"UIL7",2,2],["ftfdf",6,"UIL7",118,2],["late_gt15",40,"UIL7",118,2],["ftfdf",14,"UIT1",60,2],["item_miss",26,"UIT1",5,2],["late",5,"UIT1",62,2],["item_miss",26,"UIT4",68,2],["item_qual",28,"UIT4",92,2],["item_miss",26,"UIT4",92,2],["late_gt15",5,"UIT4",31,2],["ftfdf",14,"UIT4",117,2],["ftfdf",49,"UIT4",50,2],["late",2,"UIL7",84,2],["late",18,"UIL7",56,2],["late_gt15",18,"UIL7",56,2],["pdnr",43,"UIT4",110,2],["pdnr",43,"UIT4",78,2],["ftfdf",12,"UIT4",43,2],["item_miss",26,"UBA1",52,1],["pdnr",32,"UBA1",53,1],["ftpdf",0,"UBA1",54,1],["pdnr",48,"UIL7",4,1],["ftfdf",6,"UIL7",56,1],["ftpdf",8,"UIL7",56,1],["pdnr",37,"UIL7",56,1],["pdnr",47,"UIL7",6,1],["pdnr",34,"UIL7",6,1],["ftfdf",7,"UIT1",3,1],["ftfdf",14,"UIT1",14,1],["item_miss",26,"UIT1",90,1],["ftpdf",25,"UIT1",62,1],["item_qual",28,"UIT1",64,1],["ftfdf",14,"UIT4",30,1],["ftfdf",15,"UIT4",30,1],["pdnr",34,"UIT4",96,1],["late",5,"UIT4",96,1],["item_qual",28,"UIT4",97,1],["pdnr",34,"UIT4",33,1],["ftfdf",17,"UIT4",33,1],["pdnr",34,"UIT4",106,1],["ftfdf",15,"UIT4",106,1],["ftfdf",19,"UIT4",40,1],["ftfdf",12,"UIT4",42,1],["late",5,"UIT4",114,1],["pdnr",34,"UIT4",80,1],["late",5,"UIT4",80,1],["ftfdf",49,"UIT4",101,1],["ftpdf",8,"UIT4",101,1],["item_miss",26,"UIT4",49,1],["late",10,"UIT4",50,1],["ftpdf",3,"UBA1",52,1],["item_qual",28,"UIL7",55,1],["ftfdf",4,"UIL7",5,1],["ftfdf",6,"UIL7",91,1],["late_gt15",5,"UIT1",3,1],["item_miss",26,"UIT1",3,1],["late",5,"UIT1",9,1],["late_gt15",5,"UIT1",9,1],["fdnr",50,"UIT1",60,1],["late",5,"UIT1",60,1],["late_gt15",5,"UIT1",60,1],["ftpdf",25,"UIT1",60,1],["item_qual",28,"UIT1",108,1],["late_gt15",5,"UIT1",61,1],["ftfdf",12,"UIT1",16,1],["item_qual",28,"UIT1",90,1],["ftfdf",6,"UIT1",22,1],["ftfdf",17,"UIT1",64,1],["ftfdf",15,"UIT1",64,1],["late",5,"UIT4",115,1],["ftfdf",15,"UIT4",33,1],["ftfdf",6,"UIT4",33,1],["ftfdf",19,"UIT4",33,1],["late_gt15",5,"UIT4",33,1],["late",5,"UIT4",98,1],["ftfdf",19,"UIT4",76,1],["ftfdf",15,"UIT4",43,1],["ftdc",24,"UIT4",46,1],["pdnr",34,"UIT4",47,1],["late",5,"UIT4",120,1],["ftfdf",6,"UIT4",120,1],["ftfdf",35,"UIT4",80,1],["late",2,"UIT4",80,1],["ftpdf",3,"UIT4",101,1],["pdnr",47,"UIT4",101,1],["late",5,"UIT4",49,1],["item_qual",28,"UBA1",52,1],["pdnr",34,"UBA1",111,1],["ftpdf",8,"UBA1",111,1],["fdnr",39,"UBA1",0,1],["ftpdf",9,"UBA1",0,1],["late",5,"UIL7",56,1],["ftfdf",12,"UIT1",60,1],["item_miss",26,"UIT1",60,1],["item_qual",28,"UIT1",60,1],["ftfdf",1,"UIT1",61,1],["ftfdf",6,"UIT1",61,1],["late",10,"UIT1",14,1],["late",2,"UIT1",57,1],["ftpdf",9,"UIT1",6,1],["item_qual",28,"UIT1",6,1],["pdnr",34,"UIT1",22,1],["item_qual",28,"UIT4",65,1],["late",10,"UIT4",65,1],["ftfdf",15,"UIT4",65,1],["item_qual",28,"UIT4",23,1],["pdnr",48,"UIT4",25,1],["late_gt15",2,"UIT4",70,1],["late",2,"UIT4",30,1],["item_miss",26,"UIT4",30,1],["late",2,"UIT4",31,1],["late_gt15",2,"UIT4",97,1],["pdnr",34,"UIT4",97,1],["ftfdf",17,"UIT4",97,1],["ftfdf",14,"UIT4",97,1],["ftfdf",14,"UIT4",33,1],["late",5,"UIT4",36,1],["late_gt15",5,"UIT4",36,1],["ftfdf",12,"UIT4",106,1],["item_qual",28,"UIT4",40,1],["ftpdf",29,"UIT4",46,1],["ftfdf",14,"UIT4",49,1],["ftfdf",17,"UIT4",82,1],["ftpdf",46,"UBA1",54,1],["late",2,"UIL7",104,1],["pdnr",34,"UIL7",2,1],["ftpdf",3,"UIL7",2,1],["pdnr",38,"UIL7",2,1],["pdnr",34,"UIL7",56,1],["ftfdf",49,"UIL7",6,1],["ftpdf",9,"UIT1",9,1],["item_qual",28,"UIT1",9,1],["late",5,"UIT1",121,1],["late_gt15",5,"UIT1",121,1],["item_qual",28,"UIT1",121,1],["late",5,"UIT1",64,1],["late",2,"UIT4",23,1],["late",2,"UIT4",92,1],["ftfdf",6,"UIT4",27,1],["ftfdf",14,"UIT4",110,1],["item_qual",28,"UIT4",73,1],["late",2,"UIT4",76,1],["ftfdf",19,"UIT4",78,1],["ftpdf",25,"UIT4",39,1],["pdnr",34,"UIT4",39,1],["late",2,"UIT4",107,1],["ftfdf",12,"UIT4",120,1],["item_qual",28,"UIT4",114,1],["ftfdf",14,"UIT4",114,1],["late",5,"UIT4",101,1],["item_qual",28,"UBA1",111,1],["ftfdf",19,"UBA1",54,1],["late",13,"UBA1",54,1],["late_gt15",13,"UBA1",54,1],["late",22,"UBA1",54,1],["item_miss",26,"UIL7",118,1],["ftfdf",14,"UIL7",84,1],["item_miss",26,"UIL7",84,1],["item_qual",28,"UIL7",84,1],["late",5,"UIT1",8,1],["item_miss",26,"UIT1",8,1],["pdnr",34,"UIT1",8,1],["late",2,"UIT1",60,1],["item_miss",26,"UIT1",14,1],["pdnr",34,"UIT1",5,1],["late",10,"UIT1",90,1],["late_gt15",10,"UIT1",90,1],["item_qual",28,"UIT1",19,1],["ftfdf",14,"UIT1",19,1],["item_qual",28,"UIT1",62,1],["ftfdf",15,"UIT1",121,1],["ftpdf",3,"UIT4",25,1],["pdnr",38,"UIT4",25,1],["item_qual",28,"UIT4",25,1],["ftpdf",3,"UIT4",92,1],["ftfdf",14,"UIT4",27,1],["item_miss",26,"UIT4",70,1],["pdnr",42,"UIT4",110,1],["late",5,"UIT4",73,1],["late_gt15",5,"UIT4",73,1],["item_qual",28,"UIT4",96,1],["ftpdf",25,"UIT4",97,1],["ftpdf",9,"UIT4",33,1],["pdnr",34,"UIT4",46,1],["ftpdf",8,"UIT4",107,1],["pdnr",37,"UIT4",107,1],["ftfdf",15,"UIT4",114,1],["item_miss",26,"UIT4",117,1],["ftfdf",14,"UIT4",50,1],["ftpdf",9,"UBA1",52,1],["ftfdf",14,"UBA1",54,1],["item_miss",26,"UIL7",4,1],["late",18,"UIL7",4,1],["ftpdf",31,"UIL7",4,1],["item_miss",26,"UIL7",6,1],["fdnr",50,"UIT1",1,1],["ftfdf",6,"UIT1",14,1],["late",5,"UIT1",57,1],["pdnr",47,"UIT1",5,1],["ftpdf",3,"UIT1",90,1],["ftfdf",14,"UIT1",62,1],["late",2,"UIT1",121,1],["item_qual",28,"UIT1",22,1],["late",18,"UIT4",68,1],["ftfdf",14,"UIT4",70,1],["pdnr",34,"UIT4",31,1],["late",18,"UIT4",32,1],["item_qual",28,"UIT4",32,1],["ftfdf",12,"UIT4",33,1],["late",5,"UIT4",34,1],["pdnr",34,"UIT4",78,1],["late",5,"UIT4",78,1],["item_qual",28,"UIT4",38,1],["late",5,"UIT4",38,1],["late",5,"UIT4",106,1],["late_gt15",5,"UIT4",106,1],["late_gt15",5,"UIT4",40,1],["fdnr",39,"UIT4",42,1],["pdnr",34,"UIT4",42,1],["ftpdf",25,"UIT4",43,1],["ftpdf",3,"UIT4",45,1],["pdnr",34,"UIT4",45,1],["late",5,"UIT4",46,1],["late_gt15",5,"UIT4",46,1],["ftfdf",12,"UIT4",46,1],["ftfdf",15,"UIT4",46,1],["item_qual",28,"UIT4",46,1],["ftfdf",15,"UIT4",117,1],["ftfdf",6,"UIT4",48,1],["ftfdf",15,"UIT4",48,1],["item_miss",26,"UIT4",50,1],["item_miss",26,"UIT4",82,1],["pdnr",43,"UIT4",82,1],["ftpdf",3,"UIT4",82,1],["pdnr",38,"UIT4",82,1],["ftfdf",15,"UIL7",104,1],["late",10,"UIL7",104,1],["late_gt15",2,"UIL7",84,1],["item_miss",26,"UIL7",56,1],["ftpdf",36,"UIL7",56,1],["ftpdf",3,"UIT1",3,1],["ftpdf",9,"UIT1",3,1],["pdnr",34,"UIT1",60,1],["pdnr",34,"UIT1",61,1],["item_qual",28,"UIT1",61,1],["item_qual",28,"UIT1",5,1],["item_miss",26,"UIT4",65,1],["pdnr",34,"UIT4",68,1],["fdnr",50,"UIT4",71,1],["item_qual",28,"UIT4",71,1],["item_qual",28,"UIT4",110,1],["ftpdf",8,"UIT4",73,1],["fdnr",39,"UIT4",73,1],["ftfdf",12,"UIT4",97,1],["ftfdf",12,"UIT4",98,1],["ftfdf",14,"UIT4",98,1],["late",2,"UIT4",78,1],["item_miss",26,"UIT4",38,1],["pdnr",34,"UIT4",43,1],["late",2,"UIT4",43,1],["late_gt15",2,"UIT4",43,1],["pdnr",38,"UIT4",43,1],["ftpdf",25,"UIT4",45,1],["ftpdf",8,"UIT4",82,1]]},
"2026-W32":{"o":{"UIT4":2211,"UIT1":1006,"UBA1":340,"UIL7":435},"d":{"UBA1":30,"UIL7":62,"UIT1":91,"UIT4":259},"r":[["late",5,"UIT4",70,14],["late",5,"UIT4",65,14],["item_miss",26,"UBA1",0,13],["late_gt15",5,"UIT4",70,8],["late",2,"UIL7",2,7],["item_miss",26,"UIT4",101,7],["late",5,"UIT1",61,6],["item_qual",28,"UIT1",61,6],["item_qual",28,"UIT4",117,5],["late",5,"UIT4",82,5],["ftfdf",6,"UIT4",33,5],["late",13,"UIT1",64,5],["item_qual",28,"UIT4",76,5],["late_gt15",5,"UIT4",65,5],["late",5,"UIT4",101,5],["late_gt15",2,"UIL7",2,4],["late",40,"UIL7",6,4],["late_gt15",40,"UIL7",6,4],["item_miss",26,"UIT1",13,4],["item_qual",28,"UIT4",119,4],["item_miss",26,"UIT4",82,4],["item_miss",26,"UIL7",118,4],["late",2,"UIL7",84,4],["item_miss",26,"UIT4",97,4],["late",5,"UIT4",42,4],["item_miss",26,"UIT4",45,4],["late",5,"UIT4",49,4],["ftfdf",49,"UIT1",14,4],["item_miss",26,"UIT4",119,4],["late",5,"UIT4",36,4],["late",13,"UIT1",104,4],["late",2,"UIL7",6,4],["item_miss",26,"UBA1",53,3],["item_qual",28,"UBA1",0,3],["late",5,"UIL7",84,3],["item_miss",26,"UIT1",3,3],["item_qual",28,"UIT1",13,3],["item_miss",26,"UIT1",61,3],["ftfdf",12,"UIT4",119,3],["item_miss",26,"UIT4",105,3],["late",5,"UIT4",45,3],["item_qual",28,"UIT4",47,3],["item_miss",26,"UIT4",117,3],["ftfdf",15,"UIT4",117,3],["ftpdf",9,"UIT4",101,3],["item_qual",28,"UIT4",82,3],["item_qual",28,"UIL7",118,3],["item_miss",26,"UIL7",56,3],["late",5,"UIT1",8,3],["late_gt15",5,"UIT1",61,3],["item_qual",28,"UIT4",30,3],["ftfdf",14,"UIT4",32,3],["item_miss",26,"UIT4",32,3],["item_miss",26,"UIT4",41,3],["item_qual",28,"UIT1",14,3],["late_gt15",13,"UIT1",64,3],["late",5,"UIT1",64,3],["item_qual",28,"UIT4",27,3],["late_gt15",5,"UIT4",36,3],["item_miss",26,"UIT4",106,3],["ftfdf",14,"UIT1",57,3],["ftfdf",14,"UIT4",101,3],["pdnr",43,"UIT4",101,3],["late",2,"UIL7",104,3],["ftfdf",14,"UBA1",111,2],["late_gt15",5,"UIL7",84,2],["late",2,"UIL7",85,2],["item_qual",28,"UIL7",6,2],["item_qual",28,"UIT1",8,2],["pdnr",34,"UIT1",13,2],["ftpdf",25,"UIT4",119,2],["ftfdf",14,"UIT4",119,2],["ftpdf",3,"UIT4",29,2],["ftfdf",14,"UIT4",29,2],["item_miss",26,"UIT4",30,2],["item_qual",28,"UIT4",73,2],["pdnr",34,"UIT4",40,2],["late",2,"UIL7",118,2],["item_miss",26,"UIL7",84,2],["late_gt15",5,"UIT1",8,2],["ftfdf",12,"UIT1",57,2],["item_miss",26,"UIT1",64,2],["ftpdf",3,"UIT4",70,2],["item_qual",28,"UIT4",72,2],["item_qual",28,"UIT4",40,2],["late_gt15",5,"UIT4",42,2],["pdnr",34,"UBA1",0,2],["ftfdf",15,"UIT1",8,2],["item_qual",28,"UIT1",64,2],["item_miss",26,"UIT4",25,2],["late",5,"UIT4",27,2],["item_miss",26,"UIT4",27,2],["pdnr",34,"UIT4",72,2],["item_qual",28,"UIT4",97,2],["pdnr",43,"UIT4",97,2],["item_qual",28,"UIT4",33,2],["item_qual",28,"UIT4",38,2],["ftfdf",12,"UIT4",47,2],["item_miss",26,"UIT4",47,2],["ftfdf",14,"UBA1",52,2],["late",5,"UIL7",104,2],["late",5,"UIT1",4,2],["ftfdf",6,"UIT4",65,2],["ftfdf",17,"UIT4",65,2],["late",2,"UIT4",41,2],["late_gt15",2,"UIT4",41,2],["item_qual",28,"UIT4",114,2],["late_gt15",2,"UIL7",84,2],["late",5,"UIT1",1,2],["late_gt15",13,"UIT1",104,2],["ftfdf",14,"UIT4",30,2],["item_miss",26,"UIT4",72,2],["item_qual",28,"UIT4",106,2],["ftfdf",12,"UIT4",117,2],["late_gt15",5,"UIT4",101,2],["item_qual",28,"UIT4",49,2],["pdnr",34,"UIT1",1,2],["late",5,"UIT1",60,2],["late",2,"UIT1",19,2],["late",13,"UIT1",19,2],["late_gt15",13,"UIT1",19,2],["pdnr",43,"UIT4",119,2],["ftfdf",14,"UIT4",76,2],["late",18,"UIT4",82,2],["item_qual",28,"UBA1",111,2],["late_gt15",2,"UIL7",6,2],["ftfdf",17,"UIT4",45,2],["item_qual",28,"UIT4",101,2],["ftpdf",9,"UBA1",0,1],["item_miss",26,"UIL7",2,1],["late_gt15",2,"UIL7",85,1],["ftfdf",15,"UIL7",85,1],["ftfdf",49,"UIL7",6,1],["fdnr",39,"UIL7",6,1],["item_miss",26,"UIL7",7,1],["ftfdf",15,"UIT1",1,1],["ftfdf",4,"UIT1",8,1],["item_qual",28,"UIT4",25,1],["pdnr",38,"UIT4",29,1],["item_qual",28,"UIT4",34,1],["item_qual",28,"UIT4",39,1],["ftfdf",14,"UIT4",41,1],["ftfdf",14,"UIT4",45,1],["ftpdf",52,"UIT4",117,1],["ftfdf",14,"UIT4",117,1],["ftpdf",8,"UIT4",82,1],["ftpdf",25,"UIT4",82,1],["pdnr",47,"UIT4",82,1],["late_gt15",5,"UIT4",82,1],["ftfdf",15,"UBA1",0,1],["ftpdf",3,"UIL7",56,1],["late",2,"UIT1",104,1],["late",5,"UIT1",104,1],["item_qual",28,"UIT1",108,1],["ftfdf",6,"UIT1",61,1],["pdnr",45,"UIT1",61,1],["fdnr",39,"UIT1",64,1],["item_miss",26,"UIT4",70,1],["pdnr",34,"UIT4",73,1],["ftpdf",3,"UIT4",97,1],["ftpdf",3,"UIT4",34,1],["late",5,"UIT4",41,1],["late_gt15",5,"UIT4",41,1],["fdnr",50,"UIT4",101,1],["item_miss",26,"UIT4",50,1],["item_qual",28,"UIT4",50,1],["late",18,"UIL7",56,1],["late_gt15",18,"UIL7",56,1],["late",5,"UIT1",3,1],["late_gt15",5,"UIT1",3,1],["item_qual",28,"UIT1",19,1],["ftpdf",8,"UIT4",25,1],["pdnr",34,"UIT4",25,1],["ftfdf",14,"UIT4",25,1],["ftfdf",49,"UIT4",25,1],["ftfdf",17,"UIT4",25,1],["ftpdf",9,"UIT4",27,1],["fdnr",39,"UIT4",105,1],["ftfdf",14,"UIT4",97,1],["ftfdf",17,"UIT4",33,1],["ftfdf",12,"UIT4",33,1],["ftfdf",12,"UIT4",76,1],["item_miss",26,"UIT4",76,1],["ftfdf",14,"UIT4",38,1],["ftfdf",14,"UIT4",106,1],["ftfdf",14,"UIT4",40,1],["ftfdf",6,"UIT4",114,1],["late_gt15",5,"UIL7",104,1],["item_qual",28,"UIL7",104,1],["late",2,"UIL7",56,1],["late_gt15",2,"UIL7",56,1],["late",5,"UIL7",7,1],["late_gt15",5,"UIT1",4,1],["ftfdf",17,"UIT1",57,1],["item_qual",28,"UIT1",57,1],["late",10,"UIT1",6,1],["item_qual",28,"UIT4",65,1],["ftfdf",19,"UIT4",119,1],["pdnr",48,"UIT4",27,1],["pdnr",34,"UIT4",70,1],["item_qual",28,"UIT4",32,1],["late",5,"UIT4",33,1],["late",2,"UIT4",76,1],["late_gt15",2,"UIT4",76,1],["item_miss",26,"UIT4",39,1],["late",5,"UIT4",114,1],["ftfdf",17,"UIT4",101,1],["fdnr",39,"UIT4",101,1],["fdnr",39,"UIT4",49,1],["ftpdf",9,"UIT4",82,1],["pdnr",41,"UIT4",82,1],["late",5,"UBA1",0,1],["ftfdf",19,"UIL7",118,1],["late_gt15",2,"UIL7",118,1],["fdnr",39,"UIL7",4,1],["late",5,"UIL7",4,1],["late_gt15",5,"UIL7",4,1],["ftfdf",12,"UIL7",84,1],["ftpdf",9,"UIL7",84,1],["pdnr",34,"UIL7",84,1],["item_qual",28,"UIT1",2,1],["late",18,"UIT1",8,1],["late_gt15",18,"UIT1",8,1],["late",5,"UIT1",85,1],["late",2,"UIT4",27,1],["ftfdf",19,"UIT4",70,1],["ftpdf",8,"UIT4",70,1],["item_miss",26,"UIT4",73,1],["late",5,"UIT4",73,1],["ftfdf",14,"UIT4",73,1],["item_miss",26,"UIT4",96,1],["pdnr",34,"UIT4",96,1],["late",5,"UIT4",97,1],["pdnr",34,"UIT4",97,1],["fdnr",50,"UIT4",33,1],["item_miss",26,"UIT4",33,1],["item_miss",26,"UIT4",40,1],["ftfdf",12,"UIT4",42,1],["item_qual",28,"UIT4",42,1],["late",5,"UIT4",47,1],["ftfdf",19,"UIT4",114,1],["ftpdf",3,"UIT4",101,1],["late_gt15",5,"UIT4",49,1],["late_gt15",2,"UIL7",104,1],["item_qual",28,"UIL7",2,1],["late",5,"UIL7",6,1],["ftfdf",12,"UIT1",1,1],["ftfdf",14,"UIT1",8,1],["late_gt15",5,"UIT1",60,1],["late_gt15",2,"UIT1",19,1],["pdnr",34,"UIT4",119,1],["ftpdf",29,"UIT4",119,1],["ftpdf",9,"UIT4",25,1],["pdnr",37,"UIT4",25,1],["ftpdf",25,"UIT4",25,1],["ftpdf",31,"UIT4",29,1],["late",5,"UIT4",105,1],["pdnr",34,"UIT4",32,1],["ftpdf",3,"UIT4",73,1],["late",10,"UIT4",73,1],["ftpdf",3,"UIT4",76,1],["ftfdf",14,"UIT4",36,1],["late",5,"UIT4",38,1],["late",5,"UIT4",40,1],["late_gt15",5,"UIT4",40,1],["ftfdf",15,"UIT4",41,1],["ftpdf",3,"UIT4",45,1],["late_gt15",5,"UIT4",45,1],["pdnr",38,"UIT4",45,1],["ftfdf",33,"UIT4",117,1],["pdnr",34,"UIT4",82,1],["late_gt15",18,"UIT4",82,1],["item_miss",26,"UBA1",52,1],["pdnr",34,"UBA1",52,1],["pdnr",34,"UBA1",111,1],["ftfdf",33,"UIL7",118,1],["pdnr",34,"UIL7",118,1],["pdnr",34,"UIL7",4,1],["item_qual",28,"UIT1",1,1],["ftpdf",9,"UIT1",3,1],["item_qual",28,"UIT1",3,1],["ftfdf",15,"UIT1",57,1],["pdnr",34,"UIT1",57,1],["late_gt15",5,"UIT1",64,1],["pdnr",34,"UIT4",76,1]]},
"2026-W33":{"o":{"UIT4":1856,"UIT1":683,"UBA1":175,"UIL7":386},"d":{"UBA1":15,"UIL7":38,"UIT1":47,"UIT4":178},"r":[["item_miss",26,"UIT4",70,7],["late",2,"UIL7",56,7],["item_miss",26,"UIT4",73,6],["item_qual",28,"UIT4",33,6],["item_miss",26,"UIT4",72,6],["item_miss",26,"UIT4",45,5],["ftfdf",14,"UIT4",41,5],["item_miss",26,"UBA1",0,4],["item_miss",26,"UIL7",88,4],["late",5,"UIT1",91,4],["item_qual",28,"UIT1",13,4],["pdnr",34,"UBA1",0,3],["item_miss",26,"UIL7",85,3],["item_miss",26,"UIT1",58,3],["item_miss",26,"UIT1",16,3],["late_gt15",5,"UIT1",91,3],["item_qual",28,"UIT4",34,3],["item_qual",28,"UIT4",48,3],["item_miss",26,"UIL7",56,3],["item_miss",26,"UIT4",68,3],["late_gt15",2,"UIL7",56,3],["item_miss",26,"UIT1",14,3],["item_miss",26,"UIT4",25,3],["ftpdf",3,"UIT4",41,3],["ftfdf",12,"UIT4",41,3],["late",5,"UIT4",48,3],["item_miss",26,"UIT4",48,3],["late",5,"UIT4",36,3],["ftfdf",6,"UIT1",61,3],["item_miss",26,"UIL7",9,2],["late",5,"UIL7",88,2],["late",40,"UIL7",88,2],["item_qual",28,"UIT1",112,2],["ftfdf",14,"UIT1",112,2],["item_miss",26,"UIT1",22,2],["item_qual",28,"UIT4",65,2],["item_miss",26,"UIT4",71,2],["late",5,"UIT4",71,2],["ftpdf",3,"UIT4",71,2],["ftfdf",17,"UIT4",71,2],["ftfdf",12,"UIT4",42,2],["ftfdf",27,"UIT4",107,2],["late",5,"UIT4",107,2],["ftpdf",3,"UIT4",114,2],["ftfdf",14,"UIT4",25,2],["late",2,"UIT4",70,2],["pdnr",43,"UIT4",70,2],["item_qual",28,"UIT4",72,2],["item_miss",26,"UIT4",36,2],["late",5,"UIT4",41,2],["item_miss",26,"UIT4",47,2],["item_miss",26,"UIT4",50,2],["late",5,"UIL7",85,2],["ftfdf",15,"UIT4",119,2],["item_miss",26,"UIT4",119,2],["item_qual",28,"UIT4",119,2],["ftfdf",14,"UIT4",29,2],["item_qual",28,"UIT4",71,2],["item_qual",28,"UIT4",77,2],["item_qual",28,"UIT4",106,2],["item_qual",28,"UIT4",47,2],["item_qual",28,"UIT4",70,2],["ftpdf",3,"UIT4",30,2],["ftfdf",14,"UIT4",72,2],["ftfdf",14,"UIT4",114,2],["late",22,"UBA1",0,2],["item_miss",26,"UIT1",9,2],["item_qual",28,"UIT1",14,2],["item_miss",26,"UIT4",105,2],["ftpdf",3,"UIT4",50,2],["ftfdf",12,"UIT4",119,2],["item_qual",28,"UIT4",39,2],["late",5,"UIT4",50,2],["item_miss",26,"UBA1",111,1],["late",22,"UBA1",111,1],["late",18,"UIL7",84,1],["pdnr",32,"UIL7",85,1],["ftfdf",15,"UIL7",88,1],["ftfdf",12,"UIT1",9,1],["late",5,"UIT1",112,1],["ftfdf",14,"UIT1",58,1],["ftfdf",14,"UIT1",16,1],["ftpdf",3,"UIT1",19,1],["fdnr",50,"UIT4",119,1],["ftfdf",27,"UIT4",119,1],["ftdc",24,"UIT4",25,1],["ftfdf",14,"UIT4",105,1],["pdnr",34,"UIT4",73,1],["item_miss",26,"UIT4",33,1],["ftfdf",14,"UIT4",33,1],["ftfdf",15,"UIT4",33,1],["item_miss",26,"UIT4",34,1],["item_miss",26,"UIT4",106,1],["fdnr",39,"UIT4",106,1],["item_qual",28,"UIT4",41,1],["item_qual",28,"UIT4",45,1],["pdnr",34,"UIT4",107,1],["ftfdf",14,"UIT4",107,1],["late_gt15",5,"UIT4",107,1],["ftpdf",25,"UIL7",88,1],["item_miss",26,"UIL7",19,1],["ftfdf",14,"UIT1",8,1],["item_qual",28,"UIT1",9,1],["fdnr",39,"UIT1",16,1],["item_qual",28,"UIT1",22,1],["ftfdf",14,"UIT1",22,1],["late",2,"UIT4",65,1],["ftdc",24,"UIT4",65,1],["ftfdf",12,"UIT4",25,1],["late_gt15",2,"UIT4",70,1],["ftpdf",3,"UIT4",33,1],["ftpdf",9,"UIT4",33,1],["ftpdf",36,"UIT4",41,1],["late_gt15",5,"UIT4",41,1],["item_qual",28,"UIL7",84,1],["ftfdf",14,"UIL7",85,1],["ftfdf",4,"UIT1",22,1],["item_miss",26,"UIT4",65,1],["item_qual",28,"UIT4",25,1],["late",5,"UIT4",25,1],["pdnr",34,"UIT4",25,1],["item_qual",28,"UIT4",29,1],["item_miss",26,"UIT4",30,1],["item_qual",28,"UIT4",30,1],["pdnr",34,"UIT4",72,1],["pdnr",38,"UIT4",41,1],["late_gt15",5,"UIT4",48,1],["ftfdf",21,"UIT4",48,1],["ftfdf",14,"UBA1",111,1],["ftfdf",4,"UIL7",118,1],["item_miss",26,"UIL7",84,1],["ftfdf",14,"UIT1",14,1],["ftfdf",17,"UIT4",119,1],["ftfdf",14,"UIT4",119,1],["ftpdf",8,"UIT4",68,1],["item_qual",28,"UIT4",68,1],["late",5,"UIT4",70,1],["fdnr",39,"UIT4",70,1],["ftpdf",8,"UIT4",70,1],["late",2,"UIT4",30,1],["late",5,"UIT4",73,1],["item_qual",28,"UIT4",73,1],["ftpdf",3,"UIT4",106,1],["ftfdf",14,"UIT4",42,1],["ftfdf",27,"UIT4",42,1],["ftpdf",3,"UIT4",42,1],["item_miss",26,"UIT4",42,1],["ftpdf",8,"UIT4",45,1],["fdnr",50,"UIT4",45,1],["item_qual",28,"UIT4",114,1],["item_qual",28,"UBA1",111,1],["ftfdf",14,"UBA1",0,1],["item_miss",26,"UIL7",118,1],["pdnr",41,"UIL7",56,1],["late",18,"UIL7",85,1],["late",18,"UIL7",88,1],["late_gt15",40,"UIL7",88,1],["late",5,"UIT1",9,1],["item_qual",28,"UIT1",58,1],["fdnr",39,"UIT4",71,1],["pdnr",32,"UIT4",72,1],["ftfdf",6,"UIT4",73,1],["ftpdf",9,"UIT4",34,1],["pdnr",32,"UIT4",34,1],["ftfdf",15,"UIT4",38,1],["late",5,"UIT4",38,1],["item_miss",26,"UIT4",41,1],["late",2,"UIT4",50,1],["item_qual",28,"UIT4",50,1],["ftfdf",14,"UBA1",52,1],["item_qual",28,"UIL7",118,1],["late",2,"UIL7",84,1],["ftpdf",3,"UIL7",55,1],["pdnr",38,"UIL7",55,1],["pdnr",34,"UIT1",9,1],["item_miss",26,"UIT1",13,1],["pdnr",34,"UIT1",13,1],["item_qual",28,"UIT1",61,1],["item_miss",26,"UIT4",77,1],["ftfdf",1,"UIT4",107,1],["item_qual",28,"UIT4",107,1],["late",5,"UIT4",114,1],["item_qual",28,"UIT4",49,1]]},
"2026-W34":{"o":{"UIT4":2390,"UIT1":929,"UBA1":164,"UIL7":391},"d":{"UBA1":14,"UIL7":43,"UIT1":63,"UIT4":295},"r":[["item_miss",26,"UIT4",110,21],["item_miss",26,"UIT4",45,11],["item_miss",26,"UIT4",78,10],["late",2,"UIL7",56,9],["item_miss",26,"UBA1",0,7],["item_miss",26,"UIT4",26,7],["item_miss",26,"UIT4",31,7],["item_miss",26,"UIT4",77,6],["item_miss",26,"UIT4",68,6],["late_gt15",2,"UIL7",56,5],["late",5,"UIT4",96,5],["ftpdf",3,"UIT4",45,5],["item_miss",26,"UIT4",39,5],["item_qual",28,"UIT4",106,5],["ftfdf",12,"UIT4",41,5],["item_miss",26,"UIT4",119,5],["late",2,"UIL7",84,4],["late",5,"UIT1",90,4],["item_miss",26,"UIT1",22,4],["pdnr",42,"UIT4",110,4],["ftfdf",14,"UIT4",41,4],["item_miss",26,"UIT4",117,4],["late",5,"UIT4",45,4],["item_qual",28,"UIT4",77,4],["late_gt15",2,"UIL7",84,3],["ftfdf",14,"UIT4",92,3],["item_qual",28,"UIT4",92,3],["item_miss",26,"UIT4",96,3],["ftfdf",14,"UIT4",76,3],["late",5,"UIT4",49,3],["late",5,"UIL7",85,3],["item_miss",26,"UIL7",5,3],["item_qual",28,"UIT1",19,3],["item_qual",28,"UIT4",93,3],["ftfdf",12,"UIT4",78,3],["item_miss",26,"UIT4",38,3],["item_qual",28,"UIT4",46,3],["item_miss",26,"UIT4",47,3],["pdnr",34,"UIT4",68,3],["item_miss",26,"UIT4",49,3],["pdnr",34,"UIT4",119,3],["ftpdf",3,"UIT4",41,3],["item_qual",28,"UIT4",48,3],["item_miss",26,"UIT4",92,3],["item_qual",28,"UBA1",111,2],["pdnr",34,"UBA1",0,2],["item_miss",26,"UIL7",118,2],["item_qual",28,"UIL7",118,2],["item_miss",26,"UIL7",56,2],["item_qual",28,"UIT4",65,2],["ftfdf",6,"UIT4",26,2],["item_qual",28,"UIT4",29,2],["item_qual",28,"UIT4",31,2],["late_gt15",5,"UIT4",96,2],["ftpdf",3,"UIT4",96,2],["ftfdf",6,"UIT4",33,2],["pdnr",34,"UIT4",78,2],["item_qual",28,"UIT4",78,2],["late",5,"UIT4",41,2],["late_gt15",5,"UIL7",85,2],["item_miss",26,"UIT1",108,2],["item_miss",26,"UIT1",109,2],["late",13,"UIT1",16,2],["item_miss",26,"UIT1",16,2],["pdnr",34,"UIT1",16,2],["ftfdf",17,"UIT1",16,2],["late_gt15",5,"UIT1",90,2],["item_qual",28,"UIT1",22,2],["ftfdf",14,"UIT1",22,2],["item_qual",28,"UIT4",26,2],["item_qual",28,"UIT4",71,2],["late",5,"UIT4",115,2],["ftfdf",14,"UIT4",31,2],["item_miss",26,"UIT4",106,2],["pdnr",34,"UIT4",106,2],["item_qual",28,"UIT4",41,2],["item_miss",26,"UIT4",48,2],["ftfdf",14,"UIT1",19,2],["late",18,"UIT1",22,2],["pdnr",43,"UIT4",68,2],["item_miss",26,"UIT4",93,2],["item_qual",28,"UIT4",110,2],["pdnr",43,"UIT4",110,2],["pdnr",34,"UIT4",31,2],["ftfdf",15,"UIT4",76,2],["item_qual",28,"UIT4",39,2],["item_miss",26,"UBA1",111,2],["item_miss",26,"UIT4",25,2],["item_qual",28,"UIT4",33,2],["item_miss",26,"UIT4",41,2],["late",2,"UIL7",118,2],["late_gt15",2,"UIL7",118,2],["ftfdf",15,"UIT4",93,2],["ftfdf",14,"UIT4",110,2],["pdnr",43,"UIT4",47,2],["late",2,"UIT1",90,2],["item_miss",26,"UIT1",90,2],["ftpdf",3,"UIT4",47,2],["item_qual",28,"UIT4",117,2],["late",18,"UIT1",13,2],["item_miss",26,"UIT4",29,2],["item_miss",26,"UIT4",105,2],["item_miss",26,"UIT4",98,2],["item_miss",26,"UIT4",107,2],["late",5,"UBA1",0,1],["late_gt15",5,"UBA1",0,1],["ftpdf",9,"UBA1",0,1],["pdnr",34,"UIL7",118,1],["ftfdf",51,"UIL7",118,1],["pdnr",47,"UIL7",118,1],["ftfdf",49,"UIL7",84,1],["ftpdf",9,"UIL7",84,1],["item_qual",28,"UIL7",84,1],["ftfdf",14,"UIT1",9,1],["item_qual",28,"UIT1",58,1],["late",2,"UIT4",105,1],["ftfdf",33,"UIT4",110,1],["pdnr",38,"UIT4",96,1],["ftpdf",25,"UIT4",33,1],["ftfdf",12,"UIT4",33,1],["ftfdf",15,"UIT4",77,1],["ftfdf",35,"UIT4",41,1],["late_gt15",5,"UIT4",41,1],["item_miss",26,"UIT4",46,1],["item_qual",28,"UIT4",107,1],["ftfdf",12,"UIT4",117,1],["ftpdf",3,"UIT4",117,1],["late_gt15",5,"UIT4",49,1],["ftfdf",14,"UIL7",84,1],["item_qual",28,"UIL7",5,1],["late",5,"UIT1",9,1],["ftfdf",15,"UIT1",9,1],["ftfdf",12,"UIT1",14,1],["pdnr",34,"UIT1",109,1],["ftpdf",3,"UIT1",16,1],["late",5,"UIT1",16,1],["ftfdf",14,"UIT4",29,1],["ftpdf",8,"UIT4",110,1],["item_qual",28,"UIT4",115,1],["ftpdf",25,"UIT4",31,1],["pdnr",37,"UIT4",31,1],["ftfdf",6,"UIT4",46,1],["pdnr",34,"UIT4",46,1],["ftpdf",3,"UIT4",48,1],["pdnr",38,"UIT4",48,1],["ftfdf",14,"UIT1",13,1],["late",5,"UIT1",19,1],["late_gt15",5,"UIT1",19,1],["item_miss",26,"UIT1",19,1],["ftfdf",4,"UIT1",22,1],["pdnr",34,"UIT4",65,1],["item_miss",26,"UIT4",65,1],["ftpdf",8,"UIT4",68,1],["pdnr",34,"UIT4",77,1],["ftfdf",14,"UIT4",36,1],["item_qual",28,"UIT4",45,1],["item_qual",28,"UIL7",56,1],["pdnr",34,"UIL7",5,1],["item_qual",28,"UIT1",9,1],["item_miss",26,"UIT1",9,1],["ftfdf",12,"UIT1",58,1],["item_qual",28,"UIT1",88,1],["item_qual",28,"UIT1",108,1],["item_qual",28,"UIT1",14,1],["pdnr",48,"UIT1",109,1],["ftfdf",15,"UIT1",19,1],["ftfdf",14,"UIT4",25,1],["pdnr",48,"UIT4",25,1],["pdnr",34,"UIT4",71,1],["ftpdf",0,"UIT4",115,1],["item_miss",26,"UIT4",33,1],["ftpdf",9,"UIT4",33,1],["late",5,"UIT4",98,1],["ftpdf",25,"UIT4",77,1],["pdnr",37,"UIT4",77,1],["item_miss",26,"UIT4",36,1],["ftpdf",3,"UIT4",36,1],["item_qual",28,"UIT4",36,1],["late",5,"UIT4",78,1],["ftpdf",29,"UIT4",106,1],["item_qual",28,"UIT4",114,1],["ftpdf",3,"UIT4",49,1],["pdnr",38,"UIT4",49,1],["ftfdf",15,"UIL7",9,1],["item_miss",26,"UIL7",9,1],["late",5,"UIL7",9,1],["late_gt15",5,"UIL7",9,1],["ftpdf",3,"UIL7",9,1],["ftfdf",19,"UIL7",84,1],["ftfdf",6,"UIL7",56,1],["ftfdf",12,"UIT1",13,1],["ftfdf",21,"UIT1",16,1],["ftfdf",12,"UIT4",25,1],["ftpdf",3,"UIT4",93,1],["item_qual",28,"UIT4",96,1],["fdnr",39,"UIT4",76,1],["ftfdf",14,"UIT4",78,1],["late",5,"UIT4",38,1],["ftpdf",3,"UIT4",106,1],["late",5,"UIT4",107,1],["ftfdf",14,"UIT4",117,1],["late",2,"UIT4",48,1],["ftpdf",25,"UBA1",111,1],["pdnr",47,"UBA1",0,1],["item_miss",26,"UIL7",84,1],["late",5,"UIL7",88,1],["item_miss",26,"UIL7",14,1],["item_miss",26,"UIT1",14,1],["ftfdf",15,"UIT1",16,1],["late",5,"UIT1",5,1],["late_gt15",5,"UIT1",5,1],["late_gt15",2,"UIT1",90,1],["ftfdf",14,"UIT1",62,1],["ftpdf",3,"UIT4",65,1],["ftdc",30,"UIT4",65,1],["ftfdf",15,"UIT4",119,1],["ftfdf",12,"UIT4",119,1],["ftfdf",14,"UIT4",119,1],["ftfdf",12,"UIT4",26,1],["fdnr",32,"UIT4",92,1],["pdnr",47,"UIT4",110,1],["ftfdf",12,"UIT4",110,1],["item_miss",26,"UIT4",115,1],["ftfdf",17,"UIT4",33,1],["item_miss",26,"UIT4",76,1],["item_qual",28,"UIT4",76,1],["ftfdf",15,"UIT4",78,1],["ftpdf",25,"UIT4",38,1],["late",2,"UIT4",39,1],["late",2,"UIT4",106,1],["late_gt15",2,"UIT4",106,1],["ftfdf",12,"UIT4",47,1],["item_miss",26,"UIT4",114,1],["ftpdf",3,"UIT4",114,1],["pdnr",34,"UIT4",117,1],["ftpdf",3,"UIL7",55,1],["pdnr",38,"UIL7",55,1],["late",40,"UIL7",56,1],["late_gt15",40,"UIL7",56,1],["late",13,"UIT1",13,1],["late_gt15",13,"UIT1",13,1],["late",40,"UIT1",88,1],["late_gt15",40,"UIT1",88,1],["late",2,"UIT1",16,1],["late_gt15",2,"UIT1",16,1],["late",18,"UIT1",5,1],["late",13,"UIT1",90,1],["late",18,"UIT1",90,1],["late_gt15",18,"UIT1",90,1],["late",2,"UIT4",25,1],["pdnr",34,"UIT4",26,1],["ftpdf",3,"UIT4",26,1],["late",5,"UIT4",92,1],["ftpdf",25,"UIT4",29,1],["ftfdf",14,"UIT4",71,1],["item_qual",28,"UIT4",105,1],["ftfdf",15,"UIT4",31,1],["ftfdf",17,"UIT4",98,1],["pdnr",34,"UIT4",98,1],["ftfdf",15,"UIT4",36,1],["ftfdf",1,"UIT4",45,1],["late",2,"UIT4",45,1],["late_gt15",2,"UIT4",45,1],["ftfdf",15,"UIT4",114,1],["ftfdf",14,"UIT4",48,1]]},
"2026-W35":{"o":{"UIT4":2964,"UIT1":1360,"UBA1":282,"UIL7":506},"d":{"UBA1":39,"UIL7":78,"UIT1":110,"UIT4":353},"r":[["item_miss",26,"UIT4",110,14],["item_miss",26,"UBA1",0,12],["item_miss",26,"UIT4",75,9],["item_qual",28,"UIT4",93,8],["item_miss",26,"UIT4",101,8],["item_qual",28,"UIT4",70,6],["item_miss",26,"UIT1",5,6],["ftpdf",3,"UIL7",6,5],["item_miss",26,"UIT4",106,5],["late",5,"UIT4",82,5],["pdnr",34,"UBA1",0,5],["item_miss",26,"UIL7",56,5],["item_miss",26,"UIT4",26,5],["item_miss",26,"UIT4",78,5],["item_qual",28,"UBA1",0,4],["late",13,"UIT1",104,4],["pdnr",42,"UIT4",110,4],["item_qual",28,"UIT4",32,4],["item_miss",26,"UIT4",38,4],["item_qual",28,"UIT4",106,4],["item_qual",28,"UIT4",42,4],["item_qual",28,"UIT4",82,4],["late",2,"UIL7",56,4],["item_qual",28,"UIT4",73,4],["ftpdf",3,"UIT4",34,4],["item_miss",26,"UIT4",46,4],["item_qual",28,"UIT4",101,4],["item_miss",26,"UIT4",49,4],["late",5,"UIL7",2,4],["item_qual",28,"UIT1",3,4],["item_miss",26,"UIT4",45,4],["late",5,"UIT4",49,4],["fdnr",39,"UBA1",0,4],["item_miss",26,"UIT4",43,4],["item_miss",26,"UIL7",4,3],["late",5,"UIL7",4,3],["late_gt15",5,"UIL7",4,3],["pdnr",43,"UIL7",85,3],["late_gt15",13,"UIT1",104,3],["pdnr",34,"UIT1",13,3],["item_miss",26,"UIT1",64,3],["item_miss",26,"UIT4",65,3],["item_miss",26,"UIT4",93,3],["item_qual",28,"UIT4",110,3],["ftpdf",3,"UIT4",97,3],["item_qual",28,"UIT4",78,3],["late",5,"UIT4",38,3],["item_qual",28,"UIT4",41,3],["late",5,"UIT4",42,3],["item_miss",26,"UIT4",47,3],["late",13,"UIT4",80,3],["late",2,"UIT4",80,3],["late",2,"UIL7",2,3],["ftfdf",14,"UIT1",57,3],["item_miss",26,"UIT4",105,3],["ftfdf",6,"UIT4",110,3],["item_qual",28,"UIT4",31,3],["item_qual",28,"UIT1",58,3],["late",5,"UIT4",70,3],["late",18,"UIT4",73,3],["item_miss",26,"UIT4",97,3],["item_miss",26,"UIT4",99,3],["late",22,"UBA1",0,3],["late",2,"UIL7",104,3],["item_qual",28,"UIT1",5,3],["item_miss",26,"UIT4",29,3],["item_qual",28,"UIT4",38,3],["late",5,"UIT4",48,3],["item_miss",26,"UBA1",52,3],["late",5,"UIL7",104,3],["late",13,"UIL7",61,3],["item_qual",28,"UIT4",97,3],["item_qual",28,"UIT4",98,3],["item_miss",26,"UIL7",2,3],["ftfdf",14,"UBA1",52,2],["pdnr",43,"UIL7",4,2],["ftpdf",3,"UIL7",4,2],["item_qual",28,"UIL7",85,2],["late",2,"UIL7",85,2],["late",5,"UIL7",6,2],["late",5,"UIL7",7,2],["item_miss",26,"UIT1",3,2],["late",13,"UIT1",5,2],["late_gt15",13,"UIT1",5,2],["ftfdf",12,"UIT1",5,2],["item_qual",28,"UIT1",64,2],["late",5,"UIT4",92,2],["ftfdf",14,"UIT4",92,2],["ftfdf",14,"UIT4",110,2],["ftfdf",14,"UIT4",30,2],["pdnr",43,"UIT4",32,2],["item_miss",26,"UIT4",32,2],["ftpdf",25,"UIT4",75,2],["pdnr",38,"UIT4",97,2],["pdnr",34,"UIT4",99,2],["late",5,"UIT4",106,2],["item_miss",26,"UIT4",42,2],["ftfdf",14,"UIT4",43,2],["item_qual",28,"UIT4",47,2],["pdnr",34,"UIT4",80,2],["late_gt15",13,"UIT4",80,2],["ftfdf",14,"UIT4",80,2],["pdnr",34,"UIL7",56,2],["ftfdf",15,"UIL7",85,2],["item_miss",26,"UIT1",1,2],["late",5,"UIT1",112,2],["item_miss",26,"UIT1",113,2],["ftfdf",15,"UIT1",57,2],["late",5,"UIT1",5,2],["ftfdf",6,"UIT1",62,2],["ftfdf",17,"UIT4",110,2],["item_qual",28,"UIT4",75,2],["ftfdf",12,"UIT4",41,2],["ftfdf",14,"UIT4",41,2],["ftpdf",3,"UIT4",41,2],["item_qual",28,"UIT4",49,2],["late_gt15",5,"UIL7",2,2],["late",40,"UIT4",70,2],["item_qual",28,"UIT4",71,2],["item_qual",28,"UIT4",30,2],["ftpdf",3,"UIT4",73,2],["ftfdf",6,"UIT4",73,2],["item_miss",26,"UIT4",48,2],["late_gt15",5,"UIT4",49,2],["late_gt15",22,"UBA1",0,2],["late_gt15",2,"UIL7",104,2],["late",40,"UIL7",4,2],["late",40,"UIL7",6,2],["ftfdf",1,"UIT1",1,2],["item_miss",26,"UIT1",112,2],["item_miss",26,"UIT1",88,2],["pdnr",34,"UIT4",27,2],["item_miss",26,"UIT4",73,2],["pdnr",37,"UIT4",38,2],["item_qual",28,"UIT4",48,2],["pdnr",43,"UBA1",0,2],["item_miss",26,"UIL7",104,2],["late_gt15",5,"UIL7",104,2],["item_qual",28,"UIL7",2,2],["late_gt15",13,"UIL7",61,2],["item_qual",28,"UIT1",108,2],["item_miss",26,"UIT1",57,2],["ftpdf",3,"UIT4",67,2],["item_qual",28,"UIT4",115,2],["pdnr",34,"UIT4",30,2],["late",5,"UIT4",36,2],["ftpdf",9,"UIT4",101,2],["ftfdf",15,"UIT4",117,2],["late",10,"UIL7",56,2],["item_miss",26,"UIT1",16,2],["item_miss",26,"UIT4",92,2],["ftpdf",3,"UIT4",49,2],["pdnr",38,"UIL7",4,1],["ftpdf",3,"UIL7",84,1],["item_qual",28,"UIL7",84,1],["item_miss",26,"UIL7",85,1],["late_gt15",2,"UIL7",85,1],["item_miss",26,"UIL7",6,1],["late_gt15",5,"UIL7",6,1],["ftfdf",14,"UIL7",6,1],["ftfdf",35,"UIL7",7,1],["item_miss",26,"UIT1",104,1],["late",5,"UIT1",104,1],["late_gt15",5,"UIT1",104,1],["ftpdf",25,"UIT1",3,1],["ftfdf",6,"UIT1",3,1],["ftfdf",1,"UIT1",13,1],["late",13,"UIT1",88,1],["late_gt15",13,"UIT1",88,1],["late",5,"UIT1",88,1],["late_gt15",5,"UIT1",88,1],["item_qual",28,"UIT1",109,1],["ftfdf",19,"UIT1",109,1],["late",5,"UIT1",109,1],["ftfdf",19,"UIT1",5,1],["ftdc",24,"UIT1",5,1],["ftfdf",6,"UIT1",90,1],["late",2,"UIT1",64,1],["late_gt15",2,"UIT1",64,1],["item_qual",28,"UIT4",65,1],["ftfdf",17,"UIT4",92,1],["item_miss",26,"UIT4",70,1],["late",10,"UIT4",70,1],["ftpdf",3,"UIT4",29,1],["ftfdf",14,"UIT4",29,1],["ftfdf",15,"UIT4",93,1],["ftfdf",12,"UIT4",110,1],["ftpdf",3,"UIT4",32,1],["ftfdf",14,"UIT4",96,1],["ftfdf",14,"UIT4",78,1],["late_gt15",5,"UIT4",106,1],["pdnr",34,"UIT4",106,1],["ftfdf",19,"UIT4",42,1],["ftfdf",12,"UIT4",43,1],["late",5,"UIT4",47,1],["late",13,"UIT4",117,1],["item_miss",26,"UIT4",117,1],["item_qual",28,"UIT4",80,1],["late_gt15",2,"UIT4",80,1],["late_gt15",2,"UIL7",2,1],["ftpdf",3,"UIL7",2,1],["pdnr",38,"UIL7",2,1],["late",40,"UIL7",84,1],["item_miss",26,"UIL7",84,1],["ftpdf",8,"UIL7",85,1],["late",5,"UIT1",1,1],["ftfdf",1,"UIT1",112,1],["item_qual",28,"UIT1",113,1],["pdnr",32,"UIT1",113,1],["pdnr",34,"UIT1",113,1],["late",5,"UIT1",57,1],["late_gt15",5,"UIT1",57,1],["ftpdf",29,"UIT1",16,1],["ftpdf",8,"UIT1",16,1],["pdnr",47,"UIT1",5,1],["item_miss",26,"UIT1",90,1],["item_qual",28,"UIT1",90,1],["late",13,"UIT1",62,1],["late_gt15",13,"UIT1",62,1],["pdnr",34,"UIT4",65,1],["late",2,"UIT4",31,1],["late",5,"UIT4",31,1],["ftfdf",14,"UIT4",73,1],["fdnr",39,"UIT4",73,1],["ftfdf",49,"UIT4",73,1],["ftpdf",8,"UIT4",75,1],["fdnr",39,"UIT4",75,1],["ftpdf",46,"UIT4",41,1],["ftfdf",12,"UIT4",42,1],["ftfdf",6,"UIT4",43,1],["ftfdf",15,"UIT4",46,1],["ftpdf",31,"UIT4",46,1],["pdnr",47,"UIT4",46,1],["pdnr",34,"UIT4",101,1],["ftfdf",15,"UIT4",50,1],["ftpdf",9,"UIT4",82,1],["item_miss",26,"UIT4",51,1],["late",5,"UIT4",51,1],["pdnr",34,"UBA1",52,1],["ftfdf",12,"UBA1",111,1],["ftpdf",9,"UBA1",111,1],["item_qual",28,"UBA1",111,1],["late_gt15",2,"UIL7",56,1],["pdnr",47,"UIT1",113,1],["ftfdf",11,"UIT1",113,1],["late",2,"UIT1",16,1],["late_gt15",2,"UIT1",16,1],["ftfdf",15,"UIT1",62,1],["pdnr",32,"UIT4",26,1],["ftfdf",6,"UIT4",26,1],["item_qual",28,"UIT4",26,1],["late_gt15",40,"UIT4",70,1],["late_gt15",5,"UIT4",70,1],["ftpdf",3,"UIT4",71,1],["item_miss",26,"UIT4",71,1],["late",2,"UIT4",115,1],["pdnr",34,"UIT4",72,1],["ftpdf",0,"UIT4",73,1],["late_gt15",18,"UIT4",73,1],["ftpdf",31,"UIT4",73,1],["ftpdf",0,"UIT4",75,1],["pdnr",38,"UIT4",75,1],["pdnr",43,"UIT4",75,1],["late",5,"UIT4",75,1],["pdnr",34,"UIT4",39,1],["pdnr",38,"UIT4",41,1],["item_miss",26,"UIT4",41,1],["late",5,"UIT4",41,1],["ftfdf",14,"UIT4",46,1],["ftfdf",12,"UIT4",46,1],["ftfdf",14,"UIT4",117,1],["ftpdf",25,"UIT4",48,1],["ftfdf",20,"UIT4",80,1],["item_miss",26,"UIT4",50,1],["late",13,"UIT4",82,1],["late_gt15",5,"UIT4",82,1],["item_qual",28,"UBA1",52,1],["late",13,"UBA1",0,1],["late",5,"UBA1",0,1],["late_gt15",5,"UBA1",0,1],["late_gt15",40,"UIL7",4,1],["ftpdf",3,"UIL7",55,1],["late_gt15",40,"UIL7",6,1],["late",2,"UIL7",7,1],["pdnr",34,"UIT1",112,1],["ftfdf",14,"UIT1",58,1],["item_qual",28,"UIT1",88,1],["late",2,"UIT1",57,1],["item_qual",28,"UIT4",116,1],["item_qual",28,"UIT4",23,1],["ftfdf",12,"UIT4",26,1],["ftpdf",25,"UIT4",70,1],["pdnr",34,"UIT4",70,1],["late",5,"UIT4",29,1],["ftpdf",9,"UIT4",93,1],["pdnr",34,"UIT4",73,1],["ftpdf",31,"UIT4",34,1],["ftfdf",14,"UIT4",36,1],["ftpdf",8,"UIT4",38,1],["pdnr",34,"UIT4",41,1],["late",2,"UIT4",41,1],["late_gt15",2,"UIT4",41,1],["ftfdf",15,"UIT4",41,1],["ftpdf",3,"UIT4",42,1],["ftpdf",3,"UIT4",43,1],["pdnr",34,"UIT4",43,1],["late",5,"UIT4",43,1],["item_miss",26,"UIT4",80,1],["fdnr",50,"UIT4",101,1],["ftpdf",9,"UIT4",49,1],["ftfdf",15,"UBA1",52,1],["late",22,"UBA1",111,1],["ftpdf",9,"UIL7",2,1],["late",2,"UIL7",4,1],["late",13,"UIT1",1,1],["late_gt15",13,"UIT1",1,1],["ftpdf",9,"UIT1",3,1],["ftfdf",15,"UIT1",3,1],["pdnr",47,"UIT1",3,1],["item_miss",26,"UIT1",58,1],["ftfdf",17,"UIT1",13,1],["ftpdf",31,"UIT1",108,1],["ftfdf",1,"UIT1",6,1],["item_qual",28,"UIT1",6,1],["item_qual",28,"UIT1",62,1],["late",13,"UIT4",67,1],["ftfdf",14,"UIT4",67,1],["item_miss",26,"UIT4",67,1],["ftfdf",12,"UIT4",67,1],["item_qual",28,"UIT4",29,1],["ftpdf",3,"UIT4",93,1],["item_miss",26,"UIT4",31,1],["pdnr",34,"UIT4",31,1],["item_miss",26,"UIT4",72,1],["ftfdf",20,"UIT4",96,1],["ftpdf",3,"UIT4",96,1],["late",13,"UIT4",96,1],["pdnr",38,"UIT4",96,1],["pdnr",34,"UIT4",97,1],["ftpdf",9,"UIT4",97,1],["ftpdf",8,"UIT4",78,1],["late",2,"UIT4",38,1],["pdnr",45,"UIT4",39,1],["ftpdf",9,"UIT4",117,1],["item_qual",28,"UIT4",117,1],["pdnr",47,"UIL7",2,1],["ftpdf",8,"UIL7",2,1],["ftfdf",6,"UIL7",118,1],["ftfdf",33,"UIT1",1,1],["ftfdf",14,"UIT1",1,1],["ftfdf",12,"UIT1",1,1],["item_qual",28,"UIT1",4,1],["item_miss",26,"UIT1",13,1],["ftfdf",14,"UIT1",88,1],["pdnr",48,"UIT1",88,1],["ftfdf",17,"UIT1",5,1],["late",2,"UIT1",62,1],["item_qual",28,"UIT4",92,1],["ftpdf",3,"UIT4",27,1],["pdnr",47,"UIT4",110,1],["pdnr",48,"UIT4",31,1],["ftpdf",3,"UIT4",72,1],["ftfdf",6,"UIT4",72,1],["pdnr",47,"UIT4",38,1],["item_qual",28,"UIT4",39,1],["ftpdf",8,"UIT4",106,1],["ftfdf",15,"UIT4",42,1],["ftfdf",15,"UIT4",43,1],["pdnr",34,"UIT4",45,1],["fdnr",39,"UIT4",117,1],["pdnr",34,"UBA1",111,1],["late",5,"UIL7",118,1],["late",2,"UIL7",84,1],["item_qual",28,"UIL7",56,1],["late_gt15",10,"UIL7",56,1],["ftfdf",14,"UIT1",112,1],["ftpdf",3,"UIT1",109,1],["item_miss",26,"UIT1",109,1],["ftpdf",9,"UIT1",16,1],["item_qual",28,"UIT1",16,1],["ftfdf",15,"UIT4",92,1],["item_miss",26,"UIT4",27,1],["ftfdf",14,"UIT4",27,1],["item_qual",28,"UIT4",105,1],["late",5,"UIT4",115,1],["item_miss",26,"UIT4",30,1],["item_miss",26,"UIT4",98,1],["ftpdf",9,"UIT4",34,1],["item_qual",28,"UIT4",34,1],["ftfdf",6,"UIT4",38,1],["ftpdf",31,"UIT4",38,1],["pdnr",34,"UIT4",46,1],["pdnr",34,"UIT4",47,1],["item_miss",26,"UIT4",107,1],["item_qual",28,"UIT4",107,1],["ftpdf",3,"UIT4",117,1],["late_gt15",5,"UIT4",48,1],["pdnr",37,"UIT4",49,1]]},
"2026-W36":{"o":{"UIT4":3949,"UIT1":2215,"UBA1":445,"UIL7":578},"d":{"UBA1":39,"UIL7":103,"UIT1":277,"UIT4":675},"r":[["late",5,"UIT4",82,15],["late",5,"UIL7",104,14],["item_miss",26,"UIT4",110,14],["late",5,"UIT4",29,14],["late",13,"UIT1",18,13],["item_miss",26,"UIT4",51,12],["late",13,"UIT1",88,11],["late_gt15",5,"UIL7",104,10],["late",5,"UIT4",47,10],["late",2,"UIT4",51,10],["late_gt15",13,"UIT1",18,10],["late",13,"UIT1",64,9],["late",5,"UIT4",68,9],["late",5,"UIT4",99,9],["late_gt15",13,"UIT1",88,8],["item_miss",26,"UIT4",101,8],["late_gt15",2,"UIT4",51,8],["ftfdf",6,"UIT1",61,8],["late",5,"UIT4",70,7],["late_gt15",5,"UIT4",82,7],["item_miss",26,"UBA1",0,7],["item_qual",28,"UIT1",61,7],["late",13,"UIT1",89,7],["late",5,"UIT4",106,7],["ftpdf",3,"UIT4",41,7],["item_qual",28,"UIT4",47,7],["item_miss",26,"UIT4",106,7],["late",2,"UIT1",10,6],["late",2,"UIT4",74,6],["item_miss",26,"UIT4",78,6],["ftpdf",3,"UIT4",44,6],["late",5,"UIT4",49,6],["item_qual",28,"UIT1",1,6],["late_gt15",13,"UIT1",89,6],["late_gt15",5,"UIT4",29,6],["pdnr",42,"UIT4",110,6],["late",5,"UIL7",5,6],["ftpdf",3,"UIT4",73,6],["late",13,"UIT4",66,5],["late",2,"UIT4",66,5],["item_miss",26,"UIT4",70,5],["item_miss",26,"UIT4",77,5],["item_qual",28,"UIT4",78,5],["item_miss",26,"UIT4",45,5],["late",2,"UIL7",56,5],["late_gt15",2,"UIL7",56,5],["ftdc",24,"UIT4",29,5],["item_qual",28,"UIT4",97,5],["item_qual",28,"UIT4",99,5],["late",5,"UIT4",45,5],["late",5,"UIT4",80,5],["late",13,"UIT1",86,5],["ftfdf",33,"UIT1",91,5],["ftdc",24,"UIT4",66,5],["late",13,"UIT4",70,5],["item_qual",28,"UIT4",73,5],["late",13,"UIT1",3,5],["late",40,"UIL7",56,4],["late",5,"UIL7",6,4],["item_qual",28,"UIT1",3,4],["late_gt15",2,"UIT1",10,4],["item_qual",28,"UIT1",5,4],["late",2,"UIT1",64,4],["item_miss",26,"UIT4",67,4],["item_qual",28,"UIT4",92,4],["item_miss",26,"UIT4",32,4],["ftpdf",3,"UIT4",34,4],["ftfdf",17,"UIT4",99,4],["late_gt15",5,"UIT4",99,4],["item_qual",28,"UIT4",44,4],["ftpdf",3,"UIT4",47,4],["late",5,"UIL7",7,4],["item_miss",26,"UIT1",112,4],["late",13,"UIT1",91,4],["late",5,"UIT4",65,4],["item_miss",26,"UIT4",73,4],["item_miss",26,"UIT4",75,4],["late",2,"UIT4",99,4],["item_miss",26,"UIT4",99,4],["ftpdf",3,"UIT4",38,4],["item_miss",26,"UIT4",41,4],["late",2,"UIT4",45,4],["late",13,"UIT4",100,4],["late_gt15",5,"UIT4",80,4],["late_gt15",13,"UIT1",64,4],["late_gt15",5,"UIT4",68,4],["late",2,"UIT4",92,4],["late_gt15",13,"UIT4",70,4],["pdnr",34,"UIT4",106,4],["item_miss",26,"UIT4",43,4],["late",5,"UIT4",48,4],["late",18,"UIL7",2,4],["late",13,"UIT1",10,4],["item_qual",28,"UIT4",29,4],["late",5,"UIT4",30,4],["late",13,"UIT1",6,4],["item_qual",28,"UBA1",54,3],["item_miss",26,"UIL7",104,3],["late",40,"UIL7",2,3],["late_gt15",40,"UIL7",56,3],["late",40,"UIL7",7,3],["item_qual",28,"UIT1",108,3],["item_miss",26,"UIT1",5,3],["item_qual",28,"UIT1",90,3],["ftfdf",14,"UIT1",64,3],["late_gt15",2,"UIT4",66,3],["item_qual",28,"UIT4",68,3],["item_miss",26,"UIT4",68,3],["item_miss",26,"UIT4",92,3],["pdnr",34,"UIT4",92,3],["ftpdf",3,"UIT4",70,3],["ftfdf",14,"UIT4",110,3],["ftfdf",14,"UIT4",31,3],["late",5,"UIT4",94,3],["late",5,"UIT4",74,3],["late",5,"UIT4",96,3],["item_qual",28,"UIT4",107,3],["ftfdf",17,"UIT4",100,3],["item_qual",28,"UIT4",101,3],["ftpdf",9,"UIT4",101,3],["late",13,"UIT4",49,3],["item_qual",28,"UBA1",0,3],["late",22,"UIL7",104,3],["ftpdf",3,"UIL7",104,3],["late",5,"UIL7",2,3],["late",2,"UIL7",84,3],["late",5,"UIT1",89,3],["late",5,"UIT4",23,3],["late_gt15",5,"UIT4",23,3],["ftdc",24,"UIT4",67,3],["ftfdf",14,"UIT4",71,3],["item_qual",28,"UIT4",31,3],["late",13,"UIT4",99,3],["late_gt15",13,"UIT4",99,3],["ftfdf",15,"UIT4",44,3],["ftpdf",3,"UIT4",45,3],["item_miss",26,"UIT4",114,3],["late",2,"UIT4",80,3],["late",22,"UBA1",0,3],["late",5,"UBA1",0,3],["late_gt15",5,"UIL7",6,3],["ftfdf",12,"UIT1",112,3],["late",13,"UIT1",109,3],["item_qual",28,"UIT1",57,3],["late_gt15",2,"UIT4",92,3],["ftpdf",3,"UIT4",30,3],["item_qual",28,"UIT4",77,3],["item_miss",26,"UIT4",38,3],["late",5,"UIT4",39,3],["ftdc",24,"UIT4",79,3],["ftpdf",3,"UIT4",114,3],["late",22,"UBA1",54,3],["late_gt15",18,"UIL7",2,3],["ftfdf",14,"UIL7",84,3],["late_gt15",13,"UIT1",3,3],["late",5,"UIT1",8,3],["late_gt15",13,"UIT1",10,3],["late",13,"UIT1",60,3],["late_gt15",13,"UIT1",60,3],["late",18,"UIT1",16,3],["late_gt15",18,"UIT1",16,3],["late",2,"UIT4",26,3],["ftpdf",3,"UIT4",99,3],["item_miss",26,"UIT4",107,3],["ftpdf",3,"UIT4",49,3],["item_qual",28,"UIT4",93,3],["ftfdf",6,"UIT4",95,3],["ftfdf",14,"UIT4",41,3],["ftfdf",17,"UIT4",79,3],["late_gt15",13,"UIT1",6,3],["late",2,"UIL7",2,2],["ftfdf",19,"UIL7",56,2],["ftpdf",0,"UIL7",56,2],["ftfdf",14,"UIT1",3,2],["late",2,"UIT1",60,2],["late_gt15",2,"UIT1",60,2],["ftfdf",14,"UIT1",22,2],["late_gt15",2,"UIT1",64,2],["late",13,"UIT4",65,2],["late",5,"UIT4",67,2],["item_qual",28,"UIT4",67,2],["pdnr",43,"UIT4",67,2],["late_gt15",5,"UIT4",94,2],["late",13,"UIT4",96,2],["late_gt15",5,"UIT4",96,2],["late",5,"UIT4",34,2],["item_qual",28,"UIT4",34,2],["pdnr",34,"UIT4",45,2],["late",2,"UIT4",100,2],["item_miss",26,"UIT4",100,2],["late_gt15",5,"UIT4",49,2],["ftpdf",3,"UIT4",51,2],["item_qual",28,"UBA1",111,2],["pdnr",34,"UBA1",0,2],["late_gt15",5,"UIL7",2,2],["late_gt15",5,"UIL7",7,2],["item_miss",26,"UIT1",61,2],["item_qual",28,"UIT1",15,2],["ftfdf",6,"UIT1",16,2],["item_qual",28,"UIT1",64,2],["late_gt15",5,"UIT4",65,2],["ftpdf",25,"UIT4",23,2],["item_miss",26,"UIT4",23,2],["pdnr",34,"UIT4",23,2],["ftpdf",8,"UIT4",23,2],["pdnr",43,"UIT4",66,2],["late",2,"UIT4",67,2],["late",13,"UIT4",67,2],["ftfdf",12,"UIT4",68,2],["ftpdf",3,"UIT4",93,2],["item_miss",26,"UIT4",74,2],["item_miss",26,"UIT4",97,2],["late_gt15",2,"UIT4",99,2],["late",13,"UIT4",38,2],["late",2,"UIT4",41,2],["ftpdf",3,"UIT4",42,2],["late",13,"UIT4",42,2],["item_miss",26,"UIT4",44,2],["late_gt15",2,"UIT4",45,2],["ftdc",16,"UIT4",100,2],["pdnr",34,"UIT4",100,2],["item_qual",28,"UIT4",51,2],["late_gt15",5,"UBA1",0,2],["late_gt15",22,"UBA1",0,2],["late",40,"UIL7",4,2],["item_miss",26,"UIL7",4,2],["item_miss",26,"UIL7",56,2],["ftpdf",25,"UIT1",86,2],["item_miss",26,"UIT1",86,2],["late_gt15",13,"UIT1",86,2],["late",5,"UIT1",86,2],["late",5,"UIT1",88,2],["ftfdf",12,"UIT1",108,2],["late",18,"UIT1",18,2],["late_gt15",13,"UIT1",91,2],["item_miss",26,"UIT1",64,2],["late",5,"UIT4",92,2],["ftpdf",3,"UIT4",29,2],["pdnr",34,"UIT4",93,2],["late",5,"UIT4",97,2],["late",2,"UIT4",34,2],["item_qual",28,"UIT4",38,2],["late_gt15",5,"UIT4",39,2],["ftpdf",3,"UIT4",39,2],["late",2,"UIT4",39,2],["late_gt15",5,"UIT4",106,2],["item_qual",28,"UIT4",106,2],["item_qual",28,"UIT4",41,2],["ftpdf",3,"UIT4",43,2],["item_miss",26,"UIT4",47,2],["late_gt15",5,"UIT4",47,2],["ftpdf",0,"UIT4",107,2],["item_miss",26,"UIT4",80,2],["ftfdf",6,"UIT4",101,2],["item_miss",26,"UIT4",82,2],["late",22,"UBA1",53,2],["late",18,"UIL7",104,2],["item_miss",26,"UIL7",84,2],["late_gt15",5,"UIL7",5,2],["item_qual",28,"UIT1",86,2],["late",5,"UIT1",112,2],["late_gt15",5,"UIT1",112,2],["item_qual",28,"UIT1",60,2],["ftpdf",3,"UIT1",88,2],["late",13,"UIT1",62,2],["late",5,"UIT1",62,2],["late",5,"UIT1",63,2],["ftfdf",17,"UIT4",68,2],["item_qual",28,"UIT4",71,2],["item_miss",26,"UIT4",71,2],["ftfdf",14,"UIT4",30,2],["ftpdf",8,"UIT4",77,2],["ftfdf",6,"UIT4",45,2],["pdnr",34,"UIT4",107,2],["fdnr",39,"UIT4",101,2],["late",18,"UIT4",82,2],["item_qual",28,"UIL7",4,2],["late",5,"UIT1",10,2],["ftpdf",3,"UIT1",61,2],["item_miss",26,"UIT1",90,2],["late_gt15",13,"UIT4",66,2],["ftpdf",3,"UIT4",67,2],["item_miss",26,"UIT4",93,2],["item_miss",26,"UIT4",30,2],["late",13,"UIT4",37,2],["ftpdf",3,"UIT4",106,2],["ftpdf",25,"UIT4",106,2],["late",13,"UIT4",47,2],["item_miss",26,"UBA1",52,2],["ftpdf",9,"UIT1",1,2],["item_miss",26,"UIT1",13,2],["late",5,"UIT1",61,2],["late",5,"UIT1",90,2],["late_gt15",5,"UIT1",90,2],["ftpdf",3,"UIT1",62,2],["late",18,"UIT1",64,2],["late_gt15",18,"UIT1",64,2],["ftfdf",14,"UIT4",92,2],["item_miss",26,"UIT4",29,2],["pdnr",43,"UIT4",110,2],["item_miss",26,"UIT4",115,2],["item_miss",26,"UIT4",31,2],["ftfdf",14,"UIT4",78,2],["late",18,"UIT4",49,2],["pdnr",34,"UIT4",82,2],["pdnr",43,"UBA1",0,2],["late",2,"UIT1",6,2],["late_gt15",2,"UIT1",6,2],["ftpdf",0,"UIT4",67,2],["item_qual",28,"UIT4",115,2],["late_gt15",40,"UIL7",2,1],["item_miss",26,"UIL7",6,1],["pdnr",41,"UIL7",6,1],["late",2,"UIL7",6,1],["ftfdf",12,"UIL7",7,1],["ftpdf",0,"UIL7",7,1],["late_gt15",40,"UIL7",7,1],["ftfdf",6,"UIT1",8,1],["pdnr",34,"UIT1",8,1],["ftpdf",25,"UIT1",60,1],["item_qual",28,"UIT1",11,1],["late",2,"UIT1",11,1],["late",5,"UIT1",11,1],["item_miss",26,"UIT1",11,1],["item_qual",28,"UIT1",13,1],["late",5,"UIT1",109,1],["ftpdf",25,"UIT1",18,1],["late",18,"UIT1",21,1],["ftfdf",35,"UIT4",23,1],["pdnr",42,"UIT4",66,1],["late_gt15",5,"UIT4",67,1],["late",2,"UIT4",68,1],["ftpdf",3,"UIT4",68,1],["item_miss",26,"UIT4",26,1],["ftpdf",25,"UIT4",27,1],["item_qual",28,"UIT4",27,1],["ftfdf",14,"UIT4",27,1],["ftpdf",3,"UIT4",110,1],["pdnr",38,"UIT4",110,1],["ftfdf",27,"UIT4",110,1],["ftpdf",3,"UIT4",94,1],["pdnr",34,"UIT4",94,1],["item_qual",28,"UIT4",95,1],["item_qual",28,"UIT4",96,1],["late",13,"UIT4",34,1],["pdnr",34,"UIT4",34,1],["late",2,"UIT4",77,1],["ftpdf",3,"UIT4",77,1],["pdnr",38,"UIT4",44,1],["ftpdf",8,"UIT4",45,1],["ftpdf",25,"UIT4",45,1],["ftfdf",12,"UIT4",46,1],["ftpdf",8,"UIT4",100,1],["ftfdf",6,"UIT4",100,1],["pdnr",34,"UIT4",48,1],["pdnr",34,"UIT4",49,1],["ftfdf",14,"UIT4",82,1],["ftpdf",8,"UIT4",82,1],["pdnr",38,"UIT4",51,1],["ftpdf",9,"UBA1",83,1],["item_qual",28,"UBA1",83,1],["late_gt15",22,"UIL7",104,1],["pdnr",34,"UIL7",104,1],["late_gt15",2,"UIL7",2,1],["item_miss",26,"UIL7",7,1],["ftfdf",14,"UIT1",1,1],["pdnr",41,"UIT1",112,1],["ftfdf",19,"UIT1",10,1],["ftpdf",25,"UIT1",10,1],["ftfdf",6,"UIT1",113,1],["item_qual",28,"UIT1",87,1],["item_miss",26,"UIT1",87,1],["pdnr",34,"UIT1",87,1],["item_qual",28,"UIT1",89,1],["late_gt15",5,"UIT1",89,1],["ftfdf",19,"UIT1",89,1],["late",18,"UIT1",89,1],["late_gt15",18,"UIT1",89,1],["late",2,"UIT1",90,1],["ftfdf",12,"UIT1",19,1],["ftfdf",6,"UIT1",19,1],["late",5,"UIT1",91,1],["ftfdf",6,"UIT1",62,1],["ftfdf",35,"UIT1",22,1],["late",13,"UIT1",22,1],["late",5,"UIT1",22,1],["pdnr",34,"UIT4",65,1],["item_miss",26,"UIT4",65,1],["fdnr",39,"UIT4",66,1],["ftpdf",36,"UIT4",66,1],["late",44,"UIT4",66,1],["late_gt15",44,"UIT4",66,1],["pdnr",34,"UIT4",67,1],["late_gt15",2,"UIT4",67,1],["late_gt15",13,"UIT4",67,1],["ftpdf",25,"UIT4",68,1],["late",13,"UIT4",27,1],["late",2,"UIT4",27,1],["late_gt15",2,"UIT4",27,1],["late",5,"UIT4",27,1],["ftpdf",3,"UIT4",71,1],["fdnr",39,"UIT4",71,1],["late",5,"UIT4",71,1],["late",5,"UIT4",31,1],["ftpdf",3,"UIT4",31,1],["pdnr",34,"UIT4",32,1],["ftfdf",14,"UIT4",73,1],["late",5,"UIT4",73,1],["late",2,"UIT4",75,1],["ftpdf",9,"UIT4",97,1],["late",2,"UIT4",97,1],["ftdc",24,"UIT4",97,1],["late_gt15",13,"UIT4",38,1],["item_qual",28,"UIT4",39,1],["pdnr",38,"UIT4",41,1],["pdnr",37,"UIT4",41,1],["pdnr",38,"UIT4",42,1],["late",13,"UIT4",43,1],["ftfdf",15,"UIT4",43,1],["ftfdf",6,"UIT4",43,1],["late",5,"UIT4",44,1],["late_gt15",5,"UIT4",45,1],["ftfdf",19,"UIT4",45,1],["late",13,"UIT4",45,1],["ftfdf",6,"UIT4",47,1],["ftdc",24,"UIT4",100,1],["item_qual",28,"UIT4",100,1],["ftfdf",27,"UIT4",80,1],["ftfdf",11,"UIT4",80,1],["late_gt15",2,"UIT4",80,1],["late_gt15",40,"UIL7",4,1],["pdnr",34,"UIL7",4,1],["ftfdf",21,"UIL7",56,1],["late",5,"UIL7",85,1],["ftpdf",3,"UIL7",6,1],["item_miss",26,"UIT1",8,1],["late",13,"UIT1",8,1],["ftfdf",19,"UIT1",86,1],["item_qual",28,"UIT1",113,1],["item_miss",26,"UIT1",59,1],["item_miss",26,"UIT1",60,1],["ftfdf",14,"UIT1",13,1],["late_gt15",5,"UIT1",88,1],["item_qual",28,"UIT1",88,1],["late",5,"UIT1",108,1],["late_gt15",13,"UIT1",109,1],["ftfdf",12,"UIT1",57,1],["ftfdf",14,"UIT1",19,1],["ftfdf",15,"UIT1",19,1],["fdnr",39,"UIT1",91,1],["ftpdf",3,"UIT1",64,1],["ftpdf",3,"UIT4",66,1],["ftfdf",33,"UIT4",68,1],["ftfdf",15,"UIT4",92,1],["late_gt15",5,"UIT4",70,1],["ftdc",16,"UIT4",29,1],["ftfdf",35,"UIT4",105,1],["item_miss",26,"UIT4",105,1],["ftdc",24,"UIT4",115,1],["late",2,"UIT4",115,1],["item_qual",28,"UIT4",32,1],["pdnr",45,"UIT4",32,1],["late",2,"UIT4",73,1],["ftfdf",19,"UIT4",74,1],["item_qual",28,"UIT4",74,1],["late",13,"UIT4",74,1],["late_gt15",2,"UIT4",34,1],["ftfdf",6,"UIT4",99,1],["ftpdf",9,"UIT4",38,1],["ftdc",24,"UIT4",38,1],["late_gt15",2,"UIT4",39,1],["ftfdf",12,"UIT4",42,1],["late",5,"UIT4",42,1],["ftfdf",14,"UIT4",44,1],["item_miss",26,"UIT4",46,1],["pdnr",34,"UIT4",47,1],["ftfdf",27,"UIT4",48,1],["ftpdf",0,"UIT4",48,1],["ftpdf",31,"UIT4",80,1],["ftfdf",14,"UIT4",101,1],["fdnr",39,"UIT4",51,1],["late",13,"UIT4",51,1],["late_gt15",13,"UIT4",51,1],["ftpdf",3,"UBA1",52,1],["pdnr",34,"UBA1",52,1],["late_gt15",22,"UBA1",53,1],["ftpdf",29,"UBA1",54,1],["item_miss",26,"UBA1",54,1],["late_gt15",18,"UIL7",104,1],["ftpdf",46,"UIL7",104,1],["ftpdf",0,"UIL7",104,1],["ftpdf",25,"UIL7",4,1],["late",40,"UIL7",84,1],["item_miss",26,"UIL7",5,1],["late",2,"UIL7",7,1],["late_gt15",2,"UIL7",7,1],["ftfdf",35,"UIL7",7,1],["pdnr",34,"UIT1",3,1],["ftfdf",19,"UIT1",3,1],["late",13,"UIT1",112,1],["late_gt15",13,"UIT1",112,1],["ftpdf",8,"UIT1",10,1],["ftpdf",29,"UIT1",10,1],["late",18,"UIT1",10,1],["late_gt15",18,"UIT1",10,1],["pdnr",37,"UIT1",59,1],["ftpdf",25,"UIT1",59,1],["ftpdf",29,"UIT1",60,1],["ftdc",24,"UIT1",60,1],["ftpdf",3,"UIT1",108,1],["item_miss",26,"UIT1",15,1],["item_miss",26,"UIT1",57,1],["ftpdf",8,"UIT1",16,1],["ftfdf",14,"UIT1",16,1],["pdnr",34,"UIT1",18,1],["late",18,"UIT1",91,1],["item_qual",28,"UIT1",91,1],["ftfdf",14,"UIT1",62,1],["late_gt15",5,"UIT1",62,1],["item_miss",26,"UIT1",62,1],["ftfdf",15,"UIT1",21,1],["ftfdf",14,"UIT4",23,1],["ftfdf",15,"UIT4",68,1],["ftfdf",12,"UIT4",26,1],["ftpdf",31,"UIT4",26,1],["late",2,"UIT4",70,1],["ftfdf",12,"UIT4",70,1],["ftdc",24,"UIT4",70,1],["ftpdf",9,"UIT4",29,1],["pdnr",38,"UIT4",99,1],["item_qual",28,"UIT4",46,1],["ftfdf",14,"UIT4",47,1],["ftfdf",14,"UIT4",107,1],["pdnr",41,"UIT4",101,1],["pdnr",47,"UIT4",101,1],["item_miss",26,"UIT4",49,1],["item_qual",28,"UIT4",49,1],["ftpdf",3,"UBA1",53,1],["late_gt15",22,"UBA1",54,1],["ftpdf",9,"UIL7",84,1],["item_qual",28,"UIL7",84,1],["ftpdf",36,"UIL7",56,1],["item_qual",28,"UIL7",56,1],["pdnr",41,"UIL7",56,1],["late",5,"UIL7",88,1],["item_qual",28,"UIL7",88,1],["item_miss",26,"UIT1",3,1],["late_gt15",5,"UIT1",8,1],["late_gt15",5,"UIT1",10,1],["ftfdf",15,"UIT1",58,1],["late",18,"UIT1",60,1],["item_miss",26,"UIT1",108,1],["late",5,"UIT1",16,1],["pdnr",34,"UIT1",5,1],["pdnr",32,"UIT1",90,1],["ftfdf",12,"UIT1",91,1],["ftpdf",9,"UIT1",62,1],["item_qual",28,"UIT1",62,1],["late",2,"UIT4",65,1],["item_qual",28,"UIT4",65,1],["ftfdf",12,"UIT4",65,1],["late",5,"UIT4",116,1],["late_gt15",5,"UIT4",116,1],["ftpdf",29,"UIT4",116,1],["item_miss",26,"UIT4",116,1],["ftpdf",0,"UIT4",68,1],["pdnr",34,"UIT4",68,1],["ftfdf",14,"UIT4",26,1],["late",13,"UIT4",71,1],["late_gt15",13,"UIT4",71,1],["ftfdf",12,"UIT4",93,1],["ftfdf",12,"UIT4",105,1],["late_gt15",5,"UIT4",30,1],["late",13,"UIT4",30,1],["late",13,"UIT4",95,1],["late_gt15",13,"UIT4",95,1],["pdnr",34,"UIT4",99,1],["item_miss",26,"UIT4",37,1],["ftpdf",8,"UIT4",37,1],["late",18,"UIT4",37,1],["late",13,"UIT4",106,1],["late_gt15",13,"UIT4",106,1],["item_qual",28,"UIT4",79,1],["ftpdf",31,"UIT4",79,1],["ftfdf",6,"UIT4",79,1],["late",10,"UIT4",79,1],["pdnr",34,"UIT4",43,1],["item_qual",28,"UIT4",43,1],["ftpdf",9,"UIT4",44,1],["late_gt15",13,"UIT4",47,1],["ftfdf",17,"UIT4",47,1],["late_gt15",13,"UIT4",100,1],["ftpdf",3,"UIT4",100,1],["ftfdf",15,"UBA1",52,1],["ftpdf",3,"UIL7",4,1],["item_miss",26,"UIT1",1,1],["ftfdf",35,"UIT1",3,1],["item_qual",28,"UIT1",10,1],["item_miss",26,"UIT1",88,1],["late",2,"UIT1",61,1],["late_gt15",2,"UIT1",61,1],["late_gt15",5,"UIT1",61,1],["ftpdf",9,"UIT1",61,1],["ftpdf",3,"UIT1",109,1],["pdnr",38,"UIT1",109,1],["ftpdf",0,"UIT1",57,1],["pdnr",48,"UIT1",16,1],["ftfdf",14,"UIT1",90,1],["ftfdf",6,"UIT1",90,1],["late",18,"UIT1",6,1],["item_miss",26,"UIT1",19,1],["ftfdf",33,"UIT1",62,1],["ftfdf",17,"UIT4",26,1],["late",18,"UIT4",71,1],["late_gt15",18,"UIT4",71,1],["ftpdf",3,"UIT4",105,1],["item_qual",28,"UIT4",110,1],["fdnr",39,"UIT4",115,1],["late",10,"UIT4",31,1],["late_gt15",10,"UIT4",31,1],["pdnr",34,"UIT4",31,1],["ftpdf",8,"UIT4",73,1],["pdnr",34,"UIT4",73,1],["ftfdf",1,"UIT4",73,1],["pdnr",38,"UIT4",73,1],["ftfdf",12,"UIT4",77,1],["ftpdf",0,"UIT4",38,1],["ftpdf",9,"UIT4",42,1],["item_qual",28,"UIT4",42,1],["ftfdf",12,"UIT4",43,1],["late",2,"UIT4",43,1],["late",18,"UIT4",45,1],["late_gt15",18,"UIT4",45,1],["late",18,"UIT4",107,1],["ftpdf",25,"UIT4",107,1],["late",5,"UIT4",107,1],["ftfdf",14,"UIT4",114,1],["late",5,"UIT4",114,1],["late_gt15",5,"UIT4",48,1],["pdnr",45,"UIT4",48,1],["ftpdf",9,"UIT4",48,1],["pdnr",34,"UIT4",101,1],["ftpdf",0,"UIT4",101,1],["late_gt15",18,"UIT4",49,1],["ftfdf",14,"UBA1",52,1],["late",22,"UBA1",52,1],["late_gt15",22,"UBA1",52,1],["item_qual",28,"UBA1",52,1],["ftfdf",14,"UBA1",0,1],["ftfdf",14,"UIL7",104,1],["item_qual",28,"UIL7",85,1],["ftfdf",14,"UIT1",58,1],["item_miss",26,"UIT1",58,1],["ftfdf",1,"UIT1",5,1],["late",18,"UIT1",90,1],["late_gt15",18,"UIT1",90,1],["late",5,"UIT1",6,1],["late_gt15",5,"UIT1",6,1],["item_qual",28,"UIT1",19,1],["ftfdf",14,"UIT4",67,1],["late_gt15",2,"UIT4",26,1],["item_qual",28,"UIT4",26,1],["item_qual",28,"UIT4",70,1],["ftfdf",14,"UIT4",29,1],["pdnr",34,"UIT4",71,1],["ftpdf",0,"UIT4",31,1],["pdnr",34,"UIT4",97,1],["ftpdf",9,"UIT4",99,1],["pdnr",34,"UIT4",78,1],["item_miss",26,"UIT4",39,1],["pdnr",38,"UIT4",39,1],["ftpdf",25,"UIT4",39,1],["ftfdf",14,"UIT4",43,1],["ftfdf",14,"UIT4",46,1],["ftpdf",3,"UIT4",107,1],["item_qual",28,"UIT4",114,1],["ftfdf",15,"UIT4",117,1],["ftdc",24,"UIT4",117,1],["item_qual",28,"UIT4",48,1],["ftpdf",8,"UIT4",48,1],["pdnr",38,"UIT4",49,1]]},
"2026-W37":{"o":{"UIT4":2488,"UIT1":1401,"UBA1":301,"UIL7":378},"d":{"UBA1":18,"UIL7":79,"UIT1":150,"UIT4":429},"r":[["late",2,"UIT4",81,10],["late",5,"UIT4",47,9],["late",13,"UIT1",60,9],["late",13,"UIT4",70,9],["late",5,"UIT4",51,8],["late",2,"UIL7",2,7],["late_gt15",13,"UIT4",70,7],["ftfdf",17,"UIT4",33,7],["late_gt15",2,"UIT4",81,7],["late_gt15",2,"UIL7",2,6],["late",5,"UIT4",38,6],["late",13,"UIT4",65,6],["late",5,"UIT4",33,6],["late",5,"UIT4",82,6],["late",5,"UIT4",96,6],["item_miss",26,"UIT4",101,6],["ftpdf",3,"UIL7",4,5],["late",2,"UIT1",17,5],["late",5,"UIT4",42,5],["late_gt15",5,"UIT4",47,5],["late",5,"UIT4",49,5],["late_gt15",5,"UIT4",51,5],["late",5,"UIL7",55,5],["late",2,"UIL7",56,5],["late",13,"UIT4",76,5],["late",2,"UIT4",79,5],["ftfdf",20,"UIT4",81,5],["late",5,"UIL7",104,5],["late",10,"UIL7",6,4],["ftfdf",6,"UIT1",16,4],["late_gt15",2,"UIT1",17,4],["late_gt15",5,"UIT4",38,4],["late_gt15",5,"UIL7",55,4],["late_gt15",13,"UIT1",60,4],["late",13,"UIT1",63,4],["late_gt15",13,"UIT4",65,4],["late",5,"UIT4",65,4],["ftdc",23,"UIT4",67,4],["late",5,"UIT4",69,4],["late",5,"UIT4",70,4],["late_gt15",5,"UIT4",70,4],["late_gt15",5,"UIT4",33,4],["late_gt15",13,"UIT4",76,4],["ftfdf",17,"UIT4",80,4],["late",13,"UIT4",82,4],["ftfdf",6,"UIT1",8,4],["late",13,"UIT1",21,4],["late",2,"UIT4",94,4],["late",13,"UIT4",79,4],["late_gt15",13,"UIT4",79,4],["item_miss",26,"UIT4",43,4],["late",13,"UIT4",100,4],["late_gt15",5,"UIL7",104,4],["late",5,"UIT4",68,4],["late",2,"UIL7",1,3],["late",5,"UIL7",2,3],["late",5,"UIL7",5,3],["late",2,"UIT1",13,3],["late",2,"UIT4",23,3],["ftfdf",17,"UIT4",26,3],["late",5,"UIT4",29,3],["ftpdf",3,"UIT4",30,3],["ftfdf",14,"UIT4",31,3],["ftfdf",6,"UIT4",33,3],["late",5,"UIL7",4,3],["late_gt15",5,"UIL7",4,3],["late_gt15",2,"UIL7",56,3],["late",13,"UIT1",9,3],["late",10,"UIT1",9,3],["late",13,"UIT1",4,3],["late",5,"UIT1",62,3],["late",5,"UIT1",64,3],["ftfdf",19,"UIT4",70,3],["ftpdf",3,"UIT4",73,3],["late",5,"UIT4",74,3],["ftpdf",3,"UIT4",75,3],["late",13,"UIT4",33,3],["late_gt15",13,"UIT4",33,3],["late",2,"UIT4",35,3],["late_gt15",2,"UIT4",79,3],["late",13,"UIT4",46,3],["late",13,"UIT4",47,3],["late",5,"UIT4",80,3],["late",13,"UIT4",49,3],["ftpdf",3,"UIT4",81,3],["late_gt15",13,"UIT4",82,3],["late",5,"UIL7",1,3],["late",2,"UIL7",84,3],["late_gt15",2,"UIL7",84,3],["item_miss",26,"UIL7",84,3],["late",18,"UIT1",3,3],["item_qual",28,"UIT1",5,3],["late",13,"UIT1",64,3],["late",5,"UIT4",92,3],["late_gt15",2,"UIT4",94,3],["late_gt15",5,"UIT4",96,3],["late_gt15",13,"UIT4",100,3],["late",5,"UIT4",100,3],["late_gt15",5,"UIT4",100,3],["item_qual",28,"UIT4",101,3],["late",13,"UIT4",81,3],["late_gt15",5,"UIT4",82,3],["late_gt15",5,"UIT4",68,3],["item_miss",26,"UIT4",27,3],["item_miss",26,"UIT4",51,3],["late_gt15",5,"UIL7",2,2],["ftfdf",7,"UIL7",2,2],["late",5,"UIL7",3,2],["late_gt15",5,"UIL7",5,2],["late_gt15",10,"UIL7",6,2],["ftfdf",11,"UIT1",8,2],["late",2,"UIT1",10,2],["ftdc",16,"UIT4",23,2],["late_gt15",2,"UIT4",23,2],["late",5,"UIT4",24,2],["late_gt15",5,"UIT4",24,2],["ftpdf",3,"UIT4",27,2],["ftpdf",0,"UIT4",30,2],["late",5,"UIT4",30,2],["late_gt15",5,"UIT4",30,2],["late",5,"UIT4",32,2],["ftpdf",0,"UIT4",35,2],["ftpdf",8,"UIT4",35,2],["late",2,"UIT4",36,2],["ftpdf",0,"UIT4",38,2],["late",18,"UIT4",40,2],["late_gt15",5,"UIT4",42,2],["ftpdf",3,"UIT4",42,2],["ftfdf",19,"UIT4",42,2],["late",2,"UIT4",43,2],["late",2,"UIL7",57,2],["late_gt15",13,"UIT1",4,2],["ftfdf",6,"UIT1",59,2],["late",2,"UIT1",59,2],["ftfdf",6,"UIT1",61,2],["late",13,"UIT1",16,2],["late",5,"UIT1",16,2],["late_gt15",5,"UIT1",62,2],["ftpdf",9,"UIT1",63,2],["late_gt15",5,"UIT1",64,2],["late_gt15",5,"UIT4",65,2],["late",13,"UIT4",66,2],["late_gt15",13,"UIT4",66,2],["late",5,"UIT4",67,2],["late",13,"UIT4",67,2],["ftfdf",14,"UIT4",26,2],["ftpdf",3,"UIT4",71,2],["late",13,"UIT4",74,2],["late",13,"UIT4",75,2],["ftfdf",14,"UIT4",76,2],["late",13,"UIT4",77,2],["late_gt15",2,"UIT4",35,2],["late",13,"UIT4",37,2],["late",5,"UIT4",37,2],["late",13,"UIT4",39,2],["late",13,"UIT4",45,2],["late_gt15",13,"UIT4",45,2],["late_gt15",13,"UIT4",46,2],["late_gt15",13,"UIT4",49,2],["ftpdf",3,"UIT4",49,2],["item_miss",26,"UBA1",83,2],["late_gt15",5,"UIL7",1,2],["ftpdf",3,"UIL7",84,2],["late_gt15",18,"UIT1",3,2],["item_miss",26,"UIT1",62,2],["late_gt15",13,"UIT1",21,2],["late_gt15",5,"UIT4",69,2],["item_qual",28,"UIT4",27,2],["item_miss",26,"UIT4",71,2],["late",13,"UIT4",94,2],["item_qual",28,"UIT4",73,2],["late",5,"UIT4",73,2],["late",2,"UIT4",97,2],["late_gt15",2,"UIT4",97,2],["late",18,"UIT4",97,2],["late",5,"UIT4",98,2],["item_miss",26,"UIT4",78,2],["item_miss",26,"UIT4",38,2],["late",18,"UIT4",79,2],["item_qual",28,"UIT4",42,2],["ftpdf",9,"UIT4",43,2],["ftdc",24,"UIT4",47,2],["late_gt15",13,"UIT4",81,2],["item_miss",26,"UIT4",82,2],["late",5,"UIL7",6,2],["late_gt15",5,"UIL7",6,2],["late",2,"UIL7",6,2],["late",2,"UIL7",7,2],["item_miss",26,"UIT1",87,2],["ftpdf",0,"UIT1",60,2],["late",18,"UIT1",60,2],["item_miss",26,"UIT1",13,2],["item_miss",26,"UIT1",15,2],["ftfdf",14,"UIT4",92,2],["ftpdf",3,"UIT4",97,2],["item_miss",26,"UIT4",41,2],["item_qual",28,"UIT4",44,2],["item_qual",28,"UIT4",51,2],["late",2,"UIT4",51,2],["ftpdf",0,"UBA1",0,1],["ftfdf",1,"UIL7",1,1],["ftpdf",3,"UIL7",1,1],["late_gt15",2,"UIL7",1,1],["ftfdf",4,"UIL7",1,1],["ftfdf",6,"UIL7",2,1],["ftpdf",8,"UIL7",3,1],["late_gt15",5,"UIL7",3,1],["ftpdf",9,"UIL7",4,1],["ftpdf",3,"UIL7",7,1],["late",5,"UIT1",8,1],["ftfdf",12,"UIT1",9,1],["late",2,"UIT1",11,1],["late_gt15",2,"UIT1",11,1],["late",5,"UIT1",12,1],["late_gt15",5,"UIT1",12,1],["ftfdf",6,"UIT1",13,1],["late_gt15",2,"UIT1",13,1],["late",13,"UIT1",14,1],["late",5,"UIT1",14,1],["ftfdf",6,"UIT1",15,1],["ftfdf",14,"UIT1",17,1],["late",5,"UIT1",18,1],["late_gt15",5,"UIT1",18,1],["ftfdf",1,"UIT1",19,1],["late",5,"UIT1",20,1],["late_gt15",5,"UIT1",20,1],["ftfdf",15,"UIT1",21,1],["ftpdf",3,"UIT1",22,1],["ftfdf",15,"UIT4",25,1],["late",18,"UIT4",26,1],["late",13,"UIT4",27,1],["ftfdf",14,"UIT4",27,1],["late",2,"UIT4",28,1],["ftfdf",17,"UIT4",30,1],["ftpdf",3,"UIT4",32,1],["late_gt15",5,"UIT4",32,1],["ftdc",16,"UIT4",33,1],["late",2,"UIT4",34,1],["late",5,"UIT4",34,1],["late",18,"UIT4",35,1],["late_gt15",2,"UIT4",36,1],["late",2,"UIT4",37,1],["ftfdf",15,"UIT4",37,1],["late",2,"UIT4",39,1],["late",5,"UIT4",41,1],["late",18,"UIT4",42,1],["ftfdf",20,"UIT4",43,1],["ftfdf",14,"UIT4",43,1],["ftfdf",6,"UIT4",43,1],["ftfdf",21,"UIT4",43,1],["ftfdf",21,"UIT4",44,1],["ftpdf",3,"UIT4",44,1],["ftfdf",6,"UIT4",44,1],["late",5,"UIT4",45,1],["ftfdf",14,"UIT4",46,1],["late",5,"UIT4",48,1],["ftfdf",17,"UIT4",49,1],["late",5,"UIT4",50,1],["late",13,"UIT4",50,1],["ftpdf",3,"UBA1",52,1],["ftpdf",9,"UBA1",52,1],["ftpdf",9,"UBA1",53,1],["late",22,"UBA1",0,1],["ftfdf",17,"UBA1",0,1],["ftfdf",14,"UBA1",54,1],["ftfdf",17,"UBA1",54,1],["ftfdf",19,"UIL7",4,1],["ftfdf",11,"UIL7",56,1],["ftfdf",1,"UIL7",57,1],["ftfdf",15,"UIT1",3,1],["ftfdf",17,"UIT1",3,1],["late_gt15",10,"UIT1",9,1],["late",5,"UIT1",58,1],["late_gt15",5,"UIT1",58,1],["ftfdf",12,"UIT1",58,1],["late",5,"UIT1",60,1],["ftfdf",15,"UIT1",15,1],["ftfdf",14,"UIT1",16,1],["late_gt15",13,"UIT1",16,1],["late",10,"UIT1",17,1],["ftfdf",6,"UIT1",62,1],["late_gt15",13,"UIT1",63,1],["late",18,"UIT1",63,1],["late_gt15",18,"UIT1",63,1],["ftfdf",17,"UIT4",66,1],["ftfdf",20,"UIT4",67,1],["late_gt15",13,"UIT4",67,1],["late",13,"UIT4",25,1],["ftpdf",3,"UIT4",25,1],["ftfdf",6,"UIT4",68,1],["ftpdf",3,"UIT4",68,1],["late",2,"UIT4",26,1],["ftfdf",6,"UIT4",27,1],["late",5,"UIT4",27,1],["ftdc",24,"UIT4",70,1],["ftfdf",20,"UIT4",70,1],["ftpdf",3,"UIT4",31,1],["ftpdf",25,"UIT4",72,1],["late",13,"UIT4",72,1],["ftfdf",14,"UIT4",73,1],["late",13,"UIT4",73,1],["late_gt15",13,"UIT4",73,1],["ftpdf",25,"UIT4",74,1],["late_gt15",5,"UIT4",74,1],["late_gt15",13,"UIT4",74,1],["late",5,"UIT4",75,1],["late_gt15",13,"UIT4",75,1],["late_gt15",13,"UIT4",77,1],["late",5,"UIT4",36,1],["late",13,"UIT4",36,1],["ftdc",23,"UIT4",37,1],["ftfdf",14,"UIT4",78,1],["ftfdf",12,"UIT4",38,1],["ftfdf",21,"UIT4",42,1],["late",13,"UIT4",42,1],["late",2,"UIT4",45,1],["late_gt15",2,"UIT4",45,1],["ftpdf",0,"UIT4",45,1],["late",18,"UIT4",45,1],["late",5,"UIT4",46,1],["ftfdf",12,"UIT4",47,1],["ftfdf",6,"UIT4",80,1],["late_gt15",5,"UIT4",80,1],["ftfdf",19,"UIT4",80,1],["late",2,"UIT4",49,1],["late_gt15",5,"UIT4",49,1],["ftfdf",1,"UBA1",52,1],["ftpdf",8,"UBA1",83,1],["ftfdf",6,"UBA1",83,1],["ftfdf",27,"UIL7",55,1],["ftpdf",3,"UIL7",55,1],["ftfdf",14,"UIL7",85,1],["late",5,"UIT1",3,1],["ftpdf",3,"UIT1",3,1],["late",18,"UIT1",9,1],["late",5,"UIT1",86,1],["item_qual",28,"UIT1",86,1],["item_qual",28,"UIT1",10,1],["late_gt15",2,"UIT1",10,1],["ftpdf",29,"UIT1",87,1],["item_qual",28,"UIT1",87,1],["ftdc",30,"UIT1",87,1],["item_qual",28,"UIT1",59,1],["ftpdf",31,"UIT1",60,1],["late",2,"UIT1",60,1],["item_qual",28,"UIT1",11,1],["pdnr",32,"UIT1",11,1],["ftfdf",33,"UIT1",88,1],["late",5,"UIT1",61,1],["ftpdf",3,"UIT1",61,1],["item_qual",28,"UIT1",57,1],["item_miss",26,"UIT1",89,1],["late",5,"UIT1",17,1],["late_gt15",5,"UIT1",17,1],["late",18,"UIT1",17,1],["late",18,"UIT1",90,1],["item_miss",26,"UIT1",90,1],["late",13,"UIT1",91,1],["item_qual",28,"UIT1",91,1],["item_miss",26,"UIT1",91,1],["ftfdf",14,"UIT1",91,1],["ftfdf",12,"UIT1",62,1],["pdnr",34,"UIT1",62,1],["item_qual",28,"UIT1",63,1],["ftfdf",19,"UIT1",21,1],["late",18,"UIT1",21,1],["item_qual",28,"UIT1",22,1],["late_gt15",13,"UIT1",64,1],["ftfdf",14,"UIT4",65,1],["pdnr",34,"UIT4",65,1],["late",10,"UIT4",65,1],["late",5,"UIT4",23,1],["ftfdf",35,"UIT4",67,1],["item_miss",26,"UIT4",25,1],["item_qual",28,"UIT4",25,1],["pdnr",34,"UIT4",26,1],["item_miss",26,"UIT4",26,1],["ftfdf",12,"UIT4",26,1],["item_qual",28,"UIT4",92,1],["ftfdf",19,"UIT4",92,1],["late",2,"UIT4",69,1],["late_gt15",2,"UIT4",69,1],["ftpdf",9,"UIT4",27,1],["item_miss",26,"UIT4",70,1],["late",5,"UIT4",71,1],["item_miss",26,"UIT4",93,1],["ftfdf",15,"UIT4",30,1],["ftpdf",36,"UIT4",94,1],["item_qual",28,"UIT4",95,1],["late",18,"UIT4",73,1],["item_qual",28,"UIT4",96,1],["item_miss",26,"UIT4",97,1],["item_qual",28,"UIT4",97,1],["late_gt15",5,"UIT4",98,1],["item_qual",28,"UIT4",76,1],["item_qual",28,"UIT4",34,1],["late",10,"UIT4",77,1],["ftfdf",17,"UIT4",77,1],["ftpdf",3,"UIT4",99,1],["pdnr",34,"UIT4",99,1],["item_miss",26,"UIT4",99,1],["item_miss",26,"UIT4",37,1],["ftpdf",8,"UIT4",37,1],["item_miss",26,"UIT4",39,1],["item_qual",28,"UIT4",39,1],["ftfdf",1,"UIT4",41,1],["ftfdf",20,"UIT4",41,1],["ftpdf",3,"UIT4",41,1],["late_gt15",18,"UIT4",79,1],["item_qual",28,"UIT4",79,1],["ftfdf",14,"UIT4",42,1],["item_qual",28,"UIT4",43,1],["item_qual",28,"UIT4",47,1],["late_gt15",13,"UIT4",47,1],["pdnr",34,"UIT4",47,1],["pdnr",34,"UIT4",48,1],["ftfdf",12,"UIT4",101,1],["ftfdf",21,"UIT4",101,1],["ftpdf",25,"UIT4",81,1],["ftfdf",7,"UIT4",81,1],["item_qual",28,"UIT4",81,1],["item_miss",26,"UIT4",81,1],["ftfdf",14,"UIT4",82,1],["item_qual",28,"UIT4",82,1],["pdnr",34,"UIT4",82,1],["pdnr",37,"UBA1",102,1],["ftpdf",8,"UBA1",102,1],["late",22,"UBA1",103,1],["item_miss",26,"UBA1",54,1],["item_qual",28,"UBA1",54,1],["ftfdf",17,"UIL7",104,1],["item_miss",26,"UIL7",4,1],["ftdc",23,"UIL7",56,1],["late_gt15",2,"UIL7",7,1],["ftfdf",6,"UIL7",7,1],["item_miss",26,"UIT1",8,1],["item_miss",26,"UIT1",86,1],["late",5,"UIT1",10,1],["item_miss",26,"UIT1",59,1],["late_gt15",18,"UIT1",60,1],["pdnr",38,"UIT1",60,1],["item_qual",28,"UIT1",60,1],["item_qual",28,"UIT1",88,1],["item_qual",28,"UIT1",15,1],["late",2,"UIT1",15,1],["late_gt15",2,"UIT1",15,1],["ftfdf",14,"UIT1",89,1],["item_qual",28,"UIT1",18,1],["ftpdf",8,"UIT1",21,1],["late",2,"UIT1",21,1],["late",2,"UIT4",66,1],["late_gt15",2,"UIT4",66,1],["ftfdf",14,"UIT4",67,1],["ftpdf",9,"UIT4",68,1],["item_qual",28,"UIT4",68,1],["pdnr",34,"UIT4",68,1],["pdnr",34,"UIT4",27,1],["ftpdf",8,"UIT4",27,1],["item_qual",28,"UIT4",70,1],["late_gt15",5,"UIT4",29,1],["ftpdf",25,"UIT4",105,1],["item_qual",28,"UIT4",105,1],["pdnr",38,"UIT4",30,1],["late_gt15",5,"UIT4",73,1],["fdnr",39,"UIT4",73,1],["pdnr",38,"UIT4",73,1],["late",5,"UIT4",97,1],["late_gt15",5,"UIT4",97,1],["ftfdf",12,"UIT4",36,1],["item_miss",26,"UIT4",36,1],["item_qual",28,"UIT4",78,1],["item_qual",28,"UIT4",106,1],["ftpdf",3,"UIT4",79,1],["pdnr",34,"UIT4",43,1],["ftpdf",9,"UIT4",44,1],["item_miss",26,"UIT4",44,1],["item_miss",26,"UIT4",107,1],["ftfdf",14,"UIT4",80,1],["item_qual",28,"UIT4",80,1],["late",2,"UIT4",80,1],["ftpdf",0,"UIT4",101,1],["ftpdf",9,"UIT4",101,1],["ftfdf",6,"UIT4",82,1],["ftfdf",17,"UIT4",82,1],["ftpdf",3,"UIT4",51,1],["ftfdf",27,"UIT4",51,1],["late_gt15",2,"UIT4",51,1]]},
};

function getStatusConfig(d) {
  if (!d || d.late == null) return {bg:"#1e293b",border:"#475569",text:"#94a3b8",label:"NO DATA",icon:"?"};
  if (d.late > 6 || (d.fondCtrl != null && d.fondCtrl > 2)) return {bg:"#450a0a",border:"#dc2626",text:"#fca5a5",label:"CRITICAL",icon:"◆"};
  if (d.late > 3 || (d.fondCtrl != null && d.fondCtrl > 1)) return {bg:"#451a03",border:"#d97706",text:"#fcd34d",label:"WARNING",icon:"▲"};
  if (d.late < 1.5) return {bg:"#052e16",border:"#16a34a",text:"#86efac",label:"EXCELLENT",icon:"●"};
  return {bg:"#0c1a2e",border:"#2563eb",text:"#93c5fd",label:"ON TRACK",icon:"■"};
}
function ChartTooltip({active,payload,label}) {
  if (!active||!payload?.length) return null;
  return (<div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:6,padding:"8px 12px",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}><p style={{color:"#64748b",fontSize:10,margin:"0 0 4px",fontFamily:"'DM Mono',monospace"}}>{label}</p>{payload.filter(p=>p.value!=null).map((p,i)=>(<p key={i} style={{color:p.color||p.stroke,fontSize:11,margin:"2px 0",fontFamily:"'DM Mono',monospace"}}>{p.name}: <strong>{typeof p.value==="number"?p.value.toFixed(2):p.value}%</strong></p>))}</div>);
}
function MiniSpark({data,width=90,height=24}) {
  const vals=data.filter(d=>d.late!=null).map(d=>d.late);
  if (vals.length<2) return null;
  const max=Math.max(...vals),min=Math.min(...vals),range=max-min||1,last8=vals.slice(-8);
  const pts=last8.map((v,i)=>{const x=(i/(last8.length-1))*width;const y=height-2-((v-min)/range)*(height-4);return `${x},${y}`;});
  const trend=last8[last8.length-1]>last8[0]?"#ef4444":"#22c55e";
  return (<svg width={width} height={height}><polyline points={pts.join(" ")} fill="none" stroke={trend} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8}/>{last8.map((v,i)=>{const x=(i/(last8.length-1))*width;const y=height-2-((v-min)/range)*(height-4);return <circle key={i} cx={x} cy={y} r={i===last8.length-1?2.5:1} fill={i===last8.length-1?trend:"#475569"}/>;})}</svg>);
}

// ─── FILTER BAR ─────────────────────────────────────────────────────
function FilterBar({selectedYear,setSelectedYear,selectedDepots,setSelectedDepots,weekFrom,setWeekFrom,weekTo,setWeekTo,availableWeeks,t,isMobile}) {
  const toggleDepot = d => setSelectedDepots(prev => prev.includes(d) ? (prev.length > 1 ? prev.filter(x=>x!==d) : prev) : [...prev, d]);
  const allSelected = selectedDepots.length === ALL_DEPOTS.length;
  const ss = {background:"#0f172a",color:"#e2e8f0",border:"1px solid #334155",borderRadius:5,padding:"5px 8px",fontSize:11,fontFamily:"'DM Mono',monospace",cursor:"pointer",outline:"none",minWidth:70};
  const yrBtn = (yr, active) => ({
    background: active ? (yr === "ALL" ? "#1e293b" : `${yr===2025?"#3b82f6":"#f59e0b"}18`) : "transparent",
    border: active ? `1px solid ${yr==="ALL"?"#475569":yr===2025?"#3b82f650":"#f59e0b50"}` : "1px solid #1e293b",
    color: active ? (yr==="ALL"?"#e2e8f0":yr===2025?"#93c5fd":"#fbbf24") : "#334155",
    borderRadius:5,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace",transition:"all 0.15s"
  });
  return (
    <div style={{display:"flex",alignItems:"center",gap:isMobile?8:14,padding:isMobile?"10px 16px":"12px 32px",background:"#0a0f1a",borderBottom:"1px solid #1e293b",flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <span style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",whiteSpace:"nowrap"}}>{t("year")}</span>
        {["ALL",...ALL_YEARS].map(yr => (
          <button key={yr} onClick={()=>setSelectedYear(yr)} style={yrBtn(yr,selectedYear===yr)}>{yr==="ALL"?"All":yr}</button>
        ))}
      </div>
      {!isMobile&&<div style={{width:1,height:24,background:"#1e293b"}}/>}
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <span style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",whiteSpace:"nowrap"}}>{t("station")}</span>
        <button onClick={()=>setSelectedDepots([...ALL_DEPOTS])} style={{background:allSelected?"#1e293b":"transparent",border:allSelected?"1px solid #475569":"1px solid #1e293b",color:allSelected?"#e2e8f0":"#475569",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>ALL</button>
        {ALL_DEPOTS.map(d=>{const a=selectedDepots.includes(d);return(<button key={d} onClick={()=>toggleDepot(d)} style={{background:a?`${DEPOT_COLORS[d]}18`:"transparent",border:a?`1px solid ${DEPOT_COLORS[d]}50`:"1px solid #1e293b",color:a?DEPOT_COLORS[d]:"#334155",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace",opacity:a?1:0.5}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:a?DEPOT_COLORS[d]:"#334155",marginRight:5,verticalAlign:"middle"}}/>{d}</button>);})}
      </div>
      <div style={{width:1,height:24,background:"#1e293b"}}/>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",whiteSpace:"nowrap"}}>{t("weeks")}</span>
        <select value={weekFrom} onChange={e=>{const nv=e.target.value;setWeekFrom(nv);if(weekNum(nv)>weekNum(weekTo))setWeekTo(nv);}} style={ss}>{availableWeeks.map(w=><option key={w} value={w}>{w}</option>)}</select>
        <span style={{fontSize:10,color:"#475569",fontFamily:"'DM Mono',monospace"}}>→</span>
        <select value={weekTo} onChange={e=>{const nv=e.target.value;setWeekTo(nv);if(weekNum(nv)<weekNum(weekFrom))setWeekFrom(nv);}} style={ss}>{availableWeeks.map(w=><option key={w} value={w}>{w}</option>)}</select>
        <button onClick={()=>{if(availableWeeks.length){setWeekFrom(availableWeeks[0]);setWeekTo(availableWeeks[availableWeeks.length-1]);}}} style={{background:"transparent",border:"1px solid #1e293b",color:"#64748b",borderRadius:5,padding:"4px 8px",cursor:"pointer",fontSize:9,fontFamily:"'DM Mono',monospace"}}>{t("reset")}</button>
      </div>
      <div style={{marginLeft:"auto",fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{selectedYear==="ALL"?"2025+2026":selectedYear} · {selectedDepots.length}/{ALL_DEPOTS.length} {t("stations")} · {availableWeeks.filter(w=>weekNum(w)>=weekNum(weekFrom)&&weekNum(w)<=weekNum(weekTo)).length}w</div>
    </div>
  );
}

// ─── DEPOT CARD ─────────────────────────────────────────────────────
function DepotCard({depot,weekData}) {
  const latest=weekData.length>0?weekData[weekData.length-1]:null;const cfg=getStatusConfig(latest);
  const up=UPSTREAM_DATA.find(u=>u.depot===depot);const upPct=up&&up.total>0?Math.round(((up.total-up.ctrl)/up.total)*100):null;
  return (
    <div style={{background:cfg.bg,border:`1px solid ${cfg.border}30`,borderRadius:10,padding:"16px 18px",borderLeft:`3px solid ${cfg.border}`,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,right:0,background:`${cfg.border}18`,color:cfg.text,fontSize:8,fontWeight:700,padding:"3px 10px",borderBottomLeftRadius:6,fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase"}}>{cfg.icon} {cfg.label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:2}}>
        <span style={{fontSize:17,fontWeight:800,color:DEPOT_COLORS[depot],fontFamily:"'Outfit',sans-serif"}}>{depot}</span>
        <span style={{fontSize:10,color:"#64748b",fontFamily:"'DM Mono',monospace"}}>{DEPOT_LABELS[depot]}</span>
        {latest&&<span style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>{latest.week}{latest.year?" '"+String(latest.year).slice(2):""}</span>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px",marginTop:12}}>
        <div><div style={{fontSize:8,color:"#64748b",textTransform:"uppercase",letterSpacing:1.2,fontFamily:"'DM Mono',monospace",marginBottom:1}}>Late +15</div><div style={{fontSize:20,fontWeight:800,color:latest?.late>5?"#fca5a5":latest?.late>3?"#fcd34d":"#86efac",fontFamily:"'Outfit',sans-serif"}}>{latest?.late!=null?`${latest.late}%`:"—"}</div><MiniSpark data={weekData}/></div>
        <div><div style={{fontSize:8,color:"#64748b",textTransform:"uppercase",letterSpacing:1.2,fontFamily:"'DM Mono',monospace",marginBottom:1}}>FOND Ctrl</div><div style={{fontSize:20,fontWeight:800,color:latest?.fondCtrl>1.5?"#fca5a5":latest?.fondCtrl>0.8?"#fcd34d":"#86efac",fontFamily:"'Outfit',sans-serif"}}>{latest?.fondCtrl!=null?`${latest.fondCtrl}%`:"—"}</div><div style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",marginTop:2}}>FTFDF: {latest?.ftfdf!=null?`${latest.ftfdf}%`:"—"}</div></div>
        <div><div style={{fontSize:8,color:"#64748b",textTransform:"uppercase",letterSpacing:1.2,fontFamily:"'DM Mono',monospace",marginBottom:1}}>PDNR</div><div style={{fontSize:20,fontWeight:800,color:latest?.pdnr>0.7?"#fca5a5":latest?.pdnr>0.5?"#fcd34d":"#86efac",fontFamily:"'Outfit',sans-serif"}}>{latest?.pdnr!=null?`${latest.pdnr}%`:"—"}</div>{upPct!=null&&<div style={{fontSize:9,color:"#f59e0b",fontFamily:"'DM Mono',monospace",marginTop:2}}>{upPct}% upstream</div>}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        {[{label:"FTPDF",val:latest?.ftpdf},{label:"FDNR",val:latest?.fdnr},{label:"FTDC",val:latest?.ftdc},{label:"PP",val:latest?.pondPP}].map(({label,val})=>(<div key={label}><div style={{fontSize:7,color:"#475569",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{label}</div><div style={{fontSize:11,fontWeight:600,color:val>0.8?"#fca5a5":"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{val!=null?`${val}%`:"—"}</div></div>))}
      </div>
    </div>
  );
}

// ─── ACCESO CON CONTRASEÑA (front-end) ──────────────────────────────
// La contraseña no viaja a ningún servidor: se compara el SHA-256 de
// "<ACCESS_SALT>:<contraseña>" con ACCESS_HASH. Para cambiarla:
//   python3 scripts/set_password.py "Nueva-Clave"   → commit → push
const ACCESS_SALT = "lsrl-dsp-italy";
const ACCESS_HASH = "63df2a885c27d1749e8324d90a387f54903af9da8dd3766e1f8cdfc7b8cec98c";
const ACCESS_KEY = "dsp_it_access";
const ACCESS_DAYS = 30;        // días que se recuerda el acceso en el dispositivo
const ACCESS_MAX_TRIES = 5;    // intentos fallidos antes del bloqueo temporal
const ACCESS_LOCK_MS = 30000;  // duración del bloqueo
const GATE_T = {
  en:{sub:"Restricted access",label:"Password",btn:"Enter",wrong:"Incorrect password",locked:"Too many attempts — wait {s}s",remember:"Remember this device for 30 days",https:"Secure context (https) required"},
  it:{sub:"Accesso riservato",label:"Password",btn:"Entra",wrong:"Password errata",locked:"Troppi tentativi — attendi {s}s",remember:"Ricorda questo dispositivo per 30 giorni",https:"Serve una connessione sicura (https)"},
  es:{sub:"Acceso restringido",label:"Contraseña",btn:"Entrar",wrong:"Contraseña incorrecta",locked:"Demasiados intentos — espera {s}s",remember:"Recordar este dispositivo 30 días",https:"Se requiere conexión segura (https)"},
};
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function readAccess() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(ACCESS_KEY); if (!raw) continue;
      const o = JSON.parse(raw);
      if (o.h === ACCESS_HASH && o.exp > Date.now()) return true;
      store.removeItem(ACCESS_KEY);
    } catch (e) { /* almacenamiento no disponible */ }
  }
  return false;
}
function clearAccess() {
  try { localStorage.removeItem(ACCESS_KEY); sessionStorage.removeItem(ACCESS_KEY); } catch (e) {}
  window.location.reload();
}
if (typeof window !== "undefined") window.__dspLock = clearAccess;

function PasswordGate({ children }) {
  const [ok, setOk] = useState(readAccess);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [tries, setTries] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const lang = (typeof navigator !== "undefined" ? navigator.language : "en").slice(0, 2);
  const g = GATE_T[lang] || GATE_T.en;
  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [lockUntil]);
  if (ok) return children;
  const locked = lockUntil > now;
  const submit = async e => {
    e.preventDefault();
    if (locked || !pw || busy) return;
    if (!window.crypto?.subtle) { setErr(g.https); return; }
    setBusy(true);
    const h = await sha256Hex(`${ACCESS_SALT}:${pw}`);
    setBusy(false);
    if (h === ACCESS_HASH) {
      const payload = JSON.stringify({ h, exp: Date.now() + ACCESS_DAYS * 864e5 });
      try { (remember ? localStorage : sessionStorage).setItem(ACCESS_KEY, payload); } catch (e) {}
      setOk(true);
      return;
    }
    const n = tries + 1; setPw("");
    if (n >= ACCESS_MAX_TRIES) { setLockUntil(Date.now() + ACCESS_LOCK_MS); setTries(0); setNow(Date.now()); }
    else { setTries(n); setErr(g.wrong); }
  };
  const secs = Math.max(0, Math.ceil((lockUntil - now) / 1000));
  const mono = "'DM Mono',monospace";
  return (
    <div style={{background:"#030712",color:"#e2e8f0",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Outfit',sans-serif",padding:16}}>
      <form onSubmit={submit} style={{width:"100%",maxWidth:360,background:"linear-gradient(135deg,#0f172a 0%,#030712 100%)",border:"1px solid #1e293b",borderRadius:12,padding:"28px 28px 24px",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{fontSize:10,fontWeight:600,color:"#f59e0b",fontFamily:mono,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Last Mile DSP — Italy</div>
        <h1 style={{fontSize:22,fontWeight:800,color:"#f8fafc",margin:0,letterSpacing:"-0.03em",lineHeight:1.1}}>Delivery Performance</h1>
        <div style={{fontSize:11,color:"#64748b",fontFamily:mono,marginTop:6,marginBottom:22}}>{g.sub}</div>
        <label style={{display:"block",fontSize:9,color:"#64748b",fontFamily:mono,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{g.label}</label>
        <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} autoFocus autoComplete="current-password" disabled={locked}
          style={{width:"100%",boxSizing:"border-box",background:"#0f172a",color:"#e2e8f0",border:`1px solid ${err?"#dc2626":"#334155"}`,borderRadius:6,padding:"10px 12px",fontSize:14,fontFamily:mono,outline:"none"}}/>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:10,color:"#94a3b8",fontFamily:mono,marginTop:12,cursor:"pointer"}}>
          <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{accentColor:"#f59e0b"}}/>{g.remember}
        </label>
        <div style={{minHeight:18,fontSize:10,color:"#fca5a5",fontFamily:mono,marginTop:10}}>{locked ? g.locked.replace("{s}", secs) : err}</div>
        <button type="submit" disabled={locked||!pw||busy} style={{width:"100%",marginTop:6,background:locked||!pw?"#1e293b":"#f59e0b",color:locked||!pw?"#475569":"#030712",border:"none",borderRadius:6,padding:"10px 0",fontSize:12,fontWeight:800,fontFamily:mono,letterSpacing:1,textTransform:"uppercase",cursor:locked||!pw?"not-allowed":"pointer",transition:"all 0.15s"}}>{g.btn}</button>
      </form>
    </div>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────────
function DashboardInner() {
  const isMobile = useIsMobile();
  const [selectedView, setSelectedView] = useState("overview");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [lang, setLang] = useState("en");
  const t = key => T[lang]?.[key] || T["en"][key] || key;
  const [selectedDepots, setSelectedDepots] = useState([...ALL_DEPOTS]);
  const [highlightDepot, setHighlightDepot] = useState(null);
  const [nccStationFilter, setNccStationFilter] = useState("ALL");
  const [nccMinDefects, setNccMinDefects] = useState(3);
  const [lateStationFilter, setLateStationFilter] = useState("ALL");
  const [lateMinDefects, setLateMinDefects] = useState(5);
  const [lateViewMode, setLateViewMode] = useState("combined");
  const [scorecardMinTotal, setScorecardMinTotal] = useState(5);
  const [sprShowValues, setSprShowValues] = useState(true);
  const [flowDefect, setFlowDefect] = useState(null);
  const [flowAttr, setFlowAttr] = useState(null);
  const [flowSite, setFlowSite] = useState(null);
  const [geoDefectFilter, setGeoDefectFilter] = useState([...GEO_DATA.defectTypes]);
  const [geoSiteFilter, setGeoSiteFilter] = useState(null);
  const [geoHoveredSite, setGeoHoveredSite] = useState(null);

  // Available weeks for selected year
  const availableWeeks = useMemo(() => {
    if (selectedYear === "ALL") {
      const s = new Set();
      ALL_YEARS.forEach(y => (WEEKS_BY_YEAR[y]||[]).forEach(w => s.add(w)));
      return [...s].sort((a,b) => weekNum(a) - weekNum(b));
    }
    return WEEKS_BY_YEAR[selectedYear] || [];
  }, [selectedYear]);

  const [weekFrom, setWeekFrom] = useState("W1");
  const [weekTo, setWeekTo] = useState("W51");

  // Reset week range when year changes
  const effectiveFrom = availableWeeks.includes(weekFrom) ? weekFrom : (availableWeeks[0] || "W1");
  const effectiveTo = availableWeeks.includes(weekTo) ? weekTo : (availableWeeks[availableWeeks.length-1] || "W51");

  const yearFilter = d => selectedYear === "ALL" || d.year === selectedYear;
  const inRange = w => weekNum(w) >= weekNum(effectiveFrom) && weekNum(w) <= weekNum(effectiveTo);
  const fullFilter = d => yearFilter(d) && inRange(d.week);

  // Filtered data
  const filteredNetwork = useMemo(() => NETWORK.filter(d => d.late != null && fullFilter(d)), [selectedYear, effectiveFrom, effectiveTo]);
  const filteredDepotData = useMemo(() => { const o={}; selectedDepots.forEach(d=>{o[d]=(ALL_DEPOT_DATA[d]||[]).filter(fullFilter);}); return o; }, [selectedDepots, selectedYear, effectiveFrom, effectiveTo]);

  // Chart label: add year suffix when showing ALL
  const chartLabel = d => selectedYear === "ALL" ? `${d.week}'${String(d.year).slice(2)}` : d.week;

  // Network trend for charts
  const networkChartData = useMemo(() => filteredNetwork.map(d => ({...d, label: chartLabel(d)})).sort((a,b) => sortKey(a.year,a.week) - sortKey(b.year,b.week)), [filteredNetwork, selectedYear]);

  // Combined depot lates for line chart
  const combinedLates = useMemo(() => {
    const allRows = [];
    const seen = new Set();
    selectedDepots.forEach(depot => {
      (ALL_DEPOT_DATA[depot]||[]).filter(fullFilter).forEach(d => {
        const key = `${d.year}-${d.week}`;
        if (!seen.has(key)) { seen.add(key); allRows.push({year:d.year,week:d.week,sk:sortKey(d.year,d.week)}); }
      });
    });
    NETWORK.filter(fullFilter).forEach(d => {
      const key = `${d.year}-${d.week}`;
      if (!seen.has(key)) { seen.add(key); allRows.push({year:d.year,week:d.week,sk:sortKey(d.year,d.week)}); }
    });
    allRows.sort((a,b) => a.sk - b.sk);
    return allRows.map(({year,week}) => {
      const label = selectedYear === "ALL" ? `${week}'${String(year).slice(2)}` : week;
      const row = { label };
      selectedDepots.forEach(depot => {
        const e = (ALL_DEPOT_DATA[depot]||[]).find(d => d.year===year && d.week===week);
        row[depot] = e?.late ?? null;
      });
      return row;
    });
  }, [selectedDepots, selectedYear, effectiveFrom, effectiveTo]);

  const filteredUpstream = useMemo(() => UPSTREAM_DATA.filter(d => selectedDepots.includes(d.depot)), [selectedDepots]);
  const latestByDepot = useMemo(() => { const o={}; selectedDepots.forEach(d=>{const r=filteredDepotData[d]||[];o[d]=r.length>0?r[r.length-1]:null;}); return o; }, [filteredDepotData,selectedDepots]);
  const latestWeekLabel = useMemo(() => { const all=Object.values(latestByDepot).filter(Boolean); if (!all.length) return effectiveTo; const best=all.reduce((a,b)=>sortKey(a.year,a.week)>sortKey(b.year,b.week)?a:b); return selectedYear==="ALL"?`${best.week}'${String(best.year).slice(2)}`:best.week; }, [latestByDepot,effectiveTo,selectedYear]);

  // ── Global-aware week filtering for NCC/Late (both use same W47/25-W7/26 range) ──
  const defectWeeksFiltered = useMemo(() => NCC_WEEKS.filter(wk => {
    const [yr, w] = wk.split('-');
    const wNum = parseInt(w.replace('W',''));
    const year = parseInt(yr);
    if (selectedYear !== "ALL" && year !== parseInt(selectedYear)) return false;
    const fromNum = parseInt(effectiveFrom.replace('W',''));
    const toNum = parseInt(effectiveTo.replace('W',''));
    return wNum >= fromNum && wNum <= toNum;
  }), [selectedYear, effectiveFrom, effectiveTo]);

  // NCC filtered drivers (uses global station + week filter)
  const nccFiltered = useMemo(() => NCC_DRIVERS.map(d => {
    const filtTotal = defectWeeksFiltered.reduce((s, wk) => s + (d.w[wk]||0), 0);
    return {...d, _filtTotal: filtTotal};
  }).filter(d => {
    if (!d.stations.some(s => selectedDepots.includes(s))) return false;
    return d._filtTotal >= nccMinDefects;
  }).sort((a,b) => b._filtTotal - a._filtTotal), [selectedDepots, nccMinDefects, defectWeeksFiltered]);

  // NCC station trend chart data (filtered by global weeks + stations)
  const nccTrendData = useMemo(() => defectWeeksFiltered.map(wk => {
    const label = wk.replace("2025-","'25 ").replace("2026-","'26 ");
    const row = { label };
    selectedDepots.forEach(stn => { row[stn] = NCC_STATION_WEEKLY[stn]?.[wk] || 0; });
    row.total = selectedDepots.reduce((s, stn) => s + (NCC_STATION_WEEKLY[stn]?.[wk]||0), 0);
    return row;
  }), [defectWeeksFiltered, selectedDepots]);

  // Late delivery filtered data (uses global station + week filter)
  const lateFiltered = useMemo(() => LATE_DRIVERS.map(d => {
    const filtTotal = defectWeeksFiltered.reduce((s, wk) => s + (d.w[wk]||0), 0);
    const ratio = d.t > 0 ? d.g / d.t : 0;
    const filtGt15 = Math.round(filtTotal * ratio);
    return {...d, _filtTotal: filtTotal, _filtGt15: filtGt15};
  }).filter(d => {
    if (!d.s.some(s => selectedDepots.includes(s))) return false;
    return d._filtTotal >= lateMinDefects;
  }).sort((a,b) => b._filtTotal - a._filtTotal), [selectedDepots, lateMinDefects, defectWeeksFiltered]);

  const lateTrendData = useMemo(() => defectWeeksFiltered.map(wk => {
    const label = wk.replace("2025-","'25 ").replace("2026-","'26 ");
    const row = { label };
    selectedDepots.forEach(stn => {
      row[stn+"_late"] = (LATE_STN_WEEKLY[stn]?.[wk]||0) - (LATE_GT15_STN[stn]?.[wk]||0);
      row[stn+"_gt15"] = LATE_GT15_STN[stn]?.[wk] || 0;
      row[stn] = LATE_STN_WEEKLY[stn]?.[wk] || 0;
    });
    row.total = selectedDepots.reduce((s,stn)=>s+(row[stn]||0),0);
    row.gt15Total = selectedDepots.reduce((s,stn)=>s+(LATE_GT15_STN[stn]?.[wk]||0),0);
    return row;
  }), [defectWeeksFiltered, selectedDepots]);

  // ── SCORECARD: Merge NCC + Late by TID (week-filtered) ──
  const scorecardData = useMemo(() => {
    const map = {};
    // Add NCC drivers with week-filtered totals
    NCC_DRIVERS.forEach(d => {
      const tid = NCC_TID_MAP[d.name] || d.name;
      const filtNcc = defectWeeksFiltered.reduce((s, wk) => s + (d.w[wk]||0), 0);
      if (!map[tid]) map[tid] = {name:d.name,loc:d.loc,stations:new Set(d.stations),ncc:0,late:0,gt15:0,nccW:d.w,lateW:{}};
      map[tid].ncc = filtNcc;
      map[tid].nccW = d.w;
      d.stations.forEach(s => map[tid].stations.add(s));
    });
    // Add Late drivers with week-filtered totals
    LATE_DRIVERS.forEach(d => {
      const name = resolveName(d.tid);
      const tid = d.tid;
      const filtTotal = defectWeeksFiltered.reduce((s, wk) => s + (d.w[wk]||0), 0);
      const ratio = d.t > 0 ? d.g / d.t : 0;
      const filtGt15 = Math.round(filtTotal * ratio);
      const filtLate = filtTotal - filtGt15;
      if (!map[tid]) map[tid] = {name:name,loc:d.s.some(x=>x==="UIT4"||x==="UBA1")?"Roma":"Milano",stations:new Set(d.s),ncc:0,late:0,gt15:0,nccW:{},lateW:{}};
      map[tid].late = filtLate;
      map[tid].gt15 = filtGt15;
      map[tid].lateW = d.w;
      d.s.forEach(s => map[tid].stations.add(s));
      if (!map[tid].name || map[tid].name.startsWith('A')) map[tid].name = name;
    });
    // Merge matching NCC TIDs
    NCC_DRIVERS.forEach(d => {
      const nccTid = NCC_TID_MAP[d.name];
      if (nccTid && map[nccTid]) {
        const filtNcc = defectWeeksFiltered.reduce((s, wk) => s + (d.w[wk]||0), 0);
        map[nccTid].ncc = Math.max(map[nccTid].ncc, filtNcc);
        if (!map[nccTid].name || map[nccTid].name.startsWith('A')) map[nccTid].name = d.name;
        map[nccTid].loc = d.loc;
      }
    });
    return Object.entries(map).map(([tid,d])=>{
      const combined = d.ncc+d.late+d.gt15;
      return {
        tid,name:d.name,loc:d.loc,stations:[...d.stations],ncc:d.ncc,late:d.late,gt15:d.gt15,
        combined,nccW:d.nccW,lateW:d.lateW,
        severity: d.gt15>15?"CRITICAL":(d.late+d.ncc)>40?"HIGH":(d.late+d.ncc)>20?"MEDIUM":"LOW"
      };
    }).sort((a,b)=>b.combined-a.combined);
  }, [defectWeeksFiltered]);

  const scorecardFiltered = useMemo(() => scorecardData.filter(d => {
    if (!d.stations.some(s => selectedDepots.includes(s))) return false;
    return d.combined >= scorecardMinTotal;
  }), [scorecardData, selectedDepots, scorecardMinTotal]);

  // ── Reactive summary stats (respond to global filters) ──
  const nccStats = useMemo(() => {
    const totalDefects = nccTrendData.reduce((s,r)=>s+r.total,0);
    const driverCount = nccFiltered.length;
    // Worst station from filtered trend data
    const stnTotals = {};
    selectedDepots.forEach(stn => { stnTotals[stn] = nccTrendData.reduce((s,r)=>s+(r[stn]||0),0); });
    const worstStn = Object.entries(stnTotals).sort((a,b)=>b[1]-a[1])[0] || ["—",0];
    const worstPct = totalDefects>0 ? Math.round((worstStn[1]/totalDefects)*100) : 0;
    // Top offender from filtered list
    const topDriver = nccFiltered[0] || null;
    const wkRange = defectWeeksFiltered.length>0 ? `${defectWeeksFiltered[0].replace("2025-","").replace("2026-","")}/${defectWeeksFiltered[0].startsWith("2025")?"25":"26"} – ${defectWeeksFiltered[defectWeeksFiltered.length-1].replace("2025-","").replace("2026-","")}/${defectWeeksFiltered[defectWeeksFiltered.length-1].startsWith("2025")?"25":"26"}` : "—";
    return { totalDefects, driverCount, worstStn: worstStn[0], worstVal: worstStn[1], worstPct, topDriver, wkRange };
  }, [nccTrendData, nccFiltered, selectedDepots, defectWeeksFiltered]);

  const lateStats = useMemo(() => {
    const totalDefects = lateTrendData.reduce((s,r)=>s+r.total,0);
    const gt15Total = lateTrendData.reduce((s,r)=>s+r.gt15Total,0);
    const gt15Pct = totalDefects>0 ? Math.round((gt15Total/totalDefects)*100) : 0;
    const driverCount = lateFiltered.length;
    const stnTotals = {};
    selectedDepots.forEach(stn => { stnTotals[stn] = lateTrendData.reduce((s,r)=>s+(r[stn]||0),0); });
    const worstStn = Object.entries(stnTotals).sort((a,b)=>b[1]-a[1])[0] || ["—",0];
    const worstPct = totalDefects>0 ? Math.round((worstStn[1]/totalDefects)*100) : 0;
    const wkRange = defectWeeksFiltered.length>0 ? `${defectWeeksFiltered[0].replace("2025-","").replace("2026-","")}/${defectWeeksFiltered[0].startsWith("2025")?"25":"26"} – ${defectWeeksFiltered[defectWeeksFiltered.length-1].replace("2025-","").replace("2026-","")}/${defectWeeksFiltered[defectWeeksFiltered.length-1].startsWith("2025")?"25":"26"}` : "—";
    return { totalDefects, gt15Total, gt15Pct, driverCount, worstStn: worstStn[0], worstVal: worstStn[1], worstPct, wkRange };
  }, [lateTrendData, lateFiltered, selectedDepots, defectWeeksFiltered]);

  const scStats = useMemo(() => {
    const nccSum = scorecardFiltered.reduce((s,d)=>s+d.ncc,0);
    const lateSum = scorecardFiltered.reduce((s,d)=>s+d.late+d.gt15,0);
    const gt15Sum = scorecardFiltered.reduce((s,d)=>s+d.gt15,0);
    const dual = scorecardFiltered.filter(d=>d.ncc>0&&d.late>0).length;
    return { combined: nccSum+lateSum, nccSum, lateSum, gt15Sum, dual, count: scorecardFiltered.length };
  }, [scorecardFiltered]);

  // ── Productividad: stops per route (Orders ÷ Routes) con filtros globales ──
  const prodDepots = useMemo(() => selectedDepots.filter(d => (PRODUCTIVITY[d]||[]).length), [selectedDepots]);
  const sprWeekly = useMemo(() => {
    const keys = []; const seen = new Set();
    prodDepots.forEach(d => (PRODUCTIVITY[d]||[]).filter(fullFilter).forEach(r => { const k=`${r.year}-${r.week}`; if(!seen.has(k)){ seen.add(k); keys.push({year:r.year,week:r.week,sk:sortKey(r.year,r.week)}); } }));
    keys.sort((a,b)=>a.sk-b.sk);
    return keys.map(({year,week}) => {
      const row = { label: selectedYear==="ALL" ? `${week}'${String(year).slice(2)}` : week, year, week };
      let o=0, rt=0;
      prodDepots.forEach(d => { const e=(PRODUCTIVITY[d]||[]).find(r=>r.year===year&&r.week===week); row[d]= e&&e.routes ? +(e.orders/e.routes).toFixed(2) : null; row[d+"_o"]=e?e.orders:null; row[d+"_r"]=e?e.routes:null; if(e){ o+=e.orders; rt+=e.routes; } });
      row.network = rt ? +(o/rt).toFixed(2) : null;
      return row;
    });
  }, [prodDepots, selectedYear, effectiveFrom, effectiveTo]);
  const sprStats = useMemo(() => {
    const out = {};
    prodDepots.forEach(d => {
      const rows=(PRODUCTIVITY[d]||[]).filter(fullFilter).sort((a,b)=>sortKey(a.year,a.week)-sortKey(b.year,b.week));
      const vals=rows.filter(r=>r.routes).map(r=>r.orders/r.routes);
      const last=rows[rows.length-1], prev=rows[rows.length-2];
      out[d]={ last:last&&last.routes?last.orders/last.routes:null, lastWeek:last?(selectedYear==="ALL"?`${last.week}'${String(last.year).slice(2)}`:last.week):null,
        prev:prev&&prev.routes?prev.orders/prev.routes:null, avg:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null,
        orders:rows.reduce((a,r)=>a+r.orders,0), routes:rows.reduce((a,r)=>a+r.routes,0), target:SPR_TARGET[d]??null };
    });
    return out;
  }, [prodDepots, selectedYear, effectiveFrom, effectiveTo]);
  const sprCell = (val, tgt) => { if(val==null) return {bg:"#0f172a",color:"#334155"}; if(!tgt) return {bg:"#1e293b",color:"#e2e8f0"}; const r=val/tgt; return r>=0.9?{bg:"#052e16",color:"#86efac"}:r>=0.8?{bg:"#451a03",color:"#fcd34d"}:{bg:"#450a0a",color:"#fca5a5"}; };

  // ── Defect Flow: agrega FLOW_WEEKS según los filtros globales ──
  const FLOW_LABEL = {late:"_late",late_gt15:"_late15",ftfdf:"_ftfdf",ftpdf:"_ftpdf",pdnr:"_pdnr",fdnr:"_fdnr",ftdc:"_ftdc",item_miss:"_item_miss",item_qual:"_item_dmg"};
  const flowData = useMemo(() => {
    const wf = weekNum(effectiveFrom), wt = weekNum(effectiveTo);
    const weeks = Object.keys(FLOW_WEEKS).filter(k => { const [y, w] = k.split("-W"); return (selectedYear === "ALL" || +y === selectedYear) && +w >= wf && +w <= wt; })
      .sort((a, b) => { const [ya, wa] = a.split("-W"), [yb, wb] = b.split("-W"); return (+ya * 100 + +wa) - (+yb * 100 + +wb); });
    let orders = 0, defOrders = 0, total = 0;
    const byDef = {}, byAttr = {}, sitesBy = {}, drvBy = {};
    weeks.forEach(k => {
      const wk = FLOW_WEEKS[k];
      selectedDepots.forEach(st => { orders += wk.o[st] || 0; defOrders += wk.d[st] || 0; });
      wk.r.forEach(([d, ai, st, ti, n]) => {
        if (!selectedDepots.includes(st)) return;
        total += n; byDef[d] = (byDef[d] || 0) + n;
        const ak = `${d}|${FLOW_ATTR[ai]}`;
        byAttr[ak] = (byAttr[ak] || 0) + n;
        (sitesBy[ak] = sitesBy[ak] || {})[st] = (sitesBy[ak]?.[st] || 0) + n;
        const dk = `${st}-${ak}`; const tid = FLOW_TID[ti];
        (drvBy[dk] = drvBy[dk] || {})[tid] = (drvBy[dk]?.[tid] || 0) + n;
      });
    });
    const defectTypes = Object.entries(byDef).map(([key, count]) => ({ key, label: FLOW_LABEL[key] || "_" + key, count, pct: orders ? +(100 * count / orders).toFixed(2) : 0 })).sort((a, b) => b.count - a.count);
    const attributions = {};
    Object.entries(byAttr).forEach(([ak, count]) => { const d = ak.split("|")[0], a = ak.slice(d.length + 1); (attributions[d] = attributions[d] || []).push({ key: ak, label: a, count, sites: sitesBy[ak] }); });
    Object.values(attributions).forEach(l => l.sort((a, b) => b.count - a.count));
    const drivers = {};
    Object.entries(drvBy).forEach(([dk, mm]) => { drivers[dk] = Object.entries(mm).map(([tid, count]) => ({ name: resolveName(tid), count })).sort((a, b) => b.count - a.count); });
    const fmt = k => { const [y, w] = k.split("-W"); return selectedYear === "ALL" ? `W${w}'${y.slice(2)}` : `W${w}`; };
    const week = weeks.length === 0 ? "—" : weeks.length === 1 ? `${fmt(weeks[0])} ${selectedYear === "ALL" ? "" : selectedYear}`.trim() : `${fmt(weeks[0])}–${fmt(weeks[weeks.length - 1])} ${selectedYear === "ALL" ? "" : selectedYear}`.trim();
    const pctDef = orders ? +(100 * defOrders / orders).toFixed(1) : 0;
    return { weeks, week, ordersTotal: orders, ordersWithDefects: defOrders, pctDef, pctOk: orders ? +(100 - pctDef).toFixed(1) : 0, totalDefects: total, defectTypes, attributions, drivers };
  }, [selectedDepots, selectedYear, effectiveFrom, effectiveTo]);
  // al cambiar los filtros, la selección del drill-down puede dejar de existir → se limpia
  useEffect(() => { setFlowDefect(null); setFlowAttr(null); setFlowSite(null); }, [flowData]);

  const tabStyle = active => ({background:active?"#1e293b":"transparent",border:active?"1px solid #334155":"1px solid transparent",color:active?"#e2e8f0":"#64748b",borderRadius:6,padding:isMobile?"5px 10px":"6px 14px",cursor:"pointer",fontSize:isMobile?10:11,fontWeight:600,fontFamily:"'DM Mono',monospace",transition:"all 0.2s",letterSpacing:0.3,whiteSpace:"nowrap"});
  const cellStyle = (val,th) => { if(val==null) return {bg:"#0f172a",color:"#334155"}; if(val>th[1]) return {bg:"#450a0a",color:"#fca5a5"}; if(val>th[0]) return {bg:"#451a03",color:"#fcd34d"}; return {bg:"#052e16",color:"#86efac"}; };

  const yearLabel = selectedYear === "ALL" ? "2025–2026" : String(selectedYear);

  return (
    <div style={{background:"#030712",color:"#e2e8f0",minHeight:"100vh",fontFamily:"'Outfit',sans-serif"}}>
      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#0f172a 0%,#030712 100%)",borderBottom:"1px solid #1e293b",padding:isMobile?"16px 16px 14px":"24px 32px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:isMobile?"flex-start":"flex-start",flexDirection:isMobile?"column":"row",gap:isMobile?12:0}}>
          <div>
            <div style={{fontSize:isMobile?9:10,fontWeight:600,color:"#f59e0b",fontFamily:"'DM Mono',monospace",letterSpacing:2,textTransform:"uppercase",marginBottom:isMobile?4:6}}>{t("brand")}</div>
            <h1 style={{fontSize:isMobile?20:26,fontWeight:800,color:"#f8fafc",margin:0,fontFamily:"'Outfit',sans-serif",letterSpacing:"-0.03em",lineHeight:1.1}}>{t("title")}</h1>
            <div style={{fontSize:isMobile?10:12,color:"#64748b",fontFamily:"'DM Mono',monospace",marginTop:isMobile?4:6}}>{effectiveFrom}–{effectiveTo} / {yearLabel}</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"flex-start",width:isMobile?"100%":"auto",justifyContent:isMobile?"space-between":"flex-end"}}>
            <div style={{display:"flex",gap:2,background:"#0f172a",border:"1px solid #1e293b",borderRadius:6,padding:2}}>
              {LANGS.map(l=>(<button key={l.code} onClick={()=>setLang(l.code)} style={{background:lang===l.code?"#334155":"transparent",border:"none",color:lang===l.code?"#f8fafc":"#475569",borderRadius:4,padding:"4px 8px",cursor:"pointer",fontSize:9,fontWeight:700,fontFamily:"'DM Mono',monospace",letterSpacing:0.5,transition:"all 0.15s"}}>{l.label}</button>))}
            </div>
            <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,padding:isMobile?"8px 12px":"10px 16px",textAlign:"right"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{t("latestInRange")}</div>
              <div style={{fontSize:isMobile?18:22,fontWeight:800,color:"#f59e0b",fontFamily:"'Outfit',sans-serif"}}>{latestWeekLabel}</div>
              <div style={{fontSize:isMobile?9:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{selectedDepots.length} {t("stations")}</div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:4,marginTop:isMobile?14:18,overflowX:isMobile?"auto":"visible",paddingBottom:isMobile?4:0,WebkitOverflowScrolling:"touch"}}>
          {[{key:"overview",l:"tabOverview"},{key:"depots",l:"tabDepots"},{key:"upstream",l:"tabUpstream"},{key:"cycles",l:"tabCycles"},{key:"ncc",l:"tabNcc"},{key:"late",l:"tabLate"},{key:"scorecard",l:"tabScorecard"},{key:"productivity",l:"tabProductivity"},{key:"flow",l:"tabFlow"},{key:"geo",l:"tabGeo"}].map(tab=>{
            const isSpecial = tab.key==="ncc"||tab.key==="late"||tab.key==="scorecard"||tab.key==="productivity"||tab.key==="flow"||tab.key==="geo";
            const isActive = selectedView===tab.key;
            const specialColors = tab.key==="ncc"?{bg:"#7c2d12",border:"#ea580c",text:"#fb923c",dot:"#ea580c"}:tab.key==="late"?{bg:"#1e1b4b",border:"#6366f1",text:"#a5b4fc",dot:"#6366f1"}:tab.key==="productivity"?{bg:"#422006",border:"#f59e0b",text:"#fde68a",dot:"#f59e0b"}:tab.key==="flow"?{bg:"#134e4a",border:"#0d9488",text:"#5eead4",dot:"#0d9488"}:tab.key==="geo"?{bg:"#1a1035",border:"#8b5cf6",text:"#c4b5fd",dot:"#8b5cf6"}:{bg:"#14532d",border:"#22c55e",text:"#86efac",dot:"#22c55e"};
            return(<button key={tab.key} onClick={()=>setSelectedView(tab.key)} style={{...tabStyle(isActive),
              ...(isSpecial&&isActive?{background:specialColors.bg,borderColor:specialColors.border,color:specialColors.text}:{})
            }}>{isSpecial&&<span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:isActive?specialColors.dot:(specialColors.dot+"60"),marginRight:5,verticalAlign:"middle"}}/>}{t(tab.l)}</button>);
          })}
        </div>
      </div>

      {/* FILTER BAR */}
      <FilterBar selectedYear={selectedYear} setSelectedYear={yr=>{setSelectedYear(yr);const wks=yr==="ALL"?[...new Set(ALL_YEARS.flatMap(y=>WEEKS_BY_YEAR[y]||[]))].sort((a,b)=>weekNum(a)-weekNum(b)):WEEKS_BY_YEAR[yr]||[];if(wks.length){setWeekFrom(wks[0]);setWeekTo(wks[wks.length-1]);}}} selectedDepots={selectedDepots} setSelectedDepots={setSelectedDepots} weekFrom={effectiveFrom} setWeekFrom={setWeekFrom} weekTo={effectiveTo} setWeekTo={setWeekTo} availableWeeks={availableWeeks} t={t} isMobile={isMobile} />

      <div style={{padding:isMobile?"16px":"24px 32px"}}>
        {/* OVERVIEW */}
        {selectedView==="overview"&&(<>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":selectedDepots.length===1?"1fr":"repeat(2,1fr)",gap:12,marginBottom:24}}>
            {selectedDepots.map(d=>(<DepotCard key={d} depot={d} weekData={filteredDepotData[d]||[]}/>))}
          </div>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"20px",marginBottom:24}}>
            <h3 style={{fontSize:11,fontWeight:700,color:"#64748b",margin:"0 0 16px",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{t("networkLate")} — {effectiveFrom} → {effectiveTo} / {yearLabel}</h3>
            <ResponsiveContainer width="100%" height={isMobile?180:220}>
              <AreaChart data={networkChartData} margin={{top:5,right:isMobile?10:20,bottom:5,left:0}}>
                <defs><linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="label" tick={{fill:"#475569",fontSize:9,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}} interval={Math.max(0,Math.floor(networkChartData.length/12))}/>
                <YAxis tick={{fill:"#475569",fontSize:9,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}} tickFormatter={v=>`${v}%`}/>
                <Tooltip content={<ChartTooltip/>}/><ReferenceLine y={2.4} stroke="#334155" strokeDasharray="4 4" label={{value:t("w4Baseline"),fill:"#475569",fontSize:9,fontFamily:"DM Mono"}}/>
                <Area type="monotone" dataKey="late" stroke="#ef4444" strokeWidth={2} fill="url(#lateGrad)" name="Late +15" dot={{r:2,fill:"#ef4444"}} connectNulls/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"20px"}}>
            <h3 style={{fontSize:11,fontWeight:700,color:"#64748b",margin:"0 0 14px",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{latestWeekLabel} {t("perfHeatmap")}</h3>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:3}}>
                <thead><tr>{[t("depot"),t("week"),t("latePlus15"),t("fondCtrl"),t("ftfdf"),t("ftpdf"),t("pdnr"),t("fdnr"),t("pp"),t("status")].map((h,hi)=>(<th key={h} style={{padding:"8px",fontSize:8,color:"#475569",textAlign:hi===0?"left":"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{h}</th>))}</tr></thead>
                <tbody>{selectedDepots.map(depot=>{const d=latestByDepot[depot];const cfg=getStatusConfig(d);const wkLabel=d?(selectedYear==="ALL"?`${d.week}'${String(d.year).slice(2)}`:d.week):"—";const cells=[{val:d?.late,th:[2.5,5]},{val:d?.fondCtrl,th:[0.7,1.2]},{val:d?.ftfdf,th:[2,3]},{val:d?.ftpdf,th:[1,1.5]},{val:d?.pdnr,th:[0.5,0.8]},{val:d?.fdnr,th:[0.15,0.3]},{val:d?.pondPP,th:[0.5,0.9]}];return(<tr key={depot}><td style={{padding:"8px",fontSize:12,fontWeight:700,color:DEPOT_COLORS[depot],fontFamily:"'DM Mono',monospace"}}>{depot}</td><td style={{padding:"8px",fontSize:10,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace"}}>{wkLabel}</td>{cells.map((c,i)=>{const s=cellStyle(c.val,c.th);return(<td key={i} style={{padding:"7px 6px",fontSize:11,fontWeight:600,textAlign:"center",fontFamily:"'DM Mono',monospace",borderRadius:4,background:s.bg,color:s.color}}>{c.val!=null?`${c.val}%`:"—"}</td>);})}<td style={{padding:"7px 8px",textAlign:"center"}}><span style={{fontSize:8,fontWeight:700,color:cfg.text,background:`${cfg.border}18`,padding:"2px 8px",borderRadius:4,fontFamily:"'DM Mono',monospace",letterSpacing:1}}>{cfg.label}</span></td></tr>);})}</tbody>
              </table>
            </div>
          </div>
        </>)}

        {/* DEPOT DEEP-DIVE */}
        {selectedView==="depots"&&(<>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"20px",marginBottom:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{fontSize:11,fontWeight:700,color:"#64748b",margin:0,fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>Late +15 by Depot — {yearLabel}</h3>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>setHighlightDepot(null)} style={{...tabStyle(!highlightDepot),padding:"3px 8px",fontSize:9}}>All</button>
                {selectedDepots.map(d=>(<button key={d} onClick={()=>setHighlightDepot(highlightDepot===d?null:d)} style={{background:highlightDepot===d?`${DEPOT_COLORS[d]}22`:"transparent",border:highlightDepot===d?`1px solid ${DEPOT_COLORS[d]}40`:"1px solid transparent",color:highlightDepot===d?DEPOT_COLORS[d]:"#475569",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:9,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{d}</button>))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={isMobile?220:300}>
              <LineChart data={combinedLates} margin={{top:5,right:isMobile?10:20,bottom:5,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="label" tick={{fill:"#475569",fontSize:9,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}} interval={Math.max(0,Math.floor(combinedLates.length/12))}/>
                <YAxis tick={{fill:"#475569",fontSize:9,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}} tickFormatter={v=>`${v}%`} domain={[0,"auto"]}/>
                <Tooltip content={<ChartTooltip/>}/><ReferenceLine y={2.5} stroke="#334155" strokeDasharray="4 4"/>
                {selectedDepots.map(depot=>(<Line key={depot} type="monotone" dataKey={depot} stroke={DEPOT_COLORS[depot]} strokeWidth={highlightDepot?(highlightDepot===depot?3:0.8):2} strokeOpacity={highlightDepot?(highlightDepot===depot?1:0.2):0.8} dot={highlightDepot===depot?{r:3,fill:DEPOT_COLORS[depot]}:false} name={depot} connectNulls/>))}
              </LineChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:8}}>
              {selectedDepots.map(depot=>(<div key={depot} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:DEPOT_COLORS[depot],fontFamily:"'DM Mono',monospace",cursor:"pointer",opacity:highlightDepot&&highlightDepot!==depot?0.3:1}} onClick={()=>setHighlightDepot(highlightDepot===depot?null:depot)}><div style={{width:12,height:3,borderRadius:2,background:DEPOT_COLORS[depot]}}/>{depot}</div>))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16}}>
            <div style={{background:"#052e16",border:"1px solid #16a34a30",borderRadius:10,padding:"18px"}}>
              <h3 style={{fontSize:11,fontWeight:700,color:"#86efac",margin:"0 0 12px",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>● Tier 1 — Performing</h3>
              {["UIT1","UIT7"].filter(d=>selectedDepots.includes(d)).map(d=>{const l=latestByDepot[d];return(<div key={d} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #16a34a15"}}><span style={{fontSize:13,fontWeight:700,color:DEPOT_COLORS[d],fontFamily:"'DM Mono',monospace"}}>{d}</span><span style={{fontSize:15,fontWeight:800,color:"#86efac",fontFamily:"'Outfit',sans-serif"}}>{l?.late!=null?`${l.late}%`:"—"}</span></div>);})}
            </div>
            <div style={{background:"#450a0a",border:"1px solid #dc262630",borderRadius:10,padding:"18px"}}>
              <h3 style={{fontSize:11,fontWeight:700,color:"#fca5a5",margin:"0 0 12px",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>◆ Tier 2 — Structural</h3>
              {["UIT4","UBA1","UIL7"].filter(d=>selectedDepots.includes(d)).map(d=>{const l=latestByDepot[d];return(<div key={d} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #dc262615"}}><span style={{fontSize:13,fontWeight:700,color:DEPOT_COLORS[d],fontFamily:"'DM Mono',monospace"}}>{d}</span><span style={{fontSize:15,fontWeight:800,color:"#fca5a5",fontFamily:"'Outfit',sans-serif"}}>{l?.late!=null?`${l.late}%`:"—"}</span></div>);})}
            </div>
          </div>
        </>)}

        {/* UPSTREAM */}
        {selectedView==="upstream"&&(<>
          <div style={{background:"linear-gradient(135deg,#451a03 0%,#0f172a 100%)",border:"1px solid #d9770630",borderRadius:10,padding:"24px 28px",marginBottom:24,textAlign:"center"}}>
            <div style={{fontSize:10,color:"#fbbf24",fontFamily:"'DM Mono',monospace",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>{t("networkFtfdf")} — W51/2025</div>
            <div style={{display:"flex",justifyContent:"center",alignItems:"baseline",gap:isMobile?12:20,flexWrap:"wrap"}}>
              <div><div style={{fontSize:isMobile?28:40,fontWeight:800,color:"#fbbf24",fontFamily:"'Outfit',sans-serif"}}>64%</div><div style={{fontSize:10,color:"#92400e",fontFamily:"'DM Mono',monospace"}}>{t("upstream")}</div></div>
              <div style={{fontSize:20,color:"#475569"}}>|</div>
              <div><div style={{fontSize:22,fontWeight:700,color:"#94a3b8",fontFamily:"'Outfit',sans-serif"}}>2.44%</div><div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{t("total")}</div></div>
              <div style={{fontSize:14,color:"#475569"}}>=</div>
              <div><div style={{fontSize:22,fontWeight:700,color:"#22c55e",fontFamily:"'Outfit',sans-serif"}}>0.86%</div><div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{t("dspCtrl")}</div></div>
              <div style={{fontSize:14,color:"#475569"}}>+</div>
              <div><div style={{fontSize:22,fontWeight:700,color:"#ef4444",fontFamily:"'Outfit',sans-serif"}}>1.58%</div><div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{t("upstream")}</div></div>
            </div>
          </div>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"20px",marginBottom:24}}>
            <h3 style={{fontSize:11,fontWeight:700,color:"#64748b",margin:"0 0 16px",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{t("ftfdfBreakdown")}</h3>
            <ResponsiveContainer width="100%" height={isMobile?220:280}>
              <BarChart data={filteredUpstream} margin={{top:5,right:isMobile?10:30,bottom:5,left:0}} barSize={isMobile?28:40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="depot" tick={{fill:"#94a3b8",fontSize:12,fontFamily:"DM Mono",fontWeight:700}} axisLine={{stroke:"#1e293b"}}/>
                <YAxis tick={{fill:"#475569",fontSize:9,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}} tickFormatter={v=>`${v}%`}/>
                <Tooltip content={<ChartTooltip/>}/>
                <Bar dataKey="ctrl" stackId="a" fill="#22c55e" name="DSP Controllable"/>
                <Bar dataKey="upstream" stackId="a" fill="#ef4444" name="Upstream" radius={[4,4,0,0]} opacity={0.7}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>)}

        {/* UIT4 CYCLES */}
        {selectedView==="cycles"&&(<>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"20px",marginBottom:24}}>
            <h3 style={{fontSize:11,fontWeight:700,color:"#64748b",margin:"0 0 16px",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>UIT4 Lates — {yearLabel}</h3>
            {(()=>{const d=(ALL_DEPOT_DATA.UIT4||[]).filter(fullFilter).sort((a,b)=>sortKey(a.year,a.week)-sortKey(b.year,b.week)).map(r=>({...r,label:chartLabel(r)}));return(
            <ResponsiveContainer width="100%" height={isMobile?220:300}>
              <ComposedChart data={d} margin={{top:10,right:isMobile?10:20,bottom:5,left:0}}>
                <defs><linearGradient id="uit4Grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#60a5fa" stopOpacity={0.25}/><stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="label" tick={{fill:"#475569",fontSize:9,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}} interval={2}/>
                <YAxis tick={{fill:"#475569",fontSize:9,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}} tickFormatter={v=>`${v}%`} domain={[0,8]}/>
                <Tooltip content={<ChartTooltip/>}/><ReferenceLine y={2.11} stroke="#22c55e" strokeDasharray="4 4" label={{value:t("w4Baseline"),fill:"#22c55e",fontSize:9,fontFamily:"DM Mono"}}/>
                <Area type="monotone" dataKey="late" stroke="#60a5fa" strokeWidth={2.5} fill="url(#uit4Grad)" name="UIT4 Late +15" dot={{r:3,fill:"#60a5fa"}} connectNulls/>
              </ComposedChart>
            </ResponsiveContainer>);})()}
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:12,marginBottom:24}}>
            {CYCLES.map(c=>(<div key={c.id} style={{background:c.id===4?"#450a0a":"#0f172a",border:`1px solid ${c.id===4?"#dc262640":"#1e293b"}`,borderRadius:10,padding:"16px",textAlign:"center"}}>
              <div style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,marginBottom:8}}>CYCLE {c.id}</div>
              <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginBottom:8}}>
                <div><div style={{fontSize:8,color:"#22c55e",fontFamily:"'DM Mono',monospace"}}>{t("trough")}</div><div style={{fontSize:16,fontWeight:800,color:"#22c55e",fontFamily:"'Outfit',sans-serif"}}>{c.troughVal}%</div><div style={{fontSize:8,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{c.trough}</div></div>
                <div style={{fontSize:16,color:"#475569"}}>→</div>
                <div><div style={{fontSize:8,color:"#ef4444",fontFamily:"'DM Mono',monospace"}}>{t("peak")}</div><div style={{fontSize:16,fontWeight:800,color:"#ef4444",fontFamily:"'Outfit',sans-serif"}}>{c.peakVal}%</div><div style={{fontSize:8,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{c.peak}</div></div>
              </div>
              <div style={{fontSize:11,fontWeight:700,color:"#fca5a5",fontFamily:"'DM Mono',monospace",background:"#dc262618",borderRadius:4,padding:"4px 8px"}}>+{(c.peakVal-c.troughVal).toFixed(2)}pp</div>
            </div>))}
          </div>
        </>)}

        {/* ── NCC DRIVERS ── */}
        {selectedView==="ncc"&&(<>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:12,marginBottom:20}}>
            <div style={{background:"linear-gradient(135deg,#7c2d12,#451a03)",border:"1px solid #ea580c30",borderRadius:10,padding:isMobile?"14px":"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#fb923c",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("totalNccDefects")}</div>
              <div style={{fontSize:isMobile?28:36,fontWeight:800,color:"#fb923c",fontFamily:"'Outfit',sans-serif"}}>{nccStats.totalDefects.toLocaleString()}</div>
              <div style={{fontSize:9,color:"#9a3412",fontFamily:"'DM Mono',monospace"}}>{nccStats.wkRange}</div>
            </div>
            <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:isMobile?"14px":"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("uniqueDrivers")}</div>
              <div style={{fontSize:isMobile?28:36,fontWeight:800,color:"#e2e8f0",fontFamily:"'Outfit',sans-serif"}}>{nccStats.driverCount}</div>
              <div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{t("across")} {selectedDepots.length} {selectedDepots.length!==1?t("stations"):t("station")}</div>
            </div>
            <div style={{background:"#0f172a",border:"1px solid #60a5fa20",borderRadius:10,padding:"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("worstStation")}</div>
              <div style={{fontSize:28,fontWeight:800,color:DEPOT_COLORS[nccStats.worstStn]||"#60a5fa",fontFamily:"'Outfit',sans-serif"}}>{nccStats.worstStn}</div>
              <div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{nccStats.worstVal} {t("defects")} ({nccStats.worstPct}%)</div>
            </div>
            <div style={{background:"#0f172a",border:"1px solid #dc262620",borderRadius:10,padding:"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("topOffender")}</div>
              <div style={{fontSize:14,fontWeight:800,color:"#fca5a5",fontFamily:"'Outfit',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{nccStats.topDriver?.name||"—"}</div>
              <div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{nccStats.topDriver?`${nccStats.topDriver._filtTotal} defects · ${nccStats.topDriver.stations.join("/")}`:"—"}</div>
            </div>
          </div>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"20px",marginBottom:20}}>
            <h3 style={{fontSize:11,fontWeight:700,color:"#64748b",margin:"0 0 14px",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{t("nccByStationWeekly")}</h3>
            <ResponsiveContainer width="100%" height={isMobile?180:220}>
              <BarChart data={nccTrendData} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="label" tick={{fill:"#475569",fontSize:8,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}}/>
                <YAxis tick={{fill:"#475569",fontSize:9,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}}/>
                <Tooltip content={<ChartTooltip/>}/>
                {selectedDepots.map(stn=><Bar key={stn} dataKey={stn} stackId="a" fill={DEPOT_COLORS[stn]} name={stn}/>)}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
            <span style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase"}}>{t("minDefects")}</span>
            {[1,3,5,10].map(n=>(<button key={n} onClick={()=>setNccMinDefects(n)} style={{background:nccMinDefects===n?"#1e293b":"transparent",border:nccMinDefects===n?"1px solid #475569":"1px solid #1e293b",color:nccMinDefects===n?"#e2e8f0":"#475569",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{n}+</button>))}
            <span style={{marginLeft:"auto",fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{nccFiltered.length} {t("driversShown")} · {defectWeeksFiltered.length} {t("weeksShown")} · {selectedDepots.join(", ")}</span>
          </div>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"16px",overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"2px 3px",minWidth:900}}>
              <thead><tr>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"left",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:30}}>#</th>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"left",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",minWidth:160}}>{t("driver")}</th>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:50}}>{t("city")}</th>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:60}}>{t("station")}</th>
                <th style={{padding:"6px",fontSize:8,color:"#fb923c",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",fontWeight:800,width:45}}>{t("total")}</th>
                {defectWeeksFiltered.map(wk=><th key={wk} style={{padding:"4px 3px",fontSize:7,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{wk.replace("2025-","").replace("2026-","")}<br/><span style={{fontSize:6,color:"#334155"}}>{wk.startsWith("2025")?"'25":"'26"}</span></th>)}
              </tr></thead>
              <tbody>{nccFiltered.map((d,i)=>{const isTop5=i<5;return(<tr key={i} style={{background:isTop5?"#450a0a08":"transparent"}}>
                <td style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:isTop5?"#fca5a5":"#475569",fontFamily:"'DM Mono',monospace"}}>{i+1}</td>
                <td style={{padding:"5px 6px",fontSize:11,fontWeight:isTop5?700:500,color:isTop5?"#fca5a5":"#e2e8f0",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:180}}>{d.name.startsWith("ID:")?<span style={{color:"#64748b",fontStyle:"italic"}}>{d.name}</span>:d.name}</td>
                <td style={{padding:"5px 6px",fontSize:9,color:"#64748b",textAlign:"center",fontFamily:"'DM Mono',monospace"}}>{d.loc}</td>
                <td style={{padding:"5px 6px",textAlign:"center"}}>{d.stations.map(s=><span key={s} style={{display:"inline-block",fontSize:8,fontWeight:700,color:DEPOT_COLORS[s],background:`${DEPOT_COLORS[s]}15`,padding:"1px 5px",borderRadius:3,margin:"0 1px",fontFamily:"'DM Mono',monospace"}}>{s}</span>)}</td>
                <td style={{padding:"5px 6px",textAlign:"center",fontSize:13,fontWeight:800,color:d._filtTotal>=20?"#dc2626":d._filtTotal>=10?"#ea580c":"#d97706",fontFamily:"'Outfit',sans-serif",background:d._filtTotal>=20?"#dc262618":d._filtTotal>=10?"#ea580c12":"transparent",borderRadius:4}}>{d._filtTotal}</td>
                {defectWeeksFiltered.map(wk=><NCCCell key={wk} val={d.w[wk]}/>)}
              </tr>);})}</tbody>
            </table>
          </div>
        </>)}

        {/* ── LATE DRIVERS ── */}
        {selectedView==="late"&&(<>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:12,marginBottom:20}}>
            <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81)",border:"1px solid #6366f130",borderRadius:10,padding:isMobile?"14px":"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#a5b4fc",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("totalLateDefects")}</div>
              <div style={{fontSize:isMobile?28:36,fontWeight:800,color:"#a5b4fc",fontFamily:"'Outfit',sans-serif"}}>{lateStats.totalDefects.toLocaleString()}</div>
              <div style={{fontSize:9,color:"#6366f1",fontFamily:"'DM Mono',monospace"}}>{lateStats.wkRange} · {t("opsControllable")}</div>
            </div>
            <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:isMobile?"14px":"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("latePlus15min")}</div>
              <div style={{fontSize:isMobile?28:36,fontWeight:800,color:"#dc2626",fontFamily:"'Outfit',sans-serif"}}>{lateStats.gt15Total.toLocaleString()}</div>
              <div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{lateStats.gt15Pct}% {t("ofTotal")} · {t("severeDefects")}</div>
            </div>
            <div style={{background:"#0f172a",border:"1px solid #60a5fa20",borderRadius:10,padding:isMobile?"14px":"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("worstStation")}</div>
              <div style={{fontSize:isMobile?22:28,fontWeight:800,color:DEPOT_COLORS[lateStats.worstStn]||"#60a5fa",fontFamily:"'Outfit',sans-serif"}}>{lateStats.worstStn}</div>
              <div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{lateStats.worstVal.toLocaleString()} {t("defects")} ({lateStats.worstPct}%)</div>
            </div>
            <div style={{background:"#0f172a",border:"1px solid #dc262620",borderRadius:10,padding:isMobile?"14px":"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("uniqueDrivers")}</div>
              <div style={{fontSize:isMobile?28:36,fontWeight:800,color:"#e2e8f0",fontFamily:"'Outfit',sans-serif"}}>{lateStats.driverCount}</div>
              <div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{t("across")} {selectedDepots.length} {selectedDepots.length!==1?t("stations"):t("station")}</div>
            </div>
          </div>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"20px",marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexDirection:isMobile?"column":"row",gap:isMobile?8:0}}>
              <h3 style={{fontSize:isMobile?10:11,fontWeight:700,color:"#64748b",margin:0,fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{t("lateByStationWeekly")}</h3>
              <div style={{display:"flex",gap:6}}>
                {["combined","gt15only"].map(m=>(<button key={m} onClick={()=>setLateViewMode(m)} style={{background:lateViewMode===m?"#1e293b":"transparent",border:lateViewMode===m?"1px solid #475569":"1px solid #1e293b",color:lateViewMode===m?"#e2e8f0":"#475569",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:9,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{m==="combined"?t("allLate"):t("latePlus15Only")}</button>))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={isMobile?200:240}>
              <BarChart data={lateTrendData} barSize={lateViewMode==="gt15only"?(isMobile?10:14):(isMobile?7:10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="label" tick={{fill:"#475569",fontSize:8,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}}/>
                <YAxis tick={{fill:"#475569",fontSize:9,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}}/>
                <Tooltip content={<ChartTooltip/>}/>
                {lateViewMode==="combined"
                  ? selectedDepots.map(stn=><Bar key={stn} dataKey={stn} stackId="a" fill={DEPOT_COLORS[stn]} name={stn}/>)
                  : selectedDepots.map(stn=><Bar key={stn} dataKey={stn+"_gt15"} stackId="a" fill={DEPOT_COLORS[stn]} name={stn+" +15"}/>)
                }
              </BarChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:8}}>
              {selectedDepots.map(stn=><div key={stn} style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:DEPOT_COLORS[stn],fontFamily:"'DM Mono',monospace"}}><div style={{width:10,height:4,borderRadius:2,background:DEPOT_COLORS[stn]}}/>{stn}</div>)}
            </div>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
            <span style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase"}}>{t("minDefects")}</span>
            {[1,5,10,20].map(n=>(<button key={n} onClick={()=>setLateMinDefects(n)} style={{background:lateMinDefects===n?"#1e293b":"transparent",border:lateMinDefects===n?"1px solid #475569":"1px solid #1e293b",color:lateMinDefects===n?"#e2e8f0":"#475569",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{n}+</button>))}
            <span style={{marginLeft:"auto",fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{lateFiltered.length} {t("driversShown")} · {defectWeeksFiltered.length} {t("weeksShown")} · {selectedDepots.join(", ")}</span>
          </div>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"16px",overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"2px 3px",minWidth:1000}}>
              <thead><tr>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"left",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:30}}>#</th>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"left",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",minWidth:130}}>{t("driver")}</th>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:60}}>{t("station")}</th>
                <th style={{padding:"6px",fontSize:8,color:"#a5b4fc",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",fontWeight:800,width:50}}>{t("total")}</th>
                <th style={{padding:"6px",fontSize:8,color:"#fca5a5",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:40}}>+15</th>
                <th style={{padding:"6px",fontSize:8,color:"#6366f1",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:35}}>%</th>
                {defectWeeksFiltered.map(wk=><th key={wk} style={{padding:"4px 3px",fontSize:7,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{wk.replace("2025-","").replace("2026-","")}<br/><span style={{fontSize:6,color:"#334155"}}>{wk.startsWith("2025")?"'25":"'26"}</span></th>)}
              </tr></thead>
              <tbody>{lateFiltered.map((d,i)=>{const isTop5=i<5;const gt15Pct=d._filtTotal>0?Math.round((d._filtGt15/d._filtTotal)*100):0;return(<tr key={i} style={{background:isTop5?"#1e1b4b08":"transparent"}}>
                <td style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:isTop5?"#a5b4fc":"#475569",fontFamily:"'DM Mono',monospace"}}>{i+1}</td>
                <td style={{padding:"5px 6px",fontSize:10,fontWeight:isTop5?700:500,color:isTop5?"#a5b4fc":"#e2e8f0",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:160}}>{(()=>{const nm=resolveName(d.tid);const isId=nm===d.tid;return isId?<span style={{color:"#64748b",fontStyle:"italic",fontSize:9}}>{nm.slice(0,14)}</span>:nm;})()}</td>
                <td style={{padding:"5px 6px",textAlign:"center"}}>{d.s.map(s=><span key={s} style={{display:"inline-block",fontSize:8,fontWeight:700,color:DEPOT_COLORS[s],background:`${DEPOT_COLORS[s]}15`,padding:"1px 5px",borderRadius:3,margin:"0 1px",fontFamily:"'DM Mono',monospace"}}>{s}</span>)}</td>
                <td style={{padding:"5px 6px",textAlign:"center",fontSize:13,fontWeight:800,color:d._filtTotal>=40?"#dc2626":d._filtTotal>=25?"#ea580c":"#a5b4fc",fontFamily:"'Outfit',sans-serif",background:d._filtTotal>=40?"#dc262618":d._filtTotal>=25?"#ea580c12":"transparent",borderRadius:4}}>{d._filtTotal}</td>
                <td style={{padding:"5px 6px",textAlign:"center",fontSize:11,fontWeight:700,color:d._filtGt15>=15?"#fca5a5":"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{d._filtGt15}</td>
                <td style={{padding:"5px 6px",textAlign:"center",fontSize:10,fontWeight:600,color:gt15Pct>=45?"#fca5a5":"#6366f1",fontFamily:"'DM Mono',monospace"}}>{gt15Pct}%</td>
                {defectWeeksFiltered.map(wk=><LateCell key={wk} val={d.w[wk]||0}/>)}
              </tr>);})}</tbody>
            </table>
          </div>
          <div style={{marginTop:14,padding:"12px 16px",background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,display:"flex",gap:20,flexWrap:"wrap"}}>
            <div style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace"}}><span style={{color:"#a5b4fc",fontWeight:700}}>{t("keyInsight")}:</span> W50/25 was catastrophic — 442 late deliveries network-wide (409 UIT4). W2/26 repeated the pattern with 287.</div>
            <div style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace"}}><span style={{color:"#dc2626",fontWeight:700}}>{t("gt15Rate")}:</span> 30% of lates are &gt;15min — UIT4 has 403/527 of all severe lates.</div>
            <div style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace"}}><span style={{color:"#6366f1",fontWeight:700}}>{t("attribution")}:</span> 100% classified as "Late Batch Ops Controllable" — these are DSP-owned.</div>
          </div>
        </>)}

        {/* ── DRIVER SCORECARD ── */}
        {selectedView==="scorecard"&&(<>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:12,marginBottom:20}}>
            <div style={{background:"linear-gradient(135deg,#14532d,#052e16)",border:"1px solid #22c55e30",borderRadius:10,padding:isMobile?"14px":"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#86efac",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("combinedDefects")}</div>
              <div style={{fontSize:isMobile?28:36,fontWeight:800,color:"#86efac",fontFamily:"'Outfit',sans-serif"}}>{scStats.combined.toLocaleString()}</div>
              <div style={{fontSize:9,color:"#16a34a",fontFamily:"'DM Mono',monospace"}}>{t("ncc")} + {t("late")} · {selectedDepots.join(", ")}</div>
            </div>
            <div style={{background:"#0f172a",border:"1px solid #ea580c20",borderRadius:10,padding:isMobile?"14px":"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("nccDefects")}</div>
              <div style={{fontSize:isMobile?28:36,fontWeight:800,color:"#fb923c",fontFamily:"'Outfit',sans-serif"}}>{scStats.nccSum.toLocaleString()}</div>
              <div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{t("notCallCompliant")}</div>
            </div>
            <div style={{background:"#0f172a",border:"1px solid #6366f120",borderRadius:10,padding:isMobile?"14px":"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("lateDefects")}</div>
              <div style={{fontSize:isMobile?28:36,fontWeight:800,color:"#a5b4fc",fontFamily:"'Outfit',sans-serif"}}>{scStats.lateSum.toLocaleString()}</div>
              <div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{scStats.gt15Sum} {t("severe15min")}</div>
            </div>
            <div style={{background:"#0f172a",border:"1px solid #dc262620",borderRadius:10,padding:isMobile?"14px":"18px",textAlign:"center"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>{t("dualOffenders")}</div>
              <div style={{fontSize:isMobile?28:36,fontWeight:800,color:"#fca5a5",fontFamily:"'Outfit',sans-serif"}}>{scStats.dual}</div>
              <div style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{t("driversWithBoth")}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
            <span style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase"}}>{t("minCombined")}</span>
            {[1,5,10,20,40].map(n=>(<button key={n} onClick={()=>setScorecardMinTotal(n)} style={{background:scorecardMinTotal===n?"#1e293b":"transparent",border:scorecardMinTotal===n?"1px solid #475569":"1px solid #1e293b",color:scorecardMinTotal===n?"#e2e8f0":"#475569",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{n}+</button>))}
            <span style={{marginLeft:"auto",fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{scorecardFiltered.length} {t("driversShown")} · {selectedDepots.join(", ")}</span>
          </div>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"16px",overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"2px 3px",minWidth:800}}>
              <thead><tr>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"left",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:30}}>#</th>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"left",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",minWidth:160}}>Driver</th>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:50}}>City</th>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:60}}>Station</th>
                <th style={{padding:"6px",fontSize:8,color:"#fb923c",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",fontWeight:800,width:45}}>{t("ncc")}</th>
                <th style={{padding:"6px",fontSize:8,color:"#a5b4fc",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",fontWeight:800,width:45}}>{t("late")}</th>
                <th style={{padding:"6px",fontSize:8,color:"#fca5a5",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",fontWeight:800,width:40}}>+15</th>
                <th style={{padding:"6px",fontSize:8,color:"#22c55e",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",fontWeight:800,width:55}}>{t("combinedDefects")}</th>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:60}}>{t("severity")}</th>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",minWidth:120}}>{t("defectMix")}</th>
              </tr></thead>
              <tbody>{scorecardFiltered.map((d,i)=>{const isTop5=i<5;const nccPct=d.combined>0?Math.round((d.ncc/d.combined)*100):0;const latePct=100-nccPct;const sevColors={CRITICAL:{bg:"#450a0a",text:"#fca5a5",border:"#dc2626"},HIGH:{bg:"#451a03",text:"#fcd34d",border:"#d97706"},MEDIUM:{bg:"#172554",text:"#93c5fd",border:"#3b82f6"},LOW:{bg:"#0f172a",text:"#64748b",border:"#334155"}};const sc=sevColors[d.severity];return(<tr key={i} style={{background:isTop5?"#14532d08":"transparent"}}>
                <td style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:isTop5?"#86efac":"#475569",fontFamily:"'DM Mono',monospace"}}>{i+1}</td>
                <td style={{padding:"5px 6px",fontSize:11,fontWeight:isTop5?700:500,color:isTop5?"#86efac":"#e2e8f0",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:180}}>{d.name.startsWith("ID:")||d.name.startsWith("A")?<span style={{color:"#64748b",fontStyle:"italic",fontSize:9}}>{d.name.slice(0,16)}</span>:d.name}</td>
                <td style={{padding:"5px 6px",fontSize:9,color:"#64748b",textAlign:"center",fontFamily:"'DM Mono',monospace"}}>{d.loc}</td>
                <td style={{padding:"5px 6px",textAlign:"center"}}>{d.stations.map(s=><span key={s} style={{display:"inline-block",fontSize:8,fontWeight:700,color:DEPOT_COLORS[s],background:`${DEPOT_COLORS[s]}15`,padding:"1px 5px",borderRadius:3,margin:"0 1px",fontFamily:"'DM Mono',monospace"}}>{s}</span>)}</td>
                <td style={{padding:"5px 6px",textAlign:"center",fontSize:12,fontWeight:700,color:d.ncc>0?"#fb923c":"#1e293b",fontFamily:"'DM Mono',monospace",background:d.ncc>=15?"#ea580c12":"transparent",borderRadius:3}}>{d.ncc||"·"}</td>
                <td style={{padding:"5px 6px",textAlign:"center",fontSize:12,fontWeight:700,color:d.late>0?"#a5b4fc":"#1e293b",fontFamily:"'DM Mono',monospace",background:d.late>=20?"#6366f112":"transparent",borderRadius:3}}>{d.late||"·"}</td>
                <td style={{padding:"5px 6px",textAlign:"center",fontSize:11,fontWeight:700,color:d.gt15>0?"#fca5a5":"#1e293b",fontFamily:"'DM Mono',monospace"}}>{d.gt15||"·"}</td>
                <td style={{padding:"5px 6px",textAlign:"center",fontSize:14,fontWeight:800,color:d.combined>=50?"#dc2626":d.combined>=30?"#ea580c":"#86efac",fontFamily:"'Outfit',sans-serif",background:d.combined>=50?"#dc262618":d.combined>=30?"#ea580c12":"#22c55e08",borderRadius:4}}>{d.combined}</td>
                <td style={{padding:"5px 6px",textAlign:"center"}}><span style={{fontSize:8,fontWeight:700,color:sc.text,background:`${sc.border}18`,padding:"2px 8px",borderRadius:4,fontFamily:"'DM Mono',monospace",letterSpacing:0.5}}>{d.severity}</span></td>
                <td style={{padding:"5px 6px"}}><div style={{display:"flex",height:10,borderRadius:3,overflow:"hidden",background:"#1e293b",minWidth:80}}>
                  {d.ncc>0&&<div style={{width:`${nccPct}%`,background:"#ea580c",minWidth:d.ncc>0?2:0}} title={`NCC: ${d.ncc}`}/>}
                  {d.late>0&&<div style={{width:`${Math.round((d.late/d.combined)*100)}%`,background:"#6366f1",minWidth:d.late>0?2:0}} title={`Late: ${d.late}`}/>}
                  {d.gt15>0&&<div style={{width:`${Math.round((d.gt15/d.combined)*100)}%`,background:"#dc2626",minWidth:d.gt15>0?2:0}} title={`+15: ${d.gt15}`}/>}
                </div></td>
              </tr>);})}</tbody>
            </table>
          </div>
          <div style={{marginTop:14,padding:"12px 16px",background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace"}}><div style={{width:12,height:6,borderRadius:2,background:"#ea580c"}}/>{t("ncc")}</div>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace"}}><div style={{width:12,height:6,borderRadius:2,background:"#6366f1"}}/>{t("late")}</div>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace"}}><div style={{width:12,height:6,borderRadius:2,background:"#dc2626"}}/>{t("latePlus15Label")}</div>
            <div style={{width:1,height:16,background:"#1e293b"}}/>
            <span style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{t("severityLegend")}</span>
          </div>
        </>)}

        {/* ── DEFECT FLOW ── */}
        {selectedView==="flow"&&(()=>{
          const TEAL="#0d9488";const TEAL_DIM="#0d948860";
          const fd = flowData;
          const maxDef = Math.max(...fd.defectTypes.map(d=>d.count));
          const selAttrs = flowDefect?(fd.attributions[flowDefect]||[]):[];
          const maxAttrVal = selAttrs.length>0?Math.max(...selAttrs.map(a=>a.count)):1;
          const attrData = flowAttr?selAttrs.find(a=>a.key===flowAttr):null;
          const siteItems = attrData?Object.entries(attrData.sites).map(([s,c])=>({name:s,count:c})).sort((a,b)=>b.count-a.count):[];
          const maxSite = siteItems.length>0?Math.max(...siteItems.map(s=>s.count)):1;
          const drvKey = flowSite&&flowAttr?`${flowSite}-${flowAttr}`:null;
          const drvItems = drvKey?(fd.drivers[drvKey]||[]):[];
          const maxDrv = drvItems.length>0?Math.max(...drvItems.map(d=>d.count)):1;

          const ColHeader = ({label})=>(
            <div style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14,paddingBottom:8,borderBottom:"1px solid #1e293b",display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:4,height:4,borderRadius:"50%",background:TEAL}}/>
              {label}
            </div>
          );

          const FlowBar=({count,maxVal,color,selected})=>(
            <div style={{height:5,background:"#0f172a",borderRadius:3,overflow:"hidden",marginTop:3}}>
              <div style={{width:`${Math.max((count/maxVal)*100,2)}%`,height:"100%",background:selected?color:color+"60",borderRadius:3,transition:"width 0.3s ease"}}/>
            </div>
          );

          return(<>
          {/* KPI Row */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(5,1fr)",gap:10,marginBottom:18}}>
            {[
              {label:"Orders Total",val:fd.ordersTotal.toLocaleString(),color:"#e2e8f0",sub:`all orders · ${fd.week}`},
              {label:"With Defects",val:fd.ordersWithDefects.toLocaleString(),color:"#fcd34d",sub:`${fd.pctDef}% of total · ${fd.weeks.length}w`},
              {label:"% Orders OK",val:`${fd.pctOk}%`,color:"#86efac",sub:"delivered clean"},
              {label:"Total Defects",val:fd.totalDefects.toLocaleString(),color:"#f8fafc",sub:"sum all defect types"},
              {label:"Defect Rate",val:`${fd.pctDef}%`,color:"#fca5a5",sub:"orders with defects"},
            ].map((kpi,i)=>(
              <div key={i} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,padding:"12px 16px"}}>
                <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{kpi.label}</div>
                <div style={{fontSize:isMobile?22:28,fontWeight:800,color:kpi.color,fontFamily:"'Outfit',sans-serif",lineHeight:1}}>{kpi.val}</div>
                <div style={{fontSize:9,color:"#334155",fontFamily:"'DM Mono',monospace",marginTop:4}}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {fd.weeks.length===0&&<div style={{padding:"14px 16px",marginBottom:14,background:"#451a03",border:"1px solid #d9770640",borderRadius:8,fontSize:10,color:"#fcd34d",fontFamily:"'DM Mono',monospace"}}>No order-level data for {effectiveFrom}–{effectiveTo} / {yearLabel}. Defect Flow covers {Object.keys(FLOW_WEEKS).length ? Object.keys(FLOW_WEEKS).sort()[0].replace("-"," ") + " → " + Object.keys(FLOW_WEEKS).sort().slice(-1)[0].replace("-"," ") : "no weeks"} — adjust the week filter.</div>}
          {/* Breadcrumb + hint */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <div style={{fontSize:9,color:"#f59e0b",fontFamily:"'DM Mono',monospace",fontWeight:700,background:"#f59e0b15",padding:"3px 10px",borderRadius:4,border:"1px solid #f59e0b30"}}>{fd.week}</div>
            {flowDefect&&<><span style={{color:"#1e293b",fontSize:12}}>›</span><div style={{fontSize:9,color:"#5eead4",fontFamily:"'DM Mono',monospace",background:"#0d948815",padding:"3px 10px",borderRadius:4,border:"1px solid #0d948830"}}>{fd.defectTypes.find(d=>d.key===flowDefect)?.label}</div></>}
            {flowAttr&&<><span style={{color:"#1e293b",fontSize:12}}>›</span><div style={{fontSize:9,color:"#5eead4",fontFamily:"'DM Mono',monospace",background:"#0d948815",padding:"3px 10px",borderRadius:4,border:"1px solid #0d948830"}}>{selAttrs.find(a=>a.key===flowAttr)?.label?.slice(0,24)}</div></>}
            {flowSite&&<><span style={{color:"#1e293b",fontSize:12}}>›</span><div style={{fontSize:9,color:DEPOT_COLORS[flowSite],fontFamily:"'DM Mono',monospace",background:`${DEPOT_COLORS[flowSite]}15`,padding:"3px 10px",borderRadius:4,border:`1px solid ${DEPOT_COLORS[flowSite]}30`}}>{flowSite}</div></>}
            <div style={{marginLeft:8,fontSize:9,color:"#334155",fontFamily:"'DM Mono',monospace"}}>{t("flowInstr")}</div>
            {(flowDefect||flowAttr||flowSite)&&<button onClick={()=>{setFlowDefect(null);setFlowAttr(null);setFlowSite(null);}} style={{marginLeft:"auto",background:"transparent",border:"1px solid #334155",color:"#64748b",borderRadius:4,padding:"3px 10px",cursor:"pointer",fontSize:9,fontFamily:"'DM Mono',monospace"}}>✕ Reset</button>}
          </div>

          {/* Main Flow Grid */}
          <div style={{display:"flex",gap:0,overflowX:"auto",background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:12,WebkitOverflowScrolling:"touch"}}>

            {/* COL 1: Defect Types */}
            <div style={{minWidth:220,padding:"20px 0 20px 20px",borderRight:"1px solid #1e293b",flexShrink:0}}>
              <ColHeader label={t("flowDefectType")}/>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {fd.defectTypes.map((dt,i)=>{
                  const isSel=flowDefect===dt.key;
                  return(
                    <div key={i} onClick={()=>{setFlowDefect(isSel?null:dt.key);setFlowAttr(null);setFlowSite(null);}} style={{cursor:"pointer",padding:"8px 10px",borderRadius:7,background:isSel?"#0d948818":"transparent",border:`1px solid ${isSel?"#0d948850":"transparent"}`,transition:"all 0.15s",marginRight:16}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                        <span style={{fontSize:12,fontWeight:isSel?700:400,color:isSel?"#5eead4":"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{dt.label}</span>
                        <span style={{fontSize:10,color:isSel?"#5eead4":"#475569",fontFamily:"'DM Mono',monospace",marginLeft:8}}>{dt.pct}%</span>
                      </div>
                      <FlowBar count={dt.count} maxVal={maxDef} color={TEAL} selected={isSel}/>
                      <div style={{fontSize:13,fontWeight:700,color:isSel?"#f8fafc":"#64748b",fontFamily:"'Outfit',sans-serif",marginTop:4}}>{dt.count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COL 2: Attribution */}
            {flowDefect?(
              <div style={{minWidth:260,padding:"20px 0 20px 20px",borderRight:"1px solid #1e293b",flexShrink:0}}>
                <ColHeader label={t("flowAttribution")}/>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {selAttrs.map((attr,i)=>{
                    const isSel=flowAttr===attr.key;
                    return(
                      <div key={i} onClick={()=>{setFlowAttr(isSel?null:attr.key);setFlowSite(null);}} style={{cursor:"pointer",padding:"8px 10px",borderRadius:7,background:isSel?"#0d948818":"transparent",border:`1px solid ${isSel?"#0d948850":"transparent"}`,transition:"all 0.15s",marginRight:16}}>
                        <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11,fontWeight:isSel?700:400,color:isSel?"#5eead4":"#94a3b8",fontFamily:"'DM Mono',monospace",marginBottom:2}}>{attr.label}</div>
                        <FlowBar count={attr.count} maxVal={maxAttrVal} color={TEAL} selected={isSel}/>
                        <div style={{fontSize:13,fontWeight:700,color:isSel?"#f8fafc":"#64748b",fontFamily:"'Outfit',sans-serif",marginTop:4}}>{attr.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ):(
              <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",padding:"40px",gap:12}}>
                <div style={{fontSize:36,color:"#1e293b"}}>→</div>
                <div style={{fontSize:11,color:"#334155",fontFamily:"'DM Mono',monospace",textAlign:"center",lineHeight:1.8}}>{t("flowSelectHint")}</div>
              </div>
            )}

            {/* COL 3: Site */}
            {flowAttr&&siteItems.length>0&&(
              <div style={{minWidth:180,padding:"20px 0 20px 20px",borderRight:"1px solid #1e293b",flexShrink:0}}>
                <ColHeader label={t("flowSite")}/>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {siteItems.map((site,i)=>{
                    const isSel=flowSite===site.name;
                    const dc=DEPOT_COLORS[site.name]||TEAL;
                    return(
                      <div key={i} onClick={()=>setFlowSite(isSel?null:site.name)} style={{cursor:"pointer",padding:"8px 10px",borderRadius:7,background:isSel?`${dc}18`:"transparent",border:`1px solid ${isSel?dc+"50":"transparent"}`,transition:"all 0.15s",marginRight:16}}>
                        <div style={{fontSize:13,fontWeight:700,color:isSel?dc:"#94a3b8",fontFamily:"'DM Mono',monospace",marginBottom:2}}>{site.name}</div>
                        <div style={{height:5,background:"#0f172a",borderRadius:3,overflow:"hidden",marginTop:3}}>
                          <div style={{width:`${Math.max((site.count/maxSite)*100,2)}%`,height:"100%",background:isSel?dc:dc+"60",borderRadius:3,transition:"width 0.3s ease"}}/>
                        </div>
                        <div style={{fontSize:13,fontWeight:700,color:isSel?"#f8fafc":"#64748b",fontFamily:"'Outfit',sans-serif",marginTop:4}}>{site.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COL 4: Drivers */}
            {flowSite&&(
              <div style={{minWidth:240,padding:"20px",flexShrink:0}}>
                <ColHeader label={t("flowDriver")}/>
                {drvItems.length>0?(
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {drvItems.map((drv,i)=>(
                      <div key={i} style={{padding:"6px 10px",borderRadius:7}}>
                        <div style={{fontSize:11,color:"#94a3b8",fontFamily:"'DM Mono',monospace",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{drv.name}</div>
                        <div style={{height:5,background:"#0f172a",borderRadius:3,overflow:"hidden",marginTop:3}}>
                          <div style={{width:`${Math.max((drv.count/maxDrv)*100,4)}%`,height:"100%",background:DEPOT_COLORS[flowSite]||TEAL,borderRadius:3}}/>
                        </div>
                        <div style={{fontSize:13,fontWeight:700,color:"#64748b",fontFamily:"'Outfit',sans-serif",marginTop:4}}>{drv.count}</div>
                      </div>
                    ))}
                  </div>
                ):(
                  <div style={{fontSize:10,color:"#334155",fontFamily:"'DM Mono',monospace",marginTop:20}}>No driver data for this combination</div>
                )}
              </div>
            )}
          </div>

          {/* Legend footer */}
          <div style={{marginTop:12,padding:"10px 16px",background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:8,display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
            {[
              {color:"#0d9488",label:"late_gt15 / ftfdf"},
              {color:"#6366f1",label:"ftpdf"},
              {color:"#f59e0b",label:"pdnr"},
              {color:"#64748b",label:"fdnr / ftdc"},
            ].map((l,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:10,height:10,borderRadius:2,background:l.color}}/>
                <span style={{fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{l.label}</span>
              </div>
            ))}
            <div style={{marginLeft:"auto",fontSize:9,color:"#334155",fontFamily:"'DM Mono',monospace"}}>Bars are proportional to max value within each column · Data: {fd.week}</div>
          </div>
        </>);
        })()}

        {/* ── GEO VIEW ── */}
        {selectedView==="geo"&&(()=>{
          const PURPLE="#8b5cf6";
          const defTypes = GEO_DATA.defectTypes;
          // Filtered attribution rows
          const filteredAttribs = GEO_DATA.attributions.filter(a=>geoDefectFilter.includes(a.defect) && (!geoSiteFilter||true));
          // Filtered defect totals by site
          const activeSite = geoSiteFilter ? GEO_DATA.sites.find(s=>s.key===geoSiteFilter) : null;
          const siteDefects = activeSite ? activeSite.defects : null;
          const maxBarCount = Math.max(...defTypes.map(dt=>siteDefects?siteDefects[dt]||0:GEO_DATA.defectTotals[dt]?.count||0));
          const toggleDefect = dt => setGeoDefectFilter(prev=>prev.includes(dt)?prev.filter(x=>x!==dt):[...prev,dt]);

          // Compute filtered driver matrix totals
          const filteredDrivers = GEO_DATA.drivers.map(d=>{
            const filtTotal = geoDefectFilter.reduce((s,dt)=>(s+(d[dt]||0)),0);
            return {...d, _filtTotal: filtTotal};
          });
          const totalRow = filteredDrivers.find(d=>d.isTotal);
          const driverRows = filteredDrivers.filter(d=>!d.isTotal).sort((a,b)=>b._filtTotal-a._filtTotal);
          const maxDriverTotal = Math.max(...driverRows.map(d=>d._filtTotal),1);

          const DefTypeColor = {late:"#6366f1",late_gt15:"#dc2626",ftfdf:"#f59e0b",ftpdf:"#0d9488",pdnr:"#ec4899",fdnr:"#64748b",ftdc:"#94a3b8"};

          return (<>
          {/* Top KPIs */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:10,marginBottom:18}}>
            {[
              {label:"Year",val:GEO_DATA.year,sub:"cumulative YTD",color:"#f59e0b"},
              {label:"Total Defects",val:GEO_DATA.grandTotal.toLocaleString(),sub:`${geoDefectFilter.length} type${geoDefectFilter.length!==1?"s":""} selected`,color:"#fca5a5"},
              {label:"Active Site Filter",val:geoSiteFilter||"All Sites",sub:"click map to filter",color:geoSiteFilter?DEPOT_COLORS[geoSiteFilter]:"#64748b"},
              {label:"Defect Types On",val:`${geoDefectFilter.length}/${defTypes.length}`,sub:"use filter panel →",color:PURPLE},
            ].map((kpi,i)=>(
              <div key={i} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,padding:"12px 16px"}}>
                <div style={{fontSize:8,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{kpi.label}</div>
                <div style={{fontSize:isMobile?20:26,fontWeight:800,color:kpi.color,fontFamily:"'Outfit',sans-serif",lineHeight:1}}>{kpi.val}</div>
                <div style={{fontSize:9,color:"#334155",fontFamily:"'DM Mono',monospace",marginTop:4}}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Main 3-col layout */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr auto",gap:16}}>
            {/* Left: Map + Bar Chart + Tables */}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>

              {/* Map + Bar chart side by side */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>

                {/* REAL LEAFLET MAP */}
                <div style={{background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:10,padding:16,position:"relative",minHeight:420}}>
                  <div style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>{t("geoMap")}</span>
                    {geoSiteFilter&&<button onClick={()=>setGeoSiteFilter(null)} style={{background:"transparent",border:"1px solid #334155",color:"#64748b",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:8,fontFamily:"'DM Mono',monospace"}}>✕ {geoSiteFilter}</button>}
                  </div>
                  <div style={{height:360,borderRadius:8,overflow:"hidden"}}>
                    <LeafletMap
                      sites={GEO_DATA.sites}
                      selectedSite={geoSiteFilter}
                      onSiteClick={key=>setGeoSiteFilter(prev=>prev===key?null:key)}
                      defectFilter={geoDefectFilter}
                      hoveredSite={geoHoveredSite}
                      onSiteHover={setGeoHoveredSite}
                    />
                  </div>
                  {/* Site legend chips */}
                  <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                    {GEO_DATA.sites.map(s=>{
                      const dc=DEPOT_COLORS[s.key]||PURPLE;
                      const isSel=geoSiteFilter===s.key;
                      const cnt=geoDefectFilter.reduce((sum,dt)=>sum+(s.defects[dt]||0),0);
                      return(<div key={s.key} onClick={()=>setGeoSiteFilter(isSel?null:s.key)} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",padding:"3px 8px",borderRadius:5,background:isSel?`${dc}20`:"transparent",border:`1px solid ${isSel?dc+"60":"#1e293b"}`}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:dc,opacity:isSel?1:0.5}}/>
                        <span style={{fontSize:9,fontWeight:700,color:isSel?dc:"#64748b",fontFamily:"'DM Mono',monospace"}}>{s.key}</span>
                        <span style={{fontSize:9,color:"#334155",fontFamily:"'DM Mono',monospace"}}>{cnt}</span>
                      </div>);
                    })}
                  </div>
                </div>

                {/* Bar chart: defects by type for selected site */}
                <div style={{background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:10,padding:16}}>
                  <div style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>
                    Defect Count — {geoSiteFilter||"All Sites"} · {GEO_DATA.year}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {defTypes.filter(dt=>geoDefectFilter.includes(dt)).map(dt=>{
                      const count = siteDefects?siteDefects[dt]||0:GEO_DATA.defectTotals[dt]?.count||0;
                      const barW = maxBarCount>0?Math.max((count/maxBarCount)*100,count>0?2:0):0;
                      const dc = DefTypeColor[dt]||PURPLE;
                      return(<div key={dt}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{dt}</span>
                          <span style={{fontSize:10,fontWeight:700,color:dc,fontFamily:"'DM Mono',monospace"}}>{count.toLocaleString()}</span>
                        </div>
                        <div style={{height:14,background:"#0f172a",borderRadius:3,overflow:"hidden"}}>
                          <div style={{width:`${barW}%`,height:"100%",background:dc,borderRadius:3,opacity:0.8,transition:"width 0.3s"}}/>
                        </div>
                      </div>);
                    })}
                  </div>
                  {/* Site buttons */}
                  <div style={{marginTop:16,display:"flex",gap:6,flexWrap:"wrap"}}>
                    <button onClick={()=>setGeoSiteFilter(null)} style={{background:!geoSiteFilter?"#1e293b":"transparent",border:`1px solid ${!geoSiteFilter?"#475569":"#1e293b"}`,color:!geoSiteFilter?"#e2e8f0":"#475569",borderRadius:5,padding:"3px 8px",cursor:"pointer",fontSize:9,fontFamily:"'DM Mono',monospace"}}>All</button>
                    {GEO_DATA.sites.map(s=>{
                      const isSel=geoSiteFilter===s.key;const dc=DEPOT_COLORS[s.key];
                      return(<button key={s.key} onClick={()=>setGeoSiteFilter(isSel?null:s.key)} style={{background:isSel?`${dc}20`:"transparent",border:`1px solid ${isSel?dc+"60":"#1e293b"}`,color:isSel?dc:"#475569",borderRadius:5,padding:"3px 8px",cursor:"pointer",fontSize:9,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>
                        <span style={{display:"inline-block",width:5,height:5,borderRadius:"50%",background:isSel?dc:"#334155",marginRight:4,verticalAlign:"middle"}}/>{s.key}
                      </button>);
                    })}
                  </div>
                </div>
              </div>

              {/* Attribution × Defect Table */}
              <div style={{background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:10,padding:16}}>
                <div style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>{t("geoAttribTable")} — {geoSiteFilter||"All Sites"}</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"2px 2px",minWidth:500}}>
                    <thead><tr>
                      <th style={{padding:"5px 8px",fontSize:8,color:"#475569",textAlign:"left",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",minWidth:80}}>ior_defect</th>
                      <th style={{padding:"5px 8px",fontSize:8,color:"#475569",textAlign:"left",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",minWidth:200}}>ior_attribution</th>
                      <th style={{padding:"5px 8px",fontSize:8,color:"#475569",textAlign:"right",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:60}}>Count</th>
                      <th style={{padding:"5px 8px",minWidth:120}}/>
                    </tr></thead>
                    <tbody>
                      {filteredAttribs.map((row,i)=>{
                        const dc=DefTypeColor[row.defect]||PURPLE;
                        const maxAtt=Math.max(...filteredAttribs.map(r=>r.count),1);
                        return(<tr key={i} style={{background:i%2===0?"#0f172a08":"transparent"}}>
                          <td style={{padding:"4px 8px"}}><span style={{fontSize:9,fontWeight:700,color:dc,background:`${dc}18`,padding:"2px 6px",borderRadius:3,fontFamily:"'DM Mono',monospace"}}>{row.defect}</span></td>
                          <td style={{padding:"4px 8px",fontSize:10,color:"#94a3b8",fontFamily:"'DM Mono',monospace"}}>{row.attribution}</td>
                          <td style={{padding:"4px 8px",fontSize:11,fontWeight:700,color:"#e2e8f0",textAlign:"right",fontFamily:"'Outfit',sans-serif"}}>{row.count.toLocaleString()}</td>
                          <td style={{padding:"4px 8px"}}>
                            <div style={{height:6,background:"#0f172a",borderRadius:3,overflow:"hidden"}}>
                              <div style={{width:`${(row.count/maxAtt)*100}%`,height:"100%",background:dc,opacity:0.7,borderRadius:3}}/>
                            </div>
                          </td>
                        </tr>);
                      })}
                      <tr style={{borderTop:"1px solid #1e293b"}}>
                        <td colSpan={2} style={{padding:"5px 8px",fontSize:9,fontWeight:700,color:"#64748b",fontFamily:"'DM Mono',monospace",textTransform:"uppercase"}}>Total</td>
                        <td style={{padding:"5px 8px",fontSize:12,fontWeight:800,color:"#f8fafc",textAlign:"right",fontFamily:"'Outfit',sans-serif"}}>{filteredAttribs.reduce((s,r)=>s+r.count,0).toLocaleString()}</td>
                        <td/>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Driver matrix */}
              <div style={{background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:10,padding:16}}>
                <div style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>{t("geoDriverMatrix")} — {GEO_DATA.year}</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"2px 2px",minWidth:700}}>
                    <thead><tr>
                      <th style={{padding:"5px 8px",fontSize:8,color:"#475569",textAlign:"left",fontFamily:"'DM Mono',monospace",minWidth:180}}>Last Name, First Name</th>
                      {geoDefectFilter.map(dt=>(
                        <th key={dt} style={{padding:"5px 6px",fontSize:8,color:DefTypeColor[dt]||PURPLE,textAlign:"center",fontFamily:"'DM Mono',monospace",fontWeight:800,width:50}}>{dt}</th>
                      ))}
                      <th style={{padding:"5px 8px",fontSize:8,color:"#86efac",textAlign:"center",fontFamily:"'DM Mono',monospace",fontWeight:800,width:55}}>Total</th>
                      <th style={{padding:"5px 8px",minWidth:80}}/>
                    </tr></thead>
                    <tbody>
                      {driverRows.map((d,i)=>{
                        const isTop=i<3;
                        return(<tr key={i} style={{background:isTop?"#1a1035":"transparent"}}>
                          <td style={{padding:"4px 8px",fontSize:11,fontWeight:isTop?700:400,color:isTop?"#c4b5fd":"#94a3b8",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{d.name}</td>
                          {geoDefectFilter.map(dt=>{
                            const val=d[dt]||0;const dc=DefTypeColor[dt]||PURPLE;
                            return(<td key={dt} style={{padding:"4px 6px",textAlign:"center",fontSize:10,fontWeight:val>20?700:400,color:val>30?dc:val>10?dc+"cc":"#475569",fontFamily:"'DM Mono',monospace",background:val>30?`${dc}15`:"transparent",borderRadius:2}}>{val||"·"}</td>);
                          })}
                          <td style={{padding:"4px 8px",textAlign:"center",fontSize:12,fontWeight:800,color:isTop?"#c4b5fd":"#86efac",fontFamily:"'Outfit',sans-serif"}}>{d._filtTotal}</td>
                          <td style={{padding:"4px 8px"}}>
                            <div style={{height:5,background:"#0f172a",borderRadius:3,overflow:"hidden"}}>
                              <div style={{width:`${(d._filtTotal/maxDriverTotal)*100}%`,height:"100%",background:PURPLE,opacity:0.6,borderRadius:3}}/>
                            </div>
                          </td>
                        </tr>);
                      })}
                      {/* Total row */}
                      {totalRow&&<tr style={{borderTop:"2px solid #1e293b",background:"#12101f"}}>
                        <td style={{padding:"5px 8px",fontSize:9,fontWeight:800,color:"#64748b",fontFamily:"'DM Mono',monospace",textTransform:"uppercase"}}>Total</td>
                        {geoDefectFilter.map(dt=>{
                          const val=totalRow[dt]||0;const dc=DefTypeColor[dt]||PURPLE;
                          return(<td key={dt} style={{padding:"5px 6px",textAlign:"center",fontSize:10,fontWeight:700,color:dc,fontFamily:"'DM Mono',monospace"}}>{val.toLocaleString()}</td>);
                        })}
                        <td style={{padding:"5px 8px",textAlign:"center",fontSize:12,fontWeight:800,color:"#f8fafc",fontFamily:"'Outfit',sans-serif"}}>{geoDefectFilter.reduce((s,dt)=>s+(totalRow[dt]||0),0).toLocaleString()}</td>
                        <td/>
                      </tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: Filter panel */}
            {!isMobile&&(
            <div style={{width:200,flexShrink:0}}>
              <div style={{background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:10,padding:16,position:"sticky",top:20}}>
                <div style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14,paddingBottom:8,borderBottom:"1px solid #1e293b"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>{t("geoFilter")}</span>
                    <button onClick={()=>setGeoDefectFilter([...GEO_DATA.defectTypes])} style={{background:"transparent",border:"none",color:"#334155",fontSize:8,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>ALL</button>
                  </div>
                </div>
                {/* Site filter */}
                <div style={{fontSize:8,color:"#475569",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Site</div>
                {["ALL",...GEO_DATA.sites.map(s=>s.key)].map(sk=>{
                  const isSel=sk==="ALL"?!geoSiteFilter:geoSiteFilter===sk;
                  const dc=sk==="ALL"?"#64748b":(DEPOT_COLORS[sk]||PURPLE);
                  return(<div key={sk} onClick={()=>setGeoSiteFilter(sk==="ALL"?null:(geoSiteFilter===sk?null:sk))} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 6px",marginBottom:4,cursor:"pointer",borderRadius:5,background:isSel?`${dc}15`:"transparent",border:`1px solid ${isSel?dc+"40":"transparent"}`}}>
                    <div style={{width:10,height:10,borderRadius:2,background:isSel?dc:"#1e293b",border:`1px solid ${isSel?dc:"#334155"}`,flexShrink:0}}/>
                    <span style={{fontSize:10,color:isSel?dc:"#64748b",fontFamily:"'DM Mono',monospace",fontWeight:isSel?700:400}}>{sk}</span>
                  </div>);
                })}
                <div style={{borderTop:"1px solid #1e293b",margin:"12px 0"}}/>
                {/* ior_defect filter */}
                <div style={{fontSize:8,color:"#475569",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>ior_defect in Table Order</div>
                {defTypes.map(dt=>{
                  const isSel=geoDefectFilter.includes(dt);const dc=DefTypeColor[dt]||PURPLE;
                  return(<div key={dt} onClick={()=>toggleDefect(dt)} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 6px",marginBottom:4,cursor:"pointer",borderRadius:5,background:isSel?`${dc}10`:"transparent"}}>
                    <div style={{width:10,height:10,borderRadius:2,background:isSel?dc:"#1e293b",border:`1px solid ${isSel?dc:"#334155"}`,flexShrink:0}}/>
                    <span style={{fontSize:10,color:isSel?dc:"#64748b",fontFamily:"'DM Mono',monospace",fontWeight:isSel?600:400}}>{dt}</span>
                    <span style={{marginLeft:"auto",fontSize:9,color:"#334155",fontFamily:"'DM Mono',monospace"}}>{GEO_DATA.defectTotals[dt]?.count}</span>
                  </div>);
                })}
                <div style={{borderTop:"1px solid #1e293b",margin:"12px 0"}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace"}}>
                  <span>ior_defect Total</span>
                  <span style={{color:"#e2e8f0",fontWeight:700}}>{geoDefectFilter.reduce((s,dt)=>s+(GEO_DATA.defectTotals[dt]?.count||0),0).toLocaleString()}</span>
                </div>
              </div>
            </div>)}
          </div>
        </>);
        })()}

        {/* ── PRODUCTIVITY: STOPS PER ROUTE ── */}
        {selectedView==="productivity"&&(<>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":`repeat(${Math.min(4,Math.max(1,prodDepots.length))},1fr)`,gap:12,marginBottom:20}}>
            {prodDepots.map(d=>{const st=sprStats[d]; const tgt=st.target; const ratio=st.last!=null&&tgt?st.last/tgt:null; const col=ratio==null?"#94a3b8":ratio<0.8?"#fca5a5":ratio<0.9?"#fcd34d":"#86efac"; const delta=st.last!=null&&st.prev!=null?st.last-st.prev:null; return(
              <div key={d} style={{background:"#0f172a",border:`1px solid ${DEPOT_COLORS[d]}30`,borderLeft:`3px solid ${DEPOT_COLORS[d]}`,borderRadius:10,padding:isMobile?"14px":"16px 18px"}}>
                <div style={{display:"flex",alignItems:"baseline",gap:8}}><span style={{fontSize:15,fontWeight:800,color:DEPOT_COLORS[d],fontFamily:"'Outfit',sans-serif"}}>{d}</span><span style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace"}}>{DEPOT_LABELS[d]}</span><span style={{marginLeft:"auto",fontSize:9,color:"#475569",fontFamily:"'DM Mono',monospace"}}>{st.lastWeek||"—"}</span></div>
                <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:8}}><span style={{fontSize:28,fontWeight:800,color:col,fontFamily:"'Outfit',sans-serif"}}>{st.last!=null?st.last.toFixed(1):"—"}</span><span style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace"}}>{t("sprUnit")}</span>{delta!=null&&<span style={{fontSize:10,fontWeight:700,color:delta>=0?"#86efac":"#fca5a5",fontFamily:"'DM Mono',monospace"}}>{delta>=0?"▲":"▼"} {Math.abs(delta).toFixed(1)}</span>}</div>
                <div style={{display:"flex",gap:12,marginTop:8,fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",flexWrap:"wrap"}}><span>{t("sprAvg")} <b style={{color:"#94a3b8"}}>{st.avg!=null?st.avg.toFixed(1):"—"}</b></span><span>{t("sprTarget")} <b style={{color:"#94a3b8"}}>{tgt!=null?tgt.toFixed(1):"—"}</b></span><span>{st.orders.toLocaleString()} {t("sprOrders").toLowerCase()} / {st.routes.toLocaleString()} {t("sprRoutes").toLowerCase()}</span></div>
              </div>);})}
          </div>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"20px",marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <h3 style={{fontSize:11,fontWeight:700,color:"#64748b",margin:0,fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{t("sprTitle")} — {effectiveFrom} → {effectiveTo} / {yearLabel}</h3>
              <button onClick={()=>setSprShowValues(v=>!v)} style={{background:sprShowValues?"#1e293b":"transparent",border:sprShowValues?"1px solid #475569":"1px solid #1e293b",color:sprShowValues?"#e2e8f0":"#475569",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:9,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{t("sprValues")}</button>
            </div>
            {sprWeekly.length===0 ? <div style={{padding:"40px 0",textAlign:"center",fontSize:11,color:"#475569",fontFamily:"'DM Mono',monospace"}}>— no data in range —</div> : (
            <ResponsiveContainer width="100%" height={isMobile?260:360}>
              <LineChart data={sprWeekly} margin={{top:18,right:isMobile?10:30,bottom:5,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="label" tick={{fill:"#475569",fontSize:9,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}} interval={Math.max(0,Math.floor(sprWeekly.length/16))}/>
                <YAxis tick={{fill:"#475569",fontSize:9,fontFamily:"DM Mono"}} axisLine={{stroke:"#1e293b"}} domain={[0,"auto"]}/>
                <Tooltip content={<SprTooltip/>}/>
                {prodDepots.map(d=>(<Line key={d} type="monotone" dataKey={d} stroke={DEPOT_COLORS[d]} strokeWidth={2} dot={{r:2.5,fill:DEPOT_COLORS[d],strokeWidth:0}} activeDot={{r:5}} name={d} connectNulls isAnimationActive={false} label={sprShowValues?<SprLabel color={DEPOT_COLORS[d]}/>:false}/>))}
              </LineChart>
            </ResponsiveContainer>)}
            <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:8,flexWrap:"wrap"}}>
              {prodDepots.map(d=>(<div key={d} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:DEPOT_COLORS[d],fontFamily:"'DM Mono',monospace"}}><div style={{width:12,height:3,borderRadius:2,background:DEPOT_COLORS[d]}}/>{d}</div>))}
            </div>
          </div>
          <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"16px",overflowX:"auto"}}>
            <h3 style={{fontSize:11,fontWeight:700,color:"#64748b",margin:"0 0 12px",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>{t("sprTable")}</h3>
            <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"2px 3px",minWidth:sprWeekly.length*52+160}}>
              <thead><tr>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"left",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",minWidth:70}}>{t("station")}</th>
                <th style={{padding:"6px",fontSize:8,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase",width:50}}>{t("sprTarget")}</th>
                {sprWeekly.map(r=><th key={r.label} style={{padding:"4px 3px",fontSize:8,color:"#475569",textAlign:"center",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{r.label}</th>)}
              </tr></thead>
              <tbody>
                {prodDepots.map(d=>(<tr key={d}>
                  <td style={{padding:"5px 6px",fontSize:11,fontWeight:700,color:DEPOT_COLORS[d],fontFamily:"'DM Mono',monospace"}}>{d}</td>
                  <td style={{padding:"5px 6px",fontSize:10,color:"#94a3b8",textAlign:"center",fontFamily:"'DM Mono',monospace"}}>{SPR_TARGET[d]!=null?SPR_TARGET[d].toFixed(1):"—"}</td>
                  {sprWeekly.map(r=>{const v=r[d];const c=sprCell(v,SPR_TARGET[d]);return(<td key={r.label} title={v!=null?`${r[d+"_o"]} orders / ${r[d+"_r"]} routes`:""} style={{padding:"5px 4px",fontSize:10,fontWeight:600,textAlign:"center",fontFamily:"'DM Mono',monospace",borderRadius:3,background:c.bg,color:c.color}}>{v!=null?v.toFixed(1):"·"}</td>);})}
                </tr>))}
                <tr>
                  <td style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:"#94a3b8",fontFamily:"'DM Mono',monospace",borderTop:"1px solid #1e293b"}}>{t("sprNetwork")}</td>
                  <td style={{borderTop:"1px solid #1e293b"}}/>
                  {sprWeekly.map(r=><td key={r.label} style={{padding:"5px 4px",fontSize:10,fontWeight:600,textAlign:"center",fontFamily:"'DM Mono',monospace",color:"#e2e8f0",borderTop:"1px solid #1e293b"}}>{r.network!=null?r.network.toFixed(1):"·"}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{marginTop:14,padding:"12px 16px",background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace",lineHeight:1.6}}>{t("sprNote")}</div>
        </>)}

        {/* FOOTER */}
        <div style={{textAlign:"center",padding:"20px 0 8px",marginTop:24,borderTop:"1px solid #1e293b"}}>
          <p style={{fontSize:9,color:"#334155",fontFamily:"'DM Mono',monospace",letterSpacing:1}}><span onClick={()=>window.__dspLock&&window.__dspLock()} title="Lock dashboard" style={{cursor:"pointer",color:"#475569"}}>🔒 LOCK</span> · {t("footer")} · {yearLabel} · {t("generated")} {new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
}

// ─── EXPORT: dashboard protegido por contraseña ─────────────────────
export default function Dashboard() {
  return <PasswordGate><DashboardInner /></PasswordGate>;
}
