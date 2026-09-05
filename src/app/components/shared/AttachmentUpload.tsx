'use client';

import React, { useRef, useState } from 'react';
import { Button, Chip } from '@heroui/react';
import { getClientTenantSubdomain } from '@/app/lib/api/clientTenant';

interface AttachmentUploadProps {
  label?: string;
  attachments: string[];
  onChange: (attachments: string[]) => void;
  className?: string;
}

function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(url.split('/').pop() || url);
  } catch {
    return url;
  }
}

/**
 * Real file upload for attachment fields (proof-of-payment, scanned certificates, etc.)
 * — replaces the "type a filename" text inputs that used to stand in for this across
 * the app. Uploads to Vercel Blob via /api/upload and stores the returned URL; legacy
 * plain-filename strings (from before this existed) still render, just without a link.
 */
export default function AttachmentUpload({ label = 'Attachments', attachments, onChange, className }: AttachmentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'x-tenant-subdomain': getClientTenantSubdomain() },
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Upload failed');
        }
        const data = await res.json();
        uploaded.push(data.url);
      }
      onChange([...attachments, ...uploaded]);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAt = (idx: number) => {
    onChange(attachments.filter((_, i) => i !== idx));
  };

  return (
    <div className={className}>
      <div className="text-sm mb-1 text-gray-600">{label}</div>
      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {attachments.map((url, idx) => (
            <Chip key={idx} onClose={() => removeAt(idx)} variant="flat" size="sm">
              {/^https?:\/\//.test(url) ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {fileNameFromUrl(url)}
                </a>
              ) : (
                fileNameFromUrl(url)
              )}
            </Chip>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        size="sm"
        variant="bordered"
        isLoading={uploading}
        onPress={() => inputRef.current?.click()}
      >
        📎 {uploading ? 'Uploading…' : 'Attach file'}
      </Button>
      {error && <div className="text-red-600 text-xs mt-1">{error}</div>}
    </div>
  );
}
