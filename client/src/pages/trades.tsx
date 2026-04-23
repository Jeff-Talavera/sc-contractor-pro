import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTradeCompanySchema, type TradeCompany, type InsertTradeCompany, type Jobsite, type JobsiteTradeAssignment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HardHat, Plus, Search, Pencil, Trash2, ArrowLeft, Building2 } from "lucide-react";

const TRADE_TYPES = [
  "Concrete", "Demolition", "Electrical", "Elevator", "Excavation",
  "Fire Protection", "HVAC", "Masonry", "Mechanical", "Plumbing",
  "Roofing", "Scaffold", "Steel / Structural", "Waterproofing", "Other",
];

function expiryBadge(dateStr?: string) {
  if (!dateStr) return <Badge variant="outline" className="text-xs">None</Badge>;
  const expiry = new Date(dateStr);
  const now = new Date();
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
  if (daysLeft < 0)
    return <Badge className="text-xs bg-red-100 text-red-700 border-red-200">Expired</Badge>;
  if (daysLeft <= 30)
    return <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">Exp {dateStr}</Badge>;
  return <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Valid</Badge>;
}

function TradeForm({
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
}: {
  defaultValues?: Partial<InsertTradeCompany>;
  onSubmit: (data: InsertTradeCompany) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const form = useForm<InsertTradeCompany>({
    resolver: zodResolver(insertTradeCompanySchema),
    defaultValues: {
      name: "", tradeType: "", status: "active",
      contactName: "", contactEmail: "", contactPhone: "",
      licenseNumber: "", coiCarrier: "", coiPolicyNumber: "", coiExpiryDate: "",
      wcCarrier: "", wcPolicyNumber: "", wcExpiryDate: "", notes: "",
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Company Name *</FormLabel>
              <FormControl><Input data-testid="input-trade-name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="tradeType" render={({ field }) => (
            <FormItem>
              <FormLabel>Trade Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-trade-type"><SelectValue placeholder="Select trade" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TRADE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-trade-status"><SelectValue /></SelectTrigger>
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

        <p className="text-sm font-semibold text-muted-foreground pt-1">Primary Contact</p>
        <div className="grid grid-cols-3 gap-4">
          <FormField control={form.control} name="contactName" render={({ field }) => (
            <FormItem><FormLabel>Name</FormLabel><FormControl><Input data-testid="input-contact-name" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="contactEmail" render={({ field }) => (
            <FormItem><FormLabel>Email</FormLabel><FormControl><Input data-testid="input-contact-email" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="contactPhone" render={({ field }) => (
            <FormItem><FormLabel>Phone</FormLabel><FormControl><Input data-testid="input-contact-phone" {...field} /></FormControl></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="licenseNumber" render={({ field }) => (
          <FormItem><FormLabel>License Number</FormLabel><FormControl><Input data-testid="input-license-number" {...field} /></FormControl></FormItem>
        )} />

        <p className="text-sm font-semibold text-muted-foreground pt-1">COI (Certificate of Insurance)</p>
        <div className="grid grid-cols-3 gap-4">
          <FormField control={form.control} name="coiCarrier" render={({ field }) => (
            <FormItem><FormLabel>Carrier</FormLabel><FormControl><Input data-testid="input-coi-carrier" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="coiPolicyNumber" render={({ field }) => (
            <FormItem><FormLabel>Policy #</FormLabel><FormControl><Input data-testid="input-coi-policy" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="coiExpiryDate" render={({ field }) => (
            <FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" data-testid="input-coi-expiry" {...field} /></FormControl></FormItem>
          )} />
        </div>

        <p className="text-sm font-semibold text-muted-foreground pt-1">Workers Comp (WC)</p>
        <div className="grid grid-cols-3 gap-4">
          <FormField control={form.control} name="wcCarrier" render={({ field }) => (
            <FormItem><FormLabel>Carrier</FormLabel><FormControl><Input data-testid="input-wc-carrier" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="wcPolicyNumber" render={({ field }) => (
            <FormItem><FormLabel>Policy #</FormLabel><FormControl><Input data-testid="input-wc-policy" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="wcExpiryDate" render={({ field }) => (
            <FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" data-testid="input-wc-expiry" {...field} /></FormControl></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea data-testid="input-trade-notes" {...field} /></FormControl></FormItem>
        )} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" data-testid="button-save-trade" disabled={isPending}>
            {isPending ? "Saving…" : "Save Trade Company"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function TradesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tradeTypeFilter, setTradeTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editTrade, setEditTrade] = useState<TradeCompany | null>(null);
  const [deleteTrade, setDeleteTrade] = useState<TradeCompany | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeCompany | null>(null);

  const { data: trades = [], isLoading } = useQuery<TradeCompany[]>({
    queryKey: ["/api/trades"],
  });

  const { data: counts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/trades/counts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertTradeCompany) => {
      const res = await apiRequest("POST", "/api/trades", data);
      return res.json() as Promise<TradeCompany>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/counts"] });
      setShowCreate(false);
      toast({ title: "Trade company created" });
    },
    onError: () => toast({ title: "Error creating trade company", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertTradeCompany) => {
      const res = await apiRequest("PATCH", `/api/trades/${editTrade?.id}`, data);
      return res.json() as Promise<TradeCompany>;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      if (selectedTrade?.id === editTrade?.id) setSelectedTrade(updated);
      setEditTrade(null);
      toast({ title: "Trade company updated" });
    },
    onError: () => toast({ title: "Error updating trade company", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/trades/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/counts"] });
      if (selectedTrade?.id === deleteTrade?.id) setSelectedTrade(null);
      setDeleteTrade(null);
      toast({ title: "Trade company deleted" });
    },
    onError: () => toast({ title: "Error deleting trade company", variant: "destructive" }),
  });

  const filtered = trades.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.tradeType.toLowerCase().includes(q);
    const matchType = tradeTypeFilter === "all" || t.tradeType === tradeTypeFilter;
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  if (selectedTrade) {
    return (
      <TradeDetail
        trade={selectedTrade}
        onBack={() => setSelectedTrade(null)}
        onTradeUpdated={(updated) => {
          setSelectedTrade(updated);
          queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trades/counts"] });
        }}
        onTradeDeleted={() => {
          setSelectedTrade(null);
          queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trades/counts"] });
        }}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HardHat className="h-7 w-7 text-cobalt" />
          <div>
            <h1 className="text-2xl font-bold">Trades & Subcontractors</h1>
            <p className="text-sm text-muted-foreground">Firm-wide directory of trade companies</p>
          </div>
        </div>
        <Button data-testid="button-add-trade" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Trade Company
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-trades"
            placeholder="Search trades…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={tradeTypeFilter} onValueChange={setTradeTypeFilter}>
          <SelectTrigger data-testid="select-filter-type" className="w-48">
            <SelectValue placeholder="All trades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All trade types</SelectItem>
            {TRADE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-filter-status" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {trades.length === 0 ? "No trade companies yet. Add your first one." : "No results match your filters."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Trade Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>COI Status</TableHead>
                  <TableHead>WC Status</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(trade => (
                  <TableRow
                    key={trade.id}
                    data-testid={`row-trade-${trade.id}`}
                    className="cursor-pointer"
                    onClick={() => setSelectedTrade(trade)}
                  >
                    <TableCell className="font-medium">{trade.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{trade.tradeType}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {trade.contactName || "—"}
                    </TableCell>
                    <TableCell>{expiryBadge(trade.coiExpiryDate)}</TableCell>
                    <TableCell>{expiryBadge(trade.wcExpiryDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`text-project-count-${trade.id}`}>
                      {counts[trade.id] ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={trade.status === "active" ? "default" : "secondary"}
                        className="text-xs capitalize"
                      >
                        {trade.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost" size="icon"
                          data-testid={`button-edit-trade-${trade.id}`}
                          onClick={() => setEditTrade(trade)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          data-testid={`button-delete-trade-${trade.id}`}
                          onClick={() => setDeleteTrade(trade)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Trade Company</DialogTitle></DialogHeader>
          <TradeForm
            onSubmit={d => createMutation.mutate(d)}
            isPending={createMutation.isPending}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTrade} onOpenChange={o => { if (!o) setEditTrade(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Trade Company</DialogTitle></DialogHeader>
          {editTrade && (
            <TradeForm
              defaultValues={editTrade}
              onSubmit={d => updateMutation.mutate(d)}
              isPending={updateMutation.isPending}
              onCancel={() => setEditTrade(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTrade} onOpenChange={o => { if (!o) setDeleteTrade(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTrade?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this trade company and all jobsite assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-trade"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTrade && deleteMutation.mutate(deleteTrade.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AssignToJobsiteDialog({
  tradeId,
  open,
  onOpenChange,
}: {
  tradeId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const [selectedJobsiteId, setSelectedJobsiteId] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");

  const { data: jobsites = [] } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });
  const { data: existingAssignments = [] } = useQuery<JobsiteTradeAssignment[]>({
    queryKey: ["/api/trades", tradeId, "assignments"],
  });

  const assignedJobsiteIds = new Set(existingAssignments.map(a => a.jobsiteId));
  const availableJobsites = jobsites.filter(j => !assignedJobsiteIds.has(j.id));

  const assignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/trades/${tradeId}/assign`, {
        jobsiteId: selectedJobsiteId,
        scopeOfWork: scopeOfWork || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades", tradeId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobsites"] });
      setSelectedJobsiteId("");
      setScopeOfWork("");
      onOpenChange(false);
      toast({ title: "Assigned to jobsite" });
    },
    onError: () => toast({ title: "Error assigning to jobsite", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign to Jobsite</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Jobsite *</label>
            <Select value={selectedJobsiteId} onValueChange={setSelectedJobsiteId}>
              <SelectTrigger data-testid="select-assign-jobsite" className="mt-1">
                <SelectValue placeholder="Select a jobsite…" />
              </SelectTrigger>
              <SelectContent>
                {availableJobsites.length === 0 ? (
                  <SelectItem value="_none" disabled>All jobsites already assigned</SelectItem>
                ) : (
                  availableJobsites.map(j => (
                    <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Scope of Work</label>
            <Input
              className="mt-1"
              data-testid="input-scope-of-work"
              placeholder="e.g. Electrical rough-in and finish"
              value={scopeOfWork}
              onChange={e => setScopeOfWork(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            data-testid="button-confirm-assign"
            disabled={!selectedJobsiteId || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            {assignMutation.isPending ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TradeDetail({
  trade,
  onBack,
  onTradeUpdated,
  onTradeDeleted,
}: {
  trade: TradeCompany;
  onBack: () => void;
  onTradeUpdated: (t: TradeCompany) => void;
  onTradeDeleted: () => void;
}) {
  const { toast } = useToast();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: assignments = [] } = useQuery<JobsiteTradeAssignment[]>({
    queryKey: ["/api/trades", trade.id, "assignments"],
  });
  const { data: jobsites = [] } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });
  const jobsiteMap = new Map(jobsites.map(j => [j.id, j]));

  const updateMutation = useMutation({
    mutationFn: async (data: InsertTradeCompany) => {
      const res = await apiRequest("PATCH", `/api/trades/${trade.id}`, data);
      return res.json() as Promise<TradeCompany>;
    },
    onSuccess: (updated) => {
      setShowEdit(false);
      onTradeUpdated(updated);
      toast({ title: "Trade company updated" });
    },
    onError: () => toast({ title: "Error updating trade company", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/trades/${trade.id}`),
    onSuccess: () => {
      onTradeDeleted();
      toast({ title: "Trade company deleted" });
    },
    onError: () => toast({ title: "Error deleting trade company", variant: "destructive" }),
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) => apiRequest("DELETE", `/api/jobsite-trade-assignments/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades", trade.id, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/counts"] });
      setRemovingId(null);
      toast({ title: "Assignment removed" });
    },
    onError: () => toast({ title: "Error removing assignment", variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-trades">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-trade-name">{trade.name}</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant="secondary">{trade.tradeType}</Badge>
            <Badge variant={trade.status === "active" ? "default" : "secondary"} className="capitalize">
              {trade.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} data-testid="button-edit-trade">
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)} data-testid="button-delete-trade">
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Contact Information</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Name:</span> {trade.contactName || "—"}</div>
            <div><span className="text-muted-foreground">Email:</span> {trade.contactEmail || "—"}</div>
            <div><span className="text-muted-foreground">Phone:</span> {trade.contactPhone || "—"}</div>
            <div><span className="text-muted-foreground">License #:</span> {trade.licenseNumber || "—"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Insurance</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">COI</span>
                {expiryBadge(trade.coiExpiryDate)}
              </div>
              <div className="text-muted-foreground">
                {trade.coiCarrier ? `${trade.coiCarrier} — ${trade.coiPolicyNumber || "—"}` : "No COI on file"}
              </div>
              {trade.coiExpiryDate && <div className="text-muted-foreground">Expires: {trade.coiExpiryDate}</div>}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">Workers Comp</span>
                {expiryBadge(trade.wcExpiryDate)}
              </div>
              <div className="text-muted-foreground">
                {trade.wcCarrier ? `${trade.wcCarrier} — ${trade.wcPolicyNumber || "—"}` : "No WC on file"}
              </div>
              {trade.wcExpiryDate && <div className="text-muted-foreground">Expires: {trade.wcExpiryDate}</div>}
            </div>
          </CardContent>
        </Card>

        {trade.notes && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-sm font-semibold">Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{trade.notes}</p></CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Jobsite Assignments
            </CardTitle>
            <Button size="sm" data-testid="button-assign-jobsite" onClick={() => setShowAssign(true)}>
              <Plus className="h-4 w-4 mr-1" /> Assign to Jobsite
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No jobsite assignments yet
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map(a => {
                const jobsite = jobsiteMap.get(a.jobsiteId);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg" data-testid={`card-assignment-${a.id}`}>
                    <div>
                      <p className="text-sm font-medium">{jobsite?.name ?? a.jobsiteId}</p>
                      {a.scopeOfWork && <p className="text-xs text-muted-foreground">{a.scopeOfWork}</p>}
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      data-testid={`button-remove-assignment-${a.id}`}
                      onClick={() => setRemovingId(a.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AssignToJobsiteDialog
        tradeId={trade.id}
        open={showAssign}
        onOpenChange={setShowAssign}
      />

      <Dialog open={showEdit} onOpenChange={o => { if (!o) setShowEdit(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Trade Company</DialogTitle></DialogHeader>
          <TradeForm
            defaultValues={trade}
            onSubmit={d => updateMutation.mutate(d)}
            isPending={updateMutation.isPending}
            onCancel={() => setShowEdit(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {trade.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this trade company and all jobsite assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-trade"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removingId} onOpenChange={o => { if (!o) setRemovingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this trade company from the jobsite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-remove-assignment"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => removingId && removeAssignmentMutation.mutate(removingId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
