import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import type { Client, Jobsite, Inspection, InspectionTemplate, User, JobsitePermit, JobsiteExternalEvent } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Search, Building2, ExternalLink,
  MapPin, Hash, FileText, Layers, Container,
  Shield, HardHat, ArrowUp, AlertTriangle, Bell, BellOff,
} from "lucide-react";

function FlagBadge({ active, label }: { active: boolean; label: string }) {
  if (!active) return null;
  return <Badge variant="outline">{label}</Badge>;
}

function PermitsTab({ jobsiteId }: { jobsiteId: string }) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data: permits, isLoading } = useQuery<JobsitePermit[]>({
    queryKey: ["/api/jobsites", jobsiteId, "permits"],
  });

  const filtered = permits?.filter(p => {
    if (statusFilter !== "ALL") {
      if (statusFilter === "ACTIVE" && p.status !== "ISSUED") return false;
      if (statusFilter === "EXPIRED" && p.status !== "EXPIRED") return false;
    }
    if (dateFrom && p.issueDate && p.issueDate < dateFrom) return false;
    if (dateTo && p.issueDate && p.issueDate > dateTo) return false;
    return true;
  }) ?? [];

  const permitStatusColor: Record<string, string> = {
    ISSUED: "bg-green-500/15 text-green-700 dark:text-green-400",
    EXPIRED: "bg-destructive/15 text-destructive",
    REVOKED: "bg-destructive/15 text-destructive",
    IN_PROGRESS: "bg-chart-1/15 text-chart-1",
    OTHER: "bg-muted text-muted-foreground",
  };

  if (isLoading) {
    return <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-permit-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active / Issued</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">From:</span>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[140px] h-9" data-testid="input-permit-date-from" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">To:</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[140px] h-9" data-testid="input-permit-date-to" />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} permit{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No permits found for this jobsite</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permit #</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Work / Permit Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(permit => (
                <TableRow key={permit.id} data-testid={`row-permit-${permit.id}`}>
                  <TableCell>
                    {permit.externalUrl ? (
                      <a href={permit.externalUrl} target="_blank" rel="noopener noreferrer" className="underline text-sm font-medium flex items-center gap-1" data-testid={`link-permit-${permit.id}`}>
                        {permit.permitNumber}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-sm font-medium">{permit.permitNumber}</span>
                    )}
                    {permit.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{permit.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{permit.source.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {permit.workType}{permit.permitType ? ` / ${permit.permitType}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={permitStatusColor[permit.status] ?? ""}>
                      {permit.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{permit.issueDate ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{permit.expirationDate ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ComplaintsViolationsTab({ jobsiteId }: { jobsiteId: string }) {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data: events, isLoading } = useQuery<JobsiteExternalEvent[]>({
    queryKey: ["/api/jobsites", jobsiteId, "external-events"],
  });

  const filtered = events?.filter(e => {
    if (typeFilter !== "ALL" && e.eventType !== typeFilter) return false;
    if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
    if (dateFrom && e.issuedDate && e.issuedDate < dateFrom) return false;
    if (dateTo && e.issuedDate && e.issuedDate > dateTo) return false;
    return true;
  }) ?? [];

  const openComplaints = events?.filter(e => e.eventType === "Complaint" && e.status === "OPEN").length ?? 0;
  const openViolations = events?.filter(e => e.eventType === "Violation" && e.status === "OPEN").length ?? 0;
  const newItems = events?.filter(e => e.isNew).length ?? 0;

  if (isLoading) {
    return <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 p-3 rounded-md bg-muted/50 text-sm" data-testid="text-events-summary">
        <span>{openComplaints} open complaint{openComplaints !== 1 ? "s" : ""}</span>
        <span className="text-muted-foreground">|</span>
        <span>{openViolations} open violation{openViolations !== 1 ? "s" : ""}</span>
        <span className="text-muted-foreground">|</span>
        <span className="font-medium">{newItems} new item{newItems !== 1 ? "s" : ""} since last check</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-event-type-filter">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="Complaint">Complaints</SelectItem>
            <SelectItem value="Violation">Violations</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-event-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">From:</span>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[140px] h-9" data-testid="input-event-date-from" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">To:</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[140px] h-9" data-testid="input-event-date-to" />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No complaints or violations found</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(evt => (
                <TableRow key={evt.id} data-testid={`row-event-${evt.id}`}>
                  <TableCell>
                    <Badge variant={evt.eventType === "Violation" ? "destructive" : "secondary"}>
                      {evt.eventType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {evt.externalUrl ? (
                      <a href={evt.externalUrl} target="_blank" rel="noopener noreferrer" className="underline text-sm font-medium flex items-center gap-1" data-testid={`link-event-${evt.id}`}>
                        {evt.externalId}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-sm font-medium">{evt.externalId}</span>
                    )}
                    {evt.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{evt.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{evt.category ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={evt.status === "OPEN" ? "bg-chart-1/15 text-chart-1" : ""}>
                      {evt.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{evt.issuedDate ?? "—"}</TableCell>
                  <TableCell>
                    {evt.isNew && (
                      <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400" variant="secondary" data-testid={`badge-new-${evt.id}`}>
                        NEW
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
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

  const monitorMutation = useMutation({
    mutationFn: async (val: boolean) => {
      await apiRequest("PATCH", `/api/jobsites/${id}`, { monitorPublicRecords: val });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobsites", id] });
    },
  });

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

          <Card data-testid="card-public-records">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-base">Public Records</CardTitle>
                <div className="flex items-center gap-2">
                  {jobsite.monitorPublicRecords ? (
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <label className="text-xs text-muted-foreground" htmlFor="monitor-toggle">Monitor</label>
                  <Switch
                    id="monitor-toggle"
                    checked={jobsite.monitorPublicRecords}
                    onCheckedChange={(val) => monitorMutation.mutate(val)}
                    data-testid="switch-monitor-records"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="permits">
                <TabsList data-testid="tabs-public-records">
                  <TabsTrigger value="permits" data-testid="tab-permits">Permits</TabsTrigger>
                  <TabsTrigger value="complaints" data-testid="tab-complaints">Complaints & Violations</TabsTrigger>
                </TabsList>
                <TabsContent value="permits" className="mt-4">
                  <PermitsTab jobsiteId={id} />
                </TabsContent>
                <TabsContent value="complaints" className="mt-4">
                  <ComplaintsViolationsTab jobsiteId={id} />
                </TabsContent>
              </Tabs>
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
