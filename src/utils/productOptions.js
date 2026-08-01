export function normalizeProductOptions(rawOptions) {
  const options = Array.isArray(rawOptions) ? rawOptions : [];

  return options
    .map((option, optionIndex) => {
      const name = String(option?.name || '').trim();
      const nameEn = String(option?.nameEn || option?.name_en || '').trim();
      const id = String(option?.id || `option_${optionIndex + 1}`).trim();
      const values = (Array.isArray(option?.values) ? option.values : [])
        .map((rawValue) => {
          const valueObject = typeof rawValue === 'string'
            ? { value: rawValue, label: rawValue }
            : rawValue || {};
          const label = String(valueObject.label || valueObject.value || '').trim();
          const labelEn = String(valueObject.labelEn || valueObject.label_en || '').trim();
          const value = String(valueObject.value || label).trim();
          if (!label || !value) return null;

          return {
            value,
            label,
            labelEn,
            priceDelta: Number(valueObject.priceDelta || valueObject.price_delta || 0),
            colorHex: String(valueObject.colorHex || valueObject.color_hex || '').trim() || null,
          };
        })
        .filter(Boolean);

      if (!name || values.length === 0) return null;
      return {
        id,
        name,
        nameEn,
        required: option?.required !== false,
        values,
      };
    })
    .filter(Boolean);
}

export function localizeProductOptions(rawOptions, language = 'ar') {
  return normalizeProductOptions(rawOptions).map((option) => ({
    ...option,
    name: language === 'en' && option.nameEn ? option.nameEn : option.name,
    values: option.values.map((value) => ({
      ...value,
      label: language === 'en' && value.labelEn ? value.labelEn : value.label,
    })),
  }));
}

export function normalizeSelectedOptions(rawSelections, productOptions = []) {
  const selections = rawSelections && typeof rawSelections === 'object' && !Array.isArray(rawSelections)
    ? rawSelections
    : {};
  const normalized = {};

  normalizeProductOptions(productOptions).forEach((option) => {
    const selectedValue = String(selections[option.id] || '').trim();
    const match = option.values.find((value) => value.value === selectedValue);
    if (match) normalized[option.id] = match.value;
  });

  return normalized;
}

export function getMissingRequiredOptions(productOptions, selections) {
  const normalizedSelections = normalizeSelectedOptions(selections, productOptions);
  return normalizeProductOptions(productOptions)
    .filter((option) => option.required && !normalizedSelections[option.id])
    .map((option) => option.name);
}

export function getProductPriceWithOptions(basePrice, productOptions, selections) {
  const normalizedSelections = normalizeSelectedOptions(selections, productOptions);
  const optionDelta = normalizeProductOptions(productOptions).reduce((sum, option) => {
    const selected = option.values.find((value) => value.value === normalizedSelections[option.id]);
    return sum + Number(selected?.priceDelta || 0);
  }, 0);

  return Number((Number(basePrice || 0) + optionDelta).toFixed(2));
}

export function getCartLineKey(productId, selections = {}) {
  const optionKey = Object.entries(selections)
    .filter(([, value]) => String(value || '').trim())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join('|');

  return `${productId}${optionKey ? `::${optionKey}` : ''}`;
}

export function getSelectedOptionLabels(productOptions, selections) {
  const normalizedSelections = normalizeSelectedOptions(selections, productOptions);
  return normalizeProductOptions(productOptions)
    .map((option) => {
      const selected = option.values.find((value) => value.value === normalizedSelections[option.id]);
      return selected ? { id: option.id, name: option.name, value: selected.value, label: selected.label } : null;
    })
    .filter(Boolean);
}
