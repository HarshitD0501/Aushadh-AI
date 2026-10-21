"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import SearchPage from "../search/page";
import ScanPage from "../scan/page";
import StoresPage from "../stores/page";
import HistoryPage from "../history/page";

export default function AppShell() {
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
      {/* Exactly ONE Unified Navbar */}
      <Navbar onTabChange={handleTabChange} activeTab={activeTab} inAppShell={true} />

      {/* Embedded Active Tool Content */}
      <div className="flex-1">
        {activeTab === "search" && <SearchPage hideNavbar={true} onNavigateTab={handleTabChange} />}
        {activeTab === "scan" && <ScanPage hideNavbar={true} onNavigateTab={handleTabChange} />}
        {activeTab === "stores" && <StoresPage hideNavbar={true} onNavigateTab={handleTabChange} />}
        {activeTab === "history" && <HistoryPage hideNavbar={true} onNavigateTab={handleTabChange} />}
      </div>
    </div>
  );
}
