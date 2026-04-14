import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import type { SafetyReport, SafetyReportSettings, Client, Organization } from "@shared/schema";
import { insertSafetyReportSchema, updateSafetySettingsSchema } from "@shared/schema";
import type { UpdateSafetySettings } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { exportSafetyReportPDF } from "@/lib/export-safety-report";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  Shield, ArrowLeft, Plus, Search, Download, Settings2,
  TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronRight,
  Users, HardHat, ClipboardCheck, Activity, Camera, X, ImageIcon
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeBadgeClass(grade: string) {
  if (grade === "A") return "bg-green-500/15 text-green-700 dark:text-green-400";
  if (grade === "B") return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
  if (grade === "C") return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-destructive/15 text-destructive";
}

function scoreBarColor(score: number) {
  if (score >= 90) return "bg-green-500";
  if (score >= 75) return "bg-blue-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-destructive";
}

function formatPeriod(start: string, end: string) {
  return new Date(start + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function trendIcon(reports: SafetyReport[]) {
  if (reports.length < 2) return null;
  const latest = reports[0].overallScore;
  const prev = reports[1].overallScore;
  if (latest > prev) return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
  if (latest < prev) return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function ScoreBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBarColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-7 text-right font-medium">{value}</span>
    </div>
  );
}

// ─── New Report Form ──────────────────────────────────────────────────────────

const formSchema = insertSafetyReportSchema.extend({
  totalManhours: z.coerce.number().min(0),
  totalHeadcount: z.coerce.number().min(0),
  newHirePercent: z.coerce.number().min(0).max(100),
  recordableIncidents: z.coerce.number().min(0),
  dartCases: z.coerce.number().min(0),
  lostTimeIncidents: z.coerce.number().min(0),
  emr: z.coerce.number().min(0),
  oshaWillfulCitations: z.coerce.number().min(0),
  oshaSeriousCitations: z.coerce.number().min(0),
  oshaOtherCitations: z.coerce.number().min(0),
  openWcClaims: z.coerce.number().min(0),
  inspectionsCompleted: z.coerce.number().min(0),
  inspectionsScheduled: z.coerce.number().min(0),
  correctiveActionsClosed: z.coerce.number().min(0),
  correctiveActionsOpened: z.coerce.number().min(0),
  avgCorrectiveActionDays: z.coerce.number().min(0),
  nearMissReports: z.coerce.number().min(0),
  toolboxTalksCompleted: z.coerce.number().min(0),
  toolboxTalksScheduled: z.coerce.number().min(0),
  certifiedWorkforcePercent: z.coerce.number().min(0).max(100),
  jhaCompliancePercent: z.coerce.number().min(0).max(100),
  permitCompliancePercent: z.coerce.number().min(0).max(100),
});

type FormValues = z.infer<typeof formSchema>;

function NumberField({
  form,
  name,
  label,
  placeholder,
  hint,
}: {
  form: UseFormReturn<FormValues>;
  name: keyof FormValues;
  label: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="any"
              min={0}
              placeholder={placeholder ?? "0"}
              {...field}
              data-testid={`input-report-${name}`}
            />
          </FormControl>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NewReportDialog({
  defaultClientId,
  open,
  onOpenChange,
}: {
  defaultClientId?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const allClients = [...(clients ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";
  const lastOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString().split("T")[0];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: defaultClientId ?? "",
      periodType: "monthly",
      periodStart: firstOfMonth,
      periodEnd: lastOfMonth,
      totalManhours: 0,
      totalHeadcount: 0,
      projectRiskTier: "Medium",
      newHirePercent: 0,
      recordableIncidents: 0,
      dartCases: 0,
      lostTimeIncidents: 0,
      emr: 1.0,
      oshaWillfulCitations: 0,
      oshaSeriousCitations: 0,
      oshaOtherCitations: 0,
      openWcClaims: 0,
      inspectionsCompleted: 0,
      inspectionsScheduled: 0,
      correctiveActionsClosed: 0,
      correctiveActionsOpened: 0,
      avgCorrectiveActionDays: 0,
      nearMissReports: 0,
      toolboxTalksCompleted: 0,
      toolboxTalksScheduled: 0,
      certifiedWorkforcePercent: 0,
      jhaCompliancePercent: 0,
      permitCompliancePercent: 0,
      topRiskAreas: "",
      recommendedActions: "",
      photos: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/safety-reports", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safety-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/safety-reports/client"] });
      form.reset();
      setStep(1);
      onOpenChange(false);
      toast({ title: "Safety report submitted and scored" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const steps = [
    "Contractor & Period",
    "Lagging Indicators",
    "Leading Indicators",
    "Risk Summary",
    "Photos (Optional)",
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setStep(1); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Safety Report — Step {step} of {steps.length}</DialogTitle>
          <div className="flex gap-1 mt-2">
            {steps.map((s, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${i + 1 <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{steps[step - 1]}</p>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4">

            {step === 1 && (
              <div className="space-y-4">
                <FormField control={form.control} name="clientId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contractor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-report-client">
                          <SelectValue placeholder="Select a contractor..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allClients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="periodType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-report-period-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="projectRiskTier" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Risk Tier</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-report-risk-tier">
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
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="periodStart" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Start</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-report-period-start" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="periodEnd" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period End</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-report-period-end" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <NumberField form={form} name="totalManhours" label="Total Manhours" placeholder="80000" />
                  <NumberField form={form} name="totalHeadcount" label="Total Headcount" placeholder="400" />
                  <NumberField form={form} name="newHirePercent" label="New Hire %" hint="0–100" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Lagging indicators reflect past incidents and regulatory history. They contribute 35% of the overall score.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <NumberField form={form} name="recordableIncidents" label="Recordable Incidents" hint="OSHA 300 recordable" />
                  <NumberField form={form} name="dartCases" label="DART Cases" hint="Days Away / Restricted" />
                  <NumberField form={form} name="lostTimeIncidents" label="Lost-Time Incidents" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <NumberField form={form} name="emr" label="EMR" placeholder="1.00" hint="Experience Modification Rate" />
                  <NumberField form={form} name="openWcClaims" label="Open WC Claims" />
                </div>
                <Separator />
                <p className="text-xs font-medium">OSHA Citations</p>
                <div className="grid grid-cols-3 gap-4">
                  <NumberField form={form} name="oshaWillfulCitations" label="Willful Citations" />
                  <NumberField form={form} name="oshaSeriousCitations" label="Serious Citations" />
                  <NumberField form={form} name="oshaOtherCitations" label="Other Citations" />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Leading indicators reflect safety program activity. They contribute 65% of the overall score.
                </p>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inspections & Corrective Actions</p>
                <div className="grid grid-cols-2 gap-4">
                  <NumberField form={form} name="inspectionsCompleted" label="Inspections Completed" />
                  <NumberField form={form} name="inspectionsScheduled" label="Inspections Scheduled" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <NumberField form={form} name="correctiveActionsClosed" label="CA Closed" />
                  <NumberField form={form} name="correctiveActionsOpened" label="CA Opened" />
                  <NumberField form={form} name="avgCorrectiveActionDays" label="Avg Close Days" />
                </div>
                <Separator />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Training & Compliance</p>
                <div className="grid grid-cols-2 gap-4">
                  <NumberField form={form} name="toolboxTalksCompleted" label="Toolbox Talks Completed" />
                  <NumberField form={form} name="toolboxTalksScheduled" label="Toolbox Talks Scheduled" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <NumberField form={form} name="certifiedWorkforcePercent" label="Certified Workforce %" hint="0–100" />
                  <NumberField form={form} name="jhaCompliancePercent" label="JHA Compliance %" hint="0–100" />
                  <NumberField form={form} name="permitCompliancePercent" label="Permit Compliance %" hint="0–100" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <NumberField form={form} name="nearMissReports" label="Near-Miss Reports" hint="Higher is better — indicates proactive reporting culture" />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Summarize the key risk areas identified and your recommendations.
                </p>
                <FormField control={form.control} name="topRiskAreas" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Top Risk Areas</FormLabel>
                    <FormControl>
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="e.g., Fall protection, crane pre-lift compliance..."
                        data-testid="input-report-top-risks"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="recommendedActions" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recommended Actions</FormLabel>
                    <FormControl>
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="e.g., Increase fall protection audits; review crane pre-lift checklists..."
                        data-testid="input-report-recommendations"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Attach up to 10 site photos as documentation. These will appear in the exported PDF report.
                </p>
                <FormField control={form.control} name="photos" render={({ field }) => {
                  const photos: string[] = field.value ?? [];
                  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
                    const files = Array.from(e.target.files ?? []);
                    const remaining = 10 - photos.length;
                    const toRead = files.slice(0, remaining);
                    let loaded = 0;
                    const newPhotos: string[] = [];
                    toRead.forEach(file => {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        newPhotos.push(ev.target?.result as string);
                        loaded++;
                        if (loaded === toRead.length) {
                          field.onChange([...photos, ...newPhotos]);
                        }
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = "";
                  };
                  return (
                    <FormItem>
                      <div className="flex items-center justify-between mb-2">
                        <FormLabel>Site Photos ({photos.length}/10)</FormLabel>
                        {photos.length < 10 && (
                          <label className="cursor-pointer" data-testid="button-add-photos">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={handleAddPhotos}
                            />
                            <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <Camera className="h-3.5 w-3.5" /> Add Photos
                            </span>
                          </label>
                        )}
                      </div>
                      {photos.length === 0 ? (
                        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors" data-testid="photos-drop-zone">
                          <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />
                          <ImageIcon className="h-8 w-8 text-muted-foreground opacity-40 mb-1" />
                          <span className="text-sm text-muted-foreground">Click to add site photos</span>
                          <span className="text-xs text-muted-foreground opacity-60">Up to 10 images</span>
                        </label>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {photos.map((src, i) => (
                            <div key={i} className="relative group rounded-md overflow-hidden border border-border aspect-square bg-muted/20" data-testid={`photo-thumb-${i}`}>
                              <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => field.onChange(photos.filter((_, j) => j !== i))}
                                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                data-testid={`button-remove-photo-${i}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {photos.length < 10 && (
                            <label className="flex items-center justify-center rounded-md border-2 border-dashed border-border aspect-square cursor-pointer hover:bg-muted/40 transition-colors bg-muted/10">
                              <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />
                              <Plus className="h-5 w-5 text-muted-foreground" />
                            </label>
                          )}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }} />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {step > 1 && (
                <Button type="button" variant="secondary" onClick={() => setStep(s => s - 1)} className="flex-1" data-testid="button-report-back">
                  Back
                </Button>
              )}
              {step < steps.length ? (
                <Button
                  type="button"
                  className="flex-1"
                  onClick={async () => {
                    const fields: (keyof FormValues)[][] = [
                      ["clientId", "periodType", "periodStart", "periodEnd", "totalManhours", "totalHeadcount", "projectRiskTier", "newHirePercent"],
                      ["recordableIncidents", "dartCases", "lostTimeIncidents", "emr", "oshaWillfulCitations", "oshaSeriousCitations", "oshaOtherCitations", "openWcClaims"],
                      ["inspectionsCompleted", "inspectionsScheduled", "correctiveActionsClosed", "correctiveActionsOpened", "avgCorrectiveActionDays", "nearMissReports", "toolboxTalksCompleted", "toolboxTalksScheduled", "certifiedWorkforcePercent", "jhaCompliancePercent", "permitCompliancePercent"],
                      [],
                      [],
                    ];
                    const valid = await form.trigger(fields[step - 1]);
                    if (valid) setStep(s => s + 1);
                  }}
                  data-testid="button-report-next"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  className="flex-1"
                  disabled={createMutation.isPending}
                  onClick={form.handleSubmit((data) => createMutation.mutate(data))}
                  data-testid="button-report-submit"
                >
                  {createMutation.isPending ? "Scoring..." : "Submit & Score"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Settings Dialog ──────────────────────────────────────────────────────────

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { data: settings } = useQuery<SafetyReportSettings>({ queryKey: ["/api/safety-settings"] });

  const form = useForm<UpdateSafetySettings>({
    defaultValues: {
      incidentHistoryWeight: settings?.incidentHistoryWeight ?? 35,
      trainingComplianceWeight: settings?.trainingComplianceWeight ?? 20,
      hazardManagementWeight: settings?.hazardManagementWeight ?? 20,
      permitPreTaskWeight: settings?.permitPreTaskWeight ?? 15,
      reportingCultureWeight: settings?.reportingCultureWeight ?? 10,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        incidentHistoryWeight: settings.incidentHistoryWeight,
        trainingComplianceWeight: settings.trainingComplianceWeight,
        hazardManagementWeight: settings.hazardManagementWeight,
        permitPreTaskWeight: settings.permitPreTaskWeight,
        reportingCultureWeight: settings.reportingCultureWeight,
      });
    }
  }, [settings, form]);

  const mutation = useMutation({
    mutationFn: async (data: UpdateSafetySettings) => {
      const res = await apiRequest("PUT", "/api/safety-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safety-settings"] });
      toast({ title: "Scoring weights updated" });
      onOpenChange(false);
    },
  });

  const weights = form.watch();
  const total = Object.values(weights).reduce((sum, v) => sum + (v ?? 0), 0);

  const weightFields: { key: keyof UpdateSafetySettings; label: string }[] = [
    { key: "incidentHistoryWeight", label: "Incident History (Lagging)" },
    { key: "trainingComplianceWeight", label: "Training Compliance" },
    { key: "hazardManagementWeight", label: "Hazard Management" },
    { key: "permitPreTaskWeight", label: "Permit & Pre-Task" },
    { key: "reportingCultureWeight", label: "Reporting Culture" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Scoring Weights</DialogTitle>
          <p className="text-sm text-muted-foreground">Weights must sum to 100. New reports will use the updated weights.</p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            {weightFields.map(({ key, label }) => (
              <FormField key={key} control={form.control} name={key} render={() => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm">{label}</FormLabel>
                    <span className="text-sm font-medium w-8 text-right" data-testid={`weight-${key}`}>{form.watch(key)}%</span>
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...form.register(key, { valueAsNumber: true })}
                      data-testid={`input-${key}`}
                    />
                  </FormControl>
                </FormItem>
              )} />
            ))}
            <div className={`flex items-center justify-between text-sm font-medium pt-1 ${total !== 100 ? "text-destructive" : "text-green-700 dark:text-green-400"}`}>
              <span>Total</span>
              <span data-testid="weight-total">{total}%</span>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={total !== 100 || mutation.isPending}
              data-testid="button-save-settings"
            >
              {mutation.isPending ? "Saving..." : "Save Weights"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category Row ─────────────────────────────────────────────────────────────

function CategoryBreakdown({ report }: { report: SafetyReport }) {
  const cats = [
    { label: "Incident History", score: report.incidentHistoryScore },
    { label: "Training", score: report.trainingComplianceScore },
    { label: "Hazard Mgmt", score: report.hazardManagementScore },
    { label: "Permit & Pre-Task", score: report.permitPreTaskScore },
    { label: "Reporting Culture", score: report.reportingCultureScore },
  ];
  return (
    <div className="grid grid-cols-5 gap-2 mt-3">
      {cats.map(cat => (
        <div key={cat.label} className="text-center" data-testid={`cat-${cat.label.toLowerCase().replace(/\s+/g, "-")}`}>
          <div className="text-xs text-muted-foreground mb-1 leading-tight">{cat.label}</div>
          <div className={`text-sm font-bold ${cat.score >= 90 ? "text-green-700 dark:text-green-400" : cat.score >= 75 ? "text-blue-700 dark:text-blue-400" : cat.score >= 60 ? "text-amber-700 dark:text-amber-400" : "text-destructive"}`}>
            {cat.score}
          </div>
        </div>
      ))}
    </div>
  );
}

type SortKey = "score-desc" | "score-asc" | "name-asc" | "name-desc";

// ─── Dashboard (ranked list) ──────────────────────────────────────────────────

function SafetyRatingsDashboard() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score-desc");
  const [showNewReport, setShowNewReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { data: allReports, isLoading: reportsLoading } = useQuery<SafetyReport[]>({
    queryKey: ["/api/safety-reports"],
  });
  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: meData } = useQuery<{ user: { role: string } }>({ queryKey: ["/api/me"] });
  const isAdmin = meData?.user?.role === "Owner" || meData?.user?.role === "Admin";

  const clientMap = new Map(clients?.map(c => [c.id, c]) ?? []);

  const latestByClient = new Map<string, SafetyReport>();
  const historyByClient = new Map<string, SafetyReport[]>();

  (allReports ?? []).forEach(r => {
    const existing = historyByClient.get(r.clientId) ?? [];
    existing.push(r);
    historyByClient.set(r.clientId, existing);
  });
  historyByClient.forEach((reports, clientId) => {
    const sorted = [...reports].sort((a, b) => b.periodStart.localeCompare(a.periodStart));
    latestByClient.set(clientId, sorted[0]);
    historyByClient.set(clientId, sorted);
  });

  const matchesSearch = (c: Client) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase());

  const allClients = clients ?? [];
  const topLevelClients = allClients.filter(c => !c.parentClientId && matchesSearch(c));
  const subClientsByParent = new Map<string, Client[]>();
  allClients.filter(c => c.parentClientId).forEach(c => {
    const arr = subClientsByParent.get(c.parentClientId!) ?? [];
    arr.push(c);
    subClientsByParent.set(c.parentClientId!, arr);
  });

  const sortClients = (arr: Client[]) => {
    return [...arr].sort((a, b) => {
      const ra = latestByClient.get(a.id);
      const rb = latestByClient.get(b.id);
      if (sortKey === "score-desc") {
        return (rb?.overallScore ?? -1) - (ra?.overallScore ?? -1);
      } else if (sortKey === "score-asc") {
        const sa = ra?.overallScore ?? 101;
        const sb = rb?.overallScore ?? 101;
        return sa - sb;
      } else if (sortKey === "name-asc") {
        return a.name.localeCompare(b.name);
      } else {
        return b.name.localeCompare(a.name);
      }
    });
  };

  const sortedTopLevel = sortClients(topLevelClients);

  const ratedReports = Array.from(latestByClient.values()).filter(r => {
    const c = clientMap.get(r.clientId);
    return c && matchesSearch(c);
  });
  const avgScore = ratedReports.length > 0
    ? Math.round(ratedReports.reduce((s, r) => s + r.overallScore, 0) / ratedReports.length)
    : 0;
  const gradeA = ratedReports.filter(r => r.letterGrade === "A").length;
  const gradeD = ratedReports.filter(r => r.letterGrade === "D").length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-safety-ratings-title">Safety Ratings</h1>
              <p className="text-sm text-muted-foreground mt-1">Contractor safety performance rankings</p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} data-testid="button-open-settings">
                  <Settings2 className="h-4 w-4 mr-1.5" /> Weights
                </Button>
                <Button size="sm" onClick={() => setShowNewReport(true)} data-testid="button-new-report">
                  <Plus className="h-4 w-4 mr-1.5" /> New Report
                </Button>
              </div>
            )}
          </div>

          {!reportsLoading && !clientsLoading && ratedReports.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <Card data-testid="card-avg-score">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Portfolio Avg Score
                  </div>
                  <div className="text-3xl font-bold">{avgScore}</div>
                  <div className={`text-xs mt-1 ${avgScore >= 90 ? "text-green-700 dark:text-green-400" : avgScore >= 75 ? "text-blue-600 dark:text-blue-400" : avgScore >= 60 ? "text-amber-700 dark:text-amber-400" : "text-destructive"}`}>
                    {avgScore >= 90 ? "Excellent" : avgScore >= 75 ? "Good" : avgScore >= 60 ? "Needs improvement" : "Critical attention needed"}
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-grade-a-count">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Grade A Contractors
                  </div>
                  <div className="text-3xl font-bold text-green-700 dark:text-green-400">{gradeA}</div>
                  <div className="text-xs text-muted-foreground mt-1">of {ratedReports.length} rated</div>
                </CardContent>
              </Card>
              <Card data-testid="card-grade-d-count">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Requiring Attention
                  </div>
                  <div className={`text-3xl font-bold ${gradeD > 0 ? "text-destructive" : "text-muted-foreground"}`}>{gradeD}</div>
                  <div className="text-xs text-muted-foreground mt-1">Grade D contractors</div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contractors..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-ratings"
              />
            </div>
            <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-44" data-testid="select-sort-ratings">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score-desc">Score: High → Low</SelectItem>
                <SelectItem value="score-asc">Score: Low → High</SelectItem>
                <SelectItem value="name-asc">Name: A → Z</SelectItem>
                <SelectItem value="name-desc">Name: Z → A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reportsLoading || clientsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : topLevelClients.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">{search ? "No contractors match your search" : "No clients yet"}</p>
              {!search && isAdmin && (
                <Button className="mt-4" onClick={() => setShowNewReport(true)} data-testid="button-new-report-empty">
                  <Plus className="h-4 w-4 mr-1" /> Add First Report
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTopLevel.map((client, idx) => {
                const report = latestByClient.get(client.id);
                const history = historyByClient.get(client.id) ?? [];
                const subClients = sortClients(subClientsByParent.get(client.id) ?? []);
                return (
                  <div key={client.id}>
                    <Link href={`/safety-ratings/${client.id}`}>
                      <Card className="cursor-pointer hover-elevate" data-testid={`card-rating-${client.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center justify-center w-8 shrink-0 pt-0.5">
                              <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm truncate">{client.name}</p>
                                {report ? (
                                  <>
                                    <Badge className={`text-xs ${gradeBadgeClass(report.letterGrade)}`} data-testid={`badge-grade-${client.id}`}>
                                      Grade {report.letterGrade}
                                    </Badge>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      {trendIcon(history)}
                                      <span>{formatPeriod(report.periodStart, report.periodEnd)}</span>
                                    </div>
                                  </>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-no-report-${client.id}`}>No report</Badge>
                                )}
                              </div>
                              {report ? <CategoryBreakdown report={report} /> : (
                                <p className="text-xs text-muted-foreground mt-1">No safety data on file</p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {report ? (
                                <>
                                  <div className="text-2xl font-bold tabular-nums" data-testid={`score-${client.id}`}>{report.overallScore}</div>
                                  <div className="text-xs text-muted-foreground">/ 100</div>
                                </>
                              ) : (
                                <div className="text-sm text-muted-foreground tabular-nums" data-testid={`score-${client.id}`}>—</div>
                              )}
                              <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                    {subClients.length > 0 && (
                      <div className="ml-6 mt-1 space-y-1 border-l-2 border-muted pl-4">
                        {subClients.map(sub => {
                          const subReport = latestByClient.get(sub.id);
                          const subHistory = historyByClient.get(sub.id) ?? [];
                          return (
                            <Link key={sub.id} href={`/safety-ratings/${sub.id}`}>
                              <Card className="cursor-pointer hover-elevate" data-testid={`card-rating-${sub.id}`}>
                                <CardContent className="p-3">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-sm truncate">{sub.name}</p>
                                        <Badge variant="outline" className="text-xs">Subcontractor</Badge>
                                        {subReport ? (
                                          <>
                                            <Badge className={`text-xs ${gradeBadgeClass(subReport.letterGrade)}`} data-testid={`badge-grade-${sub.id}`}>
                                              Grade {subReport.letterGrade}
                                            </Badge>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                              {trendIcon(subHistory)}
                                              <span>{formatPeriod(subReport.periodStart, subReport.periodEnd)}</span>
                                            </div>
                                          </>
                                        ) : (
                                          <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-no-report-${sub.id}`}>No report</Badge>
                                        )}
                                      </div>
                                      {subReport ? <CategoryBreakdown report={subReport} /> : (
                                        <p className="text-xs text-muted-foreground mt-1">No safety data on file</p>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                      {subReport ? (
                                        <>
                                          <div className="text-xl font-bold tabular-nums" data-testid={`score-${sub.id}`}>{subReport.overallScore}</div>
                                          <div className="text-xs text-muted-foreground">/ 100</div>
                                        </>
                                      ) : (
                                        <div className="text-sm text-muted-foreground tabular-nums" data-testid={`score-${sub.id}`}>—</div>
                                      )}
                                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <NewReportDialog open={showNewReport} onOpenChange={setShowNewReport} />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}

// ─── Contractor Detail ────────────────────────────────────────────────────────

function ContractorSafetyDetail({ clientId }: { clientId: string }) {
  const [showNewReport, setShowNewReport] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingSubId, setDownloadingSubId] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: reports, isLoading } = useQuery<SafetyReport[]>({
    queryKey: ["/api/safety-reports/client", clientId],
    queryFn: () => fetch(`/api/safety-reports/client/${clientId}`).then(r => r.json()),
  });
  const { data: client } = useQuery<Client>({ queryKey: ["/api/clients", clientId] });
  const { data: allClients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: allReports } = useQuery<SafetyReport[]>({ queryKey: ["/api/safety-reports"] });
  const parentClient = client?.parentClientId
    ? allClients?.find(c => c.id === client.parentClientId)
    : undefined;
  const subcontractors = allClients?.filter(c => c.parentClientId === clientId) ?? [];
  const { data: meData } = useQuery<{ user: { role: string }; organization: Organization }>({ queryKey: ["/api/me"] });
  const isAdmin = meData?.user?.role === "Owner" || meData?.user?.role === "Admin";

  const sorted = [...(reports ?? [])].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  const chartData = sorted.map(r => ({
    label: formatPeriod(r.periodStart, r.periodEnd),
    score: r.overallScore,
    incidents: r.incidentHistoryScore,
    training: r.trainingComplianceScore,
  }));

  const handleDownload = async (report: SafetyReport) => {
    if (!client || !meData?.organization) return;
    setDownloadingId(report.id);
    try {
      await exportSafetyReportPDF(report, client, meData.organization, parentClient);
    } catch (err: unknown) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadSub = async (sub: Client, subReport: SafetyReport) => {
    if (!meData?.organization) return;
    setDownloadingSubId(subReport.id);
    try {
      await exportSafetyReportPDF(subReport, sub, meData.organization, client ?? undefined);
    } catch (err: unknown) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDownloadingSubId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/safety-ratings">
              <Button variant="ghost" size="icon" data-testid="button-back-ratings">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold truncate" data-testid="text-contractor-name">
                  {client?.name ?? "Loading..."}
                </h1>
                {parentClient && <Badge variant="outline" className="text-xs">Subcontractor</Badge>}
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-contractor-subtitle">
                {parentClient ? (
                  <>Subcontractor of <Link href={`/safety-ratings/${parentClient.id}`} className="underline hover:text-foreground">{parentClient.name}</Link></>
                ) : "Contractor safety performance"}
              </p>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={() => setShowNewReport(true)} data-testid="button-add-report">
                <Plus className="h-4 w-4 mr-1.5" /> New Report
              </Button>
            )}
          </div>

          {latest && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Card data-testid="card-latest-score">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">Latest Score</div>
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-bold tabular-nums">{latest.overallScore}</div>
                    <Badge className={`mb-0.5 ${gradeBadgeClass(latest.letterGrade)}`} data-testid="badge-latest-grade">
                      {latest.letterGrade}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{formatPeriod(latest.periodStart, latest.periodEnd)}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-incident-info">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Recordable Incidents
                  </div>
                  <div className="text-3xl font-bold tabular-nums">{latest.recordableIncidents}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    TRIR: {((latest.recordableIncidents / Math.max(latest.totalManhours, 1)) * 200000).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-emr-info">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <HardHat className="h-3 w-3" /> EMR
                  </div>
                  <div className={`text-3xl font-bold tabular-nums ${latest.emr < 1.0 ? "text-green-700 dark:text-green-400" : latest.emr > 1.2 ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                    {latest.emr.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Benchmark: 1.00</div>
                </CardContent>
              </Card>
            </div>
          )}

          {chartData.length >= 2 && (
            <Card data-testid="card-trend-chart">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Score Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <ReTooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    />
                    <ReferenceLine y={75} stroke="hsl(37 99% 48%)" strokeDasharray="4 2" strokeOpacity={0.6} label={{ value: "B", fontSize: 10, fill: "hsl(37 99% 48%)" }} />
                    <ReferenceLine y={90} stroke="hsl(142 71% 45%)" strokeDasharray="4 2" strokeOpacity={0.6} label={{ value: "A", fontSize: 10, fill: "hsl(142 71% 45%)" }} />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} name="Overall" />
                    <Line type="monotone" dataKey="incidents" stroke="hsl(0 72% 51%)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Incident History" />
                    <Line type="monotone" dataKey="training" stroke="hsl(142 71% 45%)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Training" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {latest && (
            <Card data-testid="card-category-breakdown">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Category Scores — {formatPeriod(latest.periodStart, latest.periodEnd)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Incident History (Lagging)", score: latest.incidentHistoryScore, weight: "35%" },
                  { label: "Training Compliance", score: latest.trainingComplianceScore, weight: "20%" },
                  { label: "Hazard Management", score: latest.hazardManagementScore, weight: "20%" },
                  { label: "Permit & Pre-Task", score: latest.permitPreTaskScore, weight: "15%" },
                  { label: "Reporting Culture", score: latest.reportingCultureScore, weight: "10%" },
                ].map(cat => (
                  <div key={cat.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{cat.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{cat.weight}</span>
                        <Badge className={`text-xs w-6 h-5 p-0 flex items-center justify-center ${gradeBadgeClass(cat.score >= 90 ? "A" : cat.score >= 75 ? "B" : cat.score >= 60 ? "C" : "D")}`}>
                          {cat.score >= 90 ? "A" : cat.score >= 75 ? "B" : cat.score >= 60 ? "C" : "D"}
                        </Badge>
                      </div>
                    </div>
                    <ScoreBar value={cat.score} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {latest && (latest.topRiskAreas || latest.recommendedActions) && (
            <Card data-testid="card-risk-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Risk Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {latest.topRiskAreas && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Top Risk Areas</p>
                    <p className="text-sm" data-testid="text-top-risks">{latest.topRiskAreas}</p>
                  </div>
                )}
                {latest.recommendedActions && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Recommended Actions</p>
                    <p className="text-sm" data-testid="text-recommendations">{latest.recommendedActions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {latest && latest.photos && latest.photos.length > 0 && (
            <Card data-testid="card-photo-docs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  Site Photo Documentation ({latest.photos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {latest.photos.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      className="rounded-md overflow-hidden border border-border aspect-square bg-muted/20 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring"
                      onClick={() => setExpandedPhoto(src)}
                      data-testid={`photo-thumb-detail-${i}`}
                    >
                      <img src={src} alt={`Site photo ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {subcontractors.length > 0 && (
            <Card data-testid="card-subcontractors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Subcontractors ({subcontractors.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {subcontractors.map(sub => {
                  const subReports = (allReports ?? [])
                    .filter(r => r.clientId === sub.id)
                    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
                  const latestSubReport = subReports[0] ?? null;
                  return (
                    <div key={sub.id} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/10">
                      <div className="flex-1 min-w-0">
                        <Link href={`/safety-ratings/${sub.id}`}>
                          <span className="text-sm font-medium hover:underline cursor-pointer" data-testid={`link-sub-${sub.id}`}>{sub.name}</span>
                        </Link>
                        {latestSubReport ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className={`text-xs ${gradeBadgeClass(latestSubReport.letterGrade)}`}>
                              {latestSubReport.letterGrade}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{latestSubReport.overallScore} pts</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{formatPeriod(latestSubReport.periodStart, latestSubReport.periodEnd)}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">No reports yet</p>
                        )}
                      </div>
                      {latestSubReport && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadSub(sub, latestSubReport)}
                          disabled={downloadingSubId === latestSubReport.id}
                          data-testid={`button-download-sub-${sub.id}`}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          {downloadingSubId === latestSubReport.id ? "..." : "PDF"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <div>
            <h2 className="text-lg font-semibold mb-3" data-testid="text-report-history">
              Report History ({reports?.length ?? 0})
            </h2>
            {!reports || reports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No reports yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...(reports ?? [])].sort((a, b) => b.periodStart.localeCompare(a.periodStart)).map(report => (
                  <Card key={report.id} data-testid={`card-report-${report.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{formatPeriod(report.periodStart, report.periodEnd)}</span>
                            <Badge className={`text-xs ${gradeBadgeClass(report.letterGrade)}`}>
                              Grade {report.letterGrade}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">{report.periodType}</Badge>
                          </div>
                          <ScoreBar value={report.overallScore} className="mt-2 max-w-xs" />
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-xl font-bold tabular-nums">{report.overallScore}</div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(report)}
                            disabled={downloadingId === report.id}
                            data-testid={`button-download-report-${report.id}`}
                          >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            {downloadingId === report.id ? "..." : "PDF"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <NewReportDialog defaultClientId={clientId} open={showNewReport} onOpenChange={setShowNewReport} />

      {expandedPhoto && (
        <Dialog open={!!expandedPhoto} onOpenChange={() => setExpandedPhoto(null)}>
          <DialogContent className="max-w-3xl p-2 bg-black border-0">
            <img src={expandedPhoto} alt="Expanded site photo" className="w-full h-auto max-h-[80vh] object-contain rounded" data-testid="img-photo-expanded" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function SafetyRatingsPage() {
  const [matchDetail, params] = useRoute("/safety-ratings/:clientId");

  if (matchDetail && params?.clientId) {
    return <ContractorSafetyDetail clientId={params.clientId} />;
  }

  return <SafetyRatingsDashboard />;
}
