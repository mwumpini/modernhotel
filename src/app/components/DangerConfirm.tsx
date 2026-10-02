'use client';

import React, { useEffect, useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';

export type DangerConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'delete' | 'void';
};

type Pending = DangerConfirmRequest & { resolve: (ok: boolean) => void };

let openRequest: ((req: DangerConfirmRequest) => Promise<boolean>) | null = null;

export function confirmDanger(req: DangerConfirmRequest): Promise<boolean> {
  if (!openRequest) return Promise.resolve(false);
  return openRequest(req);
}

export function confirmDelete(what: string, message?: string): Promise<boolean> {
  return confirmDanger({
    tone: 'delete',
    title: `Delete ${what}?`,
    message: message || `${what} will be permanently removed. This cannot be undone.`,
    confirmLabel: 'Delete',
  });
}

export function confirmVoid(what: string, message?: string): Promise<boolean> {
  return confirmDanger({
    tone: 'void',
    title: `Void ${what}?`,
    message: message || `${what} stays on file as Void. The original is kept and the books stay even. This cannot be undone.`,
    confirmLabel: 'Void',
  });
}

export default function DangerConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    openRequest = (req) => new Promise((resolve) => {
      setPending({ ...req, resolve });
    });
    return () => {
      openRequest = null;
    };
  }, []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <Modal isOpen={!!pending} onClose={() => close(false)} size="sm" hideCloseButton>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span data-danger-confirm="open">{pending?.title}</span>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-slate-600">{pending?.message}</p>
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="flat" onPress={() => close(false)}>Keep as is</Button>
          <Button
            size="sm"
            color={pending?.tone === 'delete' ? 'danger' : 'warning'}
            onPress={() => close(true)}
          >
            {pending?.confirmLabel || 'Confirm'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
