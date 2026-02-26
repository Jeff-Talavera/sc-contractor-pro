import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import type {
  Inspection, InspectionTemplate, Jobsite, User, Observation,
  CodeReference, Client
} from "@shared/schema";
import { insertObservationSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Disclaimer } from "@/components/disclaimer";
import {
  ArrowLeft, Plus, Search, ClipboardCheck,
  Calendar, MapPin, User as UserIcon, ChevronRight,
  AlertTriangle, CheckCircle2, Clock, XCircle,
  Link2, X
} from "lucide-react";

const severityColors: Record<string, string> = {
  Low: "bg-chart-4/15 text-chart-4",
  Medium: "bg-chart-1/15 text-chart-1",
  High: "bg-destructive/15 text-destructive",
};

const statusIcons: Record<string, any> = {
  "Open": AlertTriangle,
  "In progress": Clock,
  "Corrected": CheckCircle2,
  "Verified": CheckCircle2,
};

function NewInspectionWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [selectedJobsite, setSelectedJobsite] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: jobsites } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });
  const { data: templates } = useQuery<InspectionTemplate[]>({ queryKey: ["/api/templates"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const clientMap = new Map(clients?.map(c => [c.id, c]) ?? []);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/inspections", {
        jobsiteId: selectedJobsite,
        templateId: selectedTemplate,
        date: new Date().toISOString().split("T")[0],
      });
      return res.json();
    },
    onSuccess: (data: Inspection) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspections"] });
      toast({ title: "Inspection created" });
      onClose();
      setLocation(`/inspections/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>New Inspection - Step {step} of 3</DialogTitle>
      </DialogHeader>

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Select a jobsite</p>
          {jobsites?.map(job => (
            <div
              key={job.id}
              className={`rounded-md p-3 cursor-pointer border transition-colors ${
                selectedJobsite === job.id ? "border-primary bg-primary/5" : "hover-elevate"
              }`}
              onClick={() => setSelectedJobsite(job.id)}
              data-testid={`select-jobsite-${job.id}`}
            >
              <p className="text-sm font-medium">{job.name}</p>
              <p className="text-xs text-muted-foreground">
                {clientMap.get(job.clientId)?.name} - {job.borough}
              </p>
            </div>
          ))}
          <Button
            className="w-full mt-4"
            disabled={!selectedJobsite}
            onClick={() => setStep(2)}
            data-testid="button-next-step-2"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Select an inspection template</p>
          {templates?.map(tpl => (
            <div
              key={tpl.id}
              className={`rounded-md p-3 cursor-pointer border transition-colors ${
                selectedTemplate === tpl.id ? "border-primary bg-primary/5" : "hover-elevate"
              }`}
              onClick={() => setSelectedTemplate(tpl.id)}
              data-testid={`select-template-${tpl.id}`}
            >
              <p className="text-sm font-medium">{tpl.name}</p>
              <p className="text-xs text-muted-foreground">{tpl.description}</p>
              <Badge variant="secondary" className="mt-1">{tpl.category}</Badge>
            </div>
          ))}
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1" data-testid="button-back-step-1">
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={!selectedTemplate}
              onClick={() => setStep(3)}
              data-testid="button-next-step-3"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Confirm and create inspection</p>
          <div className="rounded-md bg-muted/50 p-4 space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Jobsite: </span>
              <span className="font-medium">{jobsites?.find(j => j.id === selectedJobsite)?.name}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Template: </span>
              <span className="font-medium">{templates?.find(t => t.id === selectedTemplate)?.name}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Date: </span>
              <span className="font-medium">{new Date().toISOString().split("T")[0]}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)} className="flex-1" data-testid="button-back-step-2">
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              data-testid="button-create-inspection"
            >
              {createMutation.isPending ? "Creating..." : "Create Inspection"}
            </Button>
          </div>
        </div>
      )}
    </DialogContent>
  );
}

function CodeReferenceSearch({
  linkedIds,
  onLink,
  onUnlink,
}: {
  linkedIds: string[];
  onLink: (id: string) => void;
  onUnlink: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: codeRefs } = useQuery<CodeReference[]>({ queryKey: ["/api/code-references"] });

  const filtered = search.length >= 2
    ? codeRefs?.filter(cr => {
        const q = search.toLowerCase();
        return (
          cr.id.toLowerCase().includes(q) ||
          cr.title.toLowerCase().includes(q) ||
          cr.plainSummary.toLowerCase().includes(q) ||
          cr.tags.some(t => t.toLowerCase().includes(q))
        );
      }) ?? []
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {linkedIds.map(refId => {
          const ref = codeRefs?.find(r => r.id === refId);
          return (
            <Tooltip key={refId}>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => onUnlink(refId)}
                  data-testid={`badge-linked-ref-${refId}`}
                >
                  {refId}
                  <X className="h-3 w-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">{ref?.title ?? refId}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search code references by keyword or tag..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-code-refs"
        />
      </div>

      {filtered.length > 0 && (
        <div className="max-h-48 overflow-auto space-y-1 rounded-md border p-2">
          {filtered.slice(0, 8).map(cr => (
            <div
              key={cr.id}
              className="flex items-center justify-between gap-2 rounded-md p-2 hover-elevate"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{cr.id} - {cr.title}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {cr.tags.slice(0, 3).map(t => (
                    <span key={t} className="text-[10px] text-muted-foreground">{t}</span>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={linkedIds.includes(cr.id)}
                onClick={() => onLink(cr.id)}
                data-testid={`button-link-ref-${cr.id}`}
              >
                {linkedIds.includes(cr.id) ? "Linked" : (
                  <><Link2 className="h-3 w-3 mr-1" /> Link</>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddObservationForm({
  inspectionId,
  jobsiteId,
  onClose,
}: {
  inspectionId: string;
  jobsiteId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [linkedRefs, setLinkedRefs] = useState<string[]>([]);

  const observationFormSchema = insertObservationSchema.extend({
    recommendedAction: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(observationFormSchema),
    defaultValues: {
      inspectionId,
      jobsiteId,
      location: "",
      description: "",
      category: "Fall Protection",
      severity: "Medium" as const,
      status: "Open" as const,
      assignedTo: "",
      dueDate: "",
      photoUrls: [] as string[],
      linkedCodeReferenceIds: [] as string[],
      recommendedActions: [] as string[],
      recommendedAction: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { recommendedAction, ...rest } = data;
      const actions = recommendedAction ? [...rest.recommendedActions, recommendedAction] : rest.recommendedActions;
      const res = await apiRequest("POST", "/api/observations", {
        ...rest,
        linkedCodeReferenceIds: linkedRefs,
        recommendedActions: actions,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspections", inspectionId, "observations"] });
      toast({ title: "Observation added" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const categories = [
    "Fall Protection", "Housekeeping", "Scaffolds", "Public Protection",
    "Administrative", "Cranes", "Hoists", "Excavations", "Fire Safety"
  ];

  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add Observation</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="location" render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl><Input placeholder="e.g., Level 12, North elevation" {...field} data-testid="input-obs-location" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-obs-category">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl><Textarea placeholder="Describe the observation..." {...field} data-testid="input-obs-description" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField control={form.control} name="severity" render={({ field }) => (
              <FormItem>
                <FormLabel>Severity</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-obs-severity">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="assignedTo" render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned To</FormLabel>
                <FormControl><Input placeholder="Name or ID" {...field} data-testid="input-obs-assigned" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="dueDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date</FormLabel>
                <FormControl><Input type="date" {...field} data-testid="input-obs-due-date" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="recommendedAction" render={({ field }) => (
            <FormItem>
              <FormLabel>Recommended Action</FormLabel>
              <FormControl><Input placeholder="Corrective action to take..." {...field} data-testid="input-obs-action" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div>
            <p className="text-sm font-medium mb-2">Suggest Code References</p>
            <CodeReferenceSearch
              linkedIds={linkedRefs}
              onLink={(id) => setLinkedRefs(prev => [...prev, id])}
              onUnlink={(id) => setLinkedRefs(prev => prev.filter(r => r !== id))}
            />
          </div>

          <Disclaimer compact />

          <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-observation">
            {createMutation.isPending ? "Adding..." : "Add Observation"}
          </Button>
        </form>
      </Form>
    </DialogContent>
  );
}

function InspectionDetail({ id }: { id: string }) {
  const [showAddObs, setShowAddObs] = useState(false);
  const { toast } = useToast();

  const { data: inspection, isLoading } = useQuery<Inspection>({
    queryKey: ["/api/inspections", id],
  });
  const { data: observations } = useQuery<Observation[]>({
    queryKey: ["/api/inspections", id, "observations"],
  });
  const { data: jobsites } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });
  const { data: templates } = useQuery<InspectionTemplate[]>({ queryKey: ["/api/templates"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: codeRefs } = useQuery<CodeReference[]>({ queryKey: ["/api/code-references"] });

  const codeRefMap = new Map(codeRefs?.map(r => [r.id, r]) ?? []);

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/inspections/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspections", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/inspections"] });
      toast({ title: "Status updated" });
    },
  });

  const obsStatusMutation = useMutation({
    mutationFn: async ({ obsId, status }: { obsId: string; status: string }) => {
      await apiRequest("PATCH", `/api/observations/${obsId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspections", id, "observations"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!inspection) {
    return <div className="p-6 text-center text-muted-foreground">Inspection not found</div>;
  }

  const jobsite = jobsites?.find(j => j.id === inspection.jobsiteId);
  const template = templates?.find(t => t.id === inspection.templateId);
  const inspector = users?.find(u => u.id === inspection.inspectorUserId);

  const obsStatuses = ["Open", "In progress", "Corrected", "Verified"];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/inspections">
              <Button variant="ghost" size="icon" data-testid="button-back-inspections">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold truncate" data-testid="text-inspection-title">
                {template?.name ?? "Inspection"}
              </h1>
              <p className="text-sm text-muted-foreground">{jobsite?.name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={inspection.status === "Submitted" ? "default" : "secondary"}>
                {inspection.status}
              </Badge>
              {inspection.status === "Draft" && (
                <Button
                  size="sm"
                  onClick={() => statusMutation.mutate("Submitted")}
                  disabled={statusMutation.isPending}
                  data-testid="button-submit-inspection"
                >
                  Submit
                </Button>
              )}
            </div>
          </div>

          <Card data-testid="card-inspection-header">
            <CardContent className="p-4">
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{inspection.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{jobsite?.address}, {jobsite?.borough}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{inspector?.name ?? "Unknown"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold" data-testid="text-observations-header">
              Observations ({observations?.length ?? 0})
            </h2>
            <Dialog open={showAddObs} onOpenChange={setShowAddObs}>
              <Button onClick={() => setShowAddObs(true)} data-testid="button-add-observation">
                <Plus className="h-4 w-4 mr-2" /> Add Observation
              </Button>
              {showAddObs && (
                <AddObservationForm
                  inspectionId={inspection.id}
                  jobsiteId={inspection.jobsiteId}
                  onClose={() => setShowAddObs(false)}
                />
              )}
            </Dialog>
          </div>

          {!observations || observations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No observations yet. Click "Add Observation" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {observations.map(obs => {
                const StatusIcon = statusIcons[obs.status] ?? AlertTriangle;
                return (
                  <Card key={obs.id} data-testid={`card-observation-${obs.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={severityColors[obs.severity] ?? ""} variant="secondary">
                              {obs.severity}
                            </Badge>
                            <Badge variant="secondary">{obs.category}</Badge>
                            <span className="text-xs text-muted-foreground">{obs.location}</span>
                          </div>
                          <p className="text-sm mt-2">{obs.description}</p>
                        </div>
                        <Select
                          value={obs.status}
                          onValueChange={(val) => obsStatusMutation.mutate({ obsId: obs.id, status: val })}
                        >
                          <SelectTrigger className="w-[140px] shrink-0" data-testid={`select-obs-status-${obs.id}`}>
                            <div className="flex items-center gap-1.5">
                              <StatusIcon className="h-3 w-3" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {obsStatuses.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {obs.recommendedActions.length > 0 && (
                        <div className="text-sm space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recommended Actions</p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                            {obs.recommendedActions.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {obs.linkedCodeReferenceIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {obs.linkedCodeReferenceIds.map(refId => {
                            const ref = codeRefMap.get(refId);
                            return (
                              <Tooltip key={refId}>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs cursor-help" data-testid={`badge-code-ref-${refId}`}>
                                    {refId}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <div className="max-w-xs">
                                    <p className="font-medium text-xs">{ref?.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{ref?.plainSummary?.slice(0, 120)}...</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                        {obs.assignedTo && <span>Assigned: {obs.assignedTo}</span>}
                        {obs.dueDate && <span>Due: {obs.dueDate}</span>}
                        <span>Created: {new Date(obs.createdAt).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InspectionsList() {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [, setLocation] = useLocation();

  const { data: inspections, isLoading } = useQuery<Inspection[]>({ queryKey: ["/api/inspections"] });
  const { data: jobsites } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });
  const { data: templates } = useQuery<InspectionTemplate[]>({ queryKey: ["/api/templates"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const jobsiteMap = new Map(jobsites?.map(j => [j.id, j]) ?? []);
  const templateMap = new Map(templates?.map(t => [t.id, t]) ?? []);
  const userMap = new Map(users?.map(u => [u.id, u]) ?? []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "true") {
      setShowNew(true);
    }
  }, []);

  const filtered = inspections?.filter(i => {
    const q = search.toLowerCase();
    const jobsite = jobsiteMap.get(i.jobsiteId);
    const template = templateMap.get(i.templateId);
    const user = userMap.get(i.inspectorUserId);
    return (
      (jobsite?.name ?? "").toLowerCase().includes(q) ||
      (template?.name ?? "").toLowerCase().includes(q) ||
      (user?.name ?? "").toLowerCase().includes(q) ||
      i.date.includes(q) ||
      i.status.toLowerCase().includes(q)
    );
  })?.sort((a, b) => b.date.localeCompare(a.date)) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-inspections-title">Inspections</h1>
              <p className="text-sm text-muted-foreground mt-1">View and manage all inspections</p>
            </div>
            <Dialog open={showNew} onOpenChange={setShowNew}>
              <Button onClick={() => setShowNew(true)} data-testid="button-new-inspection">
                <Plus className="h-4 w-4 mr-2" /> New Inspection
              </Button>
              {showNew && <NewInspectionWizard onClose={() => setShowNew(false)} />}
            </Dialog>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search inspections..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-inspections"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "No inspections match your search" : "No inspections yet"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(insp => {
                const jobsite = jobsiteMap.get(insp.jobsiteId);
                const template = templateMap.get(insp.templateId);
                const user = userMap.get(insp.inspectorUserId);
                return (
                  <Link key={insp.id} href={`/inspections/${insp.id}`}>
                    <Card className="cursor-pointer hover-elevate" data-testid={`card-inspection-${insp.id}`}>
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium truncate">{template?.name ?? "Inspection"}</p>
                            <Badge variant="secondary" className="shrink-0">{template?.category}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {insp.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {jobsite?.name ?? "Unknown"}
                            </span>
                            <span className="flex items-center gap-1">
                              <UserIcon className="h-3 w-3" /> {user?.name ?? "Unknown"}
                            </span>
                          </div>
                        </div>
                        <Badge variant={insp.status === "Submitted" ? "default" : "secondary"} className="shrink-0">
                          {insp.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InspectionsPage() {
  const [matchDetail, params] = useRoute("/inspections/:id");

  if (matchDetail && params?.id) {
    return <InspectionDetail id={params.id} />;
  }

  return <InspectionsList />;
}
