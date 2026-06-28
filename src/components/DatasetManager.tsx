import React, { useState, useEffect, useMemo } from "react";
import {
  Database,
  CheckCircle,
  XCircle,
  Copy,
  Mail,
  Calendar,
  ArrowUpDown,
  Search,
  Download,
  AlertTriangle,
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Cpu,
  Sparkles,
  Inbox
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { FeedbackRecord } from "../types";
import {
  getDataset,
  validateDataset,
  removeDuplicates,
  calculateDatasetStatistics,
  exportDatasetCSV,
  type DatasetStatistics
} from "../services/datasetService";

export default function DatasetManager() {
  const [allRecords, setAllRecords] = useState<FeedbackRecord[]>([]);
  const [validRecords, setValidRecords] = useState<FeedbackRecord[]>([]);
  const [invalidRecords, setInvalidRecords] = useState<FeedbackRecord[]>([]);
  const [cleanRecords, setCleanRecords] = useState<FeedbackRecord[]>([]);
  
  const [duplicatesRemovedCount, setDuplicatesRemovedCount] = useState(0);
  const [stats, setStats] = useState<DatasetStatistics | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Table Controls State
  const [searchTerm, setSearchTerm] = useState("");
  const [engineFilter, setEngineFilter] = useState("All");
  const [predictedFilter, setPredictedFilter] = useState("All");
  const [correctFilter, setCorrectFilter] = useState("All");
  
  const [sortField, setSortField] = useState<keyof FeedbackRecord>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const records = await getDataset();
      setAllRecords(records);
      
      const { valid, invalid } = validateDataset(records);
      setValidRecords(valid);
      setInvalidRecords(invalid);
      
      const { cleanRecords: clean, duplicatesRemoved } = removeDuplicates(valid);
      setCleanRecords(clean);
      setDuplicatesRemovedCount(duplicatesRemoved);
      
      const statistics = calculateDatasetStatistics(records, clean, invalid, duplicatesRemoved);
      setStats(statistics);
      
      // Reset page
      setCurrentPage(1);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load database. Check Firestore connectivity.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExport = () => {
    if (cleanRecords.length === 0) return;
    exportDatasetCSV(cleanRecords);
  };

  // Sort helper
  const handleSort = (field: keyof FeedbackRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setCurrentPage(1);
  };

  // Filter and Sort dataset
  const filteredAndSortedRecords = useMemo(() => {
    let result = [...cleanRecords];

    // 1. Apply Search
    if (searchTerm.trim() !== "") {
      const query = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.sender.toLowerCase().includes(query) ||
          r.subject.toLowerCase().includes(query) ||
          r.body.toLowerCase().includes(query)
      );
    }

    // 2. Apply Engine Filter
    if (engineFilter !== "All") {
      result = result.filter((r) => r.engine === engineFilter);
    }

    // 3. Apply Predicted Label Filter
    if (predictedFilter !== "All") {
      result = result.filter((r) => r.predictedLabel === predictedFilter);
    }

    // 4. Apply Correct Label Filter
    if (correctFilter !== "All") {
      result = result.filter((r) => r.correctLabel === correctFilter);
    }

    // 5. Apply Sorting
    result.sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null/undefined or numeric vs string sorting
      if (aVal === undefined || aVal === null) aVal = "";
      if (bVal === undefined || bVal === null) bVal = "";

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [cleanRecords, searchTerm, engineFilter, predictedFilter, correctFilter, sortField, sortAsc]);

  // Paginated Records
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedRecords.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedRecords, currentPage, pageSize]);

  // Total pages
  const totalPages = Math.ceil(filteredAndSortedRecords.length / pageSize) || 1;

  // Imbalance Warnings calculations
  const classDistribution = useMemo(() => {
    if (cleanRecords.length === 0) return { legPct: 0, phishPct: 0, suspPct: 0, highest: null };
    
    let legCount = 0;
    let phishCount = 0;
    let suspCount = 0;

    cleanRecords.forEach((r) => {
      if (r.correctLabel === "Legitimate") legCount++;
      else if (r.correctLabel === "Phishing") phishCount++;
      else if (r.correctLabel === "Suspicious") suspCount++;
    });

    const total = cleanRecords.length;
    const legPct = Math.round((legCount / total) * 100);
    const phishPct = Math.round((phishCount / total) * 100);
    const suspPct = Math.round((suspCount / total) * 100);

    let highest: { label: string; pct: number } | null = null;
    if (legPct > phishPct && legPct > suspPct) highest = { label: "Legitimate", pct: legPct };
    else if (phishPct > legPct && phishPct > suspPct) highest = { label: "Phishing", pct: phishPct };
    else if (suspPct > legPct && suspPct > phishPct) highest = { label: "Suspicious", pct: suspPct };
    else {
      // Tie breaker, pick the one above 80 if exists
      if (legPct >= 80) highest = { label: "Legitimate", pct: legPct };
      else if (phishPct >= 80) highest = { label: "Phishing", pct: phishPct };
      else if (suspPct >= 80) highest = { label: "Suspicious", pct: suspPct };
    }

    return { legPct, phishPct, suspPct, highest };
  }, [cleanRecords]);

  const latestDateFormatted = useMemo(() => {
    if (!stats?.latestFeedbackDate) return "N/A";
    return new Date(stats.latestFeedbackDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [stats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#00dbe9]" />
        <span className="text-sm font-mono tracking-widest text-[#7df4ff] uppercase">Initializing Dataset Compiler...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="glass-panel p-8 rounded-3xl border border-error/30 bg-error/5 flex flex-col items-center gap-4 text-center max-w-xl mx-auto">
        <XCircle className="w-12 h-12 text-error animate-pulse" />
        <h3 className="font-display font-black text-xs uppercase tracking-widest text-error">Database Operations Failure</h3>
        <p className="text-xs text-on-surface-variant font-mono bg-black/45 p-3 rounded-lg w-full text-left break-all leading-normal">
          {errorMsg}
        </p>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-5 py-2.5 text-[10px] uppercase font-bold tracking-wider text-background rounded-lg bg-error hover:bg-error/85 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reconnect Uplink
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* ── Top Header Controls ── */}
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-outline-variant/10 pb-4">
        <div>
          <h2 className="font-display font-black text-xs uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
            <Database className="w-4 h-4 text-[#00dbe9]" /> ML Dataset Compiler & Sanitizer
          </h2>
          <p className="text-on-surface-variant text-[11px] mt-0.5">
            Compile raw user feedback logs. Run verification protocols, discard duplicates, and structure ready-to-train datasets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 border border-outline-variant/20 hover:border-[#00dbe9]/40 rounded-xl bg-surface-container-low hover:text-[#00dbe9] text-on-surface-variant transition-all"
            title="Refresh database records"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            disabled={cleanRecords.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 text-[10px] uppercase font-bold tracking-wider text-background rounded-lg bg-[#00dbe9] hover:bg-[#00c5d2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-display"
          >
            <Download className="w-4 h-4" /> Export Dataset (CSV)
          </button>
        </div>
      </div>

      {/* ── Statistics Grid Dashboard ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {[
            { label: "Total Records", value: stats.totalRecords, color: "text-on-surface", icon: Database },
            { label: "Valid Records", value: stats.validRecords, color: "text-emerald-400", icon: CheckCircle },
            { label: "Invalid Records", value: stats.invalidRecords, color: stats.invalidRecords > 0 ? "text-rose-400" : "text-outline-variant", icon: XCircle },
            { label: "Duplicates Removed", value: stats.duplicatesRemoved, color: stats.duplicatesRemoved > 0 ? "text-amber-400" : "text-outline-variant", icon: Copy },
            { label: "Unique Senders", value: stats.uniqueEmails, color: "text-sky-400", icon: Mail },
            { label: "Latest Record", value: latestDateFormatted, color: "text-indigo-400", icon: Calendar, fullWidth: true },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className={`bg-surface-container-low border border-outline-variant/15 rounded-2xl p-4 flex flex-col justify-between min-h-[96px] ${
                  item.fullWidth ? "col-span-2" : ""
                }`}
              >
                <div className="flex justify-between items-start text-outline-variant">
                  <span className="text-[9px] uppercase tracking-widest font-bold leading-normal">{item.label}</span>
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                </div>
                <div className={`font-mono text-base font-extrabold ${item.color} mt-2 truncate`}>
                  {item.value}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Sub statistics detailed cards ── */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Class Distribution & Dataset Balance warning */}
          <div className="glass-panel p-6 rounded-3xl border border-outline-variant/15 flex flex-col gap-4">
            <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#00dbe9]" /> Dataset Quality & Balance
            </h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] font-mono text-outline-variant mb-2">
                  <span>Class Distribution (Correct Label)</span>
                  <span>{cleanRecords.length} Sanitized Samples</span>
                </div>
                {/* Visual horizontal stack bar */}
                <div className="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden flex">
                  {classDistribution.legPct > 0 && (
                    <div
                      style={{ width: `${classDistribution.legPct}%` }}
                      className="bg-emerald-500/80 hover:bg-emerald-400 transition-colors"
                      title={`Legitimate: ${classDistribution.legPct}%`}
                    />
                  )}
                  {classDistribution.phishPct > 0 && (
                    <div
                      style={{ width: `${classDistribution.phishPct}%` }}
                      className="bg-rose-500/80 hover:bg-rose-400 transition-colors"
                      title={`Phishing: ${classDistribution.phishPct}%`}
                    />
                  )}
                  {classDistribution.suspPct > 0 && (
                    <div
                      style={{ width: `${classDistribution.suspPct}%` }}
                      className="bg-amber-500/80 hover:bg-amber-400 transition-colors"
                      title={`Suspicious: ${classDistribution.suspPct}%`}
                    />
                  )}
                </div>
              </div>

              {/* Labels and legends */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-2 font-mono">
                  <div className="font-bold">{classDistribution.legPct}%</div>
                  <div className="text-[8px] uppercase tracking-wider opacity-75">Legitimate ({stats.legitimateSamples})</div>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg p-2 font-mono">
                  <div className="font-bold">{classDistribution.phishPct}%</div>
                  <div className="text-[8px] uppercase tracking-wider opacity-75">Phishing ({stats.phishingSamples})</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg p-2 font-mono">
                  <div className="font-bold">{classDistribution.suspPct}%</div>
                  <div className="text-[8px] uppercase tracking-wider opacity-75">Suspicious ({stats.suspiciousSamples})</div>
                </div>
              </div>

              {/* Highly Imbalanced Warning banner */}
              {classDistribution.highest && classDistribution.highest.pct >= 80 && (
                <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 leading-normal">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
                  <div className="space-y-1">
                    <strong className="font-display uppercase tracking-wider text-[10px] block">Highly Imbalanced Dataset Warning</strong>
                    Class "{classDistribution.highest.label}" represents {classDistribution.highest.pct}% of the dataset. One class exceeds 80%. A highly skewed class distribution can compromise machine learning model calibration. Consider injecting more counter-samples before trigger retraining.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Engine Feedbacks */}
          <div className="glass-panel p-6 rounded-3xl border border-outline-variant/15 flex flex-col justify-between">
            <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <Cpu className="w-4 h-4 text-outline" /> Intelligence Engine breakdown
            </h3>

            <div className="space-y-4 my-auto py-2">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#00dbe9]" /> Gemini AI</span>
                  <span className="font-bold">{stats.aiFeedbackCount} samples</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#00dbe9]"
                    style={{
                      width: `${
                        cleanRecords.length > 0 ? (stats.aiFeedbackCount / cleanRecords.length) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-indigo-400" /> Machine Learning</span>
                  <span className="font-bold">{stats.mlFeedbackCount} samples</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{
                      width: `${
                        cleanRecords.length > 0 ? (stats.mlFeedbackCount / cleanRecords.length) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="text-[10px] text-outline-variant font-mono flex items-center justify-between border-t border-outline-variant/10 pt-3">
              <span>Validation status:</span>
              <span className="text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> {Math.round((stats.validRecords / (stats.totalRecords || 1)) * 100)}% Pass Rate
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Dataset Preview Table Section ── */}
      <div className="glass-panel rounded-3xl border border-outline-variant/15 overflow-hidden">
        {/* Table Title and Actions */}
        <div className="p-6 border-b border-outline-variant/10 bg-surface-container-low/40 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-black text-[10px] uppercase tracking-widest text-[#7df4ff] flex items-center gap-2">
              <Inbox className="w-4 h-4 text-[#00dbe9]" /> Sanitized Dataset Preview ({filteredAndSortedRecords.length} records matching)
            </h3>
            <span className="text-[10px] font-mono text-outline-variant">
              Page {currentPage} of {totalPages}
            </span>
          </div>

          {/* Search, filters, page controls row */}
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-outline absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search sender, subject, or message body..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-surface-container-lowest border border-outline-variant/20 focus:border-[#00dbe9]/50 focus:outline-none rounded-xl pl-10 pr-4 py-2 text-xs font-mono text-on-surface"
              />
            </div>

            {/* Filter by Engine */}
            <div className="flex items-center gap-1.5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 py-1">
              <Filter className="w-3.5 h-3.5 text-outline" />
              <select
                value={engineFilter}
                onChange={(e) => {
                  setEngineFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent border-0 text-xs text-on-surface font-sans focus:outline-none focus:ring-0 pr-1.5"
              >
                <option value="All">All Engines</option>
                <option value="Gemini AI">Gemini AI</option>
                <option value="Machine Learning">Machine Learning</option>
              </select>
            </div>

            {/* Filter by Predicted */}
            <div className="flex items-center gap-1.5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 py-1">
              <select
                value={predictedFilter}
                onChange={(e) => {
                  setPredictedFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent border-0 text-xs text-on-surface font-sans focus:outline-none focus:ring-0 pr-1.5"
              >
                <option value="All">Predicted: All</option>
                <option value="Phishing">Predicted: Phishing</option>
                <option value="Legitimate">Predicted: Legitimate</option>
                <option value="Suspicious">Predicted: Suspicious</option>
              </select>
            </div>

            {/* Filter by Correct */}
            <div className="flex items-center gap-1.5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 py-1">
              <select
                value={correctFilter}
                onChange={(e) => {
                  setCorrectFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent border-0 text-xs text-on-surface font-sans focus:outline-none focus:ring-0 pr-1.5"
              >
                <option value="All">Correct: All</option>
                <option value="Phishing">Correct: Phishing</option>
                <option value="Legitimate">Correct: Legitimate</option>
                <option value="Suspicious">Correct: Suspicious</option>
              </select>
            </div>
          </div>
        </div>

        {/* The Grid Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse font-sans text-left text-xs">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container-low/20 font-display text-[9px] uppercase tracking-widest text-outline-variant select-none">
                <th
                  onClick={() => handleSort("sender")}
                  className="p-4 font-black cursor-pointer hover:text-primary-fixed-dim hover:bg-surface-container-low/10 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Sender <ArrowUpDown className="w-3 h-3 shrink-0" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("subject")}
                  className="p-4 font-black cursor-pointer hover:text-primary-fixed-dim hover:bg-surface-container-low/10 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Subject <ArrowUpDown className="w-3 h-3 shrink-0" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("engine")}
                  className="p-4 font-black cursor-pointer hover:text-primary-fixed-dim hover:bg-surface-container-low/10 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Engine <ArrowUpDown className="w-3 h-3 shrink-0" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("predictedLabel")}
                  className="p-4 font-black cursor-pointer hover:text-primary-fixed-dim hover:bg-surface-container-low/10 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Pred. Label <ArrowUpDown className="w-3 h-3 shrink-0" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("correctLabel")}
                  className="p-4 font-black cursor-pointer hover:text-primary-fixed-dim hover:bg-surface-container-low/10 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Correct Label <ArrowUpDown className="w-3 h-3 shrink-0" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("confidence")}
                  className="p-4 font-black cursor-pointer hover:text-primary-fixed-dim hover:bg-surface-container-low/10 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Confidence <ArrowUpDown className="w-3 h-3 shrink-0" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("createdAt")}
                  className="p-4 font-black cursor-pointer hover:text-primary-fixed-dim hover:bg-surface-container-low/10 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Date <ArrowUpDown className="w-3 h-3 shrink-0" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 font-mono">
              <AnimatePresence mode="popLayout">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-outline-variant">
                      <div className="flex flex-col items-center gap-2">
                        <Inbox className="w-8 h-8 opacity-40 text-outline-variant" />
                        <span className="text-xs font-sans">No matching records found in this dataset.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r) => {
                    const isCorrect = r.predictedLabel === r.correctLabel;
                    return (
                      <motion.tr
                        key={r.feedbackId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-surface-container-low/10 transition-colors"
                      >
                        <td className="p-4 truncate max-w-[160px] text-on-surface font-sans text-xs" title={r.sender}>
                          {r.sender}
                        </td>
                        <td className="p-4 truncate max-w-[200px]" title={r.subject}>
                          {r.subject}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${
                              r.engine === "Gemini AI"
                                ? "bg-[#00dbe9]/5 border-[#00dbe9]/20 text-[#00dbe9]"
                                : "bg-indigo-500/5 border-indigo-500/20 text-indigo-400"
                            }`}
                          >
                            {r.engine}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${
                              r.predictedLabel === "Phishing"
                                ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                : r.predictedLabel === "Suspicious"
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            {r.predictedLabel}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${
                              r.correctLabel === "Phishing"
                                ? "bg-rose-500/15 border-rose-500/35 text-rose-400"
                                : r.correctLabel === "Suspicious"
                                ? "bg-amber-500/15 border-amber-500/35 text-amber-400"
                                : "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                            }`}
                          >
                            {r.correctLabel}
                          </span>
                        </td>
                        <td className="p-4 font-bold">
                          <span className={isCorrect ? "text-emerald-400" : "text-amber-400"}>
                            {Number(r.confidence).toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-4 text-[11px] text-outline-variant font-sans" title={r.createdAt}>
                          {new Date(r.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination Footer Controls */}
        <div className="p-4 bg-surface-container-low/20 border-t border-outline-variant/10 flex flex-wrap items-center justify-between gap-4 font-mono text-xs select-none">
          <div className="flex items-center gap-2">
            <span className="text-outline-variant font-sans text-xs">Records per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-surface-container-lowest border border-outline-variant/20 rounded px-2.5 py-1 text-on-surface focus:outline-none"
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-outline-variant font-sans text-[11px] ml-2">
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, filteredAndSortedRecords.length)} of{" "}
              {filteredAndSortedRecords.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 border border-outline-variant/15 hover:border-primary-fixed-dim/35 hover:text-primary-fixed-dim rounded-lg bg-surface-container-lowest disabled:opacity-40 disabled:hover:text-outline-variant disabled:hover:border-outline-variant/15 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-outline-variant/15 hover:border-primary-fixed-dim/35 hover:text-primary-fixed-dim rounded-lg bg-surface-container-lowest disabled:opacity-40 font-sans text-[11px] font-bold uppercase transition-all"
            >
              Prev
            </button>
            <span className="px-3 py-1 rounded bg-surface-container-low font-bold">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-outline-variant/15 hover:border-primary-fixed-dim/35 hover:text-primary-fixed-dim rounded-lg bg-surface-container-lowest disabled:opacity-40 font-sans text-[11px] font-bold uppercase transition-all"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-outline-variant/15 hover:border-primary-fixed-dim/35 hover:text-primary-fixed-dim rounded-lg bg-surface-container-lowest disabled:opacity-40 disabled:hover:text-outline-variant disabled:hover:border-outline-variant/15 transition-all"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
