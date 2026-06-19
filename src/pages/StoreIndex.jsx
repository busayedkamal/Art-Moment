import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingCart, X, Plus, Star, ChevronDown, CheckCircle, Image as ImageIcon, ShieldCheck, Scale, Truck, FileText } from 'lucide-react';
import logo from '../assets/logo-art-moment.svg';
import { supabase } from '../lib/supabase';

const fromDb = (p) => ({
  id:          p.id,
  name:        p.name,
  description: p.description || '',
  price:       p.price,
  category:    p.category,
  image:       p.image       || null,
  hoverImage:  p.hover_image || null,
  sortOrder:   p.sort_order  ?? 0,
  inStock:     p.in_stock    ?? true,
});

const CATEGORIES = [
  { id: 'all', name: 'الكل' },
  { id: 'albums', name: 'الألبومات' },
  { id: 'frames', name: 'الإطارات' },
  { id: 'stickers', name: 'الملصقات' }
];

const FAQS = [
  { q: "كم يستغرق التوصيل؟", a: "يستغرق التوصيل داخل الأحساء 24-48 ساعة، وخارجها من 3 إلى 5 أيام عمل." },
  { q: "هل المنتجات أصلية؟", a: "نعم، جميع الألبومات والإطارات مختارة بعناية ومضمونة الجودة من لحظة فن." }
];

const REVIEWS = [
  { id: 1, name: "حوراء", text: "الألبومات جودتها خيالية وتغليف يفتح النفس!", rating: 5 },
  { id: 2, name: "زينب", text: "الإطارات الخشبية أضافت لمسة فنية لغرفتي، شكراً لكم.", rating: 5 },
  { id: 3, name: "فاطمة", text: "سرعة في التوصيل وتعامل راقي جداً.", rating: 5 }
];

export default function StoreIndex() {
  const [products, setProducts] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [toastMsg, setToastMsg] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const [openPolicyModal, setOpenPolicyModal] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('sort_order', { ascending: true });
        if (error) throw error;
        setProducts((data || []).map(fromDb));
      } catch (err) {
        console.error('Error fetching products:', err);
        setProducts([]);
      }
    };

    fetchProducts();

    const savedCart = JSON.parse(localStorage.getItem('art_moment_cart')) || [];
    setCart(savedCart);
  }, []);

  useEffect(() => {
    localStorage.setItem('art_moment_cart', JSON.stringify(cart));
  }, [cart]);

  const filteredProducts = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    showToast(`تم إضافة ${product.name} للسلة بنجاح 🛍️`);
  };

  const getProductQty = (id) => cart.find(item => item.id === id)?.qty || 0;

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  return (
    <div className="min-h-screen bg-[#F8F5F2] font-sans text-[#4A4A4A] relative pb-20" dir="rtl">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#C5A059] text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <CheckCircle size={18} /> {toastMsg}
        </div>
      )}

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 border-b border-[#D9A3AA]/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="لحظة فن" className="w-10 h-10 object-contain" />
            <h1 className="text-xl font-black text-[#4A4A4A]">متجر <span className="text-[#D9A3AA]">لحظة فن</span></h1>
          </Link>

          <div className="hidden md:flex flex-1 max-w-md mx-8 relative">
            <input
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="ابحثي عن المنتجات..."
              className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-full px-4 py-2.5 pr-10 outline-none focus:border-[#D9A3AA]"
            />
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4A4A4A]/40" />
            {searchQ && (
              <X size={16} onClick={() => setSearchQ('')} className="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer text-red-400" />
            )}
          </div>

          <Link to="/store/cart" className="relative p-2 bg-[#F8F5F2] rounded-full hover:bg-[#D9A3AA]/10 transition-colors">
            <ShoppingCart size={24} className="text-[#4A4A4A]" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#D9A3AA] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#4A4A4A] text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#D9A3AA]/10 mix-blend-multiply pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-black mb-4">اكملي ذكرياتك بمنتجاتنا الفنية</h2>
          <p className="text-white/70 mb-8 max-w-xl mx-auto">
            تشكيلة مختارة بعناية من الألبومات والإطارات التي تليق بحفظ أجمل لحظاتك المطبوعة.
          </p>
          <a
            href="#products"
            className="inline-block bg-gradient-to-l from-[#D9A3AA] to-[#C5A059] text-white px-8 py-3.5 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
          >
            تسوقي الآن
          </a>
        </div>
      </section>

      {/* Products */}
      <main id="products" className="max-w-7xl mx-auto px-4 py-12">
        {/* Categories */}
        <div className="flex overflow-x-auto gap-3 pb-4 mb-8 justify-start md:justify-center">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all border ${
                activeCategory === cat.id
                  ? 'bg-[#D9A3AA] text-white border-[#D9A3AA] shadow-md'
                  : 'bg-white text-[#4A4A4A] border-[#D9A3AA]/20 hover:border-[#D9A3AA]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Mobile Search */}
        <div className="md:hidden mb-8 relative">
          <input
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="ابحثي عن المنتجات..."
            className="w-full bg-white border border-[#D9A3AA]/20 rounded-xl px-4 py-3 pr-10 outline-none focus:border-[#D9A3AA]"
          />
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4A4A4A]/40" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-20 text-[#4A4A4A]/50 font-bold">
              لا توجد منتجات مطابقة لبحثك
            </div>
          ) : (
            filteredProducts.map(product => (
              <div
                key={product.id}
                className="bg-white rounded-3xl p-4 border border-[#D9A3AA]/10 shadow-sm hover:shadow-lg transition-all group flex flex-col relative overflow-hidden"
              >
                <div className="aspect-square bg-[#F8F5F2] rounded-2xl mb-4 relative overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                  {product.image ? (
                    <>
                      <img
                        src={product.image}
                        alt={product.name}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${product.hoverImage ? 'group-hover:opacity-0' : ''}`}
                      />
                      {product.hoverImage && (
                        <img
                          src={product.hoverImage}
                          alt={`${product.name} hover`}
                          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        />
                      )}
                    </>
                  ) : (
                    <ImageIcon size={40} className="text-[#D9A3AA]/30" />
                  )}
                  {getProductQty(product.id) > 0 && (
                    <span className="absolute top-2 right-2 bg-[#C5A059] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                      في السلة: {getProductQty(product.id)}
                    </span>
                  )}
                </div>

                <div className="flex-1 flex flex-col">
                  <h3 className="font-black text-[#4A4A4A] text-sm md:text-base line-clamp-2 leading-snug mb-1">
                    {product.name}
                  </h3>
                  <p className="text-[#4A4A4A]/50 text-xs line-clamp-2 mb-3 flex-1">{product.description}</p>

                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#F8F5F2]">
                    <span className="font-black text-[#D9A3AA]">{product.price} <span className="text-[10px]">ر.س</span></span>
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!product.inStock}
                      className={`p-2 rounded-xl transition-all ${
                        product.inStock
                          ? 'bg-[#4A4A4A] text-white hover:bg-[#D9A3AA] hover:scale-110'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Reviews */}
      <section className="bg-white py-16 border-y border-[#D9A3AA]/10">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-black text-center mb-10 text-[#4A4A4A]">ماذا يقول عملاؤنا؟</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {REVIEWS.map(review => (
              <div key={review.id} className="bg-[#F8F5F2] p-6 rounded-3xl border border-[#D9A3AA]/10">
                <div className="flex text-[#C5A059] mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                </div>
                <p className="text-sm font-medium text-[#4A4A4A]/80 mb-4">"{review.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D9A3AA] to-[#C5A059] text-white flex items-center justify-center font-bold text-xs">
                    {review.name.charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-[#4A4A4A]">{review.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-black text-center mb-8 text-[#4A4A4A]">الأسئلة الشائعة</h2>
        <div className="space-y-4">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-[#D9A3AA]/15 overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex justify-between items-center p-5 text-right"
              >
                <span className="font-bold text-[#4A4A4A] text-sm">{faq.q}</span>
                <ChevronDown size={18} className={`text-[#D9A3AA] transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === idx && (
                <div className="p-5 pt-0 text-sm text-[#4A4A4A]/70 leading-relaxed border-t border-[#F8F5F2]">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Trust & Compliance Section */}
      <section className="bg-[#4A4A4A] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center">
            <ShieldCheck size={40} className="text-[#D9A3AA] mb-4" />
            <h3 className="font-black text-lg mb-2">تسوق آمن وموثق</h3>
            <p className="text-sm text-white/70">متجر موثق في المركز السعودي للأعمال، لضمان حقوقك وتجربة تسوق موثوقة.</p>
          </div>
          <div className="flex flex-col items-center">
            <Scale size={40} className="text-[#C5A059] mb-4" />
            <h3 className="font-black text-lg mb-2">سياسة استرجاع عادلة</h3>
            <p className="text-sm text-white/70">حق الاسترجاع مكفول خلال 7 أيام للمنتجات الجاهزة بحالتها الأصلية.</p>
          </div>
          <div className="flex flex-col items-center">
            <Truck size={40} className="text-[#D9A3AA] mb-4" />
            <h3 className="font-black text-lg mb-2">ضمان التوصيل</h3>
            <p className="text-sm text-white/70">نلتزم بتوصيل طلباتك بأسرع وقت، مع ضمان التسليم خلال المدة النظامية.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#D9A3AA]/20 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="لحظة فن" className="w-10 h-10 object-contain grayscale opacity-80" />
              <h2 className="text-xl font-black text-[#4A4A4A]">لحظة فن</h2>
            </div>
            <p className="text-sm text-[#4A4A4A]/70 leading-relaxed mb-6">
              نوثق أجمل لحظاتك بأعلى جودة. تشكيلة من الألبومات والإطارات الفاخرة التي تليق بذكرياتك.
            </p>
            <div className="flex items-center gap-2 bg-[#F8F5F2] w-max px-4 py-2 rounded-xl border border-[#D9A3AA]/20">
              <ShieldCheck size={18} className="text-emerald-500" />
              <div className="text-right">
                <p className="text-[10px] text-[#4A4A4A]/60 font-bold">موثق في</p>
                <p className="text-xs font-black text-[#4A4A4A]">المركز السعودي للأعمال</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-black text-[#4A4A4A] mb-4">روابط هامة</h3>
            <ul className="space-y-3">
              <li>
                <button onClick={() => setOpenPolicyModal(true)} className="text-sm text-[#4A4A4A]/70 hover:text-[#D9A3AA] font-bold transition-colors">
                  سياسة الاسترجاع والاستبدال
                </button>
              </li>
              <li>
                <button onClick={() => setOpenPolicyModal(true)} className="text-sm text-[#4A4A4A]/70 hover:text-[#D9A3AA] font-bold transition-colors">
                  الشروط والأحكام
                </button>
              </li>
              <li>
                <Link to="/track" className="text-sm text-[#4A4A4A]/70 hover:text-[#D9A3AA] font-bold transition-colors">
                  تتبع الطلب
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-black text-[#4A4A4A] mb-4">طرق الدفع المدعومة</h3>
            <div className="flex gap-2 mb-6">
              <div className="w-12 h-8 bg-[#F8F5F2] rounded border border-[#D9A3AA]/20 flex items-center justify-center text-[10px] font-black text-[#4A4A4A]/50">Mada</div>
              <div className="w-12 h-8 bg-[#F8F5F2] rounded border border-[#D9A3AA]/20 flex items-center justify-center text-[10px] font-black text-[#4A4A4A]/50">Visa</div>
              <div className="w-12 h-8 bg-[#F8F5F2] rounded border border-[#D9A3AA]/20 flex items-center justify-center text-[10px] font-black text-[#4A4A4A]/50">Apple</div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 text-center border-t border-[#F8F5F2] pt-8">
          <p className="text-xs font-bold text-[#4A4A4A]/50">
            جميع الحقوق محفوظة لمتجر لحظة فن © {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {/* Legal Policies Modal */}
      {openPolicyModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setOpenPolicyModal(false)}
        >
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#F8F5F2] flex justify-between items-center bg-[#F8F5F2]/50">
              <h2 className="text-xl font-black text-[#4A4A4A] flex items-center gap-2">
                <FileText size={20} className="text-[#D9A3AA]" /> السياسات والأحكام
              </h2>
              <button onClick={() => setOpenPolicyModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm text-[#4A4A4A]/80 leading-relaxed custom-scrollbar">
              <div>
                <h3 className="font-black text-[#4A4A4A] text-base mb-2">1. سياسة الاسترجاع والاستبدال للمنتجات الجاهزة</h3>
                <p>نلتزم في "لحظة فن" بنظام التجارة الإلكترونية السعودي. يحق للعميل استرجاع أو استبدال المنتجات الجاهزة (مثل الألبومات الفارغة والإطارات) خلال <strong>7 أيام</strong> من تاريخ الاستلام، بشرط أن يكون المنتج بحالته الأصلية غير مستخدم وفي تغليفه الأصلي. يتحمل العميل تكاليف الشحن المترتبة على الاسترجاع ما لم يكن المنتج معيباً.</p>
              </div>

              <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                <h3 className="font-black text-red-700 text-base mb-2">2. استثناء المنتجات المخصصة (طباعة الصور)</h3>
                <p className="text-red-600/80">استناداً إلى اللوائح المنظمة، <strong>يُستثنى حق الاسترجاع أو الفسخ</strong> للطلبات التي تُصنع خصيصاً للعميل (مثل طباعة الصور الشخصية). بمجرد تأكيد طلب الطباعة وبدء التنفيذ، لا يمكن إلغاء الطلب أو استرجاع المبلغ، نظراً لخصوصية المنتج وعدم إمكانية إعادة بيعه.</p>
              </div>

              <div>
                <h3 className="font-black text-[#4A4A4A] text-base mb-2">3. ضمان التوصيل (شرط الـ 15 يوماً)</h3>
                <p>نسعى دائماً لتوصيل طلباتكم في أسرع وقت ممكن (عادة خلال 24-48 ساعة داخل الأحساء). ونلتزم قانونياً بتسليم الطلب في مدة لا تتجاوز 15 يوماً من تاريخ التأكيد. في حال تجاوز هذه المدة (لا سمح الله)، يحق للعميل إلغاء الطلب واسترداد كامل المبلغ.</p>
              </div>

              <div>
                <h3 className="font-black text-[#4A4A4A] text-base mb-2">4. الخصوصية وسرية البيانات</h3>
                <p>نولي في "لحظة فن" خصوصية صوركم وبياناتكم الشخصية أولوية قصوى. تُعالج الصور المرفوعة بسرية تامة لغرض الطباعة فقط، ولا تُشارك مع أي طرف ثالث وتُحذف من خوادمنا بشكل دوري بعد تسليم الطلب.</p>
              </div>
            </div>

            <div className="p-6 border-t border-[#F8F5F2] bg-[#F8F5F2]/30">
              <button
                onClick={() => setOpenPolicyModal(false)}
                className="w-full bg-[#4A4A4A] text-white py-3 rounded-xl font-bold hover:bg-[#D9A3AA] transition-colors"
              >
                قرأت وموافق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
