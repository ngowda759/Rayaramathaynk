"use client";

import { quoteColumns } from "./columns";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { 
  Quote, 
  QuoteCategory, 
  QUOTE_CATEGORIES,
  FestivalName 
} from "@/types/quote";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import CrudTable from "@/components/admin/crud/CrudTable";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Upload,
  Download,
  RefreshCw,
  Filter,
  Eye,
  Star,
  Calendar,
  Tag,
} from "lucide-react";

interface QuoteStats {
  total: number;
  byCategory: Record<QuoteCategory, number>;
  featured: number;
  active: number;
  topViewed: Quote[];
}

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<QuoteStats | null>(null);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState<QuoteCategory[]>([]);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  
  // Dialogs
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDays, setPreviewDays] = useState<Array<{ date: string; quote: Quote | null }>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Bulk import
  const [importData, setImportData] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const loadQuotes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/quotes");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setQuotes(data.quotes || []);
    } catch (error) {
      console.error("Failed to load quotes:", error);
      toast.error("Failed to load quotes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch("/api/quotes/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  const loadPreview = useCallback(async () => {
    try {
      setPreviewLoading(true);
      const response = await fetch("/api/quotes/preview?days=7");
      if (!response.ok) throw new Error("Failed to fetch preview");
      const data = await response.json();
      setPreviewDays(data.preview || []);
    } catch (error) {
      console.error("Failed to load preview:", error);
      toast.error("Failed to load preview.");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Data fetching pattern
    loadQuotes();
    loadStats();
  }, [loadQuotes, loadStats]);

  const filteredQuotes = useMemo(() => {
    let filtered = quotes;
    
    // Search filter
    if (search.trim()) {
      const keyword = search.toLowerCase().trim();
      filtered = filtered.filter(
        (q) =>
          q.title.toLowerCase().includes(keyword) ||
          q.source.toLowerCase().includes(keyword) ||
          q.tags.some((t) => t.toLowerCase().includes(keyword)) ||
          q.content.kannada?.toLowerCase().includes(keyword) ||
          q.content.translationEnglish?.toLowerCase().includes(keyword)
      );
    }
    
    // Category filter
    if (categoryFilter.length > 0) {
      filtered = filtered.filter((q) => categoryFilter.includes(q.category));
    }
    
    // Active filter
    if (showActiveOnly) {
      filtered = filtered.filter((q) => q.active);
    }
    
    // Featured filter
    if (showFeaturedOnly) {
      filtered = filtered.filter((q) => q.featured);
    }
    
    return filtered;
  }, [quotes, search, categoryFilter, showActiveOnly, showFeaturedOnly]);

  const handleDelete = async (quote: Quote) => {
    if (!confirm(`Delete "${quote.title}"?`)) return;
    
    try {
      const response = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error("Failed to delete");
      
      toast.success("Quote deleted successfully.");
      loadQuotes();
      loadStats();
    } catch (error) {
      console.error("Failed to delete quote:", error);
      toast.error("Failed to delete quote.");
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} quotes?`)) return;
    
    try {
      const response = await fetch("/api/admin/quotes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      
      if (!response.ok) throw new Error("Failed to delete");
      
      toast.success(`Deleted ${ids.length} quotes.`);
      loadQuotes();
      loadStats();
    } catch (error) {
      console.error("Failed to delete quotes:", error);
      toast.error("Failed to delete quotes.");
    }
  };

  const handleBulkActivate = async (ids: string[], active: boolean) => {
    try {
      const response = await fetch("/api/admin/quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, updates: { active } }),
      });
      
      if (!response.ok) throw new Error("Failed to update");
      
      toast.success(`Updated ${ids.length} quotes.`);
      loadQuotes();
      loadStats();
    } catch (error) {
      console.error("Failed to update quotes:", error);
      toast.error("Failed to update quotes.");
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/admin/quotes/bulk?activeOnly=false");
      if (!response.ok) throw new Error("Failed to export");
      
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotes-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success("Quotes exported successfully.");
    } catch (error) {
      console.error("Failed to export quotes:", error);
      toast.error("Failed to export quotes.");
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      toast.error("Please paste JSON data to import.");
      return;
    }
    
    try {
      setImporting(true);
      const quotesToImport = JSON.parse(importData);
      
      if (!Array.isArray(quotesToImport)) {
        throw new Error("Import data must be an array of quotes.");
      }
      
      const response = await fetch("/api/admin/quotes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotes: quotesToImport }),
      });
      
      if (!response.ok) throw new Error("Failed to import");
      
      const result = await response.json();
      setImportResult(result);
      
      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} quotes.`);
        loadQuotes();
        loadStats();
        setImportData("");
      }
    } catch (error: any) {
      console.error("Failed to import quotes:", error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleSeed = async () => {
    if (!confirm("Seed default quotes? This will only add quotes if the collection is empty.")) return;
    
    try {
      const response = await fetch("/api/admin/quotes/seed", {
        method: "POST",
      });
      
      if (!response.ok) throw new Error("Failed to seed");
      
      const result = await response.json();
      toast.success(result.message);
      loadQuotes();
      loadStats();
    } catch (error) {
      console.error("Failed to seed quotes:", error);
      toast.error("Failed to seed quotes.");
    }
  };

  const handleClearCache = async () => {
    try {
      const response = await fetch("/api/admin/quotes/cache", {
        method: "POST",
      });
      
      if (!response.ok) throw new Error("Failed to clear cache");
      
      toast.success("Cache cleared successfully.");
    } catch (error) {
      console.error("Failed to clear cache:", error);
      toast.error("Failed to clear cache.");
    }
  };

  const toggleCategory = (category: QuoteCategory) => {
    setCategoryFilter((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Devotional Quotes"
        description="Manage devotional quotes, stotrams, and spiritual teachings."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" onClick={handleSeed}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Seed Default
            </Button>
            <Button asChild>
              <Link href="/admin/quotes/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Quote
              </Link>
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Quotes</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold">{stats.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold">{stats.featured}</div>
            <div className="text-sm text-muted-foreground">Featured</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <Button variant="outline" size="sm" onClick={() => { setShowPreviewDialog(true); loadPreview(); }}>
              <Calendar className="mr-2 h-4 w-4" />
              Preview Rotation
            </Button>
          </div>
        </div>
      )}

      {/* Category Stats */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.byCategory).map(([category, count]) => (
            <Badge 
              key={category} 
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => toggleCategory(category as QuoteCategory)}
            >
              {QUOTE_CATEGORIES.find(c => c.id === category)?.label || category}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search quotes..."
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {categoryFilter.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {categoryFilter.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuCheckboxItem
              checked={showActiveOnly}
              onCheckedChange={setShowActiveOnly}
            >
              Active only
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showFeaturedOnly}
              onCheckedChange={setShowFeaturedOnly}
            >
              Featured only
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-sm font-semibold">Categories</div>
            {QUOTE_CATEGORIES.map((cat) => (
              <DropdownMenuCheckboxItem
                key={cat.id}
                checked={categoryFilter.includes(cat.id)}
                onCheckedChange={() => toggleCategory(cat.id)}
              >
                {cat.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={handleClearCache}>
          Clear Cache
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading quotes...
        </div>
      ) : (
        <CrudTable<Quote>
          data={filteredQuotes}
          columns={quoteColumns}
          emptyMessage="No quotes found. Add your first quote or seed default quotes."
          actions={{
            onEdit: (quote) => router.push(`/admin/quotes/${quote.id}/edit`),
            onDelete: handleDelete,
          }}
        />
      )}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Quotes</DialogTitle>
            <DialogDescription>
              Paste JSON array of quotes to import. Each quote should have title, category, and source.
            </DialogDescription>
          </DialogHeader>
          
          <textarea
            className="min-h-[300px] w-full rounded-md border p-3 font-mono text-sm"
            placeholder='[{"title": "...", "category": "...", "source": "..."}]'
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
          />
          
          {importResult && (
            <div className="rounded-md bg-green-50 p-3 text-sm">
              <div className="font-medium text-green-800">
                Imported {importResult.imported} quotes
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-2 text-red-600">
                  {importResult.errors.length} errors
                  <ul className="mt-1 list-disc pl-4">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quote Rotation Preview</DialogTitle>
            <DialogDescription>
              Preview the quotes that will be shown for the next 7 days
            </DialogDescription>
          </DialogHeader>
          
          {previewLoading ? (
            <div className="py-8 text-center">Loading preview...</div>
          ) : (
            <div className="space-y-3">
              {previewDays.map((day, index) => (
                <div
                  key={day.date}
                  className="flex items-center gap-4 rounded-lg border p-3"
                >
                  <div className="w-24 shrink-0">
                    <div className="text-sm font-medium">
                      {new Date(day.date).toLocaleDateString("en-IN", { 
                        weekday: "short",
                        month: "short",
                        day: "numeric"
                      })}
                    </div>
                    {index === 0 && (
                      <Badge variant="secondary" className="mt-1 text-xs">Today</Badge>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {day.quote ? (
                      <>
                        <p className="truncate text-sm">{day.quote.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {day.quote.source}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No quote selected</p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {day.quote?.category.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
