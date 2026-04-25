"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { MapCarousel } from "@/components/ui/map-carousel";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Badge } from "@/components/retroui/Badge";
import ActionSearchBar from "@/components/kokonutui/action-search-bar";
import { useAnalysis } from "@/hooks/useAnalysis";
import { formatDollars, formatNumber } from "@/utils/formatters";
import type { AnalysisResponse } from "@/types";
import {
  TrendingDown,
  Users,
  DollarSign,
  Shield,
  Home as HomeIcon,
  Briefcase,
  Info,
  Activity,
  ArrowLeft,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Layers,
  MapPin,
  Building2,
  Loader2,
  AlertTriangle,
  Search,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const SAMPLE_EVENTS = [
  {
    id: "intel-1",
    label: "Intel announces 1,500 layoffs at Chandler, AZ semiconductor fab",
    icon: <Activity className="h-4 w-4 text-amber-500" />,
    description: "Semiconductor workforce reduction",
    short: "EVENT",
    end: "High Risk",
  },
  {
    id: "tsmc-1",
    label: "TSMC announces 800 layoffs at Phoenix, AZ chip plant",
    icon: <Briefcase className="h-4 w-4 text-slate-500" />,
    description: "Semiconductor supply chain impact",
    short: "EVENT",
    end: "Med Risk",
  },
  {
    id: "wells-1",
    label: "Wells Fargo announces 2,000 layoffs at Chandler, AZ operations center",
    icon: <Building2 className="h-4 w-4 text-blue-500" />,
    description: "Financial services reduction",
    short: "EVENT",
    end: "High Risk",
  },
];

export default function Home() {
  const [view, setView] = useState<"landing" | "results">("landing");
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const { data, loading, error, status, analyze } = useAnalysis();

  const handleEventSelect = async (action: { id: string; label: string }) => {
    setView("results");
    await analyze(action.label);
  };

  const mapLocations = data
    ? data.zip_impacts.slice(0, 20).map((z) => ({
        name: `ZIP ${z.zip_code}`,
        subtitle: `${formatNumber(Math.round(z.estimated_jobs_lost))} jobs at risk · ${formatDollars(z.estimated_dollar_impact)}`,
        image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400",
        price: z.estimated_dollar_impact,
        priceLabel: formatDollars(z.estimated_dollar_impact),
        priceSubtext: z.commuter_share > 0.03 ? "HIGH" : z.commuter_share > 0.01 ? "MEDIUM" : "LOW",
        rating: Math.min(z.commuter_share * 100, 10),
        coordinates: [33.2764 + (Math.random() - 0.5) * 0.15, -111.8906 + (Math.random() - 0.5) * 0.15] as [number, number],
        zipData: z,
      }))
    : [];

  const mapData = {
    locations: mapLocations,
    center: [33.2764, -111.8906] as [number, number],
    zoom: 11,
    title: data ? `Blast Radius: ${data.parsed_event.employer_name} ${data.parsed_event.city}` : "Economic Blast Radius",
    mapStyle: "voyager" as const,
    useHeatmap: true,
  };

  const totalJobs = data
    ? data.direct_impact.direct_jobs_lost + data.indirect_impact.indirect_jobs_lost
    : 0;

  return (
    <main className="relative min-h-screen bg-slate-50 font-[family-name:var(--font-jetbrains-mono)] overflow-hidden">
      {/* BACKGROUND MAP */}
      <div
        className={cn(
          "absolute inset-0 z-0 transition-all duration-1000",
          view === "landing" ? "opacity-40 blur-[1px] grayscale" : "opacity-100"
        )}
      >
        <MapCarousel
          data={mapData}
          actions={{
            onSelectLocation: (loc) => setSelectedLocation(loc),
          }}
          appearance={{
            displayMode: "fullscreen",
            mapHeight: "100%",
            hideSidebar: true,
          }}
        />
        {view === "results" && (
          <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(245,158,11,0.03)_50%,_rgba(245,158,11,0.1)_100%)]" />
        )}
      </div>

      {/* LANDING UI */}
      <AnimatePresence>
        {view === "landing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="relative z-20 flex flex-col items-center justify-center min-h-screen p-6"
          >
            <div className="text-center space-y-12 max-w-4xl">
              <div className="space-y-4">
                <h1 className="text-[140px] font-black tracking-tighter text-slate-900 uppercase leading-none">
                  Churn<span className="text-indigo-600">Shield</span>
                </h1>
                <p className="text-lg font-bold text-slate-400 uppercase tracking-[0.4em]">
                  Predictive Economic Impact Analysis
                </p>
              </div>

              <div className="w-full max-w-2xl mx-auto">
                <ActionSearchBar
                  actions={SAMPLE_EVENTS}
                  onActionSelect={handleEventSelect}
                />
              </div>

              <div className="flex gap-4 justify-center">
                {["Census LODES Data", "QCEW Wages", "WARN Act Notices"].map(
                  (tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="border border-slate-200 font-bold uppercase px-4 py-2 text-xs bg-white/80 backdrop-blur text-slate-500 shadow-sm hover:border-indigo-400 transition-colors"
                    >
                      {tag}
                    </Badge>
                  )
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOADING OVERLAY */}
      <AnimatePresence>
        {view === "results" && loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6"
          >
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-lg font-black text-slate-900 uppercase tracking-wider">
                Running Analysis Engine
              </p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {status || "Processing Census LODES · QCEW · WARN · CBP data"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ERROR OVERLAY */}
      <AnimatePresence>
        {view === "results" && error && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-6"
          >
            <AlertTriangle className="w-12 h-12 text-amber-500" />
            <div className="text-center space-y-2 max-w-md">
              <p className="text-lg font-black text-slate-900 uppercase">
                Analysis Error
              </p>
              <p className="text-sm text-slate-500">{error}</p>
              <Button
                onClick={() => setView("landing")}
                className="mt-4 bg-indigo-600 text-white border-none font-bold uppercase text-xs px-6 py-3"
              >
                ← Try Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RESULTS DASHBOARD */}
      <AnimatePresence>
        {view === "results" && data && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative z-30 flex h-screen pointer-events-none"
          >
            {/* Control Bar */}
            <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-50 pointer-events-auto">
              <Button
                onClick={() => {
                  setView("landing");
                  setSelectedLocation(null);
                }}
                className="bg-white border-2 border-slate-900 shadow-none hover:bg-slate-100 transition-all font-black uppercase text-xs px-6 py-3 text-slate-900"
              >
                ← NEW ANALYSIS
              </Button>
              <div className="bg-indigo-900 text-white px-6 py-3 border border-indigo-950 font-bold uppercase text-xs flex items-center gap-3 rounded-xl shadow-lg shadow-indigo-100">
                <Shield className="w-4 h-4 text-indigo-400" />
                ACTIVE: {data.parsed_event.employer_name.toUpperCase()}{" "}
                {data.parsed_event.city.toUpperCase()} IMPACT MATRIX
              </div>
            </div>

            {/* Main Sidebar */}
            <motion.div
              initial={{ x: -440 }}
              animate={{ x: selectedLocation ? -440 : 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-[440px] bg-white/95 backdrop-blur-md border-r border-slate-200 p-10 flex flex-col gap-8 overflow-y-auto pointer-events-auto shadow-2xl z-40"
            >
              <div className="pt-20 space-y-2">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">
                  Impact Matrix
                </h2>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.2em]">
                  {data.bls_comparison.data_vintage} · Moretti{" "}
                  {data.indirect_impact.moretti_multiplier}x Multiplier
                </p>
              </div>

              {/* Key Metrics */}
              <div className="space-y-4">
                <Card className="p-8 border border-slate-100 bg-amber-50/30 shadow-none rounded-3xl">
                  <div className="flex justify-between items-center mb-4">
                    <DollarSign className="w-6 h-6 text-amber-600" />
                    <Badge className="bg-amber-600 text-white border-none font-bold text-[10px] uppercase px-3 py-1">
                      Consumer Spending Loss
                    </Badge>
                  </div>
                  <div className="text-6xl font-black text-amber-700 tracking-tighter leading-none">
                    -{formatDollars(data.dollar_impact.consumer_spending_loss)}
                  </div>
                  <p className="text-xs font-bold text-amber-900/40 mt-3 uppercase tracking-wider">
                    Annual Economic Impact
                  </p>
                </Card>

                <Card className="p-8 border border-slate-100 bg-slate-50 shadow-none rounded-3xl">
                  <div className="flex justify-between items-center mb-4">
                    <Users className="w-6 h-6 text-slate-400" />
                    <Badge
                      variant="outline"
                      className="border-slate-200 text-slate-500 font-bold text-[10px] uppercase px-3 py-1"
                    >
                      Total Jobs at Risk
                    </Badge>
                  </div>
                  <div className="text-6xl font-black text-slate-900 tracking-tighter leading-none">
                    {formatNumber(totalJobs)}
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-3 uppercase tracking-wider">
                    {formatNumber(data.direct_impact.direct_jobs_lost)} Direct +{" "}
                    {formatNumber(data.indirect_impact.indirect_jobs_lost)}{" "}
                    Indirect ({data.indirect_impact.industry_classification})
                  </p>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-6 border border-slate-100 bg-slate-50 shadow-none rounded-3xl">
                    <MapPin className="w-5 h-5 text-indigo-500 mb-3" />
                    <div className="text-3xl font-black text-indigo-600">
                      {data.zip_impacts.length}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                      ZIP Codes Hit
                    </p>
                  </Card>
                  <Card className="p-6 border border-slate-100 bg-slate-50 shadow-none rounded-3xl">
                    <Building2 className="w-5 h-5 text-amber-500 mb-3" />
                    <div className="text-3xl font-black text-amber-600">
                      {formatNumber(
                        data.exposure_summary.total_affected_businesses
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                      Businesses Exposed
                    </p>
                  </Card>
                </div>
              </div>

              {/* Top Business Categories */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Most Exposed Business Sectors
                </h4>
                <div className="space-y-4">
                  {data.exposure_summary.top_categories.map((cat, i) => {
                    const maxScore =
                      data.exposure_summary.top_categories[0]?.exposure_score ||
                      1;
                    const pct = Math.round(
                      (cat.exposure_score / maxScore) * 100
                    );
                    const colors = [
                      "bg-amber-600",
                      "bg-amber-400",
                      "bg-indigo-600",
                      "bg-indigo-400",
                      "bg-slate-400",
                    ];
                    return (
                      <div key={cat.naics_code} className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold text-slate-700 uppercase tracking-tight">
                          <span>{cat.naics_label}</span>
                          <span>
                            {formatNumber(cat.establishment_count)} est.
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                            className={cn("h-full", colors[i] || "bg-slate-300")}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BLS Comparison */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  BLS Comparison (Early Warning)
                </h4>
                <Card className="p-6 border border-slate-100 bg-indigo-50/30 shadow-none rounded-3xl space-y-4">
                  <div className="flex justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        BLS Baseline
                      </div>
                      <div className="text-xl font-black text-slate-900">
                        {formatNumber(data.bls_comparison.baseline_employment)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-amber-600 uppercase">
                        Engine Predicted
                      </div>
                      <div className="text-xl font-black text-amber-700">
                        {formatNumber(data.bls_comparison.predicted_employment)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider text-center">
                    BLS won&apos;t report until{" "}
                    {data.bls_comparison.projected_report_quarter} — We show it
                    now
                  </div>
                </Card>
              </div>

              {/* WARN Cross-Reference */}
              {data.direct_impact.warn_cross_referenced && (
                <div className="p-5 bg-emerald-50 rounded-3xl border border-emerald-100 flex gap-4">
                  <Info className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-xs text-emerald-700 leading-relaxed font-bold uppercase tracking-tight">
                    Cross-referenced with{" "}
                    {data.direct_impact.warn_notices_matched} Arizona WARN Act
                    filings for {data.parsed_event.employer_name}
                  </p>
                </div>
              )}

              {/* Sources */}
              <div className="mt-auto space-y-2">
                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Data Sources
                </h4>
                {data.sources.map((s, i) => (
                  <p
                    key={i}
                    className="text-[9px] text-slate-400 font-medium leading-relaxed"
                  >
                    {s}
                  </p>
                ))}
              </div>
            </motion.div>

            {/* Top ZIP Codes Panel (Right Side) */}
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.3 }}
              className="absolute right-0 top-20 w-[360px] max-h-[calc(100vh-120px)] bg-white/95 backdrop-blur-md border-l border-slate-200 p-8 overflow-y-auto pointer-events-auto shadow-2xl z-40 rounded-l-3xl"
            >
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
                Top Affected ZIP Codes
              </h3>
              <div className="space-y-3">
                {data.zip_impacts.slice(0, 10).map((z, i) => (
                  <div
                    key={z.zip_code}
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100"
                  >
                    <div className="text-lg font-black text-slate-300 w-6">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-black text-slate-900">
                        {z.zip_code}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {Math.round(z.estimated_jobs_lost)} jobs ·{" "}
                        {z.distance_miles
                          ? `${z.distance_miles} mi`
                          : "N/A"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-amber-600">
                        {formatDollars(z.estimated_dollar_impact)}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">
                        {(z.commuter_share * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Detail Data Panel (Slides from Left on marker click) */}
            <AnimatePresence>
              {selectedLocation && (
                <motion.div
                  initial={{ x: -600 }}
                  animate={{ x: 0 }}
                  exit={{ x: -600 }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="absolute left-0 top-0 bottom-0 w-[500px] bg-white border-r border-slate-200 z-50 pointer-events-auto flex flex-col shadow-3xl overflow-y-auto"
                >
                  <div className="p-8 pt-24 flex flex-col h-full">
                    <button
                      onClick={() => setSelectedLocation(null)}
                      className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors mb-8"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Matrix
                    </button>

                    <div className="space-y-2 mb-8">
                      <Badge className="bg-indigo-600 text-white font-bold text-[10px] uppercase">
                        {selectedLocation.priceSubtext} IMPACT ZONE
                      </Badge>
                      <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">
                        {selectedLocation.name}
                      </h3>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                        {selectedLocation.subtitle}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-8">
                      <Card className="p-6 border-slate-100 bg-slate-50 shadow-none rounded-3xl">
                        <Activity className="w-5 h-5 text-indigo-600 mb-4" />
                        <div className="text-xs font-black text-slate-400 uppercase mb-1">
                          Dollar Impact
                        </div>
                        <div className="text-2xl font-black text-indigo-600">
                          {selectedLocation.priceLabel}
                        </div>
                      </Card>
                      <Card className="p-6 border-slate-100 bg-slate-50 shadow-none rounded-3xl">
                        <Layers className="w-5 h-5 text-amber-500 mb-4" />
                        <div className="text-xs font-black text-slate-400 uppercase mb-1">
                          Risk Score
                        </div>
                        <div className="text-2xl font-black text-amber-600">
                          {selectedLocation.rating?.toFixed(1)}/10
                        </div>
                      </Card>
                    </div>

                    <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                      <p className="text-xs text-indigo-700 font-bold leading-relaxed uppercase tracking-tight">
                        LODES commute flow analysis indicates this ZIP code accounts for{" "}
                        {selectedLocation.rating?.toFixed(1)}% of the employer&apos;s
                        workforce residential distribution. Impact will materialize
                        within 90-120 days post-event.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADLINE BAR */}
      {view === "results" && data && !loading && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="absolute bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur text-white px-8 py-5"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-center text-amber-300">
            {data.headline}
          </p>
        </motion.div>
      )}

      {/* FOOTER */}
      <div className="absolute bottom-8 right-8 z-40 pointer-events-none flex items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {view === "landing" && (
          <>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              System Operational
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <span className="bg-white/80 backdrop-blur px-3 py-1 rounded-full border border-slate-100 shadow-sm">
              AWS: PREDICTIVE ENGINE
            </span>
          </>
        )}
      </div>
    </main>
  );
}
