import { useRef, useState } from "react";
import { FileCheck2, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_FILE_SIZE_BYTES,
  isAllowedReceiptMimeType,
} from "@/services/receiptStorageService";

export function ReceiptUploader({
  onSubmit,
  isSubmitting,
  disabled,
}: {
  onSubmit: (file: File) => void;
  isSubmitting: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleFileChange(selected: File | undefined) {
    setValidationError(null);
    if (!selected) return;

    if (!isAllowedReceiptMimeType(selected.type)) {
      setValidationError("Please upload a JPEG, PNG, WEBP image, or a PDF.");
      return;
    }
    if (selected.size > MAX_RECEIPT_FILE_SIZE_BYTES) {
      setValidationError("File is too large — maximum size is 10MB.");
      return;
    }

    setFile(selected);
    setPreviewUrl(selected.type.startsWith("image/") ? URL.createObjectURL(selected) : null);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_RECEIPT_MIME_TYPES.join(",")}
        className="hidden"
        onChange={(e) => handleFileChange(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          file ? "border-success/50 bg-success/5" : "border-input hover:border-primary/50 hover:bg-accent",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Payment screenshot preview" className="max-h-40 rounded-lg object-contain" />
        ) : file ? (
          <FileCheck2 className="size-8 text-success" />
        ) : (
          <Upload className="size-8 text-muted-foreground" />
        )}
        <div className="text-sm">
          {file ? (
            <span className="font-medium">{file.name}</span>
          ) : (
            <>
              <span className="font-medium text-primary">Click to upload</span>{" "}
              <span className="text-muted-foreground">your payment screenshot</span>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPEG, PNG, WEBP, or PDF — up to 10MB</p>
      </button>

      {validationError && <p className="text-xs text-destructive">{validationError}</p>}

      <Button
        type="button"
        size="lg"
        disabled={!file || isSubmitting || disabled}
        onClick={() => file && onSubmit(file)}
      >
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Submit payment proof
      </Button>
    </div>
  );
}
