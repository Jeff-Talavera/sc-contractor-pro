import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import type { Client, Jobsite, Inspection, InspectionTemplate, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Search, Building2, ExternalLink,
  MapPin, Hash, FileText, Layers, Container,
  Shield, HardHat, ArrowUp,
} from "lucide-react";

function FlagBadge({ active, label }: { active: boolean; label: string }) {
  if (!active) return null;
  return <Badge variant="outline">{label}</Badge>;
}

function JobsitesList() {
  const [search, setSearch] = useState("");
  const { data: jobsites, isLoading } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const clientMap = new Map(clients?.map(c => [c.id, c]) ?? []);

  const filtered = jobsites?.filter(j =>
    j.name.toLowerCase().includes(search.toLowerCase()) ||
    j.address.toLowerCase().includes(search.toLowerCase()) ||
    j.borough.toLowerCase().includes(search.toLowerCase()) ||
    (clientMap.get(j.clientId)?.name ?? "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-jobsites-title">Jobsites</h1>
            <p className="text-sm text-muted-foreground mt-1">All active construction sites</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, address, borough, or client..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-jobsites"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "No jobsites match your search" : "No jobsites yet"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(job => (
                <Link key={job.id} href={`/jobsites/${job.id}`}>
                  <Card className="cursor-pointer hover-elevate" data-testid={`card-jobsite-${job.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{job.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {clientMap.get(job.clientId)?.name ?? "Unknown client"}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {job.address}, {job.borough}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">{job.projectType}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <FlagBadge active={job.hasScaffold} label="Scaffold" />
                        <FlagBadge active={job.hasHoist} label="Hoist" />
                        <FlagBadge active={job.hasCrane} label="Crane" />
                        <FlagBadge active={job.hasExcavation} label="Excavation" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobsiteDetail({ id }: { id: string }) {
  const { data: jobsite, isLoading } = useQuery<Jobsite>({
    queryKey: ["/api/jobsites", id],
  });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: inspections } = useQuery<Inspection[]>({
    queryKey: ["/api/jobsites", id, "inspections"],
  });
  const { data: templates } = useQuery<InspectionTemplate[]>({
    queryKey: ["/api/templates"],
  });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const templateMap = new Map(templates?.map(t => [t.id, t]) ?? []);
  const userMap = new Map(users?.map(u => [u.id, u]) ?? []);

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!jobsite) {
    return <div className="p-6 text-center text-muted-foreground">Jobsite not found</div>;
  }

  const client = clients?.find(c => c.id === jobsite.clientId);
  const dobNowUrl = `https://a810-dobnow.nyc.gov/publish/#!/jobs?bin=${jobsite.bin}`;
  const bisUrl = `https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?bin=${jobsite.bin}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/jobsites">
              <Button variant="ghost" size="icon" data-testid="button-back-jobsites">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold truncate" data-testid="text-jobsite-name">{jobsite.name}</h1>
              {client && (
                <Link href={`/clients/${client.id}`}>
                  <span className="text-sm underline cursor-pointer">{client.name}</span>
                </Link>
              )}
            </div>
          </div>

          <Card data-testid="card-jobsite-info">
            <CardHeader>
              <CardTitle className="text-base">Site Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{jobsite.address}, {jobsite.borough}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>BIN: {jobsite.bin}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>DOB Job #: {jobsite.dobJobNumber}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{jobsite.projectType} - {jobsite.buildingType ?? "N/A"}{jobsite.stories ? `, ${jobsite.stories} stories` : ""}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Site Flags</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={jobsite.hasScaffold ? "default" : "secondary"}>
                      <Shield className="h-3 w-3 mr-1" /> Scaffold
                    </Badge>
                    <Badge variant={jobsite.hasHoist ? "default" : "secondary"}>
                      <ArrowUp className="h-3 w-3 mr-1" /> Hoist
                    </Badge>
                    <Badge variant={jobsite.hasCrane ? "default" : "secondary"}>
                      <Container className="h-3 w-3 mr-1" /> Crane
                    </Badge>
                    <Badge variant={jobsite.hasExcavation ? "default" : "secondary"}>
                      <HardHat className="h-3 w-3 mr-1" /> Excavation
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <a href={dobNowUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" data-testid="button-dob-now">
                        Open in DOB NOW <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </a>
                    <a href={bisUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" data-testid="button-bis">
                        Open in BIS <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-lg font-semibold mb-3" data-testid="text-recent-inspections">
              Recent Inspections ({inspections?.length ?? 0})
            </h2>
            {!inspections || inspections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No inspections for this jobsite</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inspections
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(insp => (
                    <Link key={insp.id} href={`/inspections/${insp.id}`}>
                      <Card className="cursor-pointer hover-elevate" data-testid={`card-inspection-${insp.id}`}>
                        <CardContent className="flex items-center justify-between gap-4 p-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">
                              {templateMap.get(insp.templateId)?.name ?? "Inspection"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {insp.date} - {userMap.get(insp.inspectorUserId)?.name ?? "Unknown"}
                            </p>
                          </div>
                          <Badge variant={insp.status === "Submitted" ? "default" : "secondary"}>
                            {insp.status}
                          </Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobsitesPage() {
  const [matchDetail, params] = useRoute("/jobsites/:id");

  if (matchDetail && params?.id) {
    return <JobsiteDetail id={params.id} />;
  }

  return <JobsitesList />;
}
