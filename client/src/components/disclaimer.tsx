import { AlertTriangle } from "lucide-react";

export const DISCLAIMER_TEXT =
  "This app provides general safety and compliance guidance for informational purposes only and does not constitute legal advice or an official interpretation of any law or regulation. Users remain responsible for consulting current official code texts and qualified professionals. No warranties are made regarding completeness or accuracy.";

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div
        data-testid="disclaimer-compact"
        className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
      >
        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
        <span>{DISCLAIMER_TEXT}</span>
      </div>
    );
  }

  return (
    <div
      data-testid="disclaimer-full"
      className="border-t bg-muted/30 px-6 py-4"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3 text-xs text-muted-foreground">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>{DISCLAIMER_TEXT}</p>
      </div>
    </div>
  );
}
