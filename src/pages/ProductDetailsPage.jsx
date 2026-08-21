import React, { useEffect, useMemo, useState } from 'react';
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Copy, Image as ImageIcon,
  Mail, Maximize2, MessageCircle, Minus, PackageCheck, Plus, Printer, RotateCcw,
  Send, Share2, ShieldCheck, ShoppingCart, Sparkles, X,
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
    productType: product?.product_type || '',
    sortOrder: product?.sort_order ?? 0,
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

function getProductType(product) {
  const explicitType = String(product?.productType || '').trim().toLowerCase();
  if (explicitType) return explicitType;
  const category = String(product?.category || '').toLowerCase();
  const searchable = [product?.name, product?.description].filter(Boolean).join(' ').toLowerCase();
  if (category === 'albums' || category === 'ألبومات') return 'album';
  if (category === 'frames' || category === 'إطارات') return 'frame';
  if (category === 'stickers' || category === 'ملصقات') return 'accessory';
  if (category === 'printing' || category === 'طباعة' || /باقة|package|طباعة/.test(searchable)) return 'printing_bundle';
  return 'product';
}

function getBundleCapacity(product) {
  const entries = Object.entries(product?.specifications || {});
  const capacityEntry = entries.find(([key]) => /سعة|عدد الصور|capacity|photos/i.test(key));
  const source = capacityEntry?.[1] || [product?.name, product?.description].filter(Boolean).join(' ');
  const matches = String(source).match(/\d[\d,]*/g) || [];
  const values = matches.map((value) => Number(value.replaceAll(',', ''))).filter(Number.isFinite);
  return values.length > 0 ? Math.max(...values) : null;
}

function getRecommendedProducts(currentProduct, candidates) {
  const currentText = [currentProduct?.name, currentProduct?.description, currentProduct?.category].filter(Boolean).join(' ').toLowerCase();
  const isA4 = currentText.includes('a4');
  const isSmallPrint = /(?:10\s*[x×*]\s*15)|(?:4\s*[x×*]\s*6)/i.test(currentText);
  const currentType = getProductType(currentProduct);

  return candidates
    .filter((candidate) => String(candidate.id) !== String(currentProduct.id) && isProductAvailable(candidate))
    .map((candidate) => {
      const candidateText = [candidate.name, candidate.description, candidate.category].filter(Boolean).join(' ').toLowerCase();
      const candidateType = getProductType(candidate);
      let score = candidate.category !== currentProduct.category ? 1 : 0;
      if (isA4 && candidateType === 'frame') score += 5;
      if (isA4 && candidateText.includes('a4')) score += 3;
      if (isSmallPrint && candidateType === 'album') score += 5;
      if (isSmallPrint && /(?:10\s*[x×*]\s*15)|(?:4\s*[x×*]\s*6)/i.test(candidateText)) score += 3;
      if (currentType === 'album' && candidateType === 'printing_bundle') score += 5;
      if (currentType === 'printing_bundle' && candidateType === 'album') score += 5;
      if (currentType === 'frame' && candidateType === 'printing_bundle') score += 4;
      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score || left.candidate.sortOrder - right.candidate.sortOrder)
    .slice(0, 4)
    .map(({ candidate }) => candidate);
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
    share: 'Share product', copied: 'Product link copied', related: 'You may also like', printNow: 'Print photos for this product',
    bundle: 'This package includes', bundleCapacity: (count) => 'Print up to ' + count + ' photos', choosePackage: 'Choose package', close: 'Close image',
  } : {
    notFound: 'تعذر العثور على هذا المنتج.', back: 'المتجر', price: 'السعر', available: 'متوفر',
    availableCount: (count) => `المتوفر ${count}`, unavailable: 'غير متوفر', add: 'إضافة إلى السلة',
    added: 'تمت إضافة المنتج إلى السلة', choose: (items) => `اختاري ${items.join(' و ')}`,
    stockOnly: (count) => `المتوفر حالياً ${count} فقط`, fallback: 'منتج مختار بعناية من لحظة فن لتوثيق ذكرياتك.',
    package: 'محتويات العبوة', preparation: 'التجهيز والشحن', returns: 'سياسة الاسترجاع', faq: 'أسئلة متكررة',
    secure: 'دفع آمن', original: 'تفاصيل واضحة للمنتج', support: 'دعم قبل الطلب وبعده', quantity: 'الكمية',
    share: 'مشاركة المنتج', copied: 'تم نسخ رابط المنتج', related: 'قد يعجبك أيضًا', printNow: 'اطبعي صورك لهذا المنتج',
    bundle: 'تتضمن الباقة', bundleCapacity: (count) => 'اطبعي حتى ' + count + ' صورة ضمن الباقة', choosePackage: 'اختيار الباقة', close: 'إغلاق الصورة',
  };
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);
  const [recommendations, setRecommendations] = useState([]);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);

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
      const { data: recommendationRows } = await supabase
        .from('products')
        .select('*')
        .neq('id', data.id)
        .order('sort_order', { ascending: true })
        .limit(16);
      if (!cancelled) {
        const candidates = (recommendationRows || []).map((row) => fromDb(row, language));
        setRecommendations(getRecommendedProducts(normalized, candidates));
      }
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

  const productType = getProductType(product);
  const isPrintingBundle = productType === 'printing_bundle';
  const bundleCapacity = isPrintingBundle ? getBundleCapacity(product) : null;
  const productUrl = product ? 'https://art-moment.com/store/products/' + product.id : '';
  const shareText = product
    ? (language === 'en'
      ? 'See ' + product.name + ' from Art Moment. View the details and current price:'
      : 'شاهد هذا المنتج من لحظة فن: ' + product.name + '. اطلع على التفاصيل والسعر الحالي:')
    : '';

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

  const copyProductLink = async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      toast.success(text.copied);
      trackStoreEvent('product_share', { productId: product.id, channel: 'copy' });
      setIsShareOpen(false);
    } catch {
      setIsShareOpen(true);
    }
  };

  const handleShare = async () => {
    const shareData = { title: product.name, text: shareText, url: productUrl };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        trackStoreEvent('product_share', { productId: product.id, channel: 'native' });
        return;
      } catch (shareError) {
        if (shareError?.name === 'AbortError') return;
      }
    }
    setIsShareOpen((current) => !current);
  };

  const showAdjacentImage = (directionDelta) => {
    if (images.length < 2) return;
    const currentIndex = Math.max(0, images.indexOf(selectedImage));
    const nextIndex = (currentIndex + directionDelta + images.length) % images.length;
    setSelectedImage(images[nextIndex]);
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
            <button
              type="button"
              onClick={() => selectedImage && setIsImageOpen(true)}
              className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-[#E8B4BC]/12 bg-white text-start"
              aria-label={language === 'en' ? 'Enlarge product image' : 'تكبير صورة المنتج'}
            >
              {selectedImage ? (
                <img src={selectedImage} alt={product.name} width="900" height="900" loading="eager" decoding="async" fetchPriority="high" className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.02] sm:p-7" />
              ) : (
                <ImageIcon className="h-full w-full p-24 text-[#E8B4BC]/15" />
              )}
              {selectedImage && (
                <span className="absolute bottom-3 end-3 flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/90 text-[#171717] shadow-sm backdrop-blur">
                  <Maximize2 size={18} />
                </span>
              )}
            </button>
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
            <div className="relative mt-4 flex items-start justify-between gap-4">
              <h1 className="art-page-title min-w-0">{product.name}</h1>
              <button
                type="button"
                onClick={handleShare}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E8B4BC]/20 bg-white text-[#171717] transition-colors hover:border-[#C6A56B] hover:text-[#B96F7D]"
                aria-label={text.share}
                title={text.share}
              >
                <Share2 size={19} />
              </button>
              {isShareOpen && (
                <div className="absolute end-0 top-14 z-30 grid min-w-56 grid-cols-2 gap-2 rounded-xl border border-[#E8B4BC]/20 bg-white p-3 shadow-xl">
                  <a
                    href={'https://wa.me/?text=' + encodeURIComponent(shareText + '\n' + productUrl)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackStoreEvent('product_share', { productId: product.id, channel: 'whatsapp' })}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 text-xs font-black text-emerald-700"
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                  <a
                    href={'https://t.me/share/url?url=' + encodeURIComponent(productUrl) + '&text=' + encodeURIComponent(shareText)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackStoreEvent('product_share', { productId: product.id, channel: 'telegram' })}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sky-50 px-3 text-xs font-black text-sky-700"
                  >
                    <Send size={16} /> Telegram
                  </a>
                  <a
                    href={'mailto:?subject=' + encodeURIComponent(product.name) + '&body=' + encodeURIComponent(shareText + '\n' + productUrl)}
                    onClick={() => trackStoreEvent('product_share', { productId: product.id, channel: 'email' })}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#FAF9F7] px-3 text-xs font-black text-[#171717]"
                  >
                    <Mail size={16} /> {language === 'en' ? 'Email' : 'البريد'}
                  </a>
                  <button
                    type="button"
                    onClick={copyProductLink}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#FAF9F7] px-3 text-xs font-black text-[#171717]"
                  >
                    <Copy size={16} /> {language === 'en' ? 'Copy' : 'نسخ الرابط'}
                  </button>
                </div>
              )}
            </div>
            <p className="art-body mt-4 font-medium">
              {product.description || text.fallback}
            </p>

            {isPrintingBundle && (
              <section className="mt-5 border-s-4 border-[#C6A56B] bg-[#C6A56B]/8 p-4">
                <div className="flex items-start gap-3">
                  <PackageCheck size={22} className="mt-0.5 shrink-0 text-[#C6A56B]" />
                  <div>
                    <h2 className="text-sm font-black text-[#171717]">{text.bundle}</h2>
                    {bundleCapacity && <p className="mt-1 text-lg font-black text-[#B97882]">{text.bundleCapacity(bundleCapacity)}</p>}
                    {product.packageContents && <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#171717]/65">{product.packageContents}</p>}
                  </div>
                </div>
              </section>
            )}

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
                <ShoppingCart size={19} /> {isPrintingBundle ? text.choosePackage : text.add}
              </button>
            </div>
          </section>
        </div>

        {['album', 'frame', 'printing_bundle'].includes(productType) && (
          <section className="mt-12 flex flex-col items-start justify-between gap-5 border-y border-[#171717]/8 py-7 sm:flex-row sm:items-center">
            <div>
              <span className="text-xs font-black text-[#B97882]">{language === 'en' ? 'Art Moment printing' : 'طباعة لحظة فن'}</span>
              <h2 className="mt-1 text-xl font-black text-[#171717]">{text.printNow}</h2>
              <p className="mt-1 text-sm leading-7 text-[#171717]/55">
                {language === 'en'
                  ? 'Choose the print size, upload your photos privately, then review the price before checkout.'
                  : 'اختر المقاس، ارفع صورك بخصوصية، ثم راجع العدد والسعر قبل إتمام الطلب.'}
              </p>
            </div>
            <Link to="/print" className="flex min-h-12 shrink-0 items-center justify-center gap-2 bg-[#171717] px-6 text-sm font-black text-white transition-colors hover:bg-[#C6A56B]">
              <Printer size={18} /> {language === 'en' ? 'Open Print Builder' : 'ابدأ طباعة الصور'}
            </Link>
          </section>
        )}

        {recommendations.length > 0 && (
          <section className="mt-12" aria-labelledby="related-products-heading">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles size={20} className="text-[#C6A56B]" />
              <h2 id="related-products-heading" className="text-xl font-black text-[#171717]">{text.related}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {recommendations.map((recommendation) => (
                <Link
                  key={recommendation.id}
                  to={'/store/products/' + recommendation.id}
                  className="group min-w-0 border border-[#E8B4BC]/15 bg-white p-3 transition-colors hover:border-[#C6A56B]/45"
                >
                  <div className="aspect-square overflow-hidden bg-[#FAF9F7]">
                    {recommendation.image ? (
                      <img
                        src={recommendation.image}
                        alt={recommendation.name}
                        width="420"
                        height="420"
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <ImageIcon className="h-full w-full p-12 text-[#E8B4BC]/20" />
                    )}
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-sm font-black leading-6 text-[#171717]">{recommendation.name}</h3>
                  <p className="mt-1 font-black text-[#B97882]">{Number(recommendation.price || 0).toFixed(2)} {language === 'en' ? 'SAR' : 'ر.س'}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {isImageOpen && selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={product.name}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-3 sm:p-8"
          onClick={() => setIsImageOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsImageOpen(false)}
            className="absolute end-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#171717]"
            aria-label={text.close}
          >
            <X size={22} />
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); showAdjacentImage(direction === 'rtl' ? 1 : -1); }}
                className="absolute start-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[#171717] sm:start-6"
                aria-label={language === 'en' ? 'Previous image' : 'الصورة السابقة'}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); showAdjacentImage(direction === 'rtl' ? -1 : 1); }}
                className="absolute end-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[#171717] sm:end-6"
                aria-label={language === 'en' ? 'Next image' : 'الصورة التالية'}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          <img
            src={selectedImage}
            alt={product.name}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[88vh] max-w-[88vw] object-contain"
          />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <button type="button" onClick={addToCart} disabled={!isProductAvailable(product)} className="flex min-h-12 items-center justify-center gap-2 bg-[#171717] px-5 text-sm font-black text-white disabled:bg-gray-300">
            <ShoppingCart size={19} /> {isPrintingBundle ? text.choosePackage : text.add}
          </button>
          <div className="text-end"><span className="block text-[9px] font-bold text-black/40">{text.price}</span><strong className="text-lg font-black text-[#C6A56B]">{unitPrice.toFixed(2)}</strong></div>
        </div>
      </div>
    </div>
  );
}
