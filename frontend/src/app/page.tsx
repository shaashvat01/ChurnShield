"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { MapCarousel } from "@/components/ui/map-carousel";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Badge } from "@/components/retroui/Badge";
import ActionSearchBar from "@/components/kokonutui/action-search-bar";
import { 
  TrendingDown,
  Users,
  DollarSign,
  MapPin,
  X,
  Shield,
  Home as HomeIcon,
  Briefcase,
  Info,
  Activity,
  ArrowLeft,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Layers,
  Utensils,
  Hotel,
  Building2,
  ShoppingBag
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AreaChart } from "@/components/retroui/charts/AreaChart";

// High Impact Event for Demo
const INTEL_CHANDLER_EVENT = {
  id: "intel-1",
  label: "Intel Chandler, Arizona — 15% workforce reduction",
  icon: <Activity className="h-4 w-4 text-amber-500" />,
  description: "October 2025 announcement",
  short: "EVENT",
  end: "High Risk",
};

const SAMPLE_EVENTS = [
  INTEL_CHANDLER_EVENT,
  {
    id: "tsmc-1",
    label: "TSMC Phoenix — Construction Delay Q4 2025",
    icon: <Briefcase className="h-4 w-4 text-slate-500" />,
    description: "Supply chain ripple predicted",
    short: "DELAY",
    end: "Med Risk",
  },
];

// Heatmap Data Clusters with Custom Icons
const IMPACT_ZONES = [
  { name: "Intel Ocotillo (Core)", type: "WORK", icon: "/icons/office.svg", coords: [33.2764, -111.8906], loss: "$0M", label: "SOURCE", risk: "CRITICAL", rating: 9.9 },
  { name: "South Chandler Residents", type: "HOME", icon: "/icons/hotel.svg", coords: [33.2600, -111.8950], loss: "$42M", label: "-15%", risk: "HIGH", rating: 8.5 },
  { name: "Price Corridor Retail", type: "RETAIL", icon: "/icons/retail.svg", coords: [33.2850, -111.8850], loss: "$88M", label: "-22%", risk: "CRITICAL", rating: 9.5 },
  { name: "Sun Lakes Cluster", type: "HOME", icon: "/icons/hotel.svg", coords: [33.2300, -111.9100], loss: "$28M", label: "-8%", risk: "MEDIUM", rating: 6.0 },
  { name: "Downtown Chandler Hub", type: "RETAIL", icon: "/icons/restaurant.svg", coords: [33.3050, -111.8417], loss: "$56M", label: "-12%", risk: "HIGH", rating: 8.0 },
  { name: "West Chandler Industrial", type: "WORK", icon: "/icons/office.svg", coords: [33.3000, -111.9300], loss: "$34M", label: "-9%", risk: "MEDIUM", rating: 6.5 },
  { name: "Gilbert Gateway Cluster", type: "HOME", icon: "/icons/hotel.svg", coords: [33.2900, -111.7500], loss: "$18M", label: "-5%", risk: "LOW", rating: 4.0 },
  { name: "Ocotillo Tech Supply", type: "WORK", icon: "/icons/office.svg", coords: [33.2700, -111.9050], loss: "$64M", label: "-18%", risk: "HIGH", rating: 8.8 },
  { name: "Queen Creek Edge", type: "HOME", icon: "/icons/hotel.svg", coords: [33.2500, -111.6500], loss: "$12M", label: "-4%", risk: "LOW", rating: 3.5 },
  { name: "Mesa Border Retail", type: "RETAIL", icon: "/icons/retail.svg", coords: [33.3300, -111.8800], loss: "$24M", label: "-7%", risk: "MEDIUM", rating: 5.5 },
  { name: "Commuter Corridor A", type: "HOME", icon: "/icons/hotel.svg", coords: [33.3200, -111.9500], loss: "$31M", label: "-10%", risk: "MEDIUM", rating: 6.2 },
  { name: "Ahwatukee Housing", type: "HOME", icon: "/icons/hotel.svg", coords: [33.3100, -112.0100], loss: "$45M", label: "-11%", risk: "HIGH", rating: 8.2 },
];

export default function Home() {
  const [view, setView] = useState<"landing" | "results">("landing");
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  
  const mapLocations = IMPACT_ZONES.map(z => ({
    name: z.name,
    subtitle: `${z.type} Zone - Churn Impact: ${z.label}`,
    image: `https://images.unsplash.com/photo-${z.type === 'HOME' ? '1480074568708-e7b720bb3f09' : '1486406146926-c627a92ad1ab'}?w=400`,
    price: parseFloat(z.loss.replace('$', '')),
    priceLabel: z.label,
    priceSubtext: z.risk,
    rating: z.rating,
    iconUrl: z.icon,
    coordinates: z.coords as [number, number],
  }));

  const intelMapData = {
    locations: mapLocations,
    center: [33.2764, -111.8906] as [number, number],
    zoom: 12,
    title: "Blast Radius: Intel Chandler",
    mapStyle: "voyager" as const,
    useHeatmap: true
  };

  const velocityData = [
    { month: "Oct", impact: 10 },
    { month: "Nov", impact: 25 },
    { month: "Dec", impact: 45 },
    { month: "Jan", impact: 70 },
    { month: "Feb", impact: 85 },
    { month: "Mar", impact: 100 },
  ];

  return (
    <main className="relative min-h-screen bg-slate-50 font-[family-name:var(--font-jetbrains-mono)] overflow-hidden">
      
      {/* BACKGROUND MAP */}
      <div className={cn(
        "absolute inset-0 z-0 transition-all duration-1000",
        view === "landing" ? "opacity-40 blur-[1px] grayscale" : "opacity-100"
      )}>
        <MapCarousel 
          data={intelMapData}
          actions={{
            onSelectLocation: (loc) => {
              setSelectedLocation(loc);
            }
          }}
          appearance={{
            displayMode: "fullscreen",
            mapHeight: "100%",
            hideSidebar: true
          }}
        />
        {/* Amber Heat Gradient */}
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
                  onActionSelect={(action) => { if (action.id === "intel-1") setView("results"); }} 
                />
              </div>

              <div className="flex gap-4 justify-center">
                {["Regional Analysis", "Industry Churn", "Municipal Risk"].map(tag => (
                  <Badge key={tag} variant="outline" className="border border-slate-200 font-bold uppercase px-4 py-2 text-xs bg-white/80 backdrop-blur text-slate-500 shadow-sm hover:border-indigo-400 transition-colors">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RESULTS DASHBOARD */}
      <AnimatePresence>
        {view === "results" && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative z-30 flex h-screen pointer-events-none"
          >
            {/* Control Bar */}
            <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-50 pointer-events-auto">
              <Button 
                onClick={() => { setView("landing"); setSelectedLocation(null); }}
                className="bg-white border-2 border-slate-900 shadow-none hover:bg-slate-100 transition-all font-black uppercase text-xs px-6 py-3 text-slate-900"
              >
                ← REFRESH ENGINE
              </Button>
              <div className="bg-indigo-900 text-white px-6 py-3 border border-indigo-950 font-bold uppercase text-xs flex items-center gap-3 rounded-xl shadow-lg shadow-indigo-100">
                <Shield className="w-4 h-4 text-indigo-400" />
                ACTIVE: INTEL CHANDLER IMPACT MATRIX
              </div>
            </div>

            {/* Main Sidebar */}
            <motion.div 
              initial={{ x: -440 }}
              animate={{ x: selectedLocation ? -440 : 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-[440px] bg-white/95 backdrop-blur-md border-r border-slate-200 p-10 flex flex-col gap-10 overflow-y-auto pointer-events-auto shadow-2xl z-40"
            >
              <div className="pt-20 space-y-2">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">Impact Matrix</h2>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.2em]">Census & Household Data Layer v4.2</p>
              </div>

              <div className="space-y-4">
                <Card className="p-8 border border-slate-100 bg-amber-50/30 shadow-none rounded-3xl">
                  <div className="flex justify-between items-center mb-4">
                    <DollarSign className="w-6 h-6 text-amber-600" />
                    <Badge className="bg-amber-600 text-white border-none font-bold text-[10px] uppercase px-3 py-1">Spend Delta</Badge>
                  </div>
                  <div className="text-6xl font-black text-amber-700 tracking-tighter leading-none">-$340M</div>
                  <p className="text-xs font-bold text-amber-900/40 mt-3 uppercase tracking-wider">Predicted Annual Household Churn</p>
                </Card>

                <Card className="p-8 border border-slate-100 bg-slate-50 shadow-none rounded-3xl">
                  <div className="flex justify-between items-center mb-4">
                    <HomeIcon className="w-6 h-6 text-slate-400" />
                    <Badge variant="outline" className="border-slate-200 text-slate-500 font-bold text-[10px] uppercase px-3 py-1">Residency</Badge>
                  </div>
                  <div className="text-6xl font-black text-slate-900 tracking-tighter leading-none">12,840</div>
                  <p className="text-xs font-bold text-slate-400 mt-3 uppercase tracking-wider">Affected Households (10mi Radius)</p>
                </Card>
              </div>

              <div className="space-y-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Commuter Impact Analysis</h4>
                <div className="space-y-6">
                  {[
                    { label: "Direct Employee Households", val: 92, color: "bg-amber-600" },
                    { label: "Secondary Supply Chain Churn", val: 68, color: "bg-amber-400" },
                    { label: "Municipal Tax Revenue Risk", val: 45, color: "bg-indigo-900" },
                  ].map((cat, i) => (
                    <div key={i} className="space-y-3">
                      <div className="flex justify-between text-[11px] font-bold text-slate-700 uppercase tracking-tight">
                        <span>{cat.label}</span>
                        <span>{cat.val}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${cat.val}%` }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          className={cn("h-full", cat.color)} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto p-6 bg-slate-50 rounded-3xl border border-slate-100 flex gap-4">
                <Info className="w-5 h-5 text-indigo-400 shrink-0" />
                <p className="text-xs text-slate-500 leading-relaxed font-bold uppercase tracking-tight">
                  Census tract analysis reveals that 32% of affected employees reside in North Chandler.
                </p>
              </div>
            </motion.div>

            {/* Detail Data Panel */}
            <AnimatePresence>
              {selectedLocation && (
                <motion.div 
                  initial={{ x: -600 }}
                  animate={{ x: 0 }}
                  exit={{ x: -600 }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="absolute left-0 top-0 bottom-0 w-[600px] bg-white border-r border-slate-200 z-50 pointer-events-auto flex flex-col shadow-3xl overflow-y-auto"
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
                      <Badge className="bg-indigo-600 text-white font-bold text-[10px] uppercase">{selectedLocation.priceSubtext} AREA</Badge>
                      <div className="flex items-center gap-3">
                        {selectedLocation.iconUrl && (
                          <div className="w-12 h-12 p-2.5 bg-slate-100 rounded-2xl flex items-center justify-center">
                            <img src={selectedLocation.iconUrl} className="w-full h-full object-contain filter brightness-0" alt="" />
                          </div>
                        )}
                        <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">{selectedLocation.name}</h3>
                      </div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{selectedLocation.subtitle}</p>
                    </div>

                    {/* Dashboard Grid */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                      <Card className="p-6 border-slate-100 bg-slate-50 shadow-none rounded-3xl">
                        <Activity className="w-5 h-5 text-indigo-600 mb-4" />
                        <div className="text-xs font-black text-slate-400 uppercase mb-1">Impact Velocity</div>
                        <div className="text-2xl font-black text-indigo-600">{selectedLocation.priceLabel}</div>
                      </Card>
                      <Card className="p-6 border-slate-100 bg-slate-50 shadow-none rounded-3xl">
                        <Layers className="w-5 h-5 text-amber-500 mb-4" />
                        <div className="text-xs font-black text-slate-400 uppercase mb-1">Exposure Index</div>
                        <div className="text-2xl font-black text-amber-600">{selectedLocation.rating}/10</div>
                      </Card>
                    </div>

                    {/* Visualization Grid */}
                    <div className="space-y-8">
                      {/* Graph 1: Churn Velocity */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <BarChartIcon className="w-4 h-4" />
                            90-Day Churn Projection
                          </h4>
                        </div>
                        <div className="h-48 w-full bg-slate-50 rounded-3xl border border-slate-100 p-6">
                           <AreaChart 
                              data={velocityData}
                              index="month"
                              categories={["impact"]}
                              strokeColors={["#4f46e5"]}
                              fillColors={["#eef2ff"]}
                              className="h-full w-full"
                              showGrid={false}
                              valueFormatter={(v) => `${v}%`}
                            />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        {/* Sector Exposure */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <PieChartIcon className="w-4 h-4" />
                            Sector Exposure
                          </h4>
                          <div className="space-y-3">
                            {[
                              { label: "Retail", val: 85, color: "bg-indigo-600" },
                              { label: "Service", val: 45, color: "bg-amber-400" },
                              { label: "Supply", val: 30, color: "bg-slate-300" },
                            ].map((s, i) => (
                              <div key={i} className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                                  <span>{s.label}</span>
                                  <span>{s.val}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={cn("h-full rounded-full", s.color)} style={{ width: `${s.val}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* HH Risk Dist. */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            HH Risk Dist.
                          </h4>
                          <div className="aspect-square w-full rounded-full border-8 border-slate-50 flex items-center justify-center relative">
                            <div className="absolute inset-0 rounded-full border-8 border-indigo-600" style={{ clipPath: 'polygon(50% 50%, 100% 0, 100% 100%, 0 100%)' }} />
                            <div className="text-center">
                              <div className="text-xl font-black text-slate-900">72%</div>
                              <div className="text-[8px] font-bold text-slate-400 uppercase">High Risk</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                        <p className="text-xs text-indigo-700 font-bold leading-relaxed uppercase tracking-tight">
                          Predictive heuristic suggests that {selectedLocation.name} will experience a {selectedLocation.priceLabel} contraction.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <div className="absolute bottom-8 right-8 z-50 pointer-events-none flex items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          System Operational
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <span className="bg-white/80 backdrop-blur px-3 py-1 rounded-full border border-slate-100 shadow-sm">AWS: PREDICTIVE ENGINE</span>
      </div>

    </main>
  );
}
