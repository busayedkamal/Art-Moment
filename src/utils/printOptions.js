const labels = {
  ar: {
    photo_paper: 'ورق صور', magnetic: 'مغناطيسي', adhesive: 'لاصق', mounted: 'مثبت على قاعدة',
    glossy: 'لامع', matte: 'مطفي', none: 'بدون سطح', borderless: 'بدون حواف', white_border: 'حواف بيضاء',
    fill: 'ملء الورق', fit: 'الصورة كاملة',
  },
  en: {
    photo_paper: 'Photo paper', magnetic: 'Magnetic', adhesive: 'Adhesive', mounted: 'Mounted',
    glossy: 'Glossy', matte: 'Matte', none: 'No surface', borderless: 'Borderless', white_border: 'White border',
    fill: 'Fill paper', fit: 'Full photo',
  },
};

export function getPrintOptionLabels(options, language = 'ar') {
  const source = options && typeof options === 'object' ? options : {};
  const text = labels[language] || labels.ar;
  return [
    source.print_size,
    text[source.material],
    text[source.surface],
    text[source.border_style],
    text[source.fit_mode],
  ].filter(Boolean);
}

export function formatPrintOptionSummary(options, language = 'ar') {
  return getPrintOptionLabels(options, language).join(' · ');
}
