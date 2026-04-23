import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Mail, Phone, User, Building2, Link2, Pencil } from "lucide-react";
import type { Contact, ContactWithAssociations, InsertContact } from "@shared/schema";
import { insertContactSchema, ENTITY_TYPES } from "@shared/schema";

interface ContactsCardProps {
  entityType: "jobsite" | "client" | "trade_company" | "contractor";
  entityId: string;
  title?: string;
}

type ContactFormValues = InsertContact & { relationship?: string };

export function ContactsCard({ entityType, entityId, title = "Contacts" }: ContactsCardProps) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string>("");
  const [linkRelationship, setLinkRelationship] = useState("");

  const qKey = ["/api/entities", entityType, entityId, "contacts"];

  const { data: contacts, isLoading } = useQuery<ContactWithAssociations[]>({
    queryKey: qKey,
    queryFn: () =>
      fetch(`/api/entities/${entityType}/${entityId}/contacts`).then(r => r.json()),
  });

  const { data: allContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(insertContactSchema.extend({})),
    defaultValues: { name: "", title: "", email: "", phone: "", company: "", notes: "", relationship: "" },
  });

  const editForm = useForm<InsertContact>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: { name: "", title: "", email: "", phone: "", company: "", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ContactFormValues) => {
      const { relationship, ...contactData } = values;
      const res = await apiRequest("POST", "/api/contacts", contactData);
      const contact: Contact = await res.json();
      await apiRequest("POST", `/api/contacts/${contact.id}/associations`, {
        entityType,
        entityId,
        relationship: relationship || undefined,
      });
      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setAddOpen(false);
      form.reset();
      toast({ title: "Contact added" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add contact", variant: "destructive" }),
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/contacts/${selectedLinkId}/associations`, {
        entityType,
        entityId,
        relationship: linkRelationship || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey });
      setLinkOpen(false);
      setSelectedLinkId("");
      setLinkRelationship("");
      toast({ title: "Contact linked" });
    },
    onError: () => toast({ title: "Error", description: "Failed to link contact", variant: "destructive" }),
  });

  const removeAssocMutation = useMutation({
    mutationFn: (assocId: string) =>
      apiRequest("DELETE", `/api/contact-associations/${assocId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey });
      toast({ title: "Contact removed" });
    },
    onError: () => toast({ title: "Error", description: "Failed to remove contact", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertContact }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setEditContact(null);
      toast({ title: "Contact updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update contact", variant: "destructive" }),
  });

  function openEditContact(c: Contact) {
    editForm.reset({
      name: c.name,
      title: c.title ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      notes: c.notes ?? "",
    });
    setEditContact(c);
  }

  const linkedIds = new Set((contacts ?? []).map(c => c.id));
  const unlinkableContacts = (allContacts ?? []).filter(c => !linkedIds.has(c.id));

  return (
    <>
      <Card data-testid="card-contacts">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            {title}
            {contacts && contacts.length > 0 && (
              <Badge variant="secondary" className="text-xs">{contacts.length}</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)} data-testid="button-link-contact">
              <Link2 className="h-4 w-4 mr-1" /> Link Existing
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-contact">
              <Plus className="h-4 w-4 mr-1" /> Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : contacts && contacts.length > 0 ? (
            <div className="space-y-2">
              {contacts.map(c => {
                const assoc = c.associations.find(
                  a => a.entityType === entityType && a.entityId === entityId
                );
                return (
                  <div
                    key={c.id}
                    className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-muted/30"
                    data-testid={`card-contact-${c.id}`}
                  >
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm" data-testid={`text-contact-name-${c.id}`}>{c.name}</span>
                        {assoc?.relationship && (
                          <Badge variant="outline" className="text-xs">{assoc.relationship}</Badge>
                        )}
                        {c.title && (
                          <span className="text-xs text-muted-foreground">{c.title}</span>
                        )}
                      </div>
                      {c.company && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />{c.company}
                        </div>
                      )}
                      <div className="flex items-center gap-3 flex-wrap">
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            data-testid={`link-contact-email-${c.id}`}
                          >
                            <Mail className="h-3 w-3" />{c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                            data-testid={`link-contact-phone-${c.id}`}
                          >
                            <Phone className="h-3 w-3" />{c.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => openEditContact(c)}
                        data-testid={`button-edit-contact-${c.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    {assoc && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeAssocMutation.mutate(assoc.id)}
                        disabled={removeAssocMutation.isPending}
                        data-testid={`button-remove-contact-${c.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No contacts yet. Add one to get started.</p>
          )}
        </CardContent>
      </Card>

      {/* Add New Contact Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input {...field} data-testid="input-contact-name" placeholder="Full name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input {...field} data-testid="input-contact-title" placeholder="e.g. Project Manager" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="company" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl><Input {...field} data-testid="input-contact-company" placeholder="Company name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" data-testid="input-contact-email" placeholder="email@example.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} data-testid="input-contact-phone" placeholder="(555) 555-5555" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="relationship" render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship Label</FormLabel>
                  <FormControl><Input {...field} data-testid="input-contact-relationship" placeholder="e.g. Project Manager, Emergency Contact" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea {...field} data-testid="input-contact-notes" rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-contact">
                  {createMutation.isPending ? "Saving…" : "Save Contact"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Link Existing Contact Dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link Existing Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Contact</label>
              <Select value={selectedLinkId} onValueChange={setSelectedLinkId}>
                <SelectTrigger data-testid="select-link-contact">
                  <SelectValue placeholder="Select a contact…" />
                </SelectTrigger>
                <SelectContent>
                  {unlinkableContacts.length === 0 ? (
                    <SelectItem value="_none" disabled>All contacts already linked</SelectItem>
                  ) : (
                    unlinkableContacts.map(c => (
                      <SelectItem key={c.id} value={c.id} data-testid={`option-contact-${c.id}`}>
                        {c.name}{c.company ? ` — ${c.company}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Relationship Label</label>
              <Input
                value={linkRelationship}
                onChange={e => setLinkRelationship(e.target.value)}
                placeholder="e.g. Project Manager"
                data-testid="input-link-relationship"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button
              disabled={!selectedLinkId || selectedLinkId === "_none" || linkMutation.isPending}
              onClick={() => linkMutation.mutate()}
              data-testid="button-confirm-link-contact"
            >
              {linkMutation.isPending ? "Linking…" : "Link Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editContact} onOpenChange={open => { if (!open) setEditContact(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(data => editContact && updateMutation.mutate({ id: editContact.id, data }))} className="space-y-3">
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
                  <FormControl><Textarea {...field} data-testid="input-edit-contact-notes-card" rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditContact(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-contact-edit">
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
