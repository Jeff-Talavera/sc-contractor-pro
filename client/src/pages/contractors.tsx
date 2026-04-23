import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import type { IndependentContractor, ContractorJobsiteAssignment, Jobsite } from "@shared/schema";
import { insertIndependentContractorSchema, insertContractorAssignmentSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ContactsCard } from "@/components/contacts-card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Search, UserCheck, Phone, Mail, FileText,
  Shield, Trash2, Building2, Pencil, X,
} from "lucide-react";

const licenseTypes = ["SSM", "Safety Coordinator", "Other"];

function insuranceStatus(expiryDate?: string): "valid" | "expiring" | "expired" | "none" {
  if (!expiryDate) return "none";
  const today = new Date();
  const expiry = new Date(expiryDate + "T00:00:00");
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "expiring";
  return "valid";
}

function InsuranceBadge({ label, expiryDate }: { label: string; expiryDate?: string }) {
  const status = insuranceStatus(expiryDate);
  if (status === "none") return (
    <Badge variant="outline" className="text-muted-foreground">{label}: —</Badge>
  );
  const colors: Record<string, string> = {
    valid: "bg-green-500/15 text-green-700 dark:text-green-400",
    expiring: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    expired: "bg-destructive/15 text-destructive",
  };
  const labels: Record<string, string> = {
    valid: expiryDate!,
    expiring: `Exp ${expiryDate}`,
    expired: `Expired ${expiryDate}`,
  };
  return (
    <Badge variant="secondary" className={colors[status]}>
      {label}: {labels[status]}
    </Badge>
  );
}

const contractorFormSchema = insertIndependentContractorSchema.extend({
  email: z.string().email("Valid email required").optional().or(z.literal("")),
});
type ContractorFormValues = z.infer<typeof contractorFormSchema>;

function ContractorForm({
  contractor,
  onClose,
}: {
  contractor?: IndependentContractor;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [certInput, setCertInput] = useState("");

  const form = useForm<ContractorFormValues>({
    resolver: zodResolver(contractorFormSchema),
    defaultValues: contractor ?? {
      name: "",
      email: "",
      phone: "",
      licenseType: "SSM",
      licenseNumber: "",
      certifications: [],
      plCarrier: "",
      plPolicyNumber: "",
      plExpiryDate: "",
      glCarrier: "",
      glPolicyNumber: "",
      glExpiryDate: "",
      status: "active",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ContractorFormValues) => apiRequest("POST", "/api/contractors", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractors"] });
      toast({ title: "Contractor added" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to save contractor", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ContractorFormValues) => apiRequest("PATCH", `/api/contractors/${contractor!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contractors", contractor!.id] });
      toast({ title: "Contractor updated" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to update contractor", variant: "destructive" }),
  });

  const certifications = form.watch("certifications") ?? [];

  function addCert() {
    const val = certInput.trim();
    if (val && !certifications.includes(val)) {
      form.setValue("certifications", [...certifications, val]);
      setCertInput("");
    }
  }

  function removeCert(c: string) {
    form.setValue("certifications", certifications.filter(x => x !== c));
  }

  function onSubmit(data: ContractorFormValues) {
    if (contractor) updateMutation.mutate(data);
    else createMutation.mutate(data);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name *</FormLabel>
              <FormControl><Input {...field} data-testid="input-contractor-name" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid="select-contractor-status">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" {...field} value={field.value ?? ""} data-testid="input-contractor-email" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} data-testid="input-contractor-phone" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="licenseType" render={({ field }) => (
            <FormItem>
              <FormLabel>License Type *</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid="select-contractor-license-type">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {licenseTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="licenseNumber" render={({ field }) => (
            <FormItem>
              <FormLabel>License Number</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} data-testid="input-contractor-license-number" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Certifications</p>
          <div className="flex gap-2 mb-2">
            <Input
              value={certInput}
              onChange={e => setCertInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCert(); } }}
              placeholder="Add certification..."
              className="flex-1"
              data-testid="input-contractor-certification"
            />
            <Button type="button" variant="outline" onClick={addCert} data-testid="button-add-certification">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {certifications.map(c => (
              <Badge key={c} variant="secondary" className="gap-1" data-testid={`badge-cert-${c}`}>
                {c}
                <button type="button" onClick={() => removeCert(c)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <Separator />
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Professional Liability (PL)</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField control={form.control} name="plCarrier" render={({ field }) => (
            <FormItem>
              <FormLabel>Carrier</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} data-testid="input-pl-carrier" /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="plPolicyNumber" render={({ field }) => (
            <FormItem>
              <FormLabel>Policy #</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} data-testid="input-pl-policy" /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="plExpiryDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Expiry Date</FormLabel>
              <FormControl><Input type="date" {...field} value={field.value ?? ""} data-testid="input-pl-expiry" /></FormControl>
            </FormItem>
          )} />
        </div>

        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">General Liability (GL)</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField control={form.control} name="glCarrier" render={({ field }) => (
            <FormItem>
              <FormLabel>Carrier</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} data-testid="input-gl-carrier" /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="glPolicyNumber" render={({ field }) => (
            <FormItem>
              <FormLabel>Policy #</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} data-testid="input-gl-policy" /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="glExpiryDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Expiry Date</FormLabel>
              <FormControl><Input type="date" {...field} value={field.value ?? ""} data-testid="input-gl-expiry" /></FormControl>
            </FormItem>
          )} />
        </div>

        <Separator />
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl><Textarea {...field} value={field.value ?? ""} rows={3} data-testid="input-contractor-notes" /></FormControl>
          </FormItem>
        )} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit-contractor">
            {isPending ? "Saving…" : contractor ? "Save Changes" : "Add Contractor"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function AssignJobsiteDialog({
  contractorId,
  open,
  onOpenChange,
}: {
  contractorId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const { data: jobsites } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });
  const { data: existing } = useQuery<ContractorJobsiteAssignment[]>({
    queryKey: ["/api/contractors", contractorId, "assignments"],
  });

  const form = useForm<{ jobsiteId: string; startDate: string; endDate: string; role: string }>({
    defaultValues: { jobsiteId: "", startDate: "", endDate: "", role: "" },
  });

  const existingJobsiteIds = new Set(existing?.map(a => a.jobsiteId) ?? []);
  const available = jobsites?.filter(j => !existingJobsiteIds.has(j.id)) ?? [];

  const mutation = useMutation({
    mutationFn: (data: { jobsiteId: string; startDate: string; endDate: string; role: string }) =>
      apiRequest("POST", `/api/contractors/${contractorId}/assignments`, {
        jobsiteId: data.jobsiteId,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        role: data.role || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractors", contractorId, "assignments"] });
      toast({ title: "Jobsite assigned" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => toast({ title: "Error", description: "Failed to assign", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Jobsite</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Jobsite *</label>
            <Select value={form.watch("jobsiteId")} onValueChange={v => form.setValue("jobsiteId", v)}>
              <SelectTrigger className="mt-1" data-testid="select-assign-jobsite">
                <SelectValue placeholder="Select jobsite…" />
              </SelectTrigger>
              <SelectContent>
                {available.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Role (optional)</label>
            <Input {...form.register("role")} placeholder="e.g. Lead SSM" className="mt-1" data-testid="input-assign-role" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" {...form.register("startDate")} className="mt-1" data-testid="input-assign-start-date" />
            </div>
            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" {...form.register("endDate")} className="mt-1" data-testid="input-assign-end-date" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.watch("jobsiteId") || mutation.isPending} data-testid="button-submit-assign">
              {mutation.isPending ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContractorDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const { data: contractor, isLoading } = useQuery<IndependentContractor>({
    queryKey: ["/api/contractors", id],
  });
  const { data: assignments } = useQuery<ContractorJobsiteAssignment[]>({
    queryKey: ["/api/contractors", id, "assignments"],
  });
  const { data: jobsites } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });
  const jobsiteMap = new Map(jobsites?.map(j => [j.id, j]) ?? []);

  const removeAssignment = useMutation({
    mutationFn: (assignmentId: string) =>
      apiRequest("DELETE", `/api/contractors/${id}/assignments/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractors", id, "assignments"] });
      toast({ title: "Assignment removed" });
    },
    onError: () => toast({ title: "Error", description: "Failed to remove", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" /><Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!contractor) {
    return <div className="p-6 text-center text-muted-foreground">Contractor not found</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/contractors">
              <Button variant="ghost" size="icon" data-testid="button-back-contractors">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold" data-testid="text-contractor-name">{contractor.name}</h1>
              <p className="text-sm text-muted-foreground">{contractor.licenseType}</p>
            </div>
            <Badge variant={contractor.status === "active" ? "default" : "secondary"} data-testid="badge-contractor-status">
              {contractor.status === "active" ? "Active" : "Inactive"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="button-edit-contractor">
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card data-testid="card-contractor-contact">
              <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {contractor.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={`mailto:${contractor.email}`} className="underline">{contractor.email}</a>
                  </div>
                )}
                {contractor.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{contractor.phone}</span>
                  </div>
                )}
                {contractor.licenseNumber && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>License: {contractor.licenseNumber}</span>
                  </div>
                )}
                {contractor.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {contractor.certifications.map(c => (
                      <Badge key={c} variant="outline" className="text-xs" data-testid={`badge-cert-${c}`}>{c}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-contractor-insurance">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />Insurance</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Professional Liability</p>
                  {contractor.plCarrier || contractor.plPolicyNumber || contractor.plExpiryDate ? (
                    <div className="space-y-1 text-sm">
                      {contractor.plCarrier && <p>Carrier: {contractor.plCarrier}</p>}
                      {contractor.plPolicyNumber && <p>Policy: {contractor.plPolicyNumber}</p>}
                      <InsuranceBadge label="PL" expiryDate={contractor.plExpiryDate} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">General Liability</p>
                  {contractor.glCarrier || contractor.glPolicyNumber || contractor.glExpiryDate ? (
                    <div className="space-y-1 text-sm">
                      {contractor.glCarrier && <p>Carrier: {contractor.glCarrier}</p>}
                      {contractor.glPolicyNumber && <p>Policy: {contractor.glPolicyNumber}</p>}
                      <InsuranceBadge label="GL" expiryDate={contractor.glExpiryDate} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {contractor.notes && (
            <Card>
              <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{contractor.notes}</p></CardContent>
            </Card>
          )}

          <Card data-testid="card-contractor-assignments">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Jobsite Assignments ({assignments?.length ?? 0})</CardTitle>
                <Button size="sm" onClick={() => setAssignOpen(true)} data-testid="button-assign-jobsite">
                  <Plus className="h-4 w-4 mr-1" /> Assign Jobsite
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!assignments || assignments.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No jobsite assignments yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jobsite</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map(a => (
                      <TableRow key={a.id} data-testid={`row-assignment-${a.id}`}>
                        <TableCell className="font-medium">
                          <Link href={`/jobsites/${a.jobsiteId}`}>
                            <span className="underline cursor-pointer text-sm">
                              {jobsiteMap.get(a.jobsiteId)?.name ?? a.jobsiteId}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.role ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.startDate ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.endDate ?? "—"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeAssignment.mutate(a.id)}
                            data-testid={`button-remove-assignment-${a.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="px-6 pb-6 max-w-5xl mx-auto">
        <ContactsCard entityType="contractor" entityId={id} title="Contacts" />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Contractor</DialogTitle></DialogHeader>
          <ContractorForm contractor={contractor} onClose={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      <AssignJobsiteDialog
        contractorId={id}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
    </div>
  );
}

function ContractorsList() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);

  const { data: contractors, isLoading } = useQuery<IndependentContractor[]>({
    queryKey: ["/api/contractors"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/contractors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractors"] });
      toast({ title: "Contractor deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const filtered = contractors?.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.licenseType.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  }) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-contractors-title">1099 Contractors</h1>
              <p className="text-sm text-muted-foreground mt-1">Independent contractors with insurance tracking</p>
            </div>
            <Button onClick={() => setAddOpen(true)} data-testid="button-add-contractor">
              <Plus className="h-4 w-4 mr-2" /> Add Contractor
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, license type, email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-contractors"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-contractor-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search || statusFilter !== "all" ? "No contractors match your filters" : "No contractors yet"}</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>License Type</TableHead>
                    <TableHead>PL Insurance</TableHead>
                    <TableHead>GL Insurance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id} className="cursor-pointer" data-testid={`row-contractor-${c.id}`}>
                      <TableCell>
                        <Link href={`/contractors/${c.id}`}>
                          <div className="font-medium hover:underline">{c.name}</div>
                          {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{c.licenseType}</TableCell>
                      <TableCell>
                        <InsuranceBadge label="PL" expiryDate={c.plExpiryDate} />
                      </TableCell>
                      <TableCell>
                        <InsuranceBadge label="GL" expiryDate={c.glExpiryDate} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === "active" ? "default" : "secondary"}>
                          {c.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={e => { e.preventDefault(); deleteMutation.mutate(c.id); }}
                          data-testid={`button-delete-contractor-${c.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Contractor</DialogTitle></DialogHeader>
          <ContractorForm onClose={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ContractorsPage() {
  const [matchDetail, params] = useRoute("/contractors/:id");

  if (matchDetail && params?.id) {
    return <ContractorDetail id={params.id} />;
  }

  return <ContractorsList />;
}
