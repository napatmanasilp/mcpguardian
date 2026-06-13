"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadOrgLogo } from "@/lib/actions/settings";
import { type ActionState } from "@/lib/types/settings";

const MIME_WHITELIST = ["image/png", "image/jpeg", "image/svg+xml"];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

interface OrgLogoUploadProps {
  currentLogoUrl?: string | null;
}

const initialState: ActionState = {};

export function OrgLogoUpload({ currentLogoUrl }: OrgLogoUploadProps) {
  const [state, formAction, isPending] = useActionState(
    uploadOrgLogo,
    initialState,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentLogoUrl ?? null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevStateRef = useRef(state);

  useEffect(() => {
    if (state === prevStateRef.current) return;
    prevStateRef.current = state;

    if (state.success) {
      toast.success("Organization logo updated.");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValidationError(null);
    const file = e.target.files?.[0];

    if (!file) return;

    // Client-side validation
    if (!MIME_WHITELIST.includes(file.type)) {
      setValidationError(
        "Unsupported file type. Please upload a PNG, JPEG, or SVG file.",
      );
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setValidationError("File is too large. Maximum size is 2 MB.");
      e.target.value = "";
      return;
    }

    // Show preview for valid files
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Auto-submit the form
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <Label className="text-xs text-slate-400">Organization Logo</Label>

      <div className="flex items-center gap-4">
        {/* Logo preview */}
        <div className="size-16 rounded-md border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Organization logo"
              loading="lazy"
              className="size-full object-contain"
            />
          ) : (
            <Upload className="size-5 text-slate-500" />
          )}
        </div>

        {/* Upload input and button */}
        <div className="flex flex-col gap-1">
          <input
            ref={fileInputRef}
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={handleFileChange}
            className="hidden"
            disabled={isPending}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/10 text-xs"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Upload className="size-3 mr-1" />
            )}
            {isPending ? "Uploading…" : "Upload Logo"}
          </Button>
          <span className="text-[10px] text-slate-500">
            PNG, JPEG, or SVG. Max 2 MB.
          </span>
        </div>
      </div>

      {/* Inline validation error */}
      {validationError && (
        <p className="text-xs text-threat">{validationError}</p>
      )}
    </form>
  );
}
