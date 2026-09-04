'use client';

import React, { useEffect, useState } from 'react';
import type { BlockTemplate } from '../../../lib/print/blocks';
import type { PrintData } from '../../../lib/print/templates';
import { renderBlockTemplate } from '../../../lib/print/blockRenderer';

interface TemplatePreviewProps {
  template: BlockTemplate;
  sampleData: PrintData;
}

/** Live preview pane — debounced so rapid edits (e.g. typing a heading) don't
 *  re-render the iframe on every keystroke. */
export default function TemplatePreview({ template, sampleData }: TemplatePreviewProps) {
  const [html, setHtml] = useState(() => renderBlockTemplate(template, sampleData));

  useEffect(() => {
    const handle = setTimeout(() => {
      setHtml(renderBlockTemplate(template, sampleData));
    }, 250);
    return () => clearTimeout(handle);
  }, [template, sampleData]);

  return (
    <div className="border rounded-lg overflow-hidden bg-gray-100" style={{ height: '70vh' }}>
      <iframe title="Template preview" srcDoc={html} className="w-full h-full bg-white" sandbox="" />
    </div>
  );
}
