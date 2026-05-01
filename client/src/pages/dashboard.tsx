import { useQuery } from "@tanstack/react-query";
import type { User, Organization, Client, Jobsite, Inspection, Observation, OrgComplianceSummary } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import {
  Users, Building2, ClipboardCheck, AlertTriangle,
  ArrowRight, TrendingUp, Clock, CheckCircle2, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";

function compliancePctBadge(pct: number) {
  if (pct >= 80) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{pct}%</Badge>;
  if (pct >= 50) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{pct}%</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{pct}%</Badge>;
}

function ComplianceOverviewCard() {
  const { data, isLoading } = useQuery<OrgComplianceSummary[]>({
    queryKey: ["/api/compliance/summary"],
  });

  const avg = data && data.length > 0
    ? Math.round(data.reduce((sum, r) => sum + r.compliancePercent, 0) / data.length)
    : 0;

  return (
    <Card data-testid="card-compliance-overview">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4" /> Compliance Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No compliance data yet. Assign workers to jobsites to track compliance.
          </p>
        ) : (
          <>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jobsite</TableHead>
                    <TableHead>Workers</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Gaps</TableHead>
                    <TableHead>Violations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(row => (
                    <TableRow key={row.jobsiteId} data-testid={`row-compliance-${row.jobsiteId}`}>
                      <TableCell className="text-sm font-medium">
                        <Link href={`/jobsites/${row.jobsiteId}`}>
                          <span className="hover:underline cursor-pointer">{row.jobsiteName}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{row.totalWorkers}</TableCell>
                      <TableCell>{compliancePctBadge(row.compliancePercent)}</TableCell>
                      <TableCell className="text-sm">{row.workersWithGaps}</TableCell>
                      <TableCell className={`text-sm ${row.openViolations > 0 ? "text-red-600 font-medium" : ""}`}>
                        {row.openViolations}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-sm text-muted-foreground mt-3" data-testid="text-compliance-avg">
              Org-wide average compliance: <span className="font-medium">{avg}%</span> across {data.length} jobsite{data.length !== 1 ? "s" : ""}.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: me } = useQuery<{ user: User; organization: Organization }>({
    queryKey: ["/api/me"],
  });
  const { data: clients, isLoading: loadingClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  const { data: jobsites, isLoading: loadingJobsites } = useQuery<Jobsite[]>({
    queryKey: ["/api/jobsites"],
  });
  const { data: inspections, isLoading: loadingInspections } = useQuery<Inspection[]>({
    queryKey: ["/api/inspections"],
  });

  const isLoading = loadingClients || loadingJobsites || loadingInspections;

  const draftCount = inspections?.filter(i => i.status === "Draft").length ?? 0;
  const submittedCount = inspections?.filter(i => i.status === "Submitted").length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">
              {me ? `Welcome back, ${me.user.name.split(" ")[0]}` : "Dashboard"}
            </h1>
            {me && (
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-org-name">
                {me.organization?.name}
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-12" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card data-testid="card-stat-clients">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Clients</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{clients?.length ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Active accounts</p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-jobsites">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Jobsites</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{jobsites?.length ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Active sites</p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-inspections">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Inspections</CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{inspections?.length ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total inspections</p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-drafts">
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{draftCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">Draft inspections</p>
                </CardContent>
              </Card>
            </div>
          )}

          {(me?.user.role === "Admin" || me?.user.role === "Owner") && (
            <ComplianceOverviewCard />
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card data-testid="card-recent-inspections">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
                <CardTitle className="text-base font-semibold">Recent Inspections</CardTitle>
                <Link href="/inspections">
                  <Button variant="ghost" size="sm" data-testid="button-view-all-inspections">
                    View all <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : inspections && inspections.length > 0 ? (
                  <div className="space-y-3">
                    {inspections.slice(0, 5).map(insp => {
                      const jobsite = jobsites?.find(j => j.id === insp.jobsiteId);
                      return (
                        <Link key={insp.id} href={`/inspections/${insp.id}`}>
                          <div
                            className="flex items-center justify-between gap-2 rounded-md p-3 hover-elevate cursor-pointer bg-muted/30"
                            data-testid={`card-inspection-${insp.id}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{jobsite?.name ?? "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{insp.date}</p>
                            </div>
                            <Badge
                              variant="secondary"
                              className={`shrink-0 ${
                                insp.status === "Submitted"
                                  ? "bg-green-500/15 text-green-700 dark:text-green-400"
                                  : insp.status === "Draft" || insp.status === "In Progress"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  : ""
                              }`}
                            >
                              {insp.status}
                            </Badge>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No inspections yet</p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-quick-actions">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/inspections?new=true">
                  <Button className="w-full justify-start" variant="secondary" data-testid="button-new-inspection">
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    New Inspection
                  </Button>
                </Link>
                <Link href="/clients">
                  <Button className="w-full justify-start mt-2" variant="secondary" data-testid="button-view-clients">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Clients
                  </Button>
                </Link>
                <Link href="/jobsites">
                  <Button className="w-full justify-start mt-2" variant="secondary" data-testid="button-view-jobsites">
                    <Building2 className="h-4 w-4 mr-2" />
                    View Jobsites
                  </Button>
                </Link>
                <Link href="/code-library">
                  <Button className="w-full justify-start mt-2" variant="secondary" data-testid="button-code-library">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Code Library
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
