import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Image as ImageIcon, Minus, Plus, ShoppingCart } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo-art-moment.svg';
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
    stockQuantity,
    inStock: (product?.in_stock ?? true) && (stockQuantity === null || stockQuantity > 0),
  };
}

function getCategoryLabel(category) {
  if (category === 'albums') return 'ألبومات';
  if (category === 'frames') return 'إطارات';
  if (category === 'stickers') return 'ملصقات';
  return category || 'منتجات لحظة فن';
}

export default function ProductDetailsPage() {
  const { productId } = useParams();
  const { language } = useLanguage();
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
        setError('تعذر العثور على هذا المنتج.');
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
  }, [language, productId]);

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

  const addToCart = () => {
    if (!product || !isProductAvailable(product)) {
      toast.error('هذا المنتج غير متوفر حالياً');
      return;
    }
    if (missingOptions.length > 0) {
      toast.error(`اختاري ${missingOptions.join(' و ')}`);
      return;
    }

    const savedCart = JSON.parse(localStorage.getItem('art_moment_cart') || '[]');
    const currentProductQuantity = savedCart
      .filter((item) => String(item.id) === String(product.id))
      .reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const requestedQuantity = Number(quantity || 1);

    if (product.stockQuantity !== null && currentProductQuantity + requestedQuantity > product.stockQuantity) {
      toast.error(`المتوفر حالياً ${product.stockQuantity} فقط`);
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
    toast.success('تمت إضافة المنتج إلى السلة');
  };

  if (loading) {
    return (
      <div className="art-page flex min-h-screen items-center justify-center font-sans" dir="rtl">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E8B4BC]/25 border-t-[#E8B4BC]" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="art-page flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center font-sans" dir="rtl">
        <ImageIcon size={46} className="text-[#E8B4BC]/40" />
        <h1 className="text-2xl font-black text-[#171717]">{error}</h1>
        <Link to="/store" className="rounded-xl bg-[#171717] px-6 py-3 text-sm font-black text-white">
          العودة إلى المتجر
        </Link>
      </div>
    );
  }

  return (
    <div className="art-page min-h-screen pb-24 font-sans text-[#171717]" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-[#E8B4BC]/10 bg-white/90 backdrop-blur-xl">
        <div className="art-shell flex h-20 items-center justify-between gap-3">
          <Link to="/store" className="flex items-center gap-2 text-sm font-black text-[#171717]/65 hover:text-[#E8B4BC]">
            <ArrowRight size={18} /> المتجر
          </Link>
          <img src={logo} alt="لحظة فن" className="h-10 w-auto" />
          <Link to="/store/cart" className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#E8B4BC]/20 bg-white">
            <ShoppingCart size={19} />
            {cartCount > 0 && (
              <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E8B4BC] px-1 text-[9px] font-black text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="art-shell py-6 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-start">
          <section className="min-w-0">
            <div className="aspect-square overflow-hidden rounded-2xl border border-[#E8B4BC]/12 bg-white">
              {selectedImage ? (
                <img src={selectedImage} alt={product.name} className="h-full w-full object-contain p-3 sm:p-7" />
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
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="min-w-0">
            <span className="inline-flex rounded-full bg-[#E8B4BC]/10 px-3 py-1 text-[11px] font-black text-[#B97882]">
              {getCategoryLabel(product.category)}
            </span>
            <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{product.name}</h1>
            <p className="mt-4 text-sm font-medium leading-8 text-[#171717]/65">
              {product.description || 'منتج مختار بعناية من لحظة فن لتوثيق ذكرياتك.'}
            </p>

            <div className="mt-6 flex items-end justify-between border-y border-[#E8B4BC]/12 py-5">
              <div>
                <span className="block text-[11px] font-bold text-[#171717]/45">السعر</span>
                <strong className="mt-1 block text-3xl font-black text-[#C6A56B]">{unitPrice.toFixed(2)} ر.س</strong>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-black ${
                isProductAvailable(product) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}>
                {isProductAvailable(product)
                  ? product.stockQuantity === null ? 'متوفر' : `المتوفر ${product.stockQuantity}`
                  : 'غير متوفر'}
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

            <div className="mt-7 grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
              <div className="flex h-14 items-center justify-between rounded-xl border border-[#E8B4BC]/20 bg-white px-2">
                <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="p-2" aria-label="تقليل الكمية">
                  <Minus size={17} />
                </button>
                <output className="font-black">{quantity}</output>
                <button
                  type="button"
                  onClick={() => setQuantity((current) => (
                    product.stockQuantity === null ? current + 1 : Math.min(product.stockQuantity, current + 1)
                  ))}
                  className="p-2"
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
                <ShoppingCart size={19} /> إضافة إلى السلة
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
