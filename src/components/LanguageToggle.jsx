import React from 'react';
import { Globe2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguageToggle() {
  const { isArabic, toggleLanguage } = useLanguage();
  const label = isArabic ? 'EN' : 'عربي';
  const accessibleLabel = isArabic ? 'Switch to English' : 'Switch to Arabic';

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      dir={isArabic ? 'ltr' : 'rtl'}
      data-no-translate
      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#E8B4BC]/20 bg-white px-3 py-2 text-xs font-bold text-[#171717] shadow-sm transition-all hover:text-[#E8B4BC]"
    >
      <span>{label}</span>
      <Globe2 size={16} />
    </button>
  );
}
