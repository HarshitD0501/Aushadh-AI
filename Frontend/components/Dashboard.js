"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  Summary,
  Upload,
  Medicines,
  Interactions,
  Prices,
  Reports,
} from "@/components/sections";
import Pharmacies from "@/components/Pharmacies";
import Assistant from "@/components/Assistant";
import {
  Activity,
  UploadCloud,
  Pill as PillIcon,
  ShieldAlert,
  Tag,
  MapPin,
  FileText,
  LogOut,
  Compass,
  HeartPulse,
  Bot,
  Home,
  Users,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

const SECTIONS = [
  {
    key: "summary",
    label: "Overview",
    Icon: Activity,
    Comp: Summary,
    title: "Health Overview",
    sub: "Your conditions, daily dose schedule, and next doctor review at a glance.",
  },
  {
    key: "assistant",
    label: "Ask Sahayak",
    Icon: Bot,
    Comp: Assistant,
    title: "Voice Assistant",
    sub: "Talk or type to ask about your medicines, interactions, prices and next visit.",
  },
  {
    key: "upload",
    label: "Upload Script",
    Icon: UploadCloud,
    Comp: Upload,
    title: "Upload Prescription",
    sub: "Snap or pick a photo — Gemini Vision extracts meds, you confirm safety.",
  },
  {
    key: "medicines",
    label: "Active Medicines",
    Icon: PillIcon,
    Comp: Medicines,
    title: "Your Active Medicines",
    sub: "Consolidated list across all your treating physicians.",
  },
  {
    key: "interactions",
    label: "Safety Check",
    Icon: ShieldAlert,
    Comp: Interactions,
    title: "Drug Interaction Safety Check",
    sub: "Automated conflict detection to prevent dangerous drug-drug interactions.",
  },
  {
    key: "prices",
    label: "Price Comparison",
    Icon: Tag,
    Comp: Prices,
    title: "Fair Price Comparison",
    sub: "Real-time pricing across trusted Indian pharmacy partners.",
  },
  {
    key: "pharmacies",
    label: "Nearby Chemists",
    Icon: MapPin,
    Comp: Pharmacies,
    title: "Nearby Pharmacies",
    sub: "Find local stores, confirm stock, and get instant turn-by-turn directions.",
  },
  {
    key: "reports",
    label: "Records & History",
    Icon: FileText,
    Comp: Reports,
    title: "Prescription History",
    sub: "Secure archival of all uploaded prescriptions and doctor notes.",
  },
];

export default function Dashboard({ patient, onLogout, onGoHome, onSwitchPatient }) {
  const [active, setActive] = useState("summary");
  const mainRef = useRef(null);
  const current = SECTIONS.find((s) => s.key === active) || SECTIONS[0];
  const Comp = current.Comp;

  // GSAP smooth section entrance
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
      );
    }, el);
    return () => ctx.revert();
  }, [active]);

  const initials = patient?.name
    ? patient.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "PT";

  return (
    <div className="min-h-screen bg-brand-cream text-brand-navy flex flex-col md:flex-row relative">
      {/* 
        1. STATIONARY LEFT VERTICAL NAVBAR
        Docked as an individual stationary section that never moves on scrolls
      */}
      <aside className="w-full md:w-72 lg:w-80 md:h-screen md:sticky md:top-0 bg-brand-cream border-b-2 md:border-b-0 md:border-r-2 border-brand-navy flex flex-col p-4 md:p-5 z-30 overflow-y-auto shrink-0 select-none shadow-sm">
        
        {/* Brand Lockup Header */}
        <div className="flex items-center gap-3 pb-4 border-b-2 border-brand-navy/15">
          <div className="w-10 h-10 bg-brand-orange text-brand-navy border-2 border-brand-navy sketchy-box flex items-center justify-center shadow-sketch-hover">
            <Compass className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-serif font-black text-xl text-brand-navy tracking-tight truncate">
              Aushadh-AI
            </span>
            <span className="text-[10px] font-sans font-black tracking-widest text-brand-gray uppercase truncate">
              Aapki Dawai, Sahi Daam
            </span>
          </div>
        </div>

        {/* Quick Nav Switches: Presentation / PWA Tool */}
        <div className="grid grid-cols-2 gap-2 my-3">
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-brand-white hover:bg-brand-peach/30 text-brand-navy border-2 border-brand-navy font-sans font-bold text-[11px] uppercase tracking-wider sketchy-btn shadow-sketch transition-all"
              title="Return to Presentation Landing Page"
            >
              <Home className="w-3.5 h-3.5 text-brand-orange shrink-0" />
              <span className="truncate">Showcase</span>
            </button>
          )}
          <Link
            href="/app"
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-brand-orange text-brand-navy border-2 border-brand-navy font-sans font-bold text-[11px] uppercase tracking-wider sketchy-btn shadow-sketch transition-all text-center"
            title="Open PWA Medicine Price Engine"
          >
            <Tag className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">PWA App</span>
          </Link>
        </div>

        {/* Navigation Dossier File Tabs */}
        <nav className="my-2 space-y-1 flex-1 overflow-y-auto pr-1">
          {SECTIONS.map((s) => {
            const Icon = s.Icon;
            const isActive = s.key === active;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black uppercase tracking-wider transition-all text-left rounded-sm ${
                  isActive
                    ? "bg-brand-navy text-brand-cream border-2 border-brand-navy sketchy-btn shadow-sketch"
                    : "text-brand-navy/80 hover:text-brand-navy hover:bg-brand-peach/30 border-2 border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-brand-orange" : "text-brand-navy/60"}`} />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 
          2. USER INFO DOSSIER BADGE
          Guaranteed zero-overflow container with truncated identity & flex-wrapped demo chips
        */}
        <div className="mt-auto pt-3 border-t-2 border-brand-navy/20">
          <div className="bg-brand-white border-2 border-brand-navy sketchy-box shadow-sketch p-3 space-y-2.5 max-w-full overflow-hidden">
            
            {/* Identity Row */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-brand-orange text-brand-navy border-2 border-brand-navy font-serif font-black text-xs flex items-center justify-center shrink-0 shadow-sketch-hover">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-serif font-black text-sm text-brand-navy truncate leading-tight" title={patient?.name}>
                  {patient?.name}
                </div>
                <div className="font-sans text-[11px] font-medium text-brand-gray truncate" title={patient?.email || patient?.phone}>
                  {patient?.email || patient?.phone || "Verified Patient"}
                </div>
              </div>
            </div>

            {/* Plan Badge & Sign Out Button */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-brand-navy/10">
              <span className="font-sans text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-brand-peach/40 text-brand-navy border border-brand-navy rounded-sm shrink-0">
                {patient?.plan === "pro" ? "Pro Dossier" : "Free Access"}
              </span>
              <button
                onClick={onLogout}
                className="flex items-center gap-1 px-2.5 py-1 bg-brand-cream hover:bg-brand-peach/30 text-brand-navy border border-brand-navy font-sans text-xs font-bold rounded-sm transition-colors shrink-0"
                title="Sign out of Aushadh-AI"
              >
                <LogOut className="w-3 h-3 text-brand-orange" />
                <span>Sign out</span>
              </button>
            </div>

            {/* Switch Demo Patient Section (wrapped, zero-overflow) */}
            {onSwitchPatient && (
              <div className="pt-2 border-t border-dashed border-brand-navy/20">
                <div className="text-[10px] font-sans font-black uppercase tracking-wider text-brand-gray flex items-center gap-1.5 mb-1.5">
                  <Users className="w-3 h-3 text-brand-orange" />
                  <span>Switch Demo Patient:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "ramesh", label: "Ramesh" },
                    { id: "shanti", label: "Shanti" },
                    { id: "aarav", label: "Aarav" },
                  ].map((p) => {
                    const isSelected = patient?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSwitchPatient(p.id)}
                        className={`px-2 py-0.5 text-[10px] font-sans font-bold border border-brand-navy rounded-sm transition-all ${
                          isSelected
                            ? "bg-brand-orange text-brand-navy font-black shadow-sketch"
                            : "bg-brand-cream text-brand-navy hover:bg-brand-peach/30"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 
        3. MAIN WORKSPACE WITH UNIVERSAL DITTO TYPOGRAPHY
      */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen bg-brand-cream/60" ref={mainRef}>
        
        {/* Sticky Top Dossier Header */}
        <header className="sticky top-0 z-20 bg-brand-cream/95 backdrop-blur-md border-b-2 border-brand-navy px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-serif font-black text-2xl sm:text-3xl text-brand-navy tracking-tight truncate">
              {current.title}
            </h1>
            <p className="font-sans text-xs sm:text-sm text-brand-gray font-medium truncate mt-0.5">
              {current.sub}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-brand-orange/20 border-2 border-brand-navy text-brand-navy font-mono text-xs font-bold sketchy-box shadow-sketch-hover">
              <HeartPulse className="w-3.5 h-3.5 text-brand-orange animate-pulse" />
              <span>Live Sync</span>
            </span>
          </div>
        </header>

        {/* Section Dynamic View Container */}
        <div className="p-4 sm:p-8 flex-1">
          <Comp patient={patient} goto={setActive} />
        </div>
      </main>
    </div>
  );
}
