import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { actions } from "@/lib/store";
import type { ReportTarget } from "@/lib/types";

export const REPORT_REASONS = [
  "Racismo, preconceito ou discurso de ódio",
  "Assédio ou bullying",
  "Incentivo a dano ao patrimônio ou invasão",
  "Exposição de endereço ou localização sensível",
  "Uso de obra ou imagem sem autorização",
  "Spam",
  "Outro motivo",
];

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  label,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetType: ReportTarget;
  targetId: string;
  label: string;
}) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]!);
  const [details, setDetails] = useState("");

  const submit = () => {
    actions.report({ targetType, targetId, reason, details: details.trim() });
    toast.success("Denúncia enviada. A equipe de moderação vai revisar.");
    setDetails("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Denunciar {label}</DialogTitle>
          <DialogDescription>Sua denúncia é anônima para quem foi denunciado.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
          {REPORT_REASONS.map((r) => (
            <Label key={r} className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 font-normal has-[:checked]:border-primary">
              <RadioGroupItem value={r} /> {r}
            </Label>
          ))}
        </RadioGroup>
        <div className="space-y-2">
          <Label htmlFor="report-details">Detalhes (opcional)</Label>
          <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} placeholder="Conte o que aconteceu" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Enviar denúncia</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
