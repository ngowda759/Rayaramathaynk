"use client";

import { ReactNode } from "react";
import { FileQuestion, Plus, Upload, RefreshCw } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}
    >
      <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-6">
        {icon || <FileQuestion className="w-10 h-10 text-stone-400" />}
      </div>
      <h3 className="text-xl font-semibold text-stone-900 mb-2">{title}</h3>
      <p className="text-stone-500 max-w-md mb-8">{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="flex items-center gap-2 px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors font-medium"
          >
            <Upload className="w-4 h-4" />
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// Pre-configured empty state for AI Knowledge
export function AIKnowledgeEmptyState({
  onInitialize,
  onUpload,
}: {
  onInitialize?: () => void;
  onUpload?: () => void;
}) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-12 h-12 text-stone-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      }
      title="No AI Knowledge Found"
      description="Raya AI has not been initialized yet. Import default knowledge to enable intelligent responses for devotees."
      actionLabel="Import Default Knowledge"
      onAction={onInitialize}
      secondaryActionLabel="Upload Knowledge"
      onSecondaryAction={onUpload}
    />
  );
}

// Pre-configured empty state for Knowledge Articles
export function KnowledgeArticlesEmptyState({
  onCreate,
}: {
  onCreate?: () => void;
}) {
  return (
    <EmptyState
      icon={<FileQuestion className="w-10 h-10 text-stone-400" />}
      title="No Knowledge Articles"
      description="Start building your knowledge base by creating articles or importing existing content."
      actionLabel="Create New Article"
      onAction={onCreate}
    />
  );
}
