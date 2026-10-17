'use client';

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';

/** In-app look at a document before it is printed or emailed. */
export function HtmlDocumentPreview({
  title,
  html,
  onClose,
}: {
  title: string;
  html: string | null;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={!!html} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="text-ghana-black">{title || 'Preview'}</ModalHeader>
        <ModalBody>
          {html && (
            <iframe
              title={title || 'Preview'}
              sandbox=""
              srcDoc={html}
              className="h-[70vh] w-full rounded-lg border border-gray-200 bg-white"
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
