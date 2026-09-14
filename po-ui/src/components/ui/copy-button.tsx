import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function CopyButton({
  className,
  label = "Copy",
  value,
}: {
  readonly className?: string;
  readonly label?: string;
  readonly value: string;
}) {
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      notify({ title: "Copied", variant: "success" });
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      notify({
        title: "Copy failed",
        description: "Select the value manually and copy it from the page.",
        variant: "error",
      });
    }
  }

  return (
    <Button
      aria-label={label}
      className={cn("w-auto", className)}
      icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      onClick={() => {
        void copy();
      }}
      type="button"
      variant="outline"
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
