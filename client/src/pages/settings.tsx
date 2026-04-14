import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Organization } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Building2, Upload, X, Image } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const { data: meData, isLoading } = useQuery<{ user: { role: string }; organization: Organization }>({
    queryKey: ["/api/me"],
  });

  useEffect(() => {
    if (meData?.organization?.logoUrl && !isDirty) {
      setPreviewUrl(meData.organization.logoUrl);
    }
  }, [meData, isDirty]);

  const saveMutation = useMutation({
    mutationFn: async (logoUrl: string | null) => {
      const res = await apiRequest("PUT", "/api/organization", { logoUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      setIsDirty(false);
      toast({ title: "Organization settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 2 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreviewUrl(dataUrl);
      setIsDirty(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setPreviewUrl(null);
    setIsDirty(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = () => {
    saveMutation.mutate(previewUrl);
  };

  const isAdmin = meData?.user?.role === "Owner" || meData?.user?.role === "Admin";

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-settings-title">Organization Settings</h1>
            <p className="text-sm text-muted-foreground">{meData?.organization?.name}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization Logo</CardTitle>
            <CardDescription>
              Upload your firm's logo to appear on exported PDF reports. Recommended size: 400×120 px or wider, PNG or JPG.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex items-center justify-center w-full h-36 border-2 border-dashed border-border rounded-lg bg-muted/30 relative overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => isAdmin && fileInputRef.current?.click()}
              data-testid="logo-upload-zone"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Organization logo preview"
                  className="max-h-28 max-w-full object-contain"
                  data-testid="img-logo-preview"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Image className="h-10 w-10 opacity-30" />
                  <span className="text-sm">{isAdmin ? "Click to upload logo" : "No logo uploaded"}</span>
                  {isAdmin && <span className="text-xs opacity-70">PNG, JPG up to 2 MB</span>}
                </div>
              )}
            </div>

            {isAdmin && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-logo-file"
              />
            )}

            {isAdmin && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-logo"
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {previewUrl ? "Replace Logo" : "Upload Logo"}
                </Button>
                {previewUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-destructive hover:text-destructive"
                    data-testid="button-remove-logo"
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Remove
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!isDirty || saveMutation.isPending}
                  className="ml-auto"
                  data-testid="button-save-logo"
                >
                  {saveMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              ["Name", meData?.organization?.name],
              ["Plan", meData?.organization?.plan],
              ["City", meData?.organization?.city],
              ["State / Province", meData?.organization?.state],
              ["Country", meData?.organization?.country],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center gap-4 py-1.5 border-b border-border/50 last:border-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-36 shrink-0">{label}</span>
                <span className="text-sm" data-testid={`text-org-${String(label).toLowerCase().replace(/\s+\/\s+|\s+/g, "-")}`}>{value ?? "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
