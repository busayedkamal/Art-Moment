import React from 'react';
import { Globe2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguageToggle() {
  const { isArabic, toggleLanguage } = useLanguage();
  const label = isArabic ? 'EN' : 'عربي';
  const accessibleLabel = isArabic ? 'Switch to English' : 'Switch to Arabic';
  const placementClass = isArabic ? 'left-3 sm:left-5' : 'right-3 sm:right-5';

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      dir={isArabic ? 'ltr' : 'rtl'}
      data-no-translate
      className={`fixed top-3 z-[150] inline-flex h-10 min-w-16 items-center justify-center gap-2 rounded-full border border-[#D9A3AA]/25 bg-[#F8F5F2]/95 px-3 text-xs font-black text-[#393737] shadow-[0_8px_24px_rgba(57,55,55,0.10)] backdrop-blur transition-colors hover:border-[#C5A059] hover:text-[#9E7D35] ${placementClass}`}
    >
      <span>{label}</span>
      <Globe2 size={16} />
    </button>
  );
}
