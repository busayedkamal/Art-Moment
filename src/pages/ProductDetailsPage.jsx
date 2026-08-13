import React, { useEffect, useMemo, useState } from 'react';
import {
  Check, ChevronDown, Clock3, Image as ImageIcon,
  Minus, PackageCheck, Plus, RotateCcw, ShieldCheck, ShoppingCart,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import PublicHeader from '../components/PublicHeader';
import SeoHead from '../components/SeoHead';
import {
  getCartLineKey,
  getMissingRequiredOptions,
  getProductPriceWithOptions,
  getSelectedOptionLabels,
  localizeProductOptions,
  normalizeSelectedOptions,
} from '../utils/productOptions';
import { isProductAvailable, normalizeStockQuantity } from '../utils/productStock';
import { trackStoreEvent } from '../utils/storeAnalytics';
import { useLanguage } from '../contexts/LanguageContext';

function fromDb(product, language) {
  const stockQuantity = normalizeStockQuantity(product?.stock_quantity);
  return {
    id: product?.id,
    name: language === 'en' && product?.name_en ? product.name_en : (product?.name || ''),
    description: language === 'en' && product?.description_en
      ? product.description_en
      : (product?.description || ''),
    price: Number(product?.price || 0),
    category: product?.category || '',
    image: product?.image || null,
    hoverImage: product?.hover_image || null,
    galleryImages: Array.isArray(product?.gallery_images) ? product.gallery_images.filter(Boolean) : [],
    specifications: language === 'en'
      && product?.specifications_en
      && typeof product.specifications_en === 'object'
      && Object.keys(product.specifications_en).length > 0
      ? product.specifications_en
      : (product?.specifications && typeof product.specifications === 'object' ? product.specifications : {}),
    productOptions: localizeProductOptions(product?.product_options, language),
    packageContents: language === 'en' && product?.package_contents_en
      ? product.package_contents_en
      : (product?.package_contents || ''),
    preparationTime: language === 'en' && product?.preparation_time_en
      ? product.preparation_time_en
      : (product?.preparation_time || ''),
    returnPolicy: language === 'en' && product?.return_policy_en
      ? product.return_policy_en
      : (product?.return_policy || ''),
    productFaqs: language === 'en' && Array.isArray(product?.product_faqs_en) && product.product_faqs_en.length > 0
      ? product.product_faqs_en
      : (Array.isArray(product?.product_faqs) ? product.product_faqs : []),
    productGroupCode: product?.product_group_code || '',
    stockQuantity,
    inStock: (product?.in_stock ?? true) && (stockQuantity === null || stockQuantity > 0),
  };
}

function getCategoryLabel(category, language) {
  const labels = {
    albums: { ar: 'ألبومات', en: 'Albums' },
    frames: { ar: 'إطارات', en: 'Frames' },
    stickers: { ar: 'ملصقات', en: 'Stickers' },
  };
  return labels[category]?.[language] || category || (language === 'en' ? 'Art Moment products' : 'منتجات لحظة فن');
}

export default function ProductDetailsPage() {
  const { productId } = useParams();
  const { language, direction } = useLanguage();
  const text = language === 'en' ? {
    notFound: 'We could not find this product.', back: 'Store', price: 'Price', available: 'Available',
    availableCount: (count) => `${count} available`, unavailable: 'Out of stock', add: 'Add to cart',
    added: 'Product added to cart', choose: (items) => `Choose ${items.join(' and ')}`,
    stockOnly: (count) => `Only ${count} available`, fallback: 'Carefully selected by Art Moment to preserve your memories.',
    package: 'What is included', preparation: 'Preparation and dispatch', returns: 'Return policy', faq: 'Frequently asked questions',
    secure: 'Secure checkout', original: 'Authentic product details', support: 'Support before and after your order', quantity: 'Quantity',
  } : {
    notFound: 'تعذر العثور على هذا المنتج.', back: 'المتجر', price: 'السعر', available: 'متوفر',
    availableCount: (count) => `المتوفر ${count}`, unavailable: 'غير متوفر', add: 'إضافة إلى السلة',
    added: 'تمت إضافة المنتج إلى السلة', choose: (items) => `اختاري ${items.join(' و ')}`,
    stockOnly: (count) => `المتوفر حالياً ${count} فقط`, fallback: 'منتج مختار بعناية من لحظة فن لتوثيق ذكرياتك.',
    package: 'محتويات العبوة', preparation: 'التجهيز والشحن', returns: 'سياسة الاسترجاع', faq: 'أسئلة متكررة',
    secure: 'دفع آمن', original: 'تفاصيل واضحة للمنتج', support: 'دعم قبل الطلب وبعده', quantity: 'الكمية',
  };
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadProduct() {
      setLoading(true);
      setError('');
      const { data, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

      if (cancelled) return;
      if (productError || !data) {
        setError(text.notFound);
        setLoading(false);
        return;
      }

      const normalized = fromDb(data, language);
      setProduct(normalized);
      setSelectedImage(normalized.image || normalized.hoverImage || '');
      const defaultSelections = {};
      normalized.productOptions.forEach((option) => {
        if (option.values.length === 1) defaultSelections[option.id] = option.values[0].value;
      });
      setSelectedOptions(defaultSelections);
      setLoading(false);
      trackStoreEvent('product_view', { productId: normalized.id, category: normalized.category });
    }

    loadProduct();
    const savedCart = JSON.parse(localStorage.getItem('art_moment_cart') || '[]');
    setCartCount(savedCart.reduce((sum, item) => sum + Number(item.qty || 0), 0));
    return () => { cancelled = true; };
  }, [language, productId, text.notFound]);

  const images = useMemo(() => {
    if (!product) return [];
    return [...new Set([product.image, product.hoverImage, ...product.galleryImages].filter(Boolean))];
  }, [product]);

  const normalizedSelections = useMemo(
    () => normalizeSelectedOptions(selectedOptions, product?.productOptions),
    [product?.productOptions, selectedOptions],
  );
  const missingOptions = useMemo(
    () => getMissingRequiredOptions(product?.productOptions, normalizedSelections),
    [normalizedSelections, product?.productOptions],
  );
  const selectedLabels = useMemo(
    () => getSelectedOptionLabels(product?.productOptions, normalizedSelections),
    [normalizedSelections, product?.productOptions],
  );
  const unitPrice = useMemo(
    () => getProductPriceWithOptions(product?.price, product?.productOptions, normalizedSelections),
    [normalizedSelections, product?.price, product?.productOptions],
  );

  const structuredData = useMemo(() => {
    if (!product) return [];
    const pageUrl = `https://art-moment.com/store/products/${product.id}`;
    const productNode = {
      '@type': 'Product',
      '@id': `${pageUrl}#product`,
      name: product.name,
      description: product.description || text.fallback,
      image: images,
      sku: String(product.id),
      category: getCategoryLabel(product.category, language),
      ...(product.productGroupCode ? {
        isVariantOf: {
          '@type': 'ProductGroup',
          productGroupID: product.productGroupCode,
          name: product.name,
          variesBy: product.productOptions.map((option) => option.name),
        },
      } : {}),
      offers: {
        '@type': 'Offer',
        url: pageUrl,
        priceCurrency: 'SAR',
        price: unitPrice.toFixed(2),
        availability: isProductAvailable(product)
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    };
    const graph = [
      productNode,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: language === 'en' ? 'Home' : 'الرئيسية', item: 'https://art-moment.com/' },
          { '@type': 'ListItem', position: 2, name: language === 'en' ? 'Store' : 'المتجر', item: 'https://art-moment.com/store' },
          { '@type': 'ListItem', position: 3, name: product.name, item: pageUrl },
        ],
      },
    ];
    if (product.productFaqs.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: product.productFaqs.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      });
    }
    return graph;
  }, [images, language, product, text.fallback, unitPrice]);

  const addToCart = () => {
    if (!product || !isProductAvailable(product)) {
      toast.error(text.unavailable);
      return;
    }
    if (missingOptions.length > 0) {
      toast.error(text.choose(missingOptions));
      return;
    }

    const savedCart = JSON.parse(localStorage.getItem('art_moment_cart') || '[]');
    const currentProductQuantity = savedCart
      .filter((item) => String(item.id) === String(product.id))
      .reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const requestedQuantity = Number(quantity || 1);

    if (product.stockQuantity !== null && currentProductQuantity + requestedQuantity > product.stockQuantity) {
      toast.error(text.stockOnly(product.stockQuantity));
      return;
    }

    const cartKey = getCartLineKey(product.id, normalizedSelections);
    const existing = savedCart.find((item) => (
      String(item.cartKey || getCartLineKey(item.id, item.selectedOptions)) === cartKey
    ));

    if (existing) {
      existing.qty = Number(existing.qty || 0) + requestedQuantity;
      existing.price = unitPrice;
      existing.stockQuantity = product.stockQuantity;
      existing.inStock = product.inStock;
    } else {
      savedCart.push({
        ...product,
        cartKey,
        price: unitPrice,
        basePrice: product.price,
        qty: requestedQuantity,
        selectedOptions: normalizedSelections,
        selectedOptionLabels: selectedLabels,
      });
    }

    localStorage.setItem('art_moment_cart', JSON.stringify(savedCart));
    setCartCount(savedCart.reduce((sum, item) => sum + Number(item.qty || 0), 0));
    trackStoreEvent('add_to_cart', {
      productId: product.id,
      quantity: requestedQuantity,
      selectedOptions: normalizedSelections,
    });
    toast.success(text.added);
  };

  if (loading) {
    return (
      <div className="art-page flex min-h-screen items-center justify-center font-[Tajawal]" dir={direction}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E8B4BC]/25 border-t-[#E8B4BC]" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="art-page flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center font-[Tajawal]" dir={direction}>
        <ImageIcon size={46} className="text-[#E8B4BC]/40" />
        <h1 className="text-2xl font-black text-[#171717]">{error}</h1>
        <Link to="/store" className="rounded-xl bg-[#171717] px-6 py-3 text-sm font-black text-white">
          {text.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="art-page min-h-screen pb-32 font-[Tajawal] text-[#171717] lg:pb-24" dir={direction}>
      <SeoHead
        title={`${product.name} | ${language === 'en' ? 'Art Moment Store' : 'متجر لحظة فن'}`}
        description={(product.description || text.fallback).slice(0, 160)}
        path={`/store/products/${product.id}`}
        image={images[0]}
        type="product"
        structuredData={structuredData}
      />
      <PublicHeader cartCount={cartCount} />

      <main className="art-shell py-6 sm:py-10">
        <nav className="mb-6 flex items-center gap-2 text-xs font-bold text-[#171717]/50" aria-label={language === 'en' ? 'Breadcrumb' : 'مسار التنقل'}>
          <Link to="/" className="hover:text-[#B96F7D]">{language === 'en' ? 'Home' : 'الرئيسية'}</Link>
          <span>/</span>
          <Link to="/store" className="hover:text-[#B96F7D]">{language === 'en' ? 'Store' : 'المتجر'}</Link>
          <span>/</span>
          <span className="truncate text-[#171717]" aria-current="page">{product.name}</span>
        </nav>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-start">
          <section className="min-w-0">
            <div className="aspect-square overflow-hidden rounded-2xl border border-[#E8B4BC]/12 bg-white">
              {selectedImage ? (
                <img src={selectedImage} alt={product.name} width="900" height="900" loading="eager" decoding="async" fetchPriority="high" className="h-full w-full object-contain p-3 sm:p-7" />
              ) : (
                <ImageIcon className="h-full w-full p-24 text-[#E8B4BC]/15" />
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {images.map((image) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    className={`aspect-square overflow-hidden rounded-xl border bg-white ${
                      selectedImage === image ? 'border-[#C6A56B] ring-2 ring-[#C6A56B]/15' : 'border-[#E8B4BC]/15'
                    }`}
                  >
                    <img src={image} alt={`${product.name} - صورة إضافية`} width="180" height="180" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="min-w-0">
            <span className="inline-flex rounded-full bg-[#E8B4BC]/10 px-3 py-1 text-[11px] font-black text-[#B97882]">
              {getCategoryLabel(product.category, language)}
            </span>
            <h1 className="art-page-title mt-4">{product.name}</h1>
            <p className="art-body mt-4 font-medium">
              {product.description || text.fallback}
            </p>

            <div className="mt-6 flex items-end justify-between border-y border-[#E8B4BC]/12 py-5">
              <div>
                <span className="block text-[11px] font-bold text-[#171717]/45">{text.price}</span>
                <strong className="mt-1 block text-3xl font-black text-[#C6A56B]">{unitPrice.toFixed(2)} {language === 'en' ? 'SAR' : 'ر.س'}</strong>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-black ${
                isProductAvailable(product) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}>
                {isProductAvailable(product)
                  ? product.stockQuantity === null ? text.available : text.availableCount(product.stockQuantity)
                  : text.unavailable}
              </span>
            </div>

            {product.productOptions.length > 0 && (
              <div className="mt-6 space-y-6">
                {product.productOptions.map((option) => (
                  <fieldset key={option.id}>
                    <legend className="mb-3 text-sm font-black">
                      {option.name}
                      {option.required && <span className="mr-1 text-red-500">*</span>}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {option.values.map((value) => {
                        const active = normalizedSelections[option.id] === value.value;
                        return (
                          <button
                            key={value.value}
                            type="button"
                            onClick={() => setSelectedOptions((current) => ({ ...current, [option.id]: value.value }))}
                            className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition-colors ${
                              active
                                ? 'border-[#C6A56B] bg-[#C6A56B] text-white'
                                : 'border-[#E8B4BC]/20 bg-white hover:border-[#C6A56B]/50'
                            }`}
                          >
                            {value.colorHex && (
                              <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: value.colorHex }} />
                            )}
                            {value.label}
                            {active && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            )}

            {Object.keys(product.specifications).length > 0 && (
              <dl className="mt-7 divide-y divide-[#E8B4BC]/10 rounded-2xl border border-[#E8B4BC]/12 bg-white px-4">
                {Object.entries(product.specifications).map(([name, value]) => (
                  <div key={name} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <dt className="font-bold text-[#171717]/55">{name}</dt>
                    <dd className="font-black">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-7 grid grid-cols-3 gap-2 border-y border-[#171717]/8 py-4 text-center">
              {[
                [ShieldCheck, text.secure],
                [PackageCheck, text.original],
                [Check, text.support],
              ].map(([icon, label]) => (
                <div key={label} className="flex min-h-16 flex-col items-center justify-center gap-2 px-1 text-[10px] font-black text-[#171717]/60 sm:text-xs">
                  {React.createElement(icon, { size: 18, className: 'text-[#C6A56B]' })} {label}
                </div>
              ))}
            </div>

            {(product.packageContents || product.preparationTime || product.returnPolicy) && (
              <div className="mt-7 divide-y divide-[#171717]/8 border-y border-[#171717]/8">
                {[
                  [PackageCheck, text.package, product.packageContents],
                  [Clock3, text.preparation, product.preparationTime],
                  [RotateCcw, text.returns, product.returnPolicy],
                ].filter(([, , value]) => value).map(([icon, title, value]) => (
                  <div key={title} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 py-4">
                    <span className="flex h-11 w-11 items-center justify-center bg-[#FAF9F7] text-[#C6A56B]">{React.createElement(icon, { size: 19 })}</span>
                    <div><h2 className="text-sm font-black">{title}</h2><p className="mt-1 whitespace-pre-line text-sm leading-7 text-[#171717]/60">{value}</p></div>
                  </div>
                ))}
              </div>
            )}

            {product.productFaqs.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-lg font-black">{text.faq}</h2>
                <div className="divide-y divide-[#171717]/8 border-y border-[#171717]/8">
                  {product.productFaqs.map((item) => (
                    <details key={item.question} className="group py-1">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-black">
                        {item.question}<ChevronDown size={17} className="shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="pb-4 text-sm leading-7 text-[#171717]/60">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-7 grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
              <div className="flex h-14 items-center justify-between rounded-xl border border-[#E8B4BC]/20 bg-white px-2">
                <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="flex h-11 w-11 items-center justify-center" aria-label="تقليل الكمية">
                  <Minus size={17} />
                </button>
                <output className="font-black">{quantity}</output>
                <button
                  type="button"
                  onClick={() => setQuantity((current) => (
                    product.stockQuantity === null ? current + 1 : Math.min(product.stockQuantity, current + 1)
                  ))}
                  className="flex h-11 w-11 items-center justify-center"
                  aria-label="زيادة الكمية"
                >
                  <Plus size={17} />
                </button>
              </div>
              <button
                type="button"
                onClick={addToCart}
                disabled={!isProductAvailable(product)}
                className="flex h-14 items-center justify-center gap-2 rounded-xl bg-[#171717] px-5 text-sm font-black text-white shadow-lg transition-colors hover:bg-[#C6A56B] disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <ShoppingCart size={19} /> {text.add}
              </button>
            </div>
          </section>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <button type="button" onClick={addToCart} disabled={!isProductAvailable(product)} className="flex min-h-12 items-center justify-center gap-2 bg-[#171717] px-5 text-sm font-black text-white disabled:bg-gray-300">
            <ShoppingCart size={19} /> {text.add}
          </button>
          <div className="text-end"><span className="block text-[9px] font-bold text-black/40">{text.price}</span><strong className="text-lg font-black text-[#C6A56B]">{unitPrice.toFixed(2)}</strong></div>
        </div>
      </div>
    </div>
  );
}
