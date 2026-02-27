"use client";

import { useRef, useLayoutEffect, useCallback, useState } from "react";

function getLinesFromList(listEl: HTMLUListElement): string[] {
  const items: string[] = [];
  const lis = listEl.querySelectorAll("li");
  lis.forEach((li) => {
    const text = (li.textContent ?? "").trim();
    items.push(text);
  });
  return items;
}

function normalizeLines(text: string): string[] {
  return text.trim() ? text.split("\n").map((l) => l.trim()).filter(Boolean) : [];
}

function setListContent(listEl: HTMLUListElement, lines: string[]) {
  listEl.innerHTML = "";
  if (lines.length === 0) {
    const li = document.createElement("li");
    li.appendChild(document.createElement("br"));
    listEl.appendChild(li);
    return;
  }
  lines.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    listEl.appendChild(li);
  });
}

type BulletListEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  className?: string;
  "data-field-id"?: string;
  highlighted?: boolean;
};

export default function BulletListEditor({
  value,
  onChange,
  onFocus,
  placeholder = "Press Enter for a new bullet",
  className = "",
  "data-field-id": dataFieldId,
  highlighted = false,
}: BulletListEditorProps) {
  const ulRef = useRef<HTMLUListElement | null>(null);
  const [refReady, setRefReady] = useState(false);
  const lastEmittedRef = useRef<string>(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setRef = useCallback((el: HTMLUListElement | null) => {
    ulRef.current = el;
    if (el) setRefReady(true);
  }, []);

  useLayoutEffect(() => {
    const ul = ulRef.current;
    if (!ul) return;

    const valueLines = normalizeLines(value);
    const currentLines = getLinesFromList(ul);

    const domCorrect =
      currentLines.length === valueLines.length &&
      currentLines.every((l, i) => l === valueLines[i]);
    if (domCorrect) return;

    // Skip rewrite when the incoming value is a round-trip of what we
    // emitted AND the user has typed content (preserves cursor position).
    // On mount the DOM is empty so we must still populate it.
    const emittedLines = normalizeLines(lastEmittedRef.current);
    const isRoundTrip =
      valueLines.length === emittedLines.length &&
      valueLines.every((l, i) => l === emittedLines[i]);
    const hasUserContent = currentLines.some((l) => l.length > 0);
    if (isRoundTrip && hasUserContent) return;

    setListContent(ul, valueLines.length ? valueLines : [""]);
    lastEmittedRef.current = value;
  }, [value, refReady]);

  const emitChange = useCallback(() => {
    const ul = ulRef.current;
    if (!ul) return;
    const lines = getLinesFromList(ul).filter((l) => l.length > 0);
    const joined = lines.join("\n");
    lastEmittedRef.current = joined;
    onChangeRef.current(joined);
  }, []);

  const handleInput = useCallback(() => {
    emitChange();
  }, [emitChange]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      const pastedLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const ul = ulRef.current;
      if (!ul) return;
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (!range || !ul.contains(range.startContainer)) {
        setListContent(ul, pastedLines.length ? pastedLines : [""]);
        emitChange();
        return;
      }
      let targetLi = range.startContainer;
      while (targetLi && targetLi.nodeName !== "LI") {
        targetLi = targetLi.parentNode as HTMLElement;
      }
      if (!targetLi) {
        setListContent(ul, pastedLines.length ? pastedLines : [""]);
        emitChange();
        return;
      }
      const currentLines = getLinesFromList(ul);
      const liIndex = Array.from(ul.querySelectorAll("li")).indexOf(targetLi as HTMLLIElement);
      const before = currentLines.slice(0, liIndex);
      const after = currentLines.slice(liIndex + 1);
      const newLines = [...before, ...pastedLines, ...after].filter(Boolean);
      setListContent(ul, newLines.length ? newLines : [""]);
      emitChange();
    },
    [emitChange]
  );

  return (
    <ul
      ref={setRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onPaste={handlePaste}
      onFocus={onFocus}
      data-placeholder={placeholder}
      data-field-id={dataFieldId}
      className={`list-disc pl-6 space-y-2 min-h-[120px] w-full resize-y border-2 rounded-md py-3 px-2 text-base leading-relaxed outline-none bg-transparent text-gray-900 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 [&:focus]:outline-none [&:focus]:border-gray-400 [&_li]:leading-relaxed transition-colors ${highlighted ? "border-gray-900 ring-2 ring-gray-200" : "border-transparent"} ${className}`}
      style={{ outline: "none" }}
    />
  );
}
