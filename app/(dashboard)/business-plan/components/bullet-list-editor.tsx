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
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  "data-field-id"?: string;
};

export default function BulletListEditor({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = "Press Enter for a new bullet",
  className = "",
  "data-field-id": dataFieldId,
}: BulletListEditorProps) {
  const ulRef = useRef<HTMLUListElement | null>(null);
  const [refReady, setRefReady] = useState(false);
  const isInternalChange = useRef(false);

  const setRef = useCallback((el: HTMLUListElement | null) => {
    ulRef.current = el;
    if (el) setRefReady(true);
  }, []);

  useLayoutEffect(() => {
    const ul = ulRef.current;
    if (!ul || isInternalChange.current) return;
    const valueLines = value.trim() ? value.split("\n").map((l) => l.trim()).filter(Boolean) : [];
    const currentLines = getLinesFromList(ul);
    const same =
      currentLines.length === valueLines.length &&
      currentLines.every((l, i) => l === valueLines[i]);
    if (currentLines.length === 0 || !same) {
      setListContent(ul, valueLines.length ? valueLines : [""]);
    }
  }, [value, refReady]);

  const emitChange = useCallback(() => {
    const ul = ulRef.current;
    if (!ul) return;
    const lines = getLinesFromList(ul).filter((l) => l.length > 0);
    isInternalChange.current = true;
    onChange(lines.join("\n"));
    requestAnimationFrame(() => {
      isInternalChange.current = false;
    });
  }, [onChange]);

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
      onBlur={onBlur}
      data-placeholder={placeholder}
      data-field-id={dataFieldId}
      className={`list-disc pl-6 space-y-2 min-h-[120px] w-full resize-y border-2 border-transparent rounded-md py-3 px-2 text-base leading-relaxed outline-none bg-transparent text-gray-900 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 [&:focus]:outline-none [&:focus]:border-gray-400 [&_li]:leading-relaxed transition-colors ${className}`}
      style={{ outline: "none" }}
    />
  );
}
