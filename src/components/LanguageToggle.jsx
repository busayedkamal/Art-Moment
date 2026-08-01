import React from 'react';
import { Globe2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguageToggle() {
  const { isArabic, toggleLanguage } = useLanguage();
  const label = isArabic ? 'EN' : 'عربي';
  const accessibleLabel = isArabic ? 'Switch to English' : 'التبديل إلى اللغة العربية';

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      data-no-translate
      className="fixed left-3 top-[5.25rem] z-[150] inline-flex h-10 min-w-16 items-center justify-center gap-2 rounded-full border border-[#D9A3AA]/25 bg-[#F8F5F2]/95 px-3 text-xs font-black text-[#393737] shadow-[0_8px_24px_rgba(57,55,55,0.10)] backdrop-blur transition-colors hover:border-[#C5A059] hover:text-[#9E7D35] sm:left-5 sm:top-3"
    >
      <span>{label}</span>
      <Globe2 size={16} />
    </button>
  );
}
