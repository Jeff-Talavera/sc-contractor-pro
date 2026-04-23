import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Search, Mail, Phone, Building2, Pencil, Trash2, Link2, X } from "lucide-react";
import type { Contact, ContactWithAssociations, InsertContact } from "@shared/schema";
import { insertContactSchema } from "@shared/schema";

const ENTITY_LABELS: Record<string, string> = {
  jobsite: "Jobsite",
  client: "Client",
  trade_company: "Trade Company",
  contractor: "Contractor",
};

function AssociationBadge({ entityType }: { entityType: string }) {
  const colors: Record<string, string> = {
    jobsite: "bg-blue-100 text-blue-800",
    client: "bg-purple-100 text-purple-800",
    trade_company: "bg-amber-100 text-amber-800",
    contractor: "bg-green-100 text-green-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[entityType] ?? "bg-gray-100 text-gray-700"}`}>
      {ENTITY_LABELS[entityType] ?? entityType}
    </span>
  );
}

export default function ContactsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [detailContact, setDetailContact] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addAssocOpen, setAddAssocOpen] = useState(false);
  const [assocEntityType, setAssocEntityType] = useState<string>("");
  const [assocEntityId, setAssocEntityId] = useState<string>("");
  const [assocRelationship, setAssocRelationship] = useState<string>("");

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: counts } = useQuery<Record<string, { count: number; entityTypes: string[] }>>({
    queryKey: ["/api/contacts/counts"],
    queryFn: () => fetch("/api/contacts/counts").then(r => r.json()),
  });

  const { data: detailData, isLoading: detailLoading } = useQuery<ContactWithAssociations>({
    queryKey: ["/api/contacts", detailContact],
    enabled: !!detailContact,
  });

  const { data: jobsites = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/jobsites"] });
  const { data: clients = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/clients"] });
  const { data: tradeCompanies = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/trades"] });
  const { data: contractors = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/contractors"] });

  const entityOptions: { id: string; name: string }[] =
    assocEntityType === "jobsite" ? jobsites :
    assocEntityType === "client" ? clients :
    assocEntityType === "trade_company" ? tradeCompanies :
    assocEntityType === "contractor" ? contractors : [];

  const addForm = useForm<InsertContact>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: { name: "", title: "", email: "", phone: "", company: "", notes: "" },
  });

  const editForm = useForm<InsertContact>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: { name: "", title: "", email: "", phone: "", company: "", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setAddOpen(false);
      addForm.reset();
      toast({ title: "Contact created" });
    },
    onError: () => toast({ title: "Error", description: "Failed to create contact", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      const res = await apiRequest("PATCH", `/api/contacts/${detailContact}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", detailContact] });
      setEditOpen(false);
      toast({ title: "Contact updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update contact", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/counts"] });
      setDetailContact(null);
      toast({ title: "Contact deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" }),
  });

  const removeAssocMutation = useMutation({
    mutationFn: (assocId: string) => apiRequest("DELETE", `/api/contact-associations/${assocId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", detailContact] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/counts"] });
      toast({ title: "Association removed" });
    },
    onError: () => toast({ title: "Error", description: "Failed to remove association", variant: "destructive" }),
  });

  const addAssocMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/contacts/${detailContact}/associations`, {
        entityType: assocEntityType,
        entityId: assocEntityId,
        relationship: assocRelationship || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", detailContact] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/counts"] });
      setAddAssocOpen(false);
      setAssocEntityType("");
      setAssocEntityId("");
      setAssocRelationship("");
      toast({ title: "Association added" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add association", variant: "destructive" }),
  });

  const filtered = (contacts ?? []).filter(c => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q) ||
      (c.title ?? "").toLowerCase().includes(q);
    const matchesEntityFilter =
      filterEntity === "all" ||
      (counts?.[c.id]?.entityTypes ?? []).includes(filterEntity);
    return matchesSearch && matchesEntityFilter;
  });

  function openEdit(contact: ContactWithAssociations) {
    editForm.reset({
      name: contact.name,
      title: contact.title ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      company: contact.company ?? "",
      notes: contact.notes ?? "",
    });
    setEditOpen(true);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-contacts">Contacts</h1>
          <p className="text-muted-foreground text-sm">All people across your projects and clients</p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-contact-global">
          <Plus className="h-4 w-4 mr-2" /> Add Contact
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-contacts-search"
          />
        </div>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-entity">
            <SelectValue placeholder="Filter by entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            <SelectItem value="jobsite">Jobsites</SelectItem>
            <SelectItem value="client">Clients</SelectItem>
            <SelectItem value="trade_company">Trade Companies</SelectItem>
            <SelectItem value="contractor">Contractors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "No contacts match your search." : "No contacts yet. Add one to get started."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Title / Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead># Associations</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailContact(c.id)}
                    data-testid={`row-contact-${c.id}`}
                  >
                    <TableCell className="font-medium" data-testid={`text-contact-name-${c.id}`}>{c.name}</TableCell>
                    <TableCell>
                      <div className="text-sm">{c.title}</div>
                      {c.company && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{c.company}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          onClick={e => e.stopPropagation()}
                          data-testid={`link-email-${c.id}`}
                        >
                          <Mail className="h-3.5 w-3.5" />{c.email}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                    <TableCell data-testid={`text-assoc-count-${c.id}`}>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-sm font-medium">{counts?.[c.id]?.count ?? 0}</span>
                        {(counts?.[c.id]?.entityTypes ?? []).map(et => (
                          <AssociationBadge key={et} entityType={et} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-contact-${c.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Contact Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(v => createMutation.mutate(v))} className="space-y-3">
              <FormField control={addForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input {...field} data-testid="input-new-contact-name" placeholder="Full name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={addForm.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input {...field} data-testid="input-new-contact-title" placeholder="e.g. Project Manager" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="company" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl><Input {...field} data-testid="input-new-contact-company" placeholder="Company name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={addForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" data-testid="input-new-contact-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} data-testid="input-new-contact-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={addForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea {...field} data-testid="input-new-contact-notes" rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-new-contact">
                  {createMutation.isPending ? "Saving…" : "Save Contact"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Contact Detail Sheet */}
      <Sheet open={!!detailContact} onOpenChange={open => { if (!open) { setDetailContact(null); setAddAssocOpen(false); setAssocEntityType(""); setAssocEntityId(""); setAssocRelationship(""); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailLoading ? (
            <div className="space-y-4 pt-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : detailData ? (
            <div className="space-y-6">
              <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <SheetTitle data-testid="text-detail-name">{detailData.name}</SheetTitle>
                    {detailData.title && <p className="text-sm text-muted-foreground mt-1">{detailData.title}</p>}
                    {detailData.company && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />{detailData.company}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(detailData)}
                      data-testid="button-edit-contact"
                    >
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(detailData.id)}
                      disabled={deleteMutation.isPending}
                      data-testid="button-delete-contact-detail"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-2">
                {detailData.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={`mailto:${detailData.email}`} className="text-blue-600 hover:underline">{detailData.email}</a>
                  </div>
                )}
                {detailData.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={`tel:${detailData.phone}`} className="text-muted-foreground hover:underline">{detailData.phone}</a>
                  </div>
                )}
                {detailData.notes && (
                  <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{detailData.notes}</div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    Linked To ({detailData.associations.length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setAddAssocOpen(v => !v); setAssocEntityType(""); setAssocEntityId(""); setAssocRelationship(""); }}
                    data-testid="button-add-assoc"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Link to Entity
                  </Button>
                </div>

                {addAssocOpen && (
                  <div className="mb-3 space-y-2 border rounded p-3 bg-muted/20">
                    <Select value={assocEntityType} onValueChange={v => { setAssocEntityType(v); setAssocEntityId(""); }}>
                      <SelectTrigger data-testid="select-assoc-entity-type">
                        <SelectValue placeholder="Entity type…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jobsite">Jobsite</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="trade_company">Trade Company</SelectItem>
                        <SelectItem value="contractor">Contractor</SelectItem>
                      </SelectContent>
                    </Select>
                    {assocEntityType && (
                      <Select value={assocEntityId} onValueChange={setAssocEntityId}>
                        <SelectTrigger data-testid="select-assoc-entity-id">
                          <SelectValue placeholder="Select entity…" />
                        </SelectTrigger>
                        <SelectContent>
                          {entityOptions.length === 0 ? (
                            <SelectItem value="_none" disabled>No entities found</SelectItem>
                          ) : entityOptions.map(e => (
                            <SelectItem key={e.id} value={e.id} data-testid={`option-entity-${e.id}`}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      value={assocRelationship}
                      onChange={e => setAssocRelationship(e.target.value)}
                      placeholder="Relationship label (optional)"
                      data-testid="input-assoc-relationship"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setAddAssocOpen(false)}>Cancel</Button>
                      <Button
                        size="sm"
                        disabled={!assocEntityType || !assocEntityId || assocEntityId === "_none" || addAssocMutation.isPending}
                        onClick={() => addAssocMutation.mutate()}
                        data-testid="button-save-assoc"
                      >
                        {addAssocMutation.isPending ? "Linking…" : "Link"}
                      </Button>
                    </div>
                  </div>
                )}

                {detailData.associations.length > 0 ? (
                  <div className="space-y-2">
                    {detailData.associations.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 p-2 rounded border bg-muted/30 text-sm"
                        data-testid={`row-assoc-${a.id}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <AssociationBadge entityType={a.entityType} />
                          <span className="text-xs text-muted-foreground font-mono">{a.entityId.slice(0, 8)}…</span>
                          {a.relationship && <span className="text-xs italic text-muted-foreground">"{a.relationship}"</span>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeAssocMutation.mutate(a.id)}
                          disabled={removeAssocMutation.isPending}
                          data-testid={`button-remove-assoc-${a.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">No associations yet.</p>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Edit Contact Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Contact</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(v => updateMutation.mutate(v))} className="space-y-3">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-contact-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editForm.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-contact-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="company" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-contact-company" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" data-testid="input-edit-contact-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-contact-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea {...field} data-testid="input-edit-contact-notes" rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-edit-contact">
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
