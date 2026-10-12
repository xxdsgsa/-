"use client";

/**
 * 自动保存草稿 hook(PRD 3.3 / SYSTEM-005):
 *
 * - 2s debounce 自动存 localStorage(白名单:仅表单草稿,见 AGENTS.md)
 * - 离开前 / 切后台 立即存(visibilitychange)
 * - 进入页面由调用方读 loadDraft() 决定是否恢复
 * - 7 天过期:读时若已过期,自动清掉
 * - 同一 key 仅一表单(命名:namespace:scope:userId:formId,userId 隔离设备多人)
 *
 * 范围(3.3.1):
 *   - 创建/编辑训练周期、动作、饮食、补剂、个人资料
 *   - 训练执行页(实时)
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** 草稿存储 TTL 7 天(3.3.4) */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** debounce 延迟 2s(3.3.2) */
const DEBOUNCE_MS = 2000;

export interface DraftEnvelope<T> {
  /** ISO 时间戳,用于 TTL 计算 */
  savedAt: string;
  data: T;
}

/** 校验草稿是否过期(7 天,3.3.4) */
function isExpired(env: DraftEnvelope<unknown>): boolean {
  return Date.now() - new Date(env.savedAt).getTime() > TTL_MS;
}

/** 读草稿(浏览器侧);过期或解析失败返回 null */
export function loadDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as DraftEnvelope<T>;
    if (!env?.savedAt || isExpired(env)) {
      window.localStorage.removeItem(key);
      return null;
    }
    return env.data;
  } catch {
    return null;
  }
}

/** 写草稿(浏览器侧);失败静默吞(QuotaExceeded 等不影响主流程) */
export function saveDraft<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const env: DraftEnvelope<T> = { savedAt: new Date().toISOString(), data };
    window.localStorage.setItem(key, JSON.stringify(env));
  } catch {
    // 静默失败(3.3.5 评审 2:草稿不阻塞主流程)
  }
}

/** 删草稿(保存成功 / 用户主动放弃,3.3.4) */
export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 静默
  }
}

/** 命名辅助:`namespace:userId:formId` */
export function draftKey(namespace: string, userId: string, formId: string): string {
  return `fitmate:draft:${namespace}:${userId}:${formId}`;
}

/**
 * 在组件中启用自动保存:
 * - data:待存的草稿数据(对象引用变化即触发 debounce)
 * - 返回:[dirty, manualSave](dirty=true 表示有未提交变更;manualSave 立即存)
 *
 * 不负责"恢复"——由调用方用 loadDraft 在挂载时取一次。
 */
export function useAutoDraft<T>(key: string, data: T): {
  dirty: boolean;
  saveNow: () => void;
} {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);
  const [dirty, setDirty] = useState(false);
  // 用 ref 锁存最新 data(避免闭包陷阱)
  const dataRef = useRef<T>(data);
  dataRef.current = data;

  const saveNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    saveDraft(key, dataRef.current);
  }, [key]);

  // data 引用变化 → 2s 后存
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setDirty(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveDraft(key, dataRef.current);
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, key]);

  // 切后台 / 关闭前 立即存(3.3.2 评审 1)
  useEffect(() => {
    if (typeof document === "undefined") return;
    function flush() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      saveDraft(key, dataRef.current);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
    };
  }, [key]);

  return { dirty, saveNow };
}

/** 通用恢复弹窗 hook(3.3.3):mount 后弹一次,用户选"恢复"或"放弃" */
export function useDraftRestore<T>(
  key: string,
  onRestore: (data: T) => void,
  onDiscard: () => void,
): { open: boolean; loading: boolean; dismiss: () => void } {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const draft = loadDraft<T>(key);
    if (draft != null) {
      setOpen(true);
    }
    setLoading(false);
  }, [key]);

  function dismiss() {
    setOpen(false);
  }

  return {
    open,
    loading,
    dismiss,
    // 暴露选择行为(在父组件按钮 onClick 中调用,关闭弹窗)
  };
}
