"use client";

import { Button } from "@/components/ui/button";

interface FormActionsProps {
  loading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
}

export default function FormActions({
  loading = false,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onCancel,
}: FormActionsProps) {
  return (
    <div className="flex justify-end gap-4 pt-4">
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
      )}

      <Button
        type="submit"
        loading={loading}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
