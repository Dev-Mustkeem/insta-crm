"use client";

import { useEffect } from "react";
import { toHindi } from "@/lib/hi-dictionary";

const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "NOSCRIPT"]);

function translateTextNode(node: Text) {
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest("[data-no-translate]")) return;
  const value = node.nodeValue;
  if (!value || !/[A-Za-z]/.test(value)) return;
  const translated = toHindi(value);
  if (translated !== value) node.nodeValue = translated;
}

function translateElement(el: Element) {
  if (el.closest("[data-no-translate]")) return;
  for (const attribute of ATTRIBUTES) {
    const value = el.getAttribute(attribute);
    if (value && /[A-Za-z]/.test(value)) {
      const translated = toHindi(value);
      if (translated !== value) el.setAttribute(attribute, translated);
    }
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  translateElement(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
    else translateElement(node as Element);
    node = walker.nextNode();
  }
}

/**
 * Translates all visible English UI text to Hindi while the Hindi locale is active.
 * Text nodes and a few attributes are rewritten in place (React nodes are never replaced),
 * and a MutationObserver keeps newly rendered content translated.
 */
export function HindiTranslator() {
  useEffect(() => {
    translateTree(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") mutation.addedNodes.forEach(translateTree);
        else if (mutation.type === "characterData") translateTree(mutation.target);
        else if (mutation.target instanceof Element) translateElement(mutation.target);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });
    const originalConfirm = window.confirm;
    const originalAlert = window.alert;
    window.confirm = (message?: string) => originalConfirm.call(window, message ? toHindi(message) : message);
    window.alert = (message?: unknown) => originalAlert.call(window, typeof message === "string" ? toHindi(message) : message);
    return () => {
      observer.disconnect();
      window.confirm = originalConfirm;
      window.alert = originalAlert;
    };
  }, []);

  return null;
}
