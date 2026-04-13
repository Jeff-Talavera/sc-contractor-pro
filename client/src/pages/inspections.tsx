import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import type {
  Inspection, InspectionTemplate, Jobsite, User, Observation,
  CodeReference, Client, AiFinding, EmployeeProfile, Organization
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
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Disclaimer } from "@/components/disclaimer";
import PhotoAnnotator from "@/components/photo-annotator";
import { exportObservationPDF } from "@/lib/export-observation";
import { exportInspectionReportPDF } from "@/lib/export-inspection-report";
import {
  ArrowLeft, Plus, Search, ClipboardCheck,
  Calendar, MapPin, User as UserIcon, ChevronRight,
  AlertTriangle, CheckCircle2, Clock, XCircle,
  Link2, X, Camera, Sparkles, Upload, ImageIcon, Loader2,
  Pencil, Download, ZoomIn, FileText, ShieldCheck
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

function inferCategory(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("guardrail") || lower.includes("fall") || lower.includes("harness") || lower.includes("open edge") || lower.includes("height")) return "Fall Protection";
  if (lower.includes("scaffold") || lower.includes("plank") || lower.includes("toe board")) return "Scaffolds";
  if (lower.includes("debris") || lower.includes("housekeep") || lower.includes("walkway") || lower.includes("storage")) return "Housekeeping";
  if (lower.includes("fence") || lower.includes("sidewalk") || lower.includes("shed") || lower.includes("pedestrian") || lower.includes("public")) return "Public Protection";
  if (lower.includes("crane") || lower.includes("hoist") || lower.includes("rigging")) return "Cranes";
  if (lower.includes("excavat") || lower.includes("shoring")) return "Excavations";
  return "Fall Protection";
}

function inferActions(label: string): string[] {
  const cat = inferCategory(label);
  const actionMap: Record<string, string[]> = {
    "Fall Protection": ["Install guardrail or safety net at open edge.", "Ensure workers use personal fall arrest systems."],
    "Scaffolds": ["Inspect and correct scaffold deficiency.", "Ensure competent person verifies scaffold condition."],
    "Housekeeping": ["Clear debris and restore clear walkways.", "Implement regular housekeeping schedule."],
    "Public Protection": ["Repair or secure protection measures.", "Verify public protection meets code requirements."],
    "Cranes": ["Review crane/hoist operation log.", "Verify operator certification is current."],
    "Excavations": ["Inspect shoring and sloping conditions.", "Verify adjacent structure protection."],
  };
  return actionMap[cat] ?? ["Review and correct identified condition.", "Document corrective actions taken."];
}

interface AiFindingWithMeta extends AiFinding {
  selected: boolean;
  editedDescription: string;
  photoIndex: number;
}

function PhotoAiDialog({
  inspectionId,
  jobsiteId,
  onClose,
}: {
  inspectionId: string;
  jobsiteId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [findings, setFindings] = useState<AiFindingWithMeta[]>([]);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [annotatingIndex, setAnnotatingIndex] = useState<number | null>(null);
  const { data: codeRefs } = useQuery<CodeReference[]>({ queryKey: ["/api/code-references"] });

  const codeRefMap = new Map(codeRefs?.map(r => [r.id, r]) ?? []);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const urls: string[] = [];
    for (let i = 0; i < Math.min(files.length, 3); i++) {
      urls.push(await fileToDataUrl(files[i]));
    }
    setPhotoPreviewUrls(urls);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const allFindings: AiFindingWithMeta[] = [];
      for (let i = 0; i < photoPreviewUrls.length; i++) {
        const res = await apiRequest("POST", "/api/ai/analyze-photo", {});
        const data = await res.json();
        for (const f of data.findings as AiFinding[]) {
          allFindings.push({
            ...f,
            selected: true,
            editedDescription: f.label,
            photoIndex: i,
          });
        }
      }
      setFindings(allFindings);
      setStep("review");
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateObservations = async () => {
    const selected = findings.filter(f => f.selected);
    if (selected.length === 0) {
      toast({ title: "No findings selected", variant: "destructive" });
      return;
    }
    setCreating(true);
    const ids: string[] = [];
    try {
      for (const finding of selected) {
        const category = inferCategory(finding.label);
        const actions = inferActions(finding.label);
        const sourcePhoto = photoPreviewUrls[finding.photoIndex] ?? photoPreviewUrls[0];
        const res = await apiRequest("POST", "/api/observations", {
          inspectionId,
          jobsiteId,
          location: `See photo ${finding.photoIndex + 1}`,
          description: finding.editedDescription,
          category,
          severity: "Medium",
          status: "Open",
          photoUrls: [sourcePhoto],
          linkedCodeReferenceIds: finding.suggestedCodeReferenceIds,
          recommendedActions: actions,
          source: "ai",
          aiFindings: [finding],
        });
        const obs = await res.json();
        ids.push(obs.id);
      }
      setCreatedIds(ids);
      queryClient.invalidateQueries({ queryKey: ["/api/inspections", inspectionId, "observations"] });
      setStep("done");
      toast({ title: `${ids.length} observation${ids.length !== 1 ? "s" : ""} created from AI analysis` });
    } catch (err: any) {
      toast({ title: "Error creating observations", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Photo Check (AI)
        </DialogTitle>
      </DialogHeader>

      <div className="rounded-md bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300" data-testid="text-ai-disclaimer">
        AI suggestions are for guidance only. A qualified safety professional must review and confirm all findings.
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload 1-3 photos from the jobsite. Our AI will analyze them for potential safety observations.
          </p>

          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-photo-upload"
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Click to upload photos</p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 3 files</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-photo-upload"
            />
          </div>

          {photoPreviewUrls.length > 0 && annotatingIndex === null && (
            <div className="flex gap-3 flex-wrap">
              {photoPreviewUrls.map((url, i) => (
                <div key={i} className="relative group">
                  <div className="w-24 h-24 rounded-md border overflow-hidden bg-muted">
                    <img src={url} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" data-testid={`img-preview-${i}`} />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setAnnotatingIndex(i)}
                    data-testid={`button-annotate-photo-${i}`}
                  >
                    <Pencil className="h-3 w-3 mr-1" /> Mark up
                  </Button>
                </div>
              ))}
            </div>
          )}

          {annotatingIndex !== null && (
            <PhotoAnnotator
              imageUrl={photoPreviewUrls[annotatingIndex]}
              onSave={(dataUrl) => {
                setPhotoPreviewUrls(prev => prev.map((u, i) => i === annotatingIndex ? dataUrl : u));
                setAnnotatingIndex(null);
                toast({ title: `Photo ${annotatingIndex + 1} annotated` });
              }}
              onCancel={() => setAnnotatingIndex(null)}
            />
          )}

          {annotatingIndex === null && (
            <Button
              className="w-full"
              disabled={photoPreviewUrls.length === 0 || analyzing}
              onClick={handleAnalyze}
              data-testid="button-analyze-photos"
            >
              {analyzing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Analyze Photos</>
              )}
            </Button>
          )}
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {findings.length} potential finding{findings.length !== 1 ? "s" : ""} detected. Select which ones to create as observations.
          </p>

          <div className="space-y-3">
            {findings.map((finding, idx) => (
              <Card key={finding.id} className={finding.selected ? "border-primary/50" : "opacity-60"} data-testid={`card-finding-${idx}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={finding.selected}
                      onCheckedChange={(checked) => {
                        setFindings(prev => prev.map((f, i) => i === idx ? { ...f, selected: !!checked } : f));
                      }}
                      data-testid={`checkbox-finding-${idx}`}
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{finding.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(finding.confidence * 100)}% confidence
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Photo {finding.photoIndex + 1}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {finding.suggestedCodeReferenceIds.map(refId => (
                          <Tooltip key={refId}>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs cursor-help">
                                {refId}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-xs">{codeRefMap.get(refId)?.title ?? refId}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                      <Textarea
                        value={finding.editedDescription}
                        onChange={(e) => {
                          setFindings(prev => prev.map((f, i) => i === idx ? { ...f, editedDescription: e.target.value } : f));
                        }}
                        className="text-sm min-h-[60px]"
                        data-testid={`textarea-finding-${idx}`}
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Category: {inferCategory(finding.label)}</span>
                        <span>|</span>
                        <span>Severity: Medium (editable later)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setStep("upload"); setFindings([]); }} className="flex-1" data-testid="button-back-upload">
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreateObservations}
              disabled={creating || findings.filter(f => f.selected).length === 0}
              data-testid="button-create-ai-observations"
            >
              {creating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                <>Create {findings.filter(f => f.selected).length} Observation{findings.filter(f => f.selected).length !== 1 ? "s" : ""}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-4 text-center py-4">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
          <p className="text-sm font-medium">
            {createdIds.length} observation{createdIds.length !== 1 ? "s" : ""} created successfully
          </p>
          <p className="text-xs text-muted-foreground">
            Observations have been added to this inspection with AI source tags.
          </p>
          <Button onClick={onClose} className="w-full" data-testid="button-close-ai-dialog">
            Done
          </Button>
        </div>
      )}
    </DialogContent>
  );
}

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

const CODE_KEYWORD_CHIPS = [
  "fall protection",
  "scaffolds",
  "cranes",
  "excavations",
  "housekeeping",
  "public protection",
  "permits",
  "demolition",
  "hoists",
  "rigging",
];

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
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const { data: codeRefs } = useQuery<CodeReference[]>({ queryKey: ["/api/code-references"] });

  const handleKeywordClick = (keyword: string) => {
    if (activeKeyword === keyword) {
      setActiveKeyword(null);
      setSearch("");
    } else {
      setActiveKeyword(keyword);
      setSearch(keyword);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (activeKeyword && value.toLowerCase() !== activeKeyword.toLowerCase()) {
      setActiveKeyword(null);
    }
  };

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

      <div className="flex flex-wrap gap-1.5">
        {CODE_KEYWORD_CHIPS.map(keyword => (
          <Badge
            key={keyword}
            variant={activeKeyword === keyword ? "default" : "outline"}
            className="cursor-pointer capitalize"
            onClick={() => handleKeywordClick(keyword)}
            data-testid={`chip-keyword-${keyword.replace(/\s+/g, "-")}`}
          >
            {keyword}
          </Badge>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search code references by keyword or tag..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
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
  const [manualPhotos, setManualPhotos] = useState<string[]>([]);
  const [annotatingManualIdx, setAnnotatingManualIdx] = useState<number | null>(null);
  const manualFileRef = useRef<HTMLInputElement>(null);

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
      type: "issue" as const,
      severity: "Medium" as const,
      status: "Open" as const,
      correctedOnSite: false,
      assignedTo: "",
      dueDate: "",
      photoUrls: [] as string[],
      linkedCodeReferenceIds: [] as string[],
      recommendedActions: [] as string[],
      recommendedAction: "",
      source: "manual" as const,
    },
  });

  const observationType = form.watch("type");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { recommendedAction, ...rest } = data;
      const actions = recommendedAction ? [...rest.recommendedActions, recommendedAction] : rest.recommendedActions;
      const res = await apiRequest("POST", "/api/observations", {
        ...rest,
        photoUrls: manualPhotos,
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
    "Administrative", "Cranes", "Hoists", "Excavations", "Fire Safety",
    "Electrical", "PPE", "Ladders", "Signage"
  ];

  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add Observation</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <FormField control={form.control} name="type" render={({ field }) => (
            <FormItem>
              <FormLabel>Finding Type</FormLabel>
              <div className="flex gap-2" data-testid="toggle-obs-type">
                <Button
                  type="button"
                  variant={field.value === "issue" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    field.onChange("issue");
                    form.setValue("status", "Open");
                    form.setValue("severity", "Medium");
                  }}
                  data-testid="button-type-issue"
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Issue
                </Button>
                <Button
                  type="button"
                  variant={field.value === "positive" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    field.onChange("positive");
                    form.setValue("status", "Verified");
                    form.setValue("severity", "Low");
                    form.setValue("correctedOnSite", false);
                  }}
                  data-testid="button-type-positive"
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Positive Finding
                </Button>
              </div>
              {observationType === "positive" && (
                <p className="text-xs text-muted-foreground">Positive findings confirm compliance — they appear as green checkmarks in the full report.</p>
              )}
            </FormItem>
          )} />

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
              <FormLabel>{observationType === "positive" ? "What was found compliant?" : "Description"}</FormLabel>
              <FormControl><Textarea placeholder={observationType === "positive" ? "e.g., All workers wearing proper PPE in required areas." : "Describe the observation..."} {...field} data-testid="input-obs-description" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {observationType === "issue" && (
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
          )}

          {observationType === "issue" && (
            <FormField control={form.control} name="correctedOnSite" render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-corrected-on-site"
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer font-normal">
                    Corrected on site — issue was fixed immediately during this inspection visit
                  </FormLabel>
                </div>
              </FormItem>
            )} />
          )}

          {observationType === "issue" && (
            <FormField control={form.control} name="recommendedAction" render={({ field }) => (
              <FormItem>
                <FormLabel>Recommended Action</FormLabel>
                <FormControl><Input placeholder="Corrective action to take..." {...field} data-testid="input-obs-action" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}

          <div>
            <p className="text-sm font-medium mb-2">Photos</p>
            {annotatingManualIdx !== null ? (
              <PhotoAnnotator
                imageUrl={manualPhotos[annotatingManualIdx]}
                onSave={(dataUrl) => {
                  setManualPhotos(prev => prev.map((u, i) => i === annotatingManualIdx ? dataUrl : u));
                  setAnnotatingManualIdx(null);
                  toast({ title: "Photo annotated" });
                }}
                onCancel={() => setAnnotatingManualIdx(null)}
              />
            ) : (
              <>
                <div className="flex gap-2 flex-wrap mb-2">
                  {manualPhotos.map((url, i) => (
                    <div key={i} className="relative group">
                      <div className="w-20 h-20 rounded-md border overflow-hidden bg-muted">
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" data-testid={`img-manual-photo-${i}`} />
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="secondary" size="sm" className="h-5 text-[9px] px-1.5" onClick={() => setAnnotatingManualIdx(i)} data-testid={`button-annotate-manual-${i}`}>
                          <Pencil className="h-2.5 w-2.5 mr-0.5" /> Mark up
                        </Button>
                        <Button variant="secondary" size="sm" className="h-5 text-[9px] px-1" onClick={() => setManualPhotos(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-manual-photo-${i}`}>
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {manualPhotos.length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => manualFileRef.current?.click()}
                    data-testid="button-add-manual-photo"
                  >
                    <Camera className="h-4 w-4 mr-1" /> Add Photo
                  </Button>
                )}
                <input
                  ref={manualFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        setManualPhotos(prev => [...prev, reader.result as string]);
                      };
                      reader.readAsDataURL(file);
                    }
                    e.target.value = "";
                  }}
                  data-testid="input-manual-photo-file"
                />
              </>
            )}
          </div>

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

function ReportDetailsDialog({
  inspection,
  onClose,
}: {
  inspection: Inspection;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [ccText, setCcText] = useState((inspection.ccList ?? []).join("\n"));

  const form = useForm({
    defaultValues: {
      recipientName: inspection.recipientName ?? "",
      recipientTitle: inspection.recipientTitle ?? "",
      recipientCompany: inspection.recipientCompany ?? "",
      recipientAddress: inspection.recipientAddress ?? "",
      scopeOfWork: inspection.scopeOfWork ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const ccList = ccText.split("\n").map(s => s.trim()).filter(Boolean);
      const res = await apiRequest("PATCH", `/api/inspections/${inspection.id}/report-details`, {
        ...values,
        ccList,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspections", inspection.id] });
      toast({ title: "Report details saved" });
      onClose();
    },
    onError: () => {
      toast({ title: "Error saving details", variant: "destructive" });
    },
  });

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Report Details</DialogTitle>
      </DialogHeader>
      <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <p className="text-sm font-semibold mb-3">Report Recipient</p>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input {...form.register("recipientName")} placeholder="e.g., Michael Rodriguez" className="mt-1" data-testid="input-recipient-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input {...form.register("recipientTitle")} placeholder="e.g., Project Manager" className="mt-1" data-testid="input-recipient-title" />
              </div>
              <div>
                <label className="text-sm font-medium">Company</label>
                <Input {...form.register("recipientCompany")} placeholder="e.g., Turner Construction" className="mt-1" data-testid="input-recipient-company" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input {...form.register("recipientAddress")} placeholder="e.g., 375 Hudson St, New York, NY 10014" className="mt-1" data-testid="input-recipient-address" />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <label className="text-sm font-medium">Scope of Work</label>
          <Textarea
            {...form.register("scopeOfWork")}
            placeholder="Describe the work activities being performed on site during this inspection..."
            className="mt-1 min-h-[80px]"
            data-testid="input-scope-of-work"
          />
        </div>

        <div>
          <label className="text-sm font-medium">CC List</label>
          <p className="text-xs text-muted-foreground mb-1">One entry per line (e.g., "James Chen, SafeGuard NYC")</p>
          <Textarea
            value={ccText}
            onChange={e => setCcText(e.target.value)}
            placeholder={"James Chen, SafeGuard NYC Consulting\nAnthony Ferraro, Turner Construction – Safety Director"}
            className="min-h-[70px]"
            data-testid="input-cc-list"
          />
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-report-details">
          {mutation.isPending ? "Saving..." : "Save Report Details"}
        </Button>
      </form>
    </DialogContent>
  );
}

function InspectionDetail({ id }: { id: string }) {
  const [showAddObs, setShowAddObs] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [showReportDetails, setShowReportDetails] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [exportingReport, setExportingReport] = useState(false);
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
  const { data: employees } = useQuery<EmployeeProfile[]>({ queryKey: ["/api/employees"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: me } = useQuery<{ user: User; organization: Organization }>({ queryKey: ["/api/me"] });

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
  const client = clients?.find(c => c.id === jobsite?.clientId);
  const inspectorEmployee = employees?.find(e => e.userId === inspection.inspectorUserId);

  const obsStatuses = ["Open", "In progress", "Corrected", "Verified"];

  const totalObs = observations?.length ?? 0;
  const positiveObs = observations?.filter(o => o.type === "positive").length ?? 0;
  const score = totalObs > 0 ? Math.round((positiveObs / totalObs) * 1000) / 10 : null;
  const scoreColor = score === null ? "secondary" :
    score >= 80 ? "default" : score >= 60 ? "secondary" : "destructive";

  const handleExportReport = async () => {
    if (!jobsite || !inspector || !me) return;
    if (!client) {
      toast({ title: "Client data not loaded yet, please try again.", variant: "destructive" });
      return;
    }
    setExportingReport(true);
    try {
      await exportInspectionReportPDF(
        inspection,
        observations ?? [],
        jobsite,
        client,
        inspector,
        codeRefMap,
        me.organization,
        inspectorEmployee,
      );
    } catch (e) {
      toast({ title: "Error generating report", variant: "destructive" });
    } finally {
      setExportingReport(false);
    }
  };

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
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {score !== null && (
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      variant={scoreColor}
                      className="text-sm px-3 py-1 cursor-default"
                      data-testid="badge-inspection-score"
                    >
                      {score}%
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{positiveObs} of {totalObs} items compliant</p>
                  </TooltipContent>
                </Tooltip>
              )}
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
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportReport}
                disabled={exportingReport || !jobsite || !inspector || !client}
                data-testid="button-export-full-report"
              >
                {exportingReport ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Export Report
              </Button>
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

          <Card data-testid="card-report-details">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">Report Details</span>
                  </div>
                  {inspection.recipientName ? (
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>
                        <span className="font-medium text-foreground">{inspection.recipientName}</span>
                        {inspection.recipientTitle && `, ${inspection.recipientTitle}`}
                        {inspection.recipientCompany && ` — ${inspection.recipientCompany}`}
                      </p>
                      {inspection.recipientAddress && <p className="text-xs">{inspection.recipientAddress}</p>}
                      {inspection.ccList && inspection.ccList.length > 0 && (
                        <p className="text-xs">CC: {inspection.ccList.join(", ")}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No recipient set — add details to personalize the exported report.</p>
                  )}
                  {inspection.scopeOfWork && (
                    <p className="text-xs text-muted-foreground border-t pt-2 mt-2 line-clamp-2">{inspection.scopeOfWork}</p>
                  )}
                </div>
                <Dialog open={showReportDetails} onOpenChange={setShowReportDetails}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReportDetails(true)}
                    data-testid="button-edit-report-details"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                  </Button>
                  {showReportDetails && (
                    <ReportDetailsDialog
                      inspection={inspection}
                      onClose={() => setShowReportDetails(false)}
                    />
                  )}
                </Dialog>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold" data-testid="text-observations-header">
              Observations ({observations?.length ?? 0})
              {score !== null && (
                <span className="text-base font-normal text-muted-foreground ml-2">
                  · {positiveObs} compliant / {(observations?.length ?? 0) - positiveObs} issues
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
                <Button variant="outline" onClick={() => setShowAiDialog(true)} data-testid="button-photo-ai">
                  <Camera className="h-4 w-4 mr-2" /> Photo Check (AI)
                </Button>
                {showAiDialog && (
                  <PhotoAiDialog
                    inspectionId={inspection.id}
                    jobsiteId={inspection.jobsiteId}
                    onClose={() => setShowAiDialog(false)}
                  />
                )}
              </Dialog>
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
          </div>

          {!observations || observations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No observations yet. Click "Add Observation" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {observations.map(obs => {
                const isPositive = obs.type === "positive";
                const StatusIcon = statusIcons[obs.status] ?? AlertTriangle;
                return (
                  <Card
                    key={obs.id}
                    className={isPositive ? "border-green-200 dark:border-green-800/50" : ""}
                    data-testid={`card-observation-${obs.id}`}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {isPositive ? (
                              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400" variant="secondary" data-testid={`badge-positive-${obs.id}`}>
                                <ShieldCheck className="h-3 w-3 mr-1" /> Positive Finding
                              </Badge>
                            ) : (
                              <Badge className={severityColors[obs.severity] ?? ""} variant="secondary">
                                {obs.severity}
                              </Badge>
                            )}
                            <Badge variant="secondary">{obs.category}</Badge>
                            {obs.correctedOnSite && (
                              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400" variant="secondary" data-testid={`badge-corrected-site-${obs.id}`}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Corrected on site
                              </Badge>
                            )}
                            {obs.source === "ai" && (
                              <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400" variant="secondary" data-testid={`badge-ai-${obs.id}`}>
                                <Sparkles className="h-3 w-3 mr-1" /> AI
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{obs.location}</span>
                          </div>
                          <p className="text-sm mt-2">{obs.description}</p>
                        </div>
                        {!isPositive && (
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
                        )}
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

                      {obs.photoUrls && obs.photoUrls.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {obs.photoUrls.map((url, pi) => (
                            <div
                              key={pi}
                              className="w-16 h-16 rounded-md border overflow-hidden bg-muted cursor-pointer relative group"
                              onClick={() => setEnlargedPhoto(url)}
                              data-testid={`img-obs-photo-${obs.id}-${pi}`}
                            >
                              <img src={url} alt={`Photo ${pi + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          ))}
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
                        {obs.source === "ai" && obs.aiFindings && obs.aiFindings.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            AI confidence: {Math.round(obs.aiFindings[0].confidence * 100)}%
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2 ml-auto"
                          onClick={() => exportObservationPDF(obs, codeRefMap, jobsite?.name, inspection.date)}
                          data-testid={`button-export-obs-${obs.id}`}
                        >
                          <Download className="h-3 w-3 mr-1" /> Export PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Dialog open={!!enlargedPhoto} onOpenChange={() => setEnlargedPhoto(null)}>
            <DialogContent className="sm:max-w-3xl p-2">
              <DialogHeader>
                <DialogTitle>Photo</DialogTitle>
              </DialogHeader>
              {enlargedPhoto && (
                <img src={enlargedPhoto} alt="Enlarged photo" className="w-full rounded-md" data-testid="img-enlarged-photo" />
              )}
            </DialogContent>
          </Dialog>
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
