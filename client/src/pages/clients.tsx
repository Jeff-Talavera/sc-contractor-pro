import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import type { Client, Jobsite } from "@shared/schema";
import { insertClientSchema, insertJobsiteSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Search, Building2, Mail, Phone, User,
  ExternalLink,
} from "lucide-react";

function ClientsList() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  const { data: jobsites } = useQuery<Jobsite[]>({
    queryKey: ["/api/jobsites"],
  });

  const form = useForm({
    resolver: zodResolver(insertClientSchema),
    defaultValues: { name: "", contactName: "", contactEmail: "", contactPhone: "", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/clients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      form.reset();
      setDialogOpen(false);
      toast({ title: "Client created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = clients?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contactName.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const getJobsiteCount = (clientId: string) =>
    jobsites?.filter(j => j.clientId === clientId).length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-clients-title">Clients</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your client accounts and contacts
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-client">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Client</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl><Input {...field} data-testid="input-client-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contactName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl><Input {...field} data-testid="input-contact-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contactEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" {...field} data-testid="input-contact-email" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contactPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl><Input {...field} data-testid="input-contact-phone" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (optional)</FormLabel>
                        <FormControl><Textarea {...field} data-testid="input-client-notes" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-client">
                      {createMutation.isPending ? "Creating..." : "Create Client"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-clients"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "No clients match your search" : "No clients yet"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(client => (
                <Link key={client.id} href={`/clients/${client.id}`}>
                  <Card className="cursor-pointer hover-elevate" data-testid={`card-client-${client.id}`}>
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{client.name}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {client.contactName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {client.contactEmail}
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {getJobsiteCount(client.id)} site{getJobsiteCount(client.id) !== 1 ? "s" : ""}
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
  );
}

const boroughs = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
const projectTypes = ["NB", "ALT", "DEM", "FO"];

function AddJobsiteForm({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm({
    resolver: zodResolver(insertJobsiteSchema),
    defaultValues: {
      clientId,
      name: "",
      address: "",
      borough: "Manhattan",
      bin: "",
      dobJobNumber: "",
      projectType: "NB",
      buildingType: "",
      stories: undefined as number | undefined,
      hasScaffold: false,
      hasHoist: false,
      hasCrane: false,
      hasExcavation: false,
      monitorPublicRecords: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data, stories: data.stories ? Number(data.stories) : undefined };
      const res = await apiRequest("POST", "/api/jobsites", payload);
      return res.json();
    },
    onSuccess: (data: Jobsite) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobsites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "jobsites"] });
      form.reset();
      onClose();
      toast({ title: "Jobsite created" });
      setLocation(`/jobsites/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New Jobsite</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Jobsite Name</FormLabel>
              <FormControl><Input placeholder="e.g., One Vanderbilt Phase 2" {...field} data-testid="input-jobsite-name" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl><Input placeholder="e.g., 1 Vanderbilt Ave" {...field} data-testid="input-jobsite-address" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="borough" render={({ field }) => (
              <FormItem>
                <FormLabel>Borough</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-jobsite-borough">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {boroughs.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField control={form.control} name="bin" render={({ field }) => (
              <FormItem>
                <FormLabel>BIN</FormLabel>
                <FormControl><Input placeholder="e.g., 1015862" {...field} data-testid="input-jobsite-bin" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="dobJobNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>DOB Job #</FormLabel>
                <FormControl><Input placeholder="e.g., 121587643" {...field} data-testid="input-jobsite-dob" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="projectType" render={({ field }) => (
              <FormItem>
                <FormLabel>Project Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-jobsite-project-type">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {projectTypes.map(pt => (
                      <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="buildingType" render={({ field }) => (
              <FormItem>
                <FormLabel>Building Type (optional)</FormLabel>
                <FormControl><Input placeholder="e.g., Commercial" {...field} data-testid="input-jobsite-building-type" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="stories" render={({ field }) => (
              <FormItem>
                <FormLabel>Stories (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="e.g., 42"
                    value={field.value ?? ""}
                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    data-testid="input-jobsite-stories"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <div>
            <p className="text-sm font-medium mb-3">Site Flags</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FormField control={form.control} name="hasScaffold" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-scaffold" />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">Scaffold</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="hasHoist" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-hoist" />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">Hoist</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="hasCrane" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-crane" />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">Crane</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="hasExcavation" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-excavation" />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">Excavation</FormLabel>
                </FormItem>
              )} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-jobsite">
            {createMutation.isPending ? "Creating..." : "Create Jobsite"}
          </Button>
        </form>
      </Form>
    </DialogContent>
  );
}

function ClientDetail({ id }: { id: string }) {
  const [showAddJobsite, setShowAddJobsite] = useState(false);
  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["/api/clients", id],
  });
  const { data: jobsites } = useQuery<Jobsite[]>({
    queryKey: ["/api/clients", id, "jobsites"],
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 text-center text-muted-foreground">Client not found</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/clients">
              <Button variant="ghost" size="icon" data-testid="button-back-clients">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-client-name">{client.name}</h1>
              <p className="text-sm text-muted-foreground">Client details</p>
            </div>
          </div>

          <Card data-testid="card-client-info">
            <CardHeader>
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{client.contactName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${client.contactEmail}`} className="underline">{client.contactEmail}</a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{client.contactPhone}</span>
              </div>
              {client.notes && (
                <p className="text-sm text-muted-foreground pt-2 border-t">{client.notes}</p>
              )}
            </CardContent>
          </Card>

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold" data-testid="text-jobsites-header">
                Jobsites ({jobsites?.length ?? 0})
              </h2>
              <Dialog open={showAddJobsite} onOpenChange={setShowAddJobsite}>
                <Button size="sm" onClick={() => setShowAddJobsite(true)} data-testid="button-add-jobsite-client">
                  <Plus className="h-4 w-4 mr-1" /> Add Jobsite
                </Button>
                {showAddJobsite && <AddJobsiteForm clientId={id} onClose={() => setShowAddJobsite(false)} />}
              </Dialog>
            </div>
            {!jobsites || jobsites.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No jobsites for this client</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobsites.map(job => (
                  <Link key={job.id} href={`/jobsites/${job.id}`}>
                    <Card className="cursor-pointer hover-elevate" data-testid={`card-jobsite-${job.id}`}>
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{job.name}</p>
                          <p className="text-xs text-muted-foreground">{job.address}, {job.borough}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 shrink-0">
                          <Badge variant="secondary">{job.projectType}</Badge>
                          {job.hasScaffold && <Badge variant="outline">Scaffold</Badge>}
                          {job.hasCrane && <Badge variant="outline">Crane</Badge>}
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
    </div>
  );
}

export default function ClientsPage() {
  const [matchDetail, params] = useRoute("/clients/:id");

  if (matchDetail && params?.id) {
    return <ClientDetail id={params.id} />;
  }

  return <ClientsList />;
}
