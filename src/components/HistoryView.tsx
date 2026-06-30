import React, { useState, useMemo } from "react";
import { 
  Search, ShieldAlert, Cpu, Trash2, Calendar, FileText, ArrowUpRight, 
  ArrowUpDown, ChevronLeft, ChevronRight, RefreshCw, GitCompare, X, 
  Download, Filter, Clock, Zap
} from "lucide-react";
import { Scan } from "../types";
import { motion, AnimatePresence } from "motion/react";

type SortField = "date" | "riskScore" | "sender" | "subject";
type SortOrder = "asc" | "desc";
type DateRangeFilter = "all" | "today" | "7days" | "30days" | "custom";
type EngineFilter = "all" | "Gemini AI" | "Machine Learning" | "Hybrid";

interface HistoryViewProps {
  scans: Scan[];
  onSelectScan: (scan: Scan) => void;
  onClearHistory?: () => void;
  onDeleteScan?: (scanId: string) => void;
  onReAnalyze?: (scan: Scan, engine: "ai" | "ml" | "hybrid") => Promise<void>;
}

export default function HistoryView({ scans, onSelectScan, onClearHistory, onDeleteScan, onReAnalyze }: HistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [engineFilter, setEngineFilter] = useState<EngineFilter>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Comparison state
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Re-analysis state
  const [reAnalyzingId, setReAnalyzingId] = useState<string | null>(null);

  // Custom date range inputs
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");

  // ── Filtering ──
  const filteredScans = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return scans.filter(scan => {
      // Text search
      const searchLow = searchTerm.toLowerCase();
      const matchesSearch =
        scan.sender.toLowerCase().includes(searchLow) ||
        (scan.subject || "").toLowerCase().includes(searchLow) ||
        (scan.summary || "").toLowerCase().includes(searchLow);
      if (!matchesSearch) return false;

      // Risk level filter
      if (riskFilter !== "ALL" && scan.riskLevel !== riskFilter) return false;

      // Engine filter
      if (engineFilter !== "all" && scan.engine !== engineFilter) return false;

      // Date range filter
      const scanDate = new Date(scan.createdAt);
      if (dateRange === "today" && scanDate < startOfToday) return false;
      if (dateRange === "7days" && scanDate < oneWeekAgo) return false;
      if (dateRange === "30days" && scanDate < oneMonthAgo) return false;
      if (dateRange === "custom") {
        if (customDateFrom && scanDate < new Date(customDateFrom)) return false;
        if (customDateTo) {
          const endDate = new Date(customDateTo);
          endDate.setHours(23, 59, 59, 999);
          if (scanDate > endDate) return false;
        }
      }

      return true;
    });
  }, [scans, searchTerm, riskFilter, engineFilter, dateRange, customDateFrom, customDateTo]);

  // ── Sorting ──
  const sortedScans = useMemo(() => {
    const sorted = [...filteredScans].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "riskScore":
          cmp = a.riskScore - b.riskScore;
          break;
        case "sender":
          cmp = a.sender.localeCompare(b.sender);
          break;
        case "subject":
          cmp = (a.subject || "").localeCompare(b.subject || "");
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredScans, sortField, sortOrder]);

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(sortedScans.length / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const paginatedScans = sortedScans.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  // ── Handlers ──
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleDeleteScan = (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation();
    if (onDeleteScan) {
      onDeleteScan(scanId);
    }
  };

  const handleReAnalyze = async (e: React.MouseEvent, scan: Scan, engine: "ai" | "ml" | "hybrid") => {
    e.stopPropagation();
    if (!onReAnalyze || reAnalyzingId) return;
    setReAnalyzingId(scan.id);
    try {
      await onReAnalyze(scan, engine);
    } catch (err) {
      console.error("[HistoryView] Re-analysis failed:", err);
    } finally {
      setReAnalyzingId(null);
    }
  };

  const toggleCompareSelect = (scanId: string) => {
    setCompareSelection(prev => {
      if (prev.includes(scanId)) return prev.filter(id => id !== scanId);
      if (prev.length >= 2) return [prev[1], scanId]; // Replace oldest selection
      return [...prev, scanId];
    });
  };

  const exportScanJSON = (e: React.MouseEvent, scan: Scan) => {
    e.stopPropagation();
    const blob = new Blob([JSON.stringify(scan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `karnakavach_scan_${scan.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    if (sortedScans.length === 0) return;
    const headers = ["ID", "Alert Date", "Sender", "Subject", "Risk Level", "Risk Score", "Confidence (%)", "Engine", "Summary"];
    const escapeCSV = (str: string) => {
      const cleanStr = (str || "").toString();
      return `"${cleanStr.replace(/"/g, '""')}"`;
    };
    const csvRows = sortedScans.map(log => [
      log.id,
      new Date(log.createdAt).toISOString(),
      escapeCSV(log.sender),
      escapeCSV(log.subject),
      log.riskLevel,
      log.riskScore,
      log.confidence,
      log.engine || "N/A",
      escapeCSV(log.summary)
    ].join(","));
    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `karnakavach_cognitive_logs_${new Date().getTime()}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const compareScanA = scans.find(s => s.id === compareSelection[0]);
  const compareScanB = scans.find(s => s.id === compareSelection[1]);

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="font-display font-black text-xs uppercase tracking-widest text-primary-fixed-dim">
            Cognitive Diagnostics Logs
          </h2>
          <p className="font-sans text-xs text-on-surface-variant mt-1">
            Browse, filter, and audit historic deep packet scans &amp; threat metadata.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {onClearHistory && scans.length > 0 && (
            <button 
              onClick={onClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-error-container/10 border border-error/20 hover:bg-error-container/20 text-error rounded-md text-xs font-mono font-bold uppercase transition-colors tracking-wider select-none cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              CLEAR ALL
            </button>
          )}
          <button
            onClick={() => { setCompareMode(!compareMode); setCompareSelection([]); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-mono font-bold uppercase transition-colors tracking-wider cursor-pointer ${
              compareMode ? "bg-primary-fixed-dim/10 border-primary-fixed-dim/30 text-primary-fixed-dim" : "bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            {compareMode ? "EXIT COMPARE" : "COMPARE"}
          </button>
        </div>
      </div>

      {/* Filter and search action bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col gap-4 border border-neutral-800">
        
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative w-full md:max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search email domains, sender addresses, or subject keywords..."
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg py-2.5 pl-10 pr-4 text-xs font-mono text-on-surface placeholder:text-outline-variant/40 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim/30 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex bg-surface-container-low border border-outline-variant/20 p-1 rounded-lg gap-1 select-none font-sans font-bold text-[10px] tracking-widest uppercase shrink-0 w-full sm:w-auto overflow-x-auto justify-between">
              {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => { setRiskFilter(r); setCurrentPage(1); }}
                  className={`p-2 px-3 rounded-md transition-colors cursor-pointer text-center flex-1 sm:flex-initial ${
                    riskFilter === r 
                      ? "bg-primary-container/10 text-primary-fixed-dim font-black shadow-[0_0_8px_rgba(0,219,233,0.1)]" 
                      : "text-outline hover:text-on-surface"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-3 py-2 border rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${
                showFilters ? "bg-primary-fixed-dim/10 border-primary-fixed-dim/30 text-primary-fixed-dim" : "bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              FILTERS
            </button>

            <button 
              onClick={exportToCSV}
              disabled={sortedScans.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-fixed-dim hover:bg-primary text-background rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              EXPORT CSV
            </button>
          </div>
        </div>

        {/* Extended filter controls */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col md:flex-row gap-4 pt-3 border-t border-outline-variant/15">
                {/* Date Range */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] uppercase tracking-widest text-outline font-mono font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Date Range
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {([
                      { value: "all", label: "All Time" },
                      { value: "today", label: "Today" },
                      { value: "7days", label: "7 Days" },
                      { value: "30days", label: "30 Days" },
                      { value: "custom", label: "Custom" },
                    ] as { value: DateRangeFilter; label: string }[]).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => { setDateRange(value); setCurrentPage(1); }}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                          dateRange === value
                            ? "bg-primary-fixed-dim/15 text-primary-fixed-dim border border-primary-fixed-dim/30"
                            : "bg-surface-container-lowest border border-outline-variant/15 text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {dateRange === "custom" && (
                    <div className="flex gap-2 mt-1">
                      <input type="date" value={customDateFrom} onChange={e => { setCustomDateFrom(e.target.value); setCurrentPage(1); }}
                        className="bg-surface-container-lowest border border-outline-variant/20 rounded px-2 py-1 text-[10px] text-on-surface font-mono focus:outline-none focus:border-primary-fixed-dim" />
                      <span className="text-outline text-[10px] self-center">→</span>
                      <input type="date" value={customDateTo} onChange={e => { setCustomDateTo(e.target.value); setCurrentPage(1); }}
                        className="bg-surface-container-lowest border border-outline-variant/20 rounded px-2 py-1 text-[10px] text-on-surface font-mono focus:outline-none focus:border-primary-fixed-dim" />
                    </div>
                  )}
                </div>

                {/* Engine Filter */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] uppercase tracking-widest text-outline font-mono font-bold flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> Analysis Engine
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {([
                      { value: "all", label: "All Engines" },
                      { value: "Gemini AI", label: "Gemini AI" },
                      { value: "Machine Learning", label: "ML" },
                      { value: "Hybrid", label: "Hybrid" },
                    ] as { value: EngineFilter; label: string }[]).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => { setEngineFilter(value); setCurrentPage(1); }}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                          engineFilter === value
                            ? "bg-primary-fixed-dim/15 text-primary-fixed-dim border border-primary-fixed-dim/30"
                            : "bg-surface-container-lowest border border-outline-variant/15 text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort Controls */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] uppercase tracking-widest text-outline font-mono font-bold flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3" /> Sort By
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {([
                      { value: "date", label: "Date" },
                      { value: "riskScore", label: "Risk Score" },
                      { value: "sender", label: "Sender" },
                      { value: "subject", label: "Subject" },
                    ] as { value: SortField; label: string }[]).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => toggleSort(value)}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                          sortField === value
                            ? "bg-primary-fixed-dim/15 text-primary-fixed-dim border border-primary-fixed-dim/30"
                            : "bg-surface-container-lowest border border-outline-variant/15 text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        {label}
                        {sortField === value && (
                          <span className="text-[8px]">{sortOrder === "asc" ? "↑" : "↓"}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Compare mode instruction banner */}
      {compareMode && (
        <div className="glass-panel p-3 rounded-xl border border-primary-fixed-dim/20 bg-primary-fixed-dim/5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-primary-fixed-dim font-mono">
            <GitCompare className="w-4 h-4" />
            <span>Select 2 scans to compare. <strong>{compareSelection.length}/2</strong> selected.</span>
          </div>
          {compareSelection.length === 2 && (
            <button
              onClick={() => setShowCompareModal(true)}
              className="px-4 py-1.5 bg-primary-fixed-dim text-background rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-primary transition-colors cursor-pointer"
            >
              COMPARE NOW
            </button>
          )}
        </div>
      )}

      {/* Stats summary */}
      <div className="flex gap-3 flex-wrap">
        <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container-low/50 border border-outline-variant/15 px-3 py-1 rounded-lg">
          <strong className="text-on-surface">{sortedScans.length}</strong> results
        </span>
        <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container-low/50 border border-outline-variant/15 px-3 py-1 rounded-lg">
          Page <strong className="text-on-surface">{clampedPage}</strong> of <strong className="text-on-surface">{totalPages}</strong>
        </span>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
          className="text-[10px] font-mono text-on-surface bg-surface-container-lowest border border-outline-variant/20 px-2 py-1 rounded-lg focus:outline-none focus:border-primary-fixed-dim cursor-pointer"
        >
          <option value={5}>5 per page</option>
          <option value={10}>10 per page</option>
          <option value={20}>20 per page</option>
        </select>
      </div>

      {/* Main logs display list */}
      <div className="flex flex-col gap-4">
        {paginatedScans.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center text-neutral-500 font-mono text-xs border border-neutral-800 flex flex-col items-center gap-3">
            <Calendar className="w-8 h-8 text-outline-variant animate-pulse" />
            No cyber diagnostics match the given configuration. Try launching a raw scan first.
          </div>
        ) : (
          paginatedScans.map((log) => {
            const riskBg = 
              log.riskLevel === "HIGH" 
                ? "border border-error/25 bg-error-container/5"
                : log.riskLevel === "MEDIUM"
                ? "border border-secondary-container/20 bg-secondary-container/5"
                : "border border-primary-fixed-dim/10 bg-primary-container/2";

            const scoreBadge = 
              log.riskLevel === "HIGH" 
                ? "text-error border-error/30" 
                : log.riskLevel === "MEDIUM"
                ? "text-secondary border-secondary/35"
                : "text-primary-fixed-dim border-primary-fixed-dim/30";

            const isSelected = compareSelection.includes(log.id);
            const isReAnalyzing = reAnalyzingId === log.id;

            return (
              <motion.div
                key={log.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`glass-panel p-5 rounded-3xl cursor-pointer hover:scale-[1.002] active:scale-[0.998] transition-all ${riskBg} ${
                  isSelected ? "ring-2 ring-primary-fixed-dim/40 shadow-[0_0_12px_rgba(0,219,233,0.1)]" : ""
                }`}
                onClick={() => compareMode ? toggleCompareSelect(log.id) : onSelectScan(log)}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex gap-4 items-start min-w-0">
                    {compareMode && (
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
                        isSelected ? "bg-primary-fixed-dim border-primary-fixed-dim" : "border-outline-variant/40"
                      }`}>
                        {isSelected && <span className="text-background text-xs font-bold">✓</span>}
                      </div>
                    )}

                    <div className={`w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 ${scoreBadge}`}>
                      <span className="font-display font-bold text-base leading-none">{log.riskScore}</span>
                    </div>
                    
                    <div className="space-y-1 min-w-0">
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className="font-sans font-bold text-xs truncate max-w-[220px] text-on-surface">
                          {log.sender}
                        </span>
                        <span className="font-mono text-[9px] text-outline">•</span>
                        <span className="font-mono text-[9px] text-outline">
                          {new Date(log.createdAt).toLocaleDateString()} at {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {log.engine && (
                          <>
                            <span className="font-mono text-[9px] text-outline">•</span>
                            <span className="font-mono text-[9px] text-primary-fixed-dim/70 bg-primary-fixed-dim/5 px-1.5 py-0.5 rounded border border-primary-fixed-dim/15">
                              {log.engine}
                            </span>
                          </>
                        )}
                      </div>

                      <h4 className="font-sans font-medium text-xs text-on-surface-variant truncate max-w-sm md:max-w-md lg:max-w-xl">
                        {log.subject}
                      </h4>

                      <p className="font-mono text-[10px] text-outline line-clamp-1">
                        {log.summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center self-end md:self-center shrink-0 flex-wrap">
                    <span className={`px-2 py-0.5 rounded font-display font-extrabold text-[9px] tracking-widest uppercase border ${scoreBadge}`}>
                      {log.riskLevel} Risk
                    </span>
                    
                    {!compareMode && (
                      <div className="flex gap-1">
                        {/* Re-analysis dropdown */}
                        {onReAnalyze && (
                          <div className="relative group">
                            <button 
                              disabled={isReAnalyzing}
                              className="p-1.5 bg-surface-container-high/40 hover:bg-surface-bright/40 text-primary-fixed-dim rounded border border-outline-variant/20 transition-colors cursor-pointer disabled:opacity-50"
                              title="Re-analyze"
                            >
                              {isReAnalyzing ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Zap className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <div className="absolute right-0 top-full mt-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg shadow-xl z-20 hidden group-hover:block min-w-[120px]">
                              {(["ai", "ml", "hybrid"] as const).map(eng => (
                                <button
                                  key={eng}
                                  onClick={(e) => handleReAnalyze(e, log, eng)}
                                  className="block w-full text-left px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-dim hover:text-on-surface transition-colors cursor-pointer first:rounded-t-lg last:rounded-b-lg"
                                >
                                  {eng === "ai" ? "🧠 Gemini AI" : eng === "ml" ? "📊 ML" : "⚡ Hybrid"}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Export JSON */}
                        <button
                          onClick={(e) => exportScanJSON(e, log)}
                          className="p-1.5 bg-surface-container-high/40 hover:bg-surface-bright/40 text-on-surface-variant rounded border border-outline-variant/20 transition-colors cursor-pointer"
                          title="Export JSON"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        {onDeleteScan && (
                          <button
                            onClick={(e) => handleDeleteScan(e, log.id)}
                            className="p-1.5 bg-error-container/10 hover:bg-error-container/20 text-error rounded border border-error/20 transition-colors cursor-pointer"
                            title="Delete scan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* View detail */}
                        <button 
                          onClick={() => onSelectScan(log)}
                          className="p-1 px-3 bg-surface-container-high/40 hover:bg-surface-bright/40 text-xs text-primary-fixed-dim rounded font-mono text-[10px] uppercase font-bold border border-outline-variant/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          Assess
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination controls */}
      {sortedScans.length > pageSize && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={clampedPage <= 1}
            className="p-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (clampedPage <= 4) {
                pageNum = i + 1;
              } else if (clampedPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = clampedPage - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg font-mono text-[10px] font-bold transition-colors cursor-pointer ${
                    clampedPage === pageNum
                      ? "bg-primary-fixed-dim text-background"
                      : "bg-surface-container-lowest border border-outline-variant/15 text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={clampedPage >= totalPages}
            className="p-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Side-by-side Comparison Modal ── */}
      <AnimatePresence>
        {showCompareModal && compareScanA && compareScanB && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCompareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass-panel w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl border border-outline-variant/30 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between sticky top-0 bg-surface-container-lowest/90 backdrop-blur-xl z-10 rounded-t-3xl">
                <h3 className="font-display font-black text-sm uppercase tracking-widest text-primary-fixed-dim flex items-center gap-2">
                  <GitCompare className="w-5 h-5" />
                  Scan Comparison Matrix
                </h3>
                <button 
                  onClick={() => setShowCompareModal(false)}
                  className="p-1 rounded-full hover:bg-surface-dim/40 text-on-surface-variant transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Comparison rows */}
                {[
                  { label: "Sender", a: compareScanA.sender, b: compareScanB.sender },
                  { label: "Subject", a: compareScanA.subject, b: compareScanB.subject },
                  { label: "Date", a: new Date(compareScanA.createdAt).toLocaleString(), b: new Date(compareScanB.createdAt).toLocaleString() },
                  { label: "Risk Score", a: `${compareScanA.riskScore}/100`, b: `${compareScanB.riskScore}/100` },
                  { label: "Risk Level", a: compareScanA.riskLevel, b: compareScanB.riskLevel },
                  { label: "Confidence", a: `${compareScanA.confidence}%`, b: `${compareScanB.confidence}%` },
                  { label: "Engine", a: compareScanA.engine || "N/A", b: compareScanB.engine || "N/A" },
                  { label: "Category", a: compareScanA.threatCategory || "N/A", b: compareScanB.threatCategory || "N/A" },
                  { label: "Threat Vectors", a: `${(compareScanA.threatVectors || []).length} identified`, b: `${(compareScanB.threatVectors || []).length} identified` },
                  { label: "URLs Analyzed", a: `${(compareScanA.urlAnalysis || []).length} URLs`, b: `${(compareScanB.urlAnalysis || []).length} URLs` },
                ].map(({ label, a, b }) => (
                  <div key={label} className="grid grid-cols-5 gap-4 items-center py-2.5 border-b border-outline-variant/10 last:border-0">
                    <div className="col-span-1 text-right">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-outline font-bold">{label}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="font-sans text-xs font-semibold text-on-surface bg-surface-container-lowest/60 border border-outline-variant/15 px-3 py-1.5 rounded-lg inline-block max-w-full truncate">
                        {a}
                      </span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="font-sans text-xs font-semibold text-on-surface bg-surface-container-lowest/60 border border-outline-variant/15 px-3 py-1.5 rounded-lg inline-block max-w-full truncate">
                        {b}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Summary comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-outline-variant/15">
                  <div className="p-4 bg-surface-container-lowest/50 rounded-xl border border-outline-variant/15">
                    <h4 className="font-mono text-[9px] uppercase tracking-widest text-outline mb-2">Scan A Summary</h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{compareScanA.summary}</p>
                  </div>
                  <div className="p-4 bg-surface-container-lowest/50 rounded-xl border border-outline-variant/15">
                    <h4 className="font-mono text-[9px] uppercase tracking-widest text-outline mb-2">Scan B Summary</h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{compareScanB.summary}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
