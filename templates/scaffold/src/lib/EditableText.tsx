"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

/**
 * Empire's in-place inline text editor (Canva-style), drop-in compatible with
 * the SDK's <EditableText> API so sections keep `as` / `sectionId` /
 * `settingId` / `value`.
 *
 * Why local instead of the SDK component: the host PreviewBridge only does
 * section click-to-select; the SDK <EditableText> just posts
 * `numu:editor:select-field` (focuses the side-panel field) — no in-place edit.
 * This component restores the proven Empire behavior:
 *   - Inside the customizer iframe (or `?editor=` flag) the text shows a gold
 *     dashed frame on hover; click → contenteditable + select-all.
 *   - Blur / Enter (single-line) posts `numu:editor:inline-edit`
 *     {sectionId, blockId?, key, value}; the hub patches the draft and the
 *     iframe re-renders with the persisted value. Escape cancels.
 *   - On the public storefront (top-level window) it's inert — plain text.
 */
export interface EditableTextProps {
  sectionId: string;
  blockId?: string | null;
  groupId?: string;
  settingId: string;
  value: string | undefined | null;
  as?: ElementType;
  /** Force multi-line (Enter inserts newline instead of committing). Defaults
   *  to true for block tags (p/div), false for inline/heading tags. */
  multiline?: boolean;
  className?: string;
  style?: CSSProperties;
  placeholder?: ReactNode;
  /** Accepted for SDK API parity; inline editing always edits plain text. */
  html?: boolean;
}

function isInsideEditor(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("editor")) return true;
  } catch {
    /* ignore */
  }
  return typeof window !== "undefined" && window.parent !== window;
}

const BLOCK_TAGS = new Set(["p", "div", "blockquote", "li"]);

export function EditableText({
  sectionId,
  blockId,
  groupId,
  settingId,
  value,
  as,
  multiline,
  className,
  style,
  placeholder,
}: EditableTextProps) {
  const Tag = (as ?? "span") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [inEditor, setInEditor] = useState(false);
  const isMultiline =
    multiline ?? (typeof Tag === "string" && BLOCK_TAGS.has(Tag));

  useEffect(() => {
    setInEditor(isInsideEditor());
  }, []);

  const commit = useCallback(
    (next: string) => {
      setEditing(false);
      if (ref.current) ref.current.removeAttribute("contenteditable");
      const trimmed = isMultiline ? next : next.replace(/\s+/g, " ").trim();
      if (trimmed === (value ?? "")) return;
      if (typeof window === "undefined") return;
      try {
        window.parent.postMessage(
          {
            type: "numu:editor:inline-edit",
            payload: { sectionId, blockId, groupId, key: settingId, value: trimmed },
          },
          "*",
        );
      } catch {
        /* ignore */
      }
    },
    [sectionId, blockId, groupId, settingId, value, isMultiline],
  );

  const cancel = useCallback(() => {
    setEditing(false);
    if (ref.current) {
      ref.current.removeAttribute("contenteditable");
      ref.current.textContent = value ?? "";
    }
  }, [value]);

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      if (!inEditor) return;
      e.preventDefault();
      e.stopPropagation();
      const el = ref.current;
      if (!el || typeof window === "undefined" || typeof document === "undefined")
        return;
      el.setAttribute("contenteditable", "true");
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      setEditing(true);
    },
    [inEditor],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!editing) return;
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        ref.current?.blur();
      } else if (e.key === "Enter" && !isMultiline && !e.shiftKey) {
        e.preventDefault();
        commit(ref.current?.textContent ?? "");
        ref.current?.blur();
      }
    },
    [editing, isMultiline, commit, cancel],
  );

  const onBlur = useCallback(() => {
    if (!editing) return;
    commit(ref.current?.textContent ?? "");
  }, [editing, commit]);

  const composed = [
    className,
    inEditor ? "nt-inline-edit nt-inline-edit--armed" : null,
    editing ? "nt-inline-edit--editing" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement & HTMLDivElement>}
      className={composed || undefined}
      style={style}
      data-numu-inline-section={sectionId}
      data-numu-inline-key={settingId}
      data-numu-inline-block={blockId || undefined}
      onClick={inEditor ? startEditing : undefined}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      suppressContentEditableWarning
    >
      {value || placeholder || null}
    </Tag>
  );
}
