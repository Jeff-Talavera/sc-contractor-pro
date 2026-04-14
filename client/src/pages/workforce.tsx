import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import type { EmployeeProfile, ScheduleEntry, Timesheet, TimesheetEntry, User, Jobsite, InsertEmployeeProfile, InsertScheduleEntry, InsertTimesheet, InsertTimesheetEntry } from "@shared/schema";
import { insertEmployeeProfileSchema, insertScheduleEntrySchema, insertTimesheetSchema, insertTimesheetEntrySchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Search, UserCog, Phone, Mail, Calendar,
  Clock, ChevronLeft, ChevronRight, Award, Shield, MapPin,
  CheckCircle2, XCircle, AlertCircle, FileText, Send, ThumbsUp,
  Pencil, Ban,
} from "lucide-react";

const statusColors: Record<string, string> = {
  Active: "bg-green-500/15 text-green-700 dark:text-green-400",
  Inactive: "bg-destructive/15 text-destructive",
  "On Leave": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

const scheduleStatusColors: Record<string, string> = {
  Scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Confirmed: "bg-green-500/15 text-green-700 dark:text-green-400",
  Completed: "bg-muted text-muted-foreground",
  Cancelled: "bg-destructive/15 text-destructive",
};

const tsStatusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Submitted: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Approved: "bg-green-500/15 text-green-700 dark:text-green-400",
  Rejected: "bg-destructive/15 text-destructive",
};

function getWeekDates(baseDate: Date): string[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    dates.push(dd.toISOString().split("T")[0]);
  }
  return dates;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDayShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const result = new Date(d);
  result.setDate(d.getDate() - ((day + 6) % 7));
  return result;
}

function AddEmployeeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: employees } = useQuery<EmployeeProfile[]>({ queryKey: ["/api/employees"] });

  const existingUserIds = new Set(employees?.map(e => e.userId) ?? []);
  const availableUsers = users?.filter(u => !existingUserIds.has(u.id)) ?? [];

  const form = useForm({
    resolver: zodResolver(insertEmployeeProfileSchema),
    defaultValues: {
      userId: "",
      title: "",
      phone: "",
      hireDate: new Date().toISOString().split("T")[0],
      status: "Active" as const,
      certifications: [] as string[],
      licenseNumbers: {} as Record<string, string>,
      emergencyContact: "",
      emergencyPhone: "",
      hourlyRate: undefined as number | undefined,
      notes: "",
    },
  });

  const [certInput, setCertInput] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseVal, setLicenseVal] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: InsertEmployeeProfile) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      form.reset();
      setCertInput("");
      onOpenChange(false);
      toast({ title: "Employee profile created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="userId" render={({ field }) => (
              <FormItem>
                <FormLabel>User Account</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-employee-user">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title</FormLabel>
                <FormControl><Input placeholder="e.g., Site Safety Manager" {...field} data-testid="input-employee-title" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="(555) 555-0000" {...field} data-testid="input-employee-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hireDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hire Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-employee-hire-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-employee-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hourlyRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hourly Rate (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 75"
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      data-testid="input-employee-rate"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Certifications</p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., OSHA-30"
                  value={certInput}
                  onChange={e => setCertInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && certInput.trim()) {
                      e.preventDefault();
                      const current = form.getValues("certifications");
                      form.setValue("certifications", [...current, certInput.trim()]);
                      setCertInput("");
                    }
                  }}
                  data-testid="input-certification"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (certInput.trim()) {
                      const current = form.getValues("certifications");
                      form.setValue("certifications", [...current, certInput.trim()]);
                      setCertInput("");
                    }
                  }}
                  data-testid="button-add-cert"
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {form.watch("certifications").map((cert, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {cert}
                    <button
                      type="button"
                      className="ml-1 hover:text-destructive"
                      onClick={() => {
                        const current = form.getValues("certifications");
                        form.setValue("certifications", current.filter((_, idx) => idx !== i));
                      }}
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">License Numbers</p>
              <div className="flex gap-2">
                <Input
                  placeholder="License type (e.g., SST Card)"
                  value={licenseKey}
                  onChange={e => setLicenseKey(e.target.value)}
                  className="flex-1"
                  data-testid="input-license-key"
                />
                <Input
                  placeholder="Number"
                  value={licenseVal}
                  onChange={e => setLicenseVal(e.target.value)}
                  className="flex-1"
                  data-testid="input-license-val"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (licenseKey.trim() && licenseVal.trim()) {
                      const current = form.getValues("licenseNumbers");
                      form.setValue("licenseNumbers", { ...current, [licenseKey.trim()]: licenseVal.trim() });
                      setLicenseKey("");
                      setLicenseVal("");
                    }
                  }}
                  data-testid="button-add-license"
                >
                  Add
                </Button>
              </div>
              <div className="space-y-1 mt-2">
                {Object.entries(form.watch("licenseNumbers")).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                    <span>{key}: <span className="font-mono text-xs">{val}</span></span>
                    <button
                      type="button"
                      className="hover:text-destructive"
                      onClick={() => {
                        const current = { ...form.getValues("licenseNumbers") };
                        delete current[key];
                        form.setValue("licenseNumbers", current);
                      }}
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="emergencyContact" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact</FormLabel>
                  <FormControl><Input {...field} data-testid="input-emergency-contact" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="emergencyPhone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Phone</FormLabel>
                  <FormControl><Input {...field} data-testid="input-emergency-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl><Textarea {...field} data-testid="input-employee-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-employee">
              {mutation.isPending ? "Creating..." : "Add Employee"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DirectoryTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);

  const { data: employees, isLoading } = useQuery<EmployeeProfile[]>({ queryKey: ["/api/employees"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const userMap = new Map(users?.map(u => [u.id, u]) ?? []);

  const filtered = useMemo(() => {
    let result = employees ?? [];
    if (statusFilter !== "all") {
      result = result.filter(e => e.status === statusFilter);
    }
    if (roleFilter !== "all") {
      result = result.filter(e => {
        const user = userMap.get(e.userId);
        return user?.role === roleFilter;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e => {
        const user = userMap.get(e.userId);
        return (
          user?.name.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q) ||
          e.certifications.some(c => c.toLowerCase().includes(q))
        );
      });
    }
    return result;
  }, [employees, search, statusFilter, roleFilter, userMap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, title, or certification..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-employees"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="On Leave">On Leave</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-role-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="Owner">Owner</SelectItem>
            <SelectItem value="Admin">Admin</SelectItem>
            <SelectItem value="Inspector">Inspector</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-employee">
          <Plus className="h-4 w-4 mr-2" /> Add Employee
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <UserCog className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search || statusFilter !== "all" || roleFilter !== "all" ? "No employees match your filters" : "No employee profiles yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(emp => {
            const user = userMap.get(emp.userId);
            return (
              <Link key={emp.id} href={`/workforce/${emp.id}`}>
                <Card className="cursor-pointer hover-elevate" data-testid={`card-employee-${emp.id}`}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UserCog className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{user?.name ?? "Unknown"}</p>
                        <Badge className={statusColors[emp.status]}>{emp.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{emp.title}</p>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {emp.phone}</span>
                        <span className="flex items-center gap-1"><Award className="h-3 w-3" /> {emp.certifications.length} cert{emp.certifications.length !== 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Hired {formatDate(emp.hireDate)}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{user?.role}</Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AssignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { data: employees } = useQuery<EmployeeProfile[]>({ queryKey: ["/api/employees"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: jobsites } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });

  const userMap = new Map(users?.map(u => [u.id, u]) ?? []);

  const form = useForm({
    resolver: zodResolver(insertScheduleEntrySchema),
    defaultValues: {
      employeeId: "",
      jobsiteId: "",
      date: new Date().toISOString().split("T")[0],
      shiftStart: "07:00",
      shiftEnd: "15:00",
      status: "Scheduled" as const,
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertScheduleEntry) => {
      const res = await apiRequest("POST", "/api/schedule", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      form.reset();
      onOpenChange(false);
      toast({ title: "Assignment created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Assignment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="employeeId" render={({ field }) => (
              <FormItem>
                <FormLabel>Employee</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-assign-employee">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {employees?.filter(e => e.status === "Active").map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{userMap.get(emp.userId)?.name ?? emp.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="jobsiteId" render={({ field }) => (
              <FormItem>
                <FormLabel>Jobsite</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-assign-jobsite">
                      <SelectValue placeholder="Select jobsite" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {jobsites?.map(j => (
                      <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl><Input type="date" {...field} data-testid="input-assign-date" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid gap-4 grid-cols-2">
              <FormField control={form.control} name="shiftStart" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift Start</FormLabel>
                  <FormControl><Input type="time" {...field} data-testid="input-shift-start" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="shiftEnd" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift End</FormLabel>
                  <FormControl><Input type="time" {...field} data-testid="input-shift-end" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl><Textarea {...field} data-testid="input-assign-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-assignment">
              {mutation.isPending ? "Creating..." : "Create Assignment"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleTab() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  const { toast } = useToast();

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
  const startDate = weekDates[0];
  const endDate = weekDates[6];

  const { data: schedule, isLoading } = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/schedule?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
  });
  const { data: employees } = useQuery<EmployeeProfile[]>({ queryKey: ["/api/employees"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: jobsites } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });

  const userMap = new Map(users?.map(u => [u.id, u]) ?? []);
  const jobsiteMap = new Map(jobsites?.map(j => [j.id, j]) ?? []);

  const activeEmployees = employees?.filter(e => e.status === "Active") ?? [];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/schedule/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const getEntriesForCell = (employeeId: string, date: string) =>
    schedule?.filter(s => s.employeeId === employeeId && s.date === date) ?? [];

  const nextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
      Scheduled: "Confirmed",
      Confirmed: "Completed",
    };
    return flow[current] ?? null;
  };

  const mondayDate = getMonday(baseDate);
  const weekLabel = `Week of ${mondayDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)} data-testid="button-prev-week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center" data-testid="text-week-label">{weekLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)} data-testid="button-next-week">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} data-testid="button-today">
            Today
          </Button>
        </div>
        <Button onClick={() => setAssignOpen(true)} data-testid="button-new-assignment">
          <Plus className="h-4 w-4 mr-2" /> Assign
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left text-xs font-medium p-2 w-[140px] sticky left-0 bg-muted/50">Employee</th>
                {weekDates.map(date => (
                  <th key={date} className="text-center text-xs font-medium p-2">
                    <div>{formatDayShort(date)}</div>
                    <div className="text-muted-foreground">{formatDate(date)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map(emp => (
                <tr key={emp.id} className="border-b last:border-b-0">
                  <td className="p-2 text-sm font-medium sticky left-0 bg-background">
                    {userMap.get(emp.userId)?.name ?? "Unknown"}
                  </td>
                  {weekDates.map(date => {
                    const entries = getEntriesForCell(emp.id, date);
                    return (
                      <td key={date} className="p-1 align-top min-w-[80px]">
                        {entries.map(entry => {
                          const jobsite = jobsiteMap.get(entry.jobsiteId);
                          const next = nextStatus(entry.status);
                          const canCancel = entry.status === "Scheduled" || entry.status === "Confirmed";
                          return (
                            <div
                              key={entry.id}
                              className={`rounded px-1.5 py-1 mb-1 text-xs ${scheduleStatusColors[entry.status]} group relative`}
                              data-testid={`schedule-chip-${entry.id}`}
                            >
                              <div
                                className={`font-medium truncate ${next ? "cursor-pointer" : ""}`}
                                onClick={() => {
                                  if (next) updateStatusMutation.mutate({ id: entry.id, status: next });
                                }}
                                title={next ? `Click to mark ${next}` : entry.status}
                              >
                                {jobsite?.name ?? "Unknown"}
                              </div>
                              {entry.shiftStart && (
                                <div className="text-[10px] opacity-75">{entry.shiftStart}{entry.shiftEnd ? `–${entry.shiftEnd}` : ""}</div>
                              )}
                              {canCancel && (
                                <button
                                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-[10px] hidden group-hover:flex"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({ id: entry.id, status: "Cancelled" });
                                  }}
                                  title="Cancel assignment"
                                  data-testid={`button-cancel-${entry.id}`}
                                >
                                  <Ban className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500/15 inline-block" /> Scheduled</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500/15 inline-block" /> Confirmed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted inline-block" /> Completed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/15 inline-block" /> Cancelled</span>
        <span className="ml-auto">Click a chip to advance its status</span>
      </div>

      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} />
    </div>
  );
}

function NewTimesheetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { data: employees } = useQuery<EmployeeProfile[]>({ queryKey: ["/api/employees"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const userMap = new Map(users?.map(u => [u.id, u]) ?? []);

  const mondayStr = getMonday(new Date()).toISOString().split("T")[0];

  const form = useForm({
    resolver: zodResolver(insertTimesheetSchema),
    defaultValues: {
      employeeId: "",
      weekStartDate: mondayStr,
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertTimesheet) => {
      const res = await apiRequest("POST", "/api/timesheets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      form.reset();
      onOpenChange(false);
      toast({ title: "Timesheet created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Timesheet</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="employeeId" render={({ field }) => (
              <FormItem>
                <FormLabel>Employee</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-ts-employee">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {employees?.filter(e => e.status === "Active").map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{userMap.get(emp.userId)?.name ?? emp.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="weekStartDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Week Starting (Monday)</FormLabel>
                <FormControl><Input type="date" {...field} data-testid="input-ts-week-start" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl><Textarea {...field} data-testid="input-ts-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-timesheet">
              {mutation.isPending ? "Creating..." : "Create Timesheet"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TimesheetDetail({ timesheet, onBack }: { timesheet: Timesheet; onBack: () => void }) {
  const { toast } = useToast();
  const { data: entries, isLoading: entriesLoading } = useQuery<TimesheetEntry[]>({
    queryKey: ["/api/timesheets", timesheet.id, "entries"],
  });
  const { data: employees } = useQuery<EmployeeProfile[]>({ queryKey: ["/api/employees"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: jobsites } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });

  const userMap = new Map(users?.map(u => [u.id, u]) ?? []);
  const jobsiteMap = new Map(jobsites?.map(j => [j.id, j]) ?? []);
  const emp = employees?.find(e => e.id === timesheet.employeeId);

  const weekDates = useMemo(() => {
    const d = new Date(timesheet.weekStartDate + "T00:00:00");
    return getWeekDates(d);
  }, [timesheet.weekStartDate]);

  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [addJobsite, setAddJobsite] = useState("");
  const [addHours, setAddHours] = useState("");
  const [addDesc, setAddDesc] = useState("");

  const addEntryMutation = useMutation({
    mutationFn: async (data: InsertTimesheetEntry) => {
      const res = await apiRequest("POST", "/api/timesheet-entries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets", timesheet.id, "entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      setAddingDate(null);
      setAddJobsite("");
      setAddHours("");
      setAddDesc("");
      toast({ title: "Entry added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/timesheet-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets", timesheet.id, "entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast({ title: "Entry removed" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/timesheets/${timesheet.id}`, {
        status: "Submitted",
        submittedAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast({ title: "Timesheet submitted for approval" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/timesheets/${timesheet.id}`, {
        status: "Approved",
        approvedAt: new Date().toISOString(),
        approvedBy: "user-1",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast({ title: "Timesheet approved" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/timesheets/${timesheet.id}`, { status: "Rejected" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      toast({ title: "Timesheet rejected" });
    },
  });

  const getEntriesForDate = (date: string) => entries?.filter(e => e.date === date) ?? [];
  const totalHours = entries?.reduce((sum, e) => sum + e.hours, 0) ?? 0;
  const isDraft = timesheet.status === "Draft";
  const isSubmitted = timesheet.status === "Submitted";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-timesheets">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold" data-testid="text-ts-employee-name">
              {userMap.get(emp?.userId ?? "")?.name ?? "Unknown"}
            </h3>
            <Badge className={tsStatusColors[timesheet.status]}>{timesheet.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Week of {formatDate(timesheet.weekStartDate)} &middot; {totalHours}h total
          </p>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <Button size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} data-testid="button-submit-ts">
              <Send className="h-4 w-4 mr-1" /> Submit
            </Button>
          )}
          {isSubmitted && (
            <>
              <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending} data-testid="button-reject-ts">
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
              <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} data-testid="button-approve-ts">
                <ThumbsUp className="h-4 w-4 mr-1" /> Approve
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {entriesLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-2">
          {weekDates.map(date => {
            const dayEntries = getEntriesForDate(date);
            const dayTotal = dayEntries.reduce((s, e) => s + e.hours, 0);
            return (
              <div key={date} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    {formatDayShort(date)} {formatDate(date)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{dayTotal}h</span>
                    {isDraft && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setAddingDate(addingDate === date ? null : date)}
                        data-testid={`button-add-entry-${date}`}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    )}
                  </div>
                </div>
                {dayEntries.length > 0 && (
                  <div className="space-y-1">
                    {dayEntries.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1" data-testid={`entry-${entry.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{entry.jobsiteId ? (jobsiteMap.get(entry.jobsiteId)?.name ?? "Unknown") : "No jobsite"}</span>
                          {entry.description && <span className="text-xs text-muted-foreground truncate">- {entry.description}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium">{entry.hours}h</span>
                          {isDraft && (
                            <button
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => deleteEntryMutation.mutate(entry.id)}
                              data-testid={`button-delete-entry-${entry.id}`}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {addingDate === date && (
                  <div className="mt-2 flex flex-wrap gap-2 items-end">
                    <Select value={addJobsite} onValueChange={setAddJobsite}>
                      <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="select-entry-jobsite">
                        <SelectValue placeholder="Jobsite" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobsites?.map(j => (
                          <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Hours"
                      className="w-20 h-8 text-xs"
                      value={addHours}
                      onChange={e => setAddHours(e.target.value)}
                      data-testid="input-entry-hours"
                    />
                    <Input
                      placeholder="Description (optional)"
                      className="flex-1 h-8 text-xs min-w-[120px]"
                      value={addDesc}
                      onChange={e => setAddDesc(e.target.value)}
                      data-testid="input-entry-desc"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={!addHours}
                      onClick={() => {
                        addEntryMutation.mutate({
                          timesheetId: timesheet.id,
                          date,
                          jobsiteId: addJobsite || undefined,
                          hours: Number(addHours),
                          description: addDesc || undefined,
                        });
                      }}
                      data-testid="button-save-entry"
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimesheetsTab() {
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [selectedTs, setSelectedTs] = useState<Timesheet | null>(null);

  const { data: timesheets, isLoading } = useQuery<Timesheet[]>({ queryKey: ["/api/timesheets"] });
  const { data: employees } = useQuery<EmployeeProfile[]>({ queryKey: ["/api/employees"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const userMap = new Map(users?.map(u => [u.id, u]) ?? []);
  const empMap = new Map(employees?.map(e => [e.id, e]) ?? []);

  const filtered = useMemo(() => {
    let result = timesheets ?? [];
    if (employeeFilter !== "all") {
      result = result.filter(ts => ts.employeeId === employeeFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter(ts => ts.status === statusFilter);
    }
    return result.sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  }, [timesheets, employeeFilter, statusFilter]);

  const freshTs = selectedTs ? timesheets?.find(ts => ts.id === selectedTs.id) ?? selectedTs : null;

  if (freshTs) {
    return <TimesheetDetail timesheet={freshTs} onBack={() => setSelectedTs(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-ts-filter-employee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees?.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{userMap.get(emp.userId)?.name ?? emp.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-ts-filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Submitted">Submitted</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => setNewOpen(true)} data-testid="button-new-timesheet">
          <Plus className="h-4 w-4 mr-2" /> New Timesheet
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{employeeFilter !== "all" || statusFilter !== "all" ? "No timesheets match your filters" : "No timesheets yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ts => {
            const emp = empMap.get(ts.employeeId);
            const user = userMap.get(emp?.userId ?? "");
            return (
              <Card
                key={ts.id}
                className="cursor-pointer hover-elevate"
                onClick={() => setSelectedTs(ts)}
                data-testid={`card-timesheet-${ts.id}`}
              >
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{user?.name ?? "Unknown"}</p>
                      <Badge className={tsStatusColors[ts.status]}>{ts.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Week of {formatDate(ts.weekStartDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {ts.totalHours}h
                      </span>
                      {ts.submittedAt && (
                        <span>Submitted {new Date(ts.submittedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  {ts.status === "Submitted" && (
                    <Badge variant="outline" className="shrink-0">Needs Review</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NewTimesheetDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

function EditEmployeeDialog({ employee, open, onOpenChange }: { employee: EmployeeProfile; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [editLicenses, setEditLicenses] = useState<Record<string, string>>({ ...employee.licenseNumbers });
  const [editLicKey, setEditLicKey] = useState("");
  const [editLicVal, setEditLicVal] = useState("");
  const editSchema = z.object({
    title: z.string().min(1, "Title is required"),
    phone: z.string().min(1, "Phone is required"),
    status: z.string(),
    hireDate: z.string().min(1, "Hire date is required"),
    hourlyRate: z.coerce.number().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().optional(),
    certifications: z.string(),
    notes: z.string().optional(),
  });
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: employee.title,
      phone: employee.phone,
      status: employee.status,
      hireDate: employee.hireDate,
      hourlyRate: employee.hourlyRate ?? undefined,
      emergencyContact: employee.emergencyContact ?? "",
      emergencyPhone: employee.emergencyPhone ?? "",
      certifications: employee.certifications.join(", "),
      notes: employee.notes ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof editSchema>) => {
      const payload = {
        title: values.title,
        phone: values.phone,
        status: values.status,
        hireDate: values.hireDate,
        hourlyRate: values.hourlyRate ?? null,
        emergencyContact: values.emergencyContact || null,
        emergencyPhone: values.emergencyPhone || null,
        certifications: values.certifications.split(",").map(c => c.trim()).filter(Boolean),
        licenseNumbers: editLicenses,
        notes: values.notes || null,
      };
      const res = await apiRequest("PATCH", `/api/employees/${employee.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee updated" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} data-testid="input-edit-title" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} data-testid="input-edit-phone" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem><FormLabel>Status</FormLabel><FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="hireDate" render={({ field }) => (
              <FormItem><FormLabel>Hire Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-edit-hiredate" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="hourlyRate" render={({ field }) => (
              <FormItem><FormLabel>Hourly Rate ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} data-testid="input-edit-rate" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="emergencyContact" render={({ field }) => (
              <FormItem><FormLabel>Emergency Contact</FormLabel><FormControl><Input {...field} data-testid="input-edit-emergency" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="emergencyPhone" render={({ field }) => (
              <FormItem><FormLabel>Emergency Phone</FormLabel><FormControl><Input {...field} data-testid="input-edit-emergencyphone" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="certifications" render={({ field }) => (
              <FormItem><FormLabel>Certifications (comma-separated)</FormLabel><FormControl><Input {...field} data-testid="input-edit-certs" /></FormControl><FormMessage /></FormItem>
            )} />
            <div>
              <p className="text-sm font-medium mb-2">License Numbers</p>
              <div className="flex gap-2">
                <Input placeholder="License type" value={editLicKey} onChange={e => setEditLicKey(e.target.value)} className="flex-1" data-testid="input-edit-lic-key" />
                <Input placeholder="Number" value={editLicVal} onChange={e => setEditLicVal(e.target.value)} className="flex-1" data-testid="input-edit-lic-val" />
                <Button type="button" variant="secondary" size="sm" onClick={() => {
                  if (editLicKey.trim() && editLicVal.trim()) {
                    setEditLicenses(prev => ({ ...prev, [editLicKey.trim()]: editLicVal.trim() }));
                    setEditLicKey("");
                    setEditLicVal("");
                  }
                }} data-testid="button-edit-add-license">Add</Button>
              </div>
              <div className="space-y-1 mt-2">
                {Object.entries(editLicenses).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                    <span>{key}: <span className="font-mono text-xs">{val}</span></span>
                    <button type="button" className="hover:text-destructive" onClick={() => {
                      setEditLicenses(prev => { const n = { ...prev }; delete n[key]; return n; });
                    }}><XCircle className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} data-testid="input-edit-notes" /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-employee">
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeDetail({ id }: { id: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const { data: employee, isLoading } = useQuery<EmployeeProfile>({
    queryKey: ["/api/employees", id],
  });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: schedule } = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule/employee", id],
    queryFn: async () => {
      const res = await fetch(`/api/schedule/employee/${id}`);
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
  });
  const { data: jobsites } = useQuery<Jobsite[]>({ queryKey: ["/api/jobsites"] });

  const userMap = new Map(users?.map(u => [u.id, u]) ?? []);
  const jobsiteMap = new Map(jobsites?.map(j => [j.id, j]) ?? []);

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!employee) {
    return <div className="p-6 text-center text-muted-foreground">Employee not found</div>;
  }

  const user = userMap.get(employee.userId);
  const today = new Date().toISOString().split("T")[0];
  const upcomingSchedule = schedule
    ?.filter(s => s.date >= today && s.status !== "Cancelled")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/workforce">
              <Button variant="ghost" size="icon" data-testid="button-back-workforce">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold" data-testid="text-employee-name">{user?.name ?? "Unknown"}</h1>
                <Badge className={statusColors[employee.status]}>{employee.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{employee.title}</p>
            </div>
            <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="button-edit-employee">
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </Button>
          </div>

          <EditEmployeeDialog employee={employee} open={editOpen} onOpenChange={setEditOpen} />

          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-employee-contact">
              <CardHeader>
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${user?.email}`} className="underline">{user?.email}</a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Hired {formatDate(employee.hireDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>{user?.role}</span>
                </div>
                {employee.hourlyRate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>${employee.hourlyRate}/hr</span>
                  </div>
                )}
                {employee.notes && (
                  <p className="text-sm text-muted-foreground pt-2 border-t">{employee.notes}</p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-employee-emergency">
              <CardHeader>
                <CardTitle className="text-base">Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {employee.emergencyContact ? (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <UserCog className="h-4 w-4 text-muted-foreground" />
                      <span>{employee.emergencyContact}</span>
                    </div>
                    {employee.emergencyPhone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{employee.emergencyPhone}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No emergency contact on file</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-employee-certs">
            <CardHeader>
              <CardTitle className="text-base">Certifications & Licenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {employee.certifications.map((cert, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    <Award className="h-3 w-3" /> {cert}
                  </Badge>
                ))}
                {employee.certifications.length === 0 && (
                  <p className="text-sm text-muted-foreground">No certifications on file</p>
                )}
              </div>
              {Object.keys(employee.licenseNumbers).length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-2">
                    {Object.entries(employee.licenseNumbers).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-mono text-xs">{val}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-employee-schedule">
            <CardHeader>
              <CardTitle className="text-base">Upcoming Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingSchedule.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming assignments</p>
              ) : (
                <div className="space-y-2">
                  {upcomingSchedule.map(entry => {
                    const jobsite = jobsiteMap.get(entry.jobsiteId);
                    return (
                      <div key={entry.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2" data-testid={`upcoming-${entry.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{formatDayShort(entry.date)} {formatDate(entry.date)}</span>
                          <span className="text-muted-foreground">|</span>
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{jobsite?.name ?? "Unknown"}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {entry.shiftStart && (
                            <span className="text-xs text-muted-foreground">{entry.shiftStart}–{entry.shiftEnd}</span>
                          )}
                          <Badge className={scheduleStatusColors[entry.status]} variant="secondary">{entry.status}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function WorkforceMain() {
  const [tab, setTab] = useState("directory");

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-workforce-title">Workforce</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your team, schedule assignments, and track timesheets
            </p>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList data-testid="tabs-workforce">
              <TabsTrigger value="directory" data-testid="tab-directory">Directory</TabsTrigger>
              <TabsTrigger value="schedule" data-testid="tab-schedule">Schedule</TabsTrigger>
              <TabsTrigger value="timesheets" data-testid="tab-timesheets">Timesheets</TabsTrigger>
            </TabsList>
            <TabsContent value="directory" className="mt-4">
              <DirectoryTab />
            </TabsContent>
            <TabsContent value="schedule" className="mt-4">
              <ScheduleTab />
            </TabsContent>
            <TabsContent value="timesheets" className="mt-4">
              <TimesheetsTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function WorkforcePage() {
  const [matchDetail, params] = useRoute("/workforce/:id");

  if (matchDetail && params?.id) {
    return <EmployeeDetail id={params.id} />;
  }

  return <WorkforceMain />;
}
