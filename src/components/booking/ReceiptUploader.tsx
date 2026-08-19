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
      setValidationError("يرجى رفع صورة (JPEG, PNG, WEBP) أو ملف PDF.");
      return;
    }
    if (selected.size > MAX_RECEIPT_FILE_SIZE_BYTES) {
      setValidationError("حجم الملف كبير جداً — الحد الأقصى 10 ميجابايت.");
      return;
    }

    setFile(selected);
    setPreviewUrl(selected.type.startsWith("image/") ? URL.createObjectURL(selected) : null);
  }

  return (
    <div className="flex flex-col gap-4" dir="rtl">
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
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-all",
          file ? "border-success/50 bg-success/5 shadow-sm" : "border-input bg-muted/20 hover:border-primary/50 hover:bg-muted active:scale-95",
          disabled && "pointer-events-none opacity-50 grayscale"
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="معاينة إثبات الدفع" className="max-h-40 rounded-xl object-contain shadow-sm" />
        ) : file ? (
          <FileCheck2 className="size-10 text-success" />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Upload className="size-6 text-primary" />
          </div>
        )}
        <div className="text-sm">
          {file ? (
            <span className="font-bold text-foreground">{file.name}</span>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-foreground">اضغط هنا لرفع إثبات الدفع</span>
              <span className="text-muted-foreground">صورة التحويل أو لقطة الشاشة</span>
            </div>
          )}
        </div>
        <p className="text-xs font-medium text-muted-foreground/70">المدعوم: JPEG, PNG, WEBP, PDF (بحد أقصى 10MB)</p>
      </button>

      {validationError && <p className="text-xs font-bold text-destructive">{validationError}</p>}

      <Button
        type="button"
        size="lg"
        disabled={!file || isSubmitting || disabled}
        onClick={() => file && onSubmit(file)}
        className="mt-2 h-12 rounded-xl text-base font-bold shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            جاري إرسال الطلب...
          </>
        ) : (
          <>تأكيد الدفع وإتمام الحجز</>
        )}
      </Button>
    </div>
  );
}
