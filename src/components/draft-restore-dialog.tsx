"use client";

/**
 * 草稿恢复弹窗(PRD 3.3.3 / 3.2.15):
 * 父组件挂载时读草稿,有就 open=true;用户选"恢复"或"放弃"。
 *
 * 复用 useDraft + AlertDialog 组合;父组件只需提供:
 * - onRestore(data):恢复时把 data 填回表单
 * - onDiscard():放弃时调 clearDraft
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { clearDraft, loadDraft } from "@/lib/hooks/use-draft";

interface Props<T> {
  keyName: string;
  onRestore: (data: T) => void;
  /** 弹窗打开时点"放弃"的回调;默认仅清草稿 */
  onDiscard?: () => void;
}

export function DraftRestoreDialog<T>({ keyName, onRestore, onDiscard }: Props<T>) {
  const [draft, setDraft] = useState<T | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = loadDraft<T>(keyName);
    if (d != null) {
      setDraft(d);
      setOpen(true);
    }
  }, [keyName]);

  function doRestore() {
    if (draft != null) {
      onRestore(draft);
      toast.success("已恢复上次编辑");
    }
    setOpen(false);
  }

  function doDiscard() {
    clearDraft(keyName);
    setOpen(false);
    onDiscard?.();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>检测到未完成内容</AlertDialogTitle>
          <AlertDialogDescription>
            是否恢复上次编辑?
            <br />
            <span className="text-xs text-muted-foreground">
              (放弃后将删除此草稿)
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={doDiscard}>放弃</AlertDialogCancel>
          <AlertDialogAction onClick={doRestore}>恢复</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
