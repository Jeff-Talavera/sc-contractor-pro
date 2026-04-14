import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  HardHat, Building2, BarChart3, ChevronRight, Plus, ShieldAlert,
  ShieldCheck, Users, ClipboardList, FileText, Briefcase, MapPin, LogOut,
  UserCheck, UserX, Key, Pencil,
} from "lucide-react";
import type { Organization, User } from "@shared/schema";

type AdminView = "analytics" | "firms" | "firm-detail";

interface FirmDetail {
  org: Organization;
  users: User[];
}

interface Analytics {
  totalOrgs: number;
  totalUsers: number;
  totalInspections: number;
  totalSafetyReports: number;
  totalClients: number;
  totalJobsites: number;
}

interface SupportData {
  clients: { id: string; name: string; contactName: string; contactEmail: string }[];
  jobsites: { id: string; name: string; address: string; city: string; projectType: string }[];
  inspections: { id: string; date: string; status: string; jobsiteId: string }[];
}

export default function AdminPortal({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<AdminView>("analytics");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { toast } = useToast();

  function nav(v: AdminView, orgId?: string) {
    setView(v);
    if (orgId !== undefined) setSelectedOrgId(orgId);
  }

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50">
      <header className="flex items-center justify-between px-6 h-14 bg-gray-900 text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
            <HardHat className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-wide">SafeSite</span>
          <Badge variant="secondary" className="text-xs bg-yellow-500 text-yellow-950 border-0">
            Admin Portal
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/70 hover:text-white hover:bg-white/10 gap-2"
          onClick={onLogout}
          data-testid="button-admin-logout"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </header>

      <div className="flex flex-1 min-h-0">
        <nav className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col gap-1 p-3">
          <NavItem
            icon={BarChart3}
            label="Analytics"
            active={view === "analytics"}
            onClick={() => nav("analytics")}
            testId="nav-admin-analytics"
          />
          <NavItem
            icon={Building2}
            label="Firms"
            active={view === "firms" || view === "firm-detail"}
            onClick={() => nav("firms")}
            testId="nav-admin-firms"
          />
        </nav>

        <main className="flex-1 overflow-auto p-6">
          {view === "analytics" && <AnalyticsView />}
          {view === "firms" && <FirmsView onViewFirm={(id) => nav("firm-detail", id)} />}
          {view === "firm-detail" && selectedOrgId && (
            <FirmDetailView orgId={selectedOrgId} onBack={() => nav("firms")} />
          )}
        </main>
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon, label, active, onClick, testId,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left ${
        active
          ? "bg-primary/10 text-primary"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

// ─── Analytics view ────────────────────────────────────────────────────────────

function AnalyticsView() {
  const { data, isLoading } = useQuery<Analytics>({ queryKey: ["/api/admin/analytics"] });

  const stats = [
    { label: "Total Firms", value: data?.totalOrgs, icon: Building2, color: "text-blue-600" },
    { label: "Total Users", value: data?.totalUsers, icon: Users, color: "text-green-600" },
    { label: "Total Clients", value: data?.totalClients, icon: Briefcase, color: "text-purple-600" },
    { label: "Total Jobsites", value: data?.totalJobsites, icon: MapPin, color: "text-orange-600" },
    { label: "Inspections", value: data?.totalInspections, icon: ClipboardList, color: "text-cyan-600" },
    { label: "Safety Reports", value: data?.totalSafetyReports, icon: FileText, color: "text-rose-600" },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6" data-testid="heading-analytics">
        Platform Analytics
      </h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label} data-testid={`card-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gray-100 ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? "—" : (s.value ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Firms list view ───────────────────────────────────────────────────────────

function FirmsView({ onViewFirm }: { onViewFirm: (id: string) => void }) {
  const { data: orgs = [], isLoading } = useQuery<Organization[]>({ queryKey: ["/api/admin/orgs"] });
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newFirmName, setNewFirmName] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const org = await apiRequest("POST", "/api/admin/orgs", { name: newFirmName });
      const orgData: Organization = await org.json();
      await apiRequest("POST", `/api/admin/orgs/${orgData.id}/users`, {
        name: newOwnerName,
        email: newOwnerEmail,
        role: "Owner",
        password: newOwnerPassword,
      });
      return orgData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      setCreateOpen(false);
      setNewFirmName("");
      setNewOwnerName("");
      setNewOwnerEmail("");
      setNewOwnerPassword("");
      toast({ title: "Firm created", description: "New firm and owner account are ready." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredOrgs = orgs.filter((o) => o.id !== "org-system");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900" data-testid="heading-firms">
          Firms ({filteredOrgs.length})
        </h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-firm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Firm
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Firm</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label htmlFor="firm-name">Firm Name</Label>
                <Input
                  id="firm-name"
                  data-testid="input-firm-name"
                  placeholder="e.g. Acme Safety Consulting"
                  value={newFirmName}
                  onChange={(e) => setNewFirmName(e.target.value)}
                />
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Owner Account</p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="owner-name">Owner Name</Label>
                    <Input
                      id="owner-name"
                      data-testid="input-owner-name"
                      placeholder="Full name"
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="owner-email">Owner Email</Label>
                    <Input
                      id="owner-email"
                      data-testid="input-owner-email"
                      type="email"
                      placeholder="owner@firm.com"
                      value={newOwnerEmail}
                      onChange={(e) => setNewOwnerEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="owner-password">Initial Password</Label>
                    <Input
                      id="owner-password"
                      data-testid="input-owner-password"
                      type="password"
                      placeholder="Min. 8 characters"
                      value={newOwnerPassword}
                      onChange={(e) => setNewOwnerPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <Button
                className="w-full"
                data-testid="button-create-firm-submit"
                disabled={
                  createMutation.isPending ||
                  !newFirmName.trim() || !newOwnerName.trim() ||
                  !newOwnerEmail.trim() || newOwnerPassword.length < 8
                }
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Creating…" : "Create Firm"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading firms…</div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Firm</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrgs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-400 py-8">
                    No firms yet. Create the first one.
                  </TableCell>
                </TableRow>
              )}
              {filteredOrgs.map((org) => (
                <OrgRow key={org.id} org={org} onView={() => onViewFirm(org.id)} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function OrgRow({ org, onView }: { org: Organization; onView: () => void }) {
  const { toast } = useToast();
  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", `/api/admin/orgs/${org.id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs"] });
      toast({ title: "Firm updated", description: `Firm is now ${org.status === "active" ? "suspended" : "active"}.` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <TableRow data-testid={`row-firm-${org.id}`}>
      <TableCell className="font-medium">{org.name}</TableCell>
      <TableCell>
        <Badge
          variant={org.status === "active" ? "default" : "destructive"}
          data-testid={`status-firm-${org.id}`}
        >
          {org.status === "active" ? "Active" : "Suspended"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              statusMutation.mutate(org.status === "active" ? "suspended" : "active")
            }
            disabled={statusMutation.isPending}
            data-testid={`button-toggle-status-${org.id}`}
            className={org.status === "active" ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"}
          >
            {org.status === "active" ? (
              <><ShieldAlert className="h-3.5 w-3.5 mr-1.5" />Suspend</>
            ) : (
              <><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Activate</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onView}
            data-testid={`button-view-firm-${org.id}`}
            className="gap-1"
          >
            Manage <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Firm detail view ──────────────────────────────────────────────────────────

function FirmDetailView({ orgId, onBack }: { orgId: string; onBack: () => void }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<FirmDetail>({
    queryKey: ["/api/admin/orgs", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/orgs/${orgId}`);
      if (!res.ok) throw new Error("Failed to load firm");
      return res.json();
    },
  });

  if (isLoading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (!data) return <div className="text-sm text-red-500">Firm not found.</div>;

  const firmUsers = data.users.filter((u) => !u.isSuperAdmin);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-gray-500">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Firms
        </Button>
        <span className="text-gray-400">/</span>
        <h1 className="text-xl font-semibold text-gray-900" data-testid="heading-firm-detail">
          {data.org.name}
        </h1>
        <Badge variant={data.org.status === "active" ? "default" : "destructive"}>
          {data.org.status === "active" ? "Active" : "Suspended"}
        </Badge>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users" data-testid="tab-users">
            Users ({firmUsers.length})
          </TabsTrigger>
          <TabsTrigger value="support" data-testid="tab-support">
            Support View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersTab orgId={orgId} users={firmUsers} />
        </TabsContent>

        <TabsContent value="support">
          <SupportTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab({ orgId, users }: { orgId: string; users: User[] }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("Inspector");
  const [newPassword, setNewPassword] = useState("");

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("Inspector");

  const [resetPassword, setResetPassword] = useState("");

  const addMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/orgs/${orgId}/users`, {
        name: newName, email: newEmail, role: newRole, password: newPassword,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs", orgId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      setAddOpen(false);
      setNewName(""); setNewEmail(""); setNewRole("Inspector"); setNewPassword("");
      toast({ title: "User added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/admin/users/${editUser!.id}`, {
        name: editName, email: editEmail, role: editRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs", orgId] });
      setEditUser(null);
      toast({ title: "User updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (u: User) =>
      apiRequest("PATCH", `/api/admin/users/${u.id}`, {
        userStatus: u.userStatus === "active" ? "inactive" : "active",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orgs", orgId] });
      toast({ title: "User status updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/users/${resetUser!.id}/reset-password`, {
        newPassword: resetPassword,
      }),
    onSuccess: () => {
      setResetUser(null);
      setResetPassword("");
      toast({ title: "Password reset", description: "The user's password has been updated." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" data-testid="button-add-user">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add User to Firm</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label>Name</Label>
                <Input data-testid="input-new-user-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input data-testid="input-new-user-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@firm.com" />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger data-testid="select-new-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Owner">Owner</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Inspector">Inspector</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Initial Password</Label>
                <Input data-testid="input-new-user-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" />
              </div>
              <Button
                className="w-full"
                data-testid="button-add-user-submit"
                disabled={addMutation.isPending || !newName || !newEmail || newPassword.length < 8}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? "Adding…" : "Add User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                  No users in this firm yet.
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-gray-500 text-sm">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{u.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={u.userStatus === "active" ? "default" : "secondary"}
                    className="text-xs"
                    data-testid={`status-user-${u.id}`}
                  >
                    {u.userStatus === "active" ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit user"
                      data-testid={`button-edit-user-${u.id}`}
                      onClick={() => {
                        setEditUser(u);
                        setEditName(u.name);
                        setEditEmail(u.email);
                        setEditRole(u.role);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Reset password"
                      data-testid={`button-reset-pw-${u.id}`}
                      onClick={() => { setResetUser(u); setResetPassword(""); }}
                    >
                      <Key className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${u.userStatus === "active" ? "text-red-500 hover:text-red-600" : "text-green-600 hover:text-green-700"}`}
                      title={u.userStatus === "active" ? "Deactivate user" : "Activate user"}
                      data-testid={`button-toggle-user-${u.id}`}
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate(u)}
                    >
                      {u.userStatus === "active" ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Name</Label>
              <Input data-testid="input-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input data-testid="input-edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Owner">Owner</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Inspector">Inspector</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              data-testid="button-edit-user-submit"
              disabled={editMutation.isPending || !editName || !editEmail}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetUser} onOpenChange={(open) => !open && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password — {resetUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>New Password</Label>
              <Input
                data-testid="input-reset-password"
                type="password"
                placeholder="Min. 8 characters"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              data-testid="button-reset-password-submit"
              disabled={resetMutation.isPending || resetPassword.length < 8}
              onClick={() => resetMutation.mutate()}
            >
              {resetMutation.isPending ? "Resetting…" : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Support view tab ──────────────────────────────────────────────────────────

function SupportTab({ orgId }: { orgId: string }) {
  const { data, isLoading } = useQuery<SupportData>({
    queryKey: ["/api/admin/orgs", orgId, "support"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/orgs/${orgId}/support`);
      if (!res.ok) throw new Error("Failed to load support data");
      return res.json();
    },
  });

  if (isLoading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Clients ({data.clients.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.clients.length === 0 ? (
            <p className="text-sm text-gray-400">No clients.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clients.map((c) => (
                  <TableRow key={c.id} data-testid={`row-support-client-${c.id}`}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{c.contactName}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{c.contactEmail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Jobsites ({data.jobsites.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.jobsites.length === 0 ? (
            <p className="text-sm text-gray-400">No jobsites.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.jobsites.map((j) => (
                  <TableRow key={j.id} data-testid={`row-support-jobsite-${j.id}`}>
                    <TableCell className="font-medium">{j.name}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{j.address}, {j.city}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{j.projectType}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Recent Inspections ({data.inspections.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.inspections.length === 0 ? (
            <p className="text-sm text-gray-400">No inspections.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Jobsite ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.inspections.slice(0, 20).map((i) => (
                  <TableRow key={i.id} data-testid={`row-support-inspection-${i.id}`}>
                    <TableCell className="text-sm">{i.date}</TableCell>
                    <TableCell>
                      <Badge variant={i.status === "Submitted" ? "default" : "secondary"} className="text-xs">
                        {i.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-400 text-xs font-mono">{i.jobsiteId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
