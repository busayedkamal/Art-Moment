import { useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translateUiText } from '../i18n/translations';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE']);
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label'];
const originalTextValues = new WeakMap();
const originalAttributeValues = new WeakMap();

function shouldSkip(element) {
  if (!element) return true;
  if (SKIP_TAGS.has(element.tagName)) return true;
  if (element.closest?.('[data-no-translate], [contenteditable="true"]')) return true;
  return false;
}

function translateTextNode(node, language) {
  if (!node?.parentElement || shouldSkip(node.parentElement)) return;

  const current = node.nodeValue;
  const saved = originalTextValues.get(node);
  let source = saved?.source ?? current;
  if (saved && current !== saved.source && current !== saved.translated) source = current;

  const translated = language === 'en' ? translateUiText(source, language) : source;
  originalTextValues.set(node, { source, translated });
  if (translated !== current) node.nodeValue = translated;
}

function translateAttributes(element, language) {
  if (!(element instanceof Element) || shouldSkip(element)) return;
  let savedAttributes = originalAttributeValues.get(element);
  if (!savedAttributes) {
    savedAttributes = new Map();
    originalAttributeValues.set(element, savedAttributes);
  }

  TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
    if (!element.hasAttribute(attribute)) return;
    const current = element.getAttribute(attribute);
    const saved = savedAttributes.get(attribute);
    let source = saved?.source ?? current;
    if (saved && current !== saved.source && current !== saved.translated) source = current;

    const translated = language === 'en' ? translateUiText(source, language) : source;
    savedAttributes.set(attribute, { source, translated });
    if (translated !== current) element.setAttribute(attribute, translated);
  });
}

function translateElement(element, language) {
  if (!(element instanceof Element) || shouldSkip(element)) return;

  translateAttributes(element, language);
  element.querySelectorAll('*').forEach((descendant) => {
    translateAttributes(descendant, language);
  });

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();
  while (textNode) {
    translateTextNode(textNode, language);
    textNode = walker.nextNode();
  }
}

export default function DomTranslator() {
  const { language } = useLanguage();

  useEffect(() => {
    const root = document.getElementById('app-language-scope');
    if (!root) return undefined;
    translateElement(root, language);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target, language);
          return;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language);
          if (node.nodeType === Node.ELEMENT_NODE) translateElement(node, language);
        });
      });
    });

    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return null;
}
