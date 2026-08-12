import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Image as ImageIcon, Printer, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import SeoHead from '../components/SeoHead';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { isProductAvailable, normalizeStockQuantity } from '../utils/productStock';

const SITE_URL = 'https://art-moment.com';

const SEO_CATEGORY_PAGES = {
  photoPrinting: {
    path: '/photo-printing',
    category: ['printing', 'طباعة'],
    ar: {
      eyebrow: 'خدمة طباعة الصور',
      title: 'طباعة الصور بجودة تحفظ لحظاتك',
      description: 'اطبع صور الجوال والكاميرا بمقاسات عملية وجودة ألوان واضحة، مع مراجعة الملفات قبل تجهيز الطلب.',
      intro: 'ابدأ باختيار المقاس، ارفع صورك، ثم راجع العدد والسعر قبل إضافة طلب الطباعة إلى السلة.',
    },
    en: {
      eyebrow: 'Photo printing service',
      title: 'Photo printing made for lasting memories',
      description: 'Print phone and camera photos in practical sizes with clear color and a file review before production.',
      intro: 'Choose a size, upload your photos, then review quantity and price before adding the print order to your cart.',
    },
  },
  photographicPrinting: {
    path: '/photographic-printing',
    category: ['printing', 'طباعة'],
    ar: {
      eyebrow: 'ورق صور مختار بعناية',
      title: 'طباعة الصور الفوتوغرافية',
      description: 'طباعة فوتوغرافية للألبومات والإطارات والذكريات اليومية، مع تنبيه للدقة المنخفضة قبل تنفيذ الطلب.',
      intro: 'نراجع ملاءمة الدقة للمقاس المختار ونحافظ على الملف الأصلي في مساحة تخزين خاصة ومحدودة الوصول.',
    },
    en: {
      eyebrow: 'Carefully selected photo paper',
      title: 'Photographic photo printing',
      description: 'Photographic prints for albums, frames, and everyday memories, including low-resolution warnings before production.',
      intro: 'We review image resolution for the selected size and keep originals in private, access-controlled storage.',
    },
  },
  printSizes: {
    path: '/photo-print-sizes',
    category: ['printing', 'طباعة'],
    ar: {
      eyebrow: 'اختر المقاس الأنسب',
      title: 'مقاسات طباعة الصور',
      description: 'دليل مبسط لاختيار مقاس طباعة الصور المناسب للألبوم أو الإطار، مع السعر قبل إتمام الطلب.',
      intro: 'استخدم أداة الطباعة لاختيار المقاس ومشاهدة السعر الفعلي لكل نسخة قبل رفع الطلب.',
    },
    en: {
      eyebrow: 'Choose the right size',
      title: 'Photo print sizes',
      description: 'A simple guide to choosing print sizes for albums and frames, with pricing shown before checkout.',
      intro: 'Use the print builder to choose a size and see the per-copy price before submitting your order.',
    },
  },
  albums: {
    path: '/store/albums',
    category: ['albums', 'ألبومات'],
    ar: {
      eyebrow: 'حفظ الصور المطبوعة',
      title: 'ألبومات الصور',
      description: 'تصفح ألبومات الصور المتوفرة بمقاسات وألوان مختلفة، مع تفاصيل السعة والخامة والتوفر.',
      intro: 'قارن السعة والمقاس واللون، ثم افتح صفحة المنتج لمراجعة جميع التفاصيل والخيارات.',
    },
    en: {
      eyebrow: 'Preserve your prints',
      title: 'Photo albums',
      description: 'Browse photo albums in different sizes and colors with capacity, material, and availability details.',
      intro: 'Compare capacity, size, and color, then open a product page for all details and options.',
    },
  },
  frames: {
    path: '/store/frames',
    category: ['frames', 'إطارات'],
    ar: {
      eyebrow: 'اعرض لحظاتك',
      title: 'إطارات الصور',
      description: 'إطارات للصور المطبوعة بمقاسات وخامات متنوعة، مع توضيح المقاس والتوفر لكل منتج.',
      intro: 'اختر الإطار المناسب لمساحتك، وتحقق من المقاس والخامة قبل إضافته إلى السلة.',
    },
    en: {
      eyebrow: 'Display your moments',
      title: 'Photo frames',
      description: 'Frames for printed photos in varied sizes and materials, with clear size and availability details.',
      intro: 'Choose a frame for your space and review its size and material before adding it to the cart.',
    },
  },
  supplies: {
    path: '/store/photo-supplies',
    category: ['stickers', 'ملصقات', 'supplies', 'مستلزمات'],
    ar: {
      eyebrow: 'تفاصيل تكمل الذكرى',
      title: 'مستلزمات حفظ الصور',
      description: 'ملصقات ومستلزمات مختارة لتنظيم الصور وتزيين الألبومات وحفظ الذكريات.',
      intro: 'تصفح المنتجات المكملة للطباعة والألبومات، وافتح صفحة كل منتج لمعرفة محتوى العبوة وخياراته.',
    },
    en: {
      eyebrow: 'Details that complete the memory',
      title: 'Photo preservation supplies',
      description: 'Selected stickers and supplies for organizing prints, decorating albums, and preserving memories.',
      intro: 'Browse products that complement prints and albums, with package contents and options on every product page.',
    },
  },
};

function matchesCategory(product, categories) {
  return categories.some((category) => String(product.category || '').toLowerCase() === String(category).toLowerCase());
}

export default function SeoCategoryPage({ pageKey }) {
  const config = SEO_CATEGORY_PAGES[pageKey] || SEO_CATEGORY_PAGES.photoPrinting;
  const { language, direction } = useLanguage();
  const text = config[language] || config.ar;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    try {
      const cart = JSON.parse(localStorage.getItem('art_moment_cart') || '[]');
      setCartCount(cart.reduce((sum, item) => sum + Number(item.qty || 0), 0));
    } catch {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('products').select('*').order('sort_order', { ascending: true });
      if (!active) return;
      if (error) {
        console.error('Unable to load category products:', error);
        setProducts([]);
      } else {
        setProducts((data || []).filter((product) => matchesCategory(product, config.category)));
      }
      setLoading(false);
    };
    loadProducts();
    return () => { active = false; };
  }, [config.category]);

  const structuredData = useMemo(() => {
    const pageUrl = `${SITE_URL}${config.path}`;
    return [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#collection`,
        url: pageUrl,
        name: text.title,
        description: text.description,
        inLanguage: language === 'en' ? 'en' : 'ar',
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: language === 'en' ? 'Home' : 'الرئيسية', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: text.title, item: pageUrl },
        ],
      },
    ];
  }, [config.path, language, text.description, text.title]);

  const Arrow = direction === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="art-page min-h-screen pb-16 font-[Tajawal]" dir={direction}>
      <SeoHead
        title={`${text.title} | لحظة فن Art Moment`}
        description={text.description}
        path={config.path}
        structuredData={structuredData}
      />
      <PublicHeader cartCount={cartCount} />

      <main>
        <section className="art-shell border-b border-black/10 py-10 sm:py-16">
          <nav className="mb-7 flex items-center gap-2 text-xs font-bold text-[#171717]/50" aria-label={language === 'en' ? 'Breadcrumb' : 'مسار التنقل'}>
            <Link to="/" className="hover:text-[#B96F7D]">{language === 'en' ? 'Home' : 'الرئيسية'}</Link>
            <span>/</span>
            <span className="text-[#171717]">{text.title}</span>
          </nav>
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs font-black text-[#C6A56B]">{text.eyebrow}</p>
              <h1 className="text-3xl font-black leading-tight text-[#171717] sm:text-5xl">{text.title}</h1>
              <p className="mt-5 max-w-2xl text-sm font-medium leading-8 text-[#171717]/65 sm:text-base">{text.description}</p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#171717]/55">{text.intro}</p>
            </div>
            <Link to="/print" className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#171717] px-6 text-sm font-black text-white">
              <Printer size={19} /> {language === 'en' ? 'Print your photos now' : 'اطبع صورك الآن'}
            </Link>
          </div>
        </section>

        <section className="art-shell py-10 sm:py-14">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black text-[#C6A56B]">{language === 'en' ? 'Available now' : 'المتوفر الآن'}</p>
              <h2 className="mt-2 text-2xl font-black">{language === 'en' ? 'Choose your product' : 'اختر منتجك'}</h2>
            </div>
            <Link to="/store" className="flex items-center gap-2 text-sm font-black text-[#171717]/65 hover:text-[#B96F7D]">
              {language === 'en' ? 'Full store' : 'كل المتجر'} <Arrow size={17} />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((item) => <div key={item} className="aspect-[4/5] animate-pulse bg-black/5" />)}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => {
                const stock = normalizeStockQuantity(product.stock_quantity);
                const available = isProductAvailable({ ...product, stockQuantity: stock, inStock: product.in_stock });
                const productName = language === 'en' && product.name_en ? product.name_en : product.name;
                const description = language === 'en' && product.description_en ? product.description_en : product.description;
                return (
                  <article key={product.id} className="art-product-card flex min-w-0 flex-col overflow-hidden p-3 sm:p-4">
                    <Link to={`/store/products/${product.id}`} className="relative block aspect-square overflow-hidden bg-[#F3F0EC]">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={productName}
                          width="640"
                          height="640"
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                        />
                      ) : <ImageIcon className="h-full w-full p-16 text-[#171717]/10" />}
                      <span className={`absolute bottom-2 end-2 px-2 py-1 text-[10px] font-black ${available ? 'bg-white text-[#171717]' : 'bg-red-500 text-white'}`}>
                        {available
                          ? (stock === null ? (language === 'en' ? 'Available' : 'متوفر') : `${language === 'en' ? 'Available' : 'المتوفر'}: ${stock}`)
                          : (language === 'en' ? 'Out of stock' : 'غير متوفر')}
                      </span>
                    </Link>
                    <div className="flex flex-1 flex-col pt-4">
                      <h3 className="text-sm font-black leading-6 sm:text-base">{productName}</h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-6 text-[#171717]/50">{description}</p>
                      <div className="mt-auto flex items-end justify-between gap-2 border-t border-black/10 pt-4">
                        <strong className="text-lg font-black text-[#B96F7D]">{Number(product.price || 0).toFixed(2)} <small>{language === 'en' ? 'SAR' : 'ر.س'}</small></strong>
                        <Link to={`/store/products/${product.id}`} className="flex h-11 w-11 items-center justify-center bg-[#171717] text-white" aria-label={productName}>
                          <ShoppingBag size={18} />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="border-y border-black/10 py-16 text-center">
              <p className="text-sm font-bold text-[#171717]/55">{language === 'en' ? 'No products are listed in this category yet.' : 'لا توجد منتجات مدرجة في هذا القسم حالياً.'}</p>
              <Link to="/store" className="mt-5 inline-flex min-h-11 items-center bg-[#171717] px-5 text-sm font-black text-white">
                {language === 'en' ? 'Browse the store' : 'تصفح المتجر'}
              </Link>
            </div>
          )}
        </section>

        <nav className="art-shell grid grid-cols-2 gap-2 border-t border-black/10 pt-8 text-sm sm:grid-cols-3 lg:grid-cols-6" aria-label={language === 'en' ? 'Related categories' : 'أقسام ذات صلة'}>
          {Object.values(SEO_CATEGORY_PAGES).map((page) => (
            <Link key={page.path} to={page.path} className="flex min-h-12 items-center border border-black/10 bg-white px-3 font-bold transition-colors hover:border-[#C6A56B]">
              {page[language]?.title || page.ar.title}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
