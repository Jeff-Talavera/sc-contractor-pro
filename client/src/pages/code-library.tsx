import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CodeReference } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Disclaimer } from "@/components/disclaimer";
import { Search, ExternalLink, BookOpen, Filter } from "lucide-react";

const TAG_FILTERS = [
  "scaffolds",
  "hoists",
  "cranes",
  "excavations",
  "housekeeping",
  "public protection",
  "fall protection",
  "administrative",
  "demolition",
  "rigging",
];

export default function CodeLibraryPage() {
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const { data: codeRefs, isLoading } = useQuery<CodeReference[]>({
    queryKey: ["/api/code-references"],
  });

  const toggleTag = (tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!codeRefs) return [];

    return codeRefs.filter(cr => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        cr.id.toLowerCase().includes(q) ||
        cr.sectionNumber.toLowerCase().includes(q) ||
        cr.title.toLowerCase().includes(q) ||
        cr.plainSummary.toLowerCase().includes(q) ||
        cr.tags.some(t => t.toLowerCase().includes(q));

      const matchesTags =
        activeTags.size === 0 ||
        cr.tags.some(t => activeTags.has(t));

      return matchesSearch && matchesTags;
    });
  }, [codeRefs, search, activeTags]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-code-library-title">Code Library</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Building codes, OSHA CFR 1926, and regulatory references for construction safety
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code section, title, keyword, or tag..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-code-library"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filter by topic</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TAG_FILTERS.map(tag => (
                <Badge
                  key={tag}
                  variant={activeTags.has(tag) ? "default" : "secondary"}
                  className="cursor-pointer capitalize"
                  onClick={() => toggleTag(tag)}
                  data-testid={`badge-filter-${tag.replace(/\s+/g, "-")}`}
                >
                  {tag}
                </Badge>
              ))}
              {activeTags.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTags(new Set())}
                  data-testid="button-clear-filters"
                >
                  Clear all
                </Button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {filtered.length} reference{filtered.length !== 1 ? "s" : ""} found
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No code references match your search</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(cr => (
                <Card key={cr.id} data-testid={`card-code-ref-${cr.id}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={cr.codeType === "BC" ? "default" : cr.codeType === "OSHA" ? "secondary" : "secondary"} className={`shrink-0 ${cr.codeType === "OSHA" ? "bg-orange-500/15 text-orange-700 dark:text-orange-400" : ""}`}>
                            {cr.codeType === "BC" ? "Building Code" : cr.codeType === "OSHA" ? "OSHA" : "Admin Code"}
                          </Badge>
                          <span className="font-mono text-sm font-semibold">{cr.id}</span>
                        </div>
                        <h3 className="font-medium mt-1">{cr.title}</h3>
                      </div>
                      <a href={cr.officialUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" data-testid={`button-view-official-${cr.id}`}>
                          Official text <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </a>
                    </div>
                    <p className="text-sm text-muted-foreground">{cr.plainSummary}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cr.tags.map(tag => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs capitalize cursor-pointer"
                          onClick={() => {
                            setSearch("");
                            setActiveTags(new Set([tag]));
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
