"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { MapCarousel } from "@/components/ui/map-carousel";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Badge } from "@/components/retroui/Badge";
import ActionSearchBar from "@/components/kokonutui/action-search-bar";
import { 
  AlertTriangle,
  TrendingDown,
  Users,
  DollarSign,
  MapPin,
  BarChart3,
  X,
  ShieldAlert,
  Home as HomeIcon,
  ShoppingBag,
  Briefcase,
  Info
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AreaChart } from "@/components/retroui/charts/AreaChart";

// High Impact Event for Demo
const INTEL_CHANDLER_EVENT = {
  id: "intel-1",
  label: "Intel Chandler, Arizona — 15% workforce reduction",
  icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
  description: "October 2025 announcement",
  short: "EVENT",
  end: "High Risk",
};

const SAMPLE_EVENTS = [
  INTEL_CHANDLER_EVENT,
  {
    id: "tsmc-1",
    label: "TSMC Phoenix — Construction Delay Q4 2025",
    icon: <Briefcase className="h-4 w-4 text-amber-500" />,
    description: "Supply chain ripple predicted",
    short: "DELAY",
    end: "Med Risk",
  },
];

// Heatmap Data: Clusters of affected employees and businesses
const IMPACT_ZONES = [
  { name: "Intel Ocotillo (Core)", type: "WORK", coords: [33.2764, -111.8906], loss: "$0M", label: "SOURCE", risk: "CRITICAL" },
  { name: "South Chandler Residents", type: "HOME", coords: [33.2600, -111.8950], loss: "$42M", label: "-15%", risk: "HIGH" },
  { name: "Price Corridor Retail", type: "RETAIL", coords: [33.2850, -111.8850], loss: "$88M", label: "-22%", risk: "CRITICAL" },
  { name: "Sun Lakes Cluster", type: "HOME", coords: [33.2300, -111.9100], loss: "$28M", label: "-8%", risk: "MEDIUM" },
  { name: "Downtown Chandler Hub", type: "RETAIL", coords: [33.3050, -111.8417], loss: "$56M", label: "-12%", risk: "HIGH" },
  { name: "West Chandler Industrial", type: "WORK", coords: [33.3000, -111.9300], loss: "$34M", label: "-9%", risk: "MEDIUM" },
  { name: "Gilbert Gateway Cluster", type: "HOME", coords: [33.2900, -111.7500], loss: "$18M", label: "-5%", risk: "LOW" },
  { name: "Ocotillo Tech Supply", type: "WORK", coords: [33.2700, -111.9050], loss: "$64M", label: "-18%", risk: "HIGH" },
  { name: "Queen Creek Edge", type: "HOME", coords: [33.2500, -111.6500], loss: "$12M", label: "-4%", risk: "LOW" },
  { name: "Mesa Border Retail", type: "RETAIL", coords: [33.3300, -111.8800], loss: "$24M", label: "-7%", risk: "MEDIUM" },
  { name: "Commuter Corridor A", type: "HOME", coords: [33.3200, -111.9500], loss: "$31M", label: "-10%", risk: "MEDIUM" },
  { name: "Ahwatukee Housing", type: "HOME", coords: [33.3100, -112.0100], loss: "$45M", label: "-11%", risk: "HIGH" },
];

export default function Home() {
  const [view, setView] = useState<"landing" | "results">("landing");
  const [showMetrics, setShowMetrics] = useState(false);
  
  const mapLocations = IMPACT_ZONES.map(z => ({
    name: z.name,
    subtitle: `${z.type} Zone - Household spending delta: ${z.label}`,
    image: `https://images.unsplash.com/photo-${z.type === 'HOME' ? '1480074568708-e7b720bb3f09' : '1486406146926-c627a92ad1ab'}?w=400`,
    price: parseFloat(z.loss.replace('$', '')),
    priceLabel: z.label,
    priceSubtext: z.risk,
    rating: z.risk === "CRITICAL" ? 9.9 : z.risk === "HIGH" ? 8.5 : 7.0,
    coordinates: z.coords as [number, number],
  }));

  const intelMapData = {
    locations: mapLocations,
    center: [33.2764, -111.8906] as [number, number],
    zoom: 12,
    title: "Blast Radius: Intel Chandler",
    mapStyle: "voyager" as const
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
    <main className="relative min-h-screen bg-white font-[family-name:var(--font-jetbrains-mono)] overflow-hidden">
      
      {/* BACKGROUND MAP */}
      <div className={cn(
        "absolute inset-0 z-0 transition-all duration-1000",
        view === "landing" ? "opacity-30 blur-[2px] grayscale" : "opacity-100"
      )}>
        <MapCarousel 
          data={intelMapData}
          actions={{
            onSelectLocation: (loc) => {
              if (loc.name?.includes("Intel")) setShowMetrics(true);
            }
          }}
          appearance={{
            displayMode: "fullscreen",
            mapHeight: "100%",
            hideSidebar: true
          }}
        />
        {/* Heatmap Vignette */}
        {view === "results" && (
          <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(239,68,68,0.05)_40%,_rgba(239,68,68,0.15)_100%)]" />
        )}
      </div>

      {/* LANDING UI (RETRO REVERT) */}
      <AnimatePresence>
        {view === "landing" && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="relative z-20 flex flex-col items-center justify-center min-h-screen p-6"
          >
            <div className="text-center space-y-8 max-w-4xl">
              <div className="space-y-2">
                <h1 className="text-[160px] font-black tracking-tighter text-black uppercase leading-none drop-shadow-sm">
                  Churn<span className="text-red-600">Shield</span>
                </h1>
                <p className="text-2xl font-black text-black/40 uppercase tracking-[0.3em]">
                  Predictive Economic Impact Engine
                </p>
              </div>
              
              <div className="w-full max-w-2xl mx-auto pt-4">
                <ActionSearchBar 
                  actions={SAMPLE_EVENTS} 
                  onActionSelect={(action) => { if (action.id === "intel-1") setView("results"); }} 
                />
              </div>

              <div className="flex gap-4 justify-center pt-8">
                {["Regional Risk", "Household Churn", "Municipal Delta"].map(tag => (
                  <Badge key={tag} variant="outline" className="border-2 border-black font-black uppercase italic px-4 py-1 text-sm bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RESULTS DASHBOARD (RETRO REVERT) */}
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
                onClick={() => { setView("landing"); setShowMetrics(false); }}
                className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all font-black uppercase"
              >
                ← RESTART ENGINE
              </Button>
              <div className="bg-red-600 text-white px-6 py-2 border-2 border-black font-black uppercase italic shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                ALERT: INTEL CHANDLER BLAST RADIUS
              </div>
            </div>

            {/* Analytics Sidebar */}
            <motion.div 
              initial={{ x: -400 }}
              animate={{ x: 0 }}
              className="w-[460px] bg-white border-r-4 border-black p-10 flex flex-col gap-8 overflow-y-auto pointer-events-auto shadow-[12px_0px_40px_rgba(0,0,0,0.1)]"
            >
              <div className="pt-20 space-y-1">
                <h2 className="text-4xl font-black text-black tracking-tighter uppercase">Impact Matrix</h2>
                <p className="text-xs font-black text-red-600 uppercase tracking-widest">Census & Household Data Layer v2.1</p>
              </div>

              <div className="space-y-4">
                <Card className="p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-red-50">
                  <div className="flex justify-between items-center mb-3">
                    <DollarSign className="w-6 h-6 text-red-600" />
                    <Badge className="bg-red-600 text-white border-2 border-black font-black text-[10px] uppercase shadow-none">Spend Delta</Badge>
                  </div>
                  <div className="text-5xl font-black text-red-600 tracking-tighter">-$340M</div>
                  <p className="text-xs font-black text-red-900/40 mt-1 uppercase">Predicted Annual Household Churn</p>
                </Card>

                <Card className="p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                  <div className="flex justify-between items-center mb-3">
                    <HomeIcon className="w-6 h-6 text-black" />
                    <Badge variant="outline" className="border-2 border-black text-black font-black text-[10px] uppercase shadow-none">Residency</Badge>
                  </div>
                  <div className="text-5xl font-black text-black tracking-tighter">12,840</div>
                  <p className="text-xs font-black text-black/40 mt-1 uppercase">Highly Affected Households (10mi Radius)</p>
                </Card>
              </div>

              <div className="space-y-6">
                <h4 className="text-xs font-black text-black/40 uppercase tracking-widest">Commuter Impact (Home vs Work)</h4>
                <div className="space-y-5">
                  {[
                    { label: "Direct Employee Households", val: 92, color: "bg-red-600" },
                    { label: "Secondary Commuter Churn", val: 68, color: "bg-red-400" },
                    { label: "Municipal Tax Revenue Risk", val: 45, color: "bg-black" },
                  ].map((cat, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-[11px] font-black text-black uppercase">
                        <span>{cat.label}</span>
                        <span>{cat.val}%</span>
                      </div>
                      <div className="h-4 border-2 border-black bg-white p-0.5">
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

              <div className="mt-auto p-5 border-2 border-black bg-zinc-100 flex gap-4 italic shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <Info className="w-6 h-6 text-black shrink-0" />
                <p className="text-[11px] text-black leading-tight font-black uppercase">
                  Census tract analysis reveals that 32% of affected Intel employees reside in North Chandler/Gilbert, directly impacting those specific retail corridors within 90 days.
                </p>
              </div>
            </motion.div>

            {/* Deep-Dive Modal */}
            <AnimatePresence>
              {showMetrics && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-black/10 backdrop-blur-[2px] pointer-events-auto"
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="w-full max-w-3xl bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] p-12 relative"
                  >
                    <button 
                      onClick={() => setShowMetrics(false)}
                      className="absolute top-6 right-6 p-2 hover:rotate-90 transition-transform"
                    >
                      <X className="w-8 h-8 text-black" />
                    </button>
                    
                    <h3 className="text-4xl font-black text-black mb-2 uppercase tracking-tighter">Household Churn Velocity</h3>
                    <p className="text-red-600 mb-10 font-black text-sm uppercase italic tracking-widest">Predictive Commuter Loss Graph</p>
                    
                    <div className="h-80 w-full mb-10">
                      <AreaChart 
                        data={velocityData}
                        index="month"
                        categories={["impact"]}
                        strokeColors={["#000"]}
                        fillColors={["#ef4444"]}
                        className="h-full w-full"
                        showGrid={true}
                        valueFormatter={(v) => `${v}%`}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                      <div className="p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-zinc-50">
                        <div className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-1">Retail Churn (Est)</div>
                        <div className="text-3xl font-black text-red-600">-$24,200/HH</div>
                      </div>
                      <div className="p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-zinc-50">
                        <div className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-1">Municipal Delta</div>
                        <div className="text-3xl font-black text-black">-$2.1M / ZIP</div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SYSTEM FOOTER */}
      <div className="absolute bottom-8 right-8 z-50 pointer-events-none flex items-center gap-6 text-[11px] font-black text-black uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
          Engine: ACTIVE
        </div>
        <div className="w-px h-4 bg-black" />
        <span className="bg-white px-4 py-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">AWS: PREDICTIVE INSTANCE</span>
      </div>

    </main>
  );
}
