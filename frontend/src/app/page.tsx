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
    label: "Intel announces 3,000 layoffs at Chandler, AZ semiconductor fab",
    icon: <Activity className="h-4 w-4 text-amber-500" />,
    description: "Semiconductor workforce reduction · 4.9x Moretti multiplier",
    short: "DEMO",
    end: "High Risk",
  },
  {
    id: "microchip-recent",
    label: "Microchip announces 500 layoffs at Tempe, AZ (WARN filed Oct 29, 2025)",
    icon: <Briefcase className="h-4 w-4 text-blue-500" />,
    description: "Semiconductor · Tempe blast radius (62 OSM businesses)",
    short: "WARN",
    end: "Active",
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

  // Source-employer label for the businesses-by-category subtitle
  const epicenterLabel = data?.epicenter?.employer ?? "epicenter";

  // Map locations: epicenter (red), then ZIP regions, then real businesses
  const mapLocations = data
    ? [
        // Epicenter — the source employer (red marker on top)
        ...(data.epicenter
          ? [
              {
                name: `${data.epicenter.employer} ${data.epicenter.city}`,
                subtitle: `Source event · ${formatNumber(data.epicenter.direct_jobs)} direct layoffs`,
                image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400",
                price: data.epicenter.direct_jobs,
                priceLabel: data.epicenter.employer.toUpperCase(),
                priceSubtext: `${formatNumber(data.epicenter.direct_jobs)} jobs cut`,
                rating: 100,
                coordinates: [
                  data.epicenter.latitude,
                  data.epicenter.longitude,
                ] as [number, number],
                epicenterData: data.epicenter,
                markerType: "epicenter" as const,
                category: "epicenter",
              },
            ]
          : []),
        // ZIP code markers (geographic circles, show dollar impact)
        ...data.affected_zips.slice(0, 14).map((z) => ({
          name: `ZIP ${z.zip_code} - ${z.city}`,
          subtitle: `${formatNumber(Math.round(z.total_jobs_impact))} jobs at risk`,
          image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400",
          price: z.dollar_impact,
          priceLabel: formatDollars(z.dollar_impact),
          priceSubtext: `${(z.commuter_share * 100).toFixed(0)}% of workforce`,
          rating: z.commuter_share * 100,
          coordinates: [z.latitude, z.longitude] as [number, number],
          zipData: z,
          markerType: "zip" as const,
          category: "zip",
        })),
        // Real business markers (show revenue impact %)
        ...Object.entries(data.businesses_by_category || {}).flatMap(([category, businesses]) =>
          (businesses as any[]).slice(0, 6).map((b) => ({
            name: b.name,
            subtitle: `${b.distance_miles.toFixed(1)} mi from ${epicenterLabel} · ${category.replace("_", " ")}`,
            image: category === "restaurant" 
              ? "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400"
              : category === "childcare"
              ? "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400"
              : "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400",
            price: b.estimated_revenue_impact_pct,
            priceLabel: `-${b.estimated_revenue_impact_pct}%`,
            priceSubtext: "predicted revenue loss",
            rating: b.estimated_revenue_impact_pct,
            coordinates: [b.latitude, b.longitude] as [number, number],
            businessData: b,
            markerType: "business" as const,
            category: category,
          }))
        ),
      ]
    : [];

  // Center on the epicenter when available, else fall back to Intel Chandler
  const mapCenter: [number, number] = data?.epicenter
    ? [data.epicenter.latitude, data.epicenter.longitude]
    : [33.3062, -111.8413];

  const mapData = {
    locations: mapLocations,
    center: mapCenter,
    zoom: 11,
    title: data ? `Blast Radius: ${data.event.employer} ${data.event.location_city}` : "Economic Blast Radius",
    mapStyle: "voyager" as const,
    useHeatmap: true,
  };

  // Total businesses from business exposure
  const totalBusinesses = data
    ? data.business_exposure.reduce((sum, b) => sum + b.establishment_count, 0)
    : 0;

  return (
    <main className="relative min-h-screen bg-slate-50 font-sans overflow-hidden">
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
                {["Moretti (2010) Multipliers", "Census LODES Data", "QCEW Wages", "WARN Act"].map(
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
                ACTIVE: {data.event.employer.toUpperCase()}{" "}
                {data.event.location_city.toUpperCase()} IMPACT MATRIX
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
                  {data.multiplier_source} · {data.multiplier}x Multiplier
                </p>
              </div>

              {/* Key Metrics */}
              <div className="space-y-4">
                <Card className="p-8 border border-slate-100 bg-amber-50/30 shadow-none rounded-3xl">
                  <div className="flex justify-between items-center mb-4">
                    <DollarSign className="w-6 h-6 text-amber-600" />
                    <Badge className="bg-amber-600 text-white border-none font-bold text-[10px] uppercase px-3 py-1">
                      Quarterly Revenue Loss
                    </Badge>
                  </div>
                  <div className="text-6xl font-black text-amber-700 tracking-tighter leading-none">
                    -{formatDollars(data.quarterly_revenue_loss)}
                  </div>
                  <p className="text-xs font-bold text-amber-900/40 mt-3 uppercase tracking-wider">
                    {data.confidence_interval}
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
                    {formatNumber(data.total_jobs_at_risk)}
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-3 uppercase tracking-wider">
                    {formatNumber(data.direct_jobs)} Direct +{" "}
                    {formatNumber(data.indirect_jobs)}{" "}
                    Indirect (Moretti {data.multiplier}x)
                  </p>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-6 border border-slate-100 bg-slate-50 shadow-none rounded-3xl">
                    <MapPin className="w-5 h-5 text-indigo-500 mb-3" />
                    <div className="text-3xl font-black text-indigo-600">
                      {data.affected_zips.length}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                      ZIP Codes Hit
                    </p>
                  </Card>
                  <Card className="p-6 border border-slate-100 bg-slate-50 shadow-none rounded-3xl">
                    <Building2 className="w-5 h-5 text-amber-500 mb-3" />
                    <div className="text-3xl font-black text-amber-600">
                      {formatNumber(totalBusinesses)}
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
                  {data.business_exposure.slice(0, 5).map((cat, i) => {
                    const maxImpact = data.business_exposure[0]?.dollar_impact || 1;
                    const pct = Math.round((cat.dollar_impact / maxImpact) * 100);
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
                          <span>{cat.naics_description}</span>
                          <span>{formatDollars(cat.dollar_impact)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                            className={cn("h-full", colors[i] || "bg-slate-300")}
                          />
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {formatNumber(cat.establishment_count)} establishments
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real Businesses at Risk - with Revenue Impact */}
              {data.businesses_by_category && Object.keys(data.businesses_by_category).length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Real Businesses at Risk (OSM Data)
                  </h4>
                  {Object.entries(data.businesses_by_category).slice(0, 4).map(([category, businesses]) => (
                    <div key={category} className="space-y-2">
                      <div className="text-[10px] font-bold text-indigo-600 uppercase">
                        {category.replace("_", " ")} ({businesses.length})
                      </div>
                      {businesses.slice(0, 4).map((biz: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-[10px] pl-2 border-l-2 border-slate-200">
                          <span className="text-slate-600 truncate max-w-[180px]">
                            {biz.name}
                          </span>
                          <span className="text-amber-600 font-bold whitespace-nowrap">
                            -{biz.estimated_revenue_impact_pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <p className="text-[8px] text-slate-400 italic">
                    Revenue impact based on distance decay + category dependency
                  </p>
                </div>
              )}

              {/* Methodology */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Methodology
                </h4>
                <Card className="p-6 border border-slate-100 bg-indigo-50/30 shadow-none rounded-3xl space-y-4">
                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                    Based on Moretti (2010) &quot;Local Multipliers&quot;
                  </div>
                  <div className="text-[9px] text-slate-500 leading-relaxed">
                    High-tech industries generate {data.multiplier}x additional jobs in the 
                    nontradable sector (restaurants, retail, services) for each tradable 
                    sector job lost. American Economic Review, 100(2), 373-377.
                  </div>
                </Card>
              </div>

              {/* Sources */}
              <div className="mt-auto space-y-2">
                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Data Sources
                </h4>
                {Object.entries(data.data_sources).slice(0, 4).map(([key, citation]) => (
                  <p
                    key={key}
                    className="text-[9px] text-slate-400 font-medium leading-relaxed"
                  >
                    {citation}
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
                {data.affected_zips.slice(0, 10).map((z, i) => (
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
                        {z.city || "AZ"} · {formatNumber(z.total_jobs_impact)} jobs
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-amber-600">
                        {formatDollars(z.dollar_impact)}
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

                    {/* Different content for ZIP vs Business */}
                    {selectedLocation.markerType === "business" ? (
                      // BUSINESS DETAIL VIEW
                      <>
                        <div className="space-y-2 mb-8">
                          <Badge className={cn(
                            "font-bold text-[10px] uppercase",
                            selectedLocation.price > 30 ? "bg-red-600 text-white" :
                            selectedLocation.price > 20 ? "bg-amber-500 text-white" :
                            "bg-emerald-500 text-white"
                          )}>
                            {selectedLocation.price > 30 ? "HIGH RISK" : selectedLocation.price > 20 ? "MEDIUM RISK" : "MODERATE RISK"}
                          </Badge>
                          <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                            {selectedLocation.name}
                          </h3>
                          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                            {selectedLocation.subtitle}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <Card className="p-5 border-slate-100 bg-red-50 shadow-none rounded-2xl">
                            <TrendingDown className="w-5 h-5 text-red-500 mb-3" />
                            <div className="text-[10px] font-black text-slate-400 uppercase mb-1">
                              Predicted Revenue Loss
                            </div>
                            <div className="text-3xl font-black text-red-600">
                              {selectedLocation.priceLabel}
                            </div>
                          </Card>
                          <Card className="p-5 border-slate-100 bg-slate-50 shadow-none rounded-2xl">
                            <MapPin className="w-5 h-5 text-indigo-500 mb-3" />
                            <div className="text-[10px] font-black text-slate-400 uppercase mb-1">
                              Distance from {epicenterLabel}
                            </div>
                            <div className="text-3xl font-black text-indigo-600">
                              {selectedLocation.businessData?.distance_miles?.toFixed(1) || "?"} mi
                            </div>
                          </Card>
                        </div>

                        <Card className="p-5 border border-amber-200 bg-amber-50/50 shadow-none rounded-2xl mb-6">
                          <h4 className="text-[10px] font-black text-amber-700 uppercase mb-3">
                            How We Calculated This
                          </h4>
                          <div className="space-y-2 text-[11px] text-amber-900">
                            <div className="flex justify-between">
                              <span>Base impact (category: {selectedLocation.category})</span>
                              <span className="font-bold">40%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Distance decay ({selectedLocation.businessData?.distance_miles?.toFixed(1)} mi)</span>
                              <span className="font-bold">-{(40 - (selectedLocation.price || 0)).toFixed(0)}%</span>
                            </div>
                            <div className="flex justify-between border-t border-amber-200 pt-2 mt-2">
                              <span className="font-bold">Final predicted impact</span>
                              <span className="font-black text-red-600">{selectedLocation.priceLabel}</span>
                            </div>
                          </div>
                        </Card>

                        <div className="p-5 bg-slate-100 rounded-2xl">
                          <p className="text-[10px] text-slate-600 leading-relaxed">
                            <strong>Methodology:</strong> Revenue impact calculated using distance-decay model 
                            (closer businesses more affected) combined with category dependency scores 
                            (restaurants 100%, retail 60%). Based on consumer spending patterns from 
                            BLS Consumer Expenditure Survey.
                          </p>
                        </div>
                      </>
                    ) : (
                      // ZIP CODE DETAIL VIEW
                      <>
                        <div className="space-y-2 mb-8">
                          <Badge className="bg-amber-600 text-white font-bold text-[10px] uppercase">
                            {selectedLocation.rating > 10 ? "HIGH IMPACT ZONE" : selectedLocation.rating > 5 ? "MEDIUM IMPACT" : "AFFECTED AREA"}
                          </Badge>
                          <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">
                            {selectedLocation.name}
                          </h3>
                          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                            {selectedLocation.subtitle}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <Card className="p-5 border-slate-100 bg-amber-50 shadow-none rounded-2xl">
                            <DollarSign className="w-5 h-5 text-amber-600 mb-3" />
                            <div className="text-[10px] font-black text-slate-400 uppercase mb-1">
                              Quarterly Impact
                            </div>
                            <div className="text-3xl font-black text-amber-700">
                              {selectedLocation.priceLabel}
                            </div>
                          </Card>
                          <Card className="p-5 border-slate-100 bg-slate-50 shadow-none rounded-2xl">
                            <Users className="w-5 h-5 text-indigo-500 mb-3" />
                            <div className="text-[10px] font-black text-slate-400 uppercase mb-1">
                              Commuter Share
                            </div>
                            <div className="text-3xl font-black text-indigo-600">
                              {selectedLocation.rating?.toFixed(0)}%
                            </div>
                          </Card>
                        </div>

                        <Card className="p-5 border border-indigo-200 bg-indigo-50/50 shadow-none rounded-2xl mb-6">
                          <h4 className="text-[10px] font-black text-indigo-700 uppercase mb-3">
                            LODES Commute Flow Analysis
                          </h4>
                          <div className="space-y-2 text-[11px] text-indigo-900">
                            <div className="flex justify-between">
                              <span>Workers commuting from this ZIP</span>
                              <span className="font-bold">{selectedLocation.rating?.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Direct jobs impact</span>
                              <span className="font-bold">{formatNumber(selectedLocation.zipData?.direct_jobs_impact || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Indirect jobs impact ({data.multiplier}x)</span>
                              <span className="font-bold">{formatNumber(selectedLocation.zipData?.indirect_jobs_impact || 0)}</span>
                            </div>
                            <div className="flex justify-between border-t border-indigo-200 pt-2 mt-2">
                              <span className="font-bold">Total jobs at risk</span>
                              <span className="font-black text-amber-600">{formatNumber(selectedLocation.zipData?.total_jobs_impact || 0)}</span>
                            </div>
                          </div>
                        </Card>

                        <div className="p-5 bg-slate-100 rounded-2xl">
                          <p className="text-[10px] text-slate-600 leading-relaxed">
                            <strong>Data Source:</strong> Census LEHD LODES Origin-Destination data shows 
                            where {epicenterLabel} {data.event.location_city} workers live. This ZIP accounts for {selectedLocation.rating?.toFixed(1)}% 
                            of the workforce. Impact distributed proportionally using Moretti (2010) {data.multiplier}x multiplier.
                          </p>
                        </div>
                      </>
                    )}
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
            {data.headline_summary}
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
