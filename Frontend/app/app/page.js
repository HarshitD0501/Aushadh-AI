"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import SearchPage from "../search/page";
import ScanPage from "../scan/page";
import StoresPage from "../stores/page";
import HistoryPage from "../history/page";
import { useLanguage } from "@/contexts/LanguageContext";
import { Search, Camera, MapPin, History, Sparkles } from "lucide-react";

export default function AppShell() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("search");

  // Read ?tab= from URL query on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam && ["search", "scan", "stores", "history"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location);
      url.searchParams.set("tab", newTab);
      window.history.replaceState({}, "", url);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream text-brand-navy flex flex-col">
      {/* Universal Notebook Navbar */}
      <Navbar onTabChange={handleTabChange} activeTab={activeTab} />

      {/* Floating Tactical Workspace Tab Switcher (Visible on both mobile & desktop) */}
      <div className="bg-brand-white border-b-2 border-brand-navy sticky top-20 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto py-2.5">
            <button
              onClick={() => handleTabChange("search")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                activeTab === "search"
                  ? "bg-brand-navy text-brand-cream border-2 border-brand-navy sketchy-btn shadow-sketch"
                  : "bg-brand-cream/80 text-brand-navy hover:bg-brand-peach/40 border border-brand-navy/30"
              }`}
            >
              <Search className="w-3.5 h-3.5 text-brand-orange" />
              <span>{t.navSearch}</span>
            </button>

            <button
              onClick={() => handleTabChange("scan")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                activeTab === "scan"
                  ? "bg-brand-navy text-brand-cream border-2 border-brand-navy sketchy-btn shadow-sketch"
                  : "bg-brand-cream/80 text-brand-navy hover:bg-brand-peach/40 border border-brand-navy/30"
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-brand-orange" />
              <span>{t.navScan}</span>
            </button>

            <button
              onClick={() => handleTabChange("stores")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                activeTab === "stores"
                  ? "bg-brand-navy text-brand-cream border-2 border-brand-navy sketchy-btn shadow-sketch"
                  : "bg-brand-cream/80 text-brand-navy hover:bg-brand-peach/40 border border-brand-navy/30"
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-brand-orange" />
              <span>{t.navStores}</span>
            </button>

            <button
              onClick={() => handleTabChange("history")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                activeTab === "history"
                  ? "bg-brand-navy text-brand-cream border-2 border-brand-navy sketchy-btn shadow-sketch"
                  : "bg-brand-cream/80 text-brand-navy hover:bg-brand-peach/40 border border-brand-navy/30"
              }`}
            >
              <History className="w-3.5 h-3.5 text-brand-orange" />
              <span>{t.navHistory}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Active Tool Content */}
      <div className="flex-1">
        {activeTab === "search" && <SearchPage />}
        {activeTab === "scan" && <ScanPage />}
        {activeTab === "stores" && <StoresPage />}
        {activeTab === "history" && <HistoryPage />}
      </div>
    </div>
  );
}
