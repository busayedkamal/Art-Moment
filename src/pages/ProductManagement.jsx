import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, ExternalLink, Image as ImageIcon, Trash2, Edit3,
  Check, X, Loader2, Package, Frame, StickyNote, UploadCloud, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import fallbackLogo from '../assets/logo.png';

// ─── إعدادات الفئات ──────────────────────────────────────────────
const CAT_CONFIG = {
  albums:   { label: 'ألبومات', bg: 'bg-[#D9A3AA]', text: 'text-[#D9A3AA]', icon: Package },
  frames:   { label: 'إطارات', bg: 'bg-[#C5A059]', text: 'text-[#C5A059]', icon: Frame },
  stickers: { label: 'ملصقات', bg: 'bg-[#4A4A4A]', text: 'text-[#4A4A4A]', icon: StickyNote },
};

const getCatStyle = (cat) =>
  CAT_CONFIG[cat] || { label: cat, bg: 'bg-[#F8F5F2]', text: 'text-[#4A4A4A]', icon: Package };

// تحويل صف قاعدة البيانات (snake_case) → حالة React (camelCase)
const fromDb = (p) => ({
  id:            p.id,
  name:          p.name,
  description:   p.description  || '',
  price:         p.price,
  category:      p.category,
  image:         p.image        || null,
  hoverImage:    p.hover_image  || null,
  sortOrder:     p.sort_order   ?? 0,
  inStock:       p.in_stock      ?? true,
  stockQuantity: p.stock_quantity ?? 0,
  isBestSeller:  p.is_best_seller ?? false,
});

// تحويل حالة React (camelCase) → صف قاعدة البيانات (snake_case)
const toDb = (f) => ({
  name:           f.name,
  description:    f.description,
  price:          Number(f.price),
  category:       f.category,
  image:          f.image,
  hover_image:    f.hoverImage,
  sort_order:     Number(f.sortOrder),
  in_stock:       f.inStock,
  stock_quantity: Number(f.stockQuantity) || 0,
  is_best_seller: f.isBestSeller,
});

const initialForm = {
  name: '', description: '', price: '', category: 'albums',
  image: null, hoverImage: null, sortOrder: 0, inStock: true, stockQuantity: 0, isBestSeller: false,
};

export default function ProductManagement() {
  const [products,       setProducts]       = useState([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [catFilter,      setCatFilter]      = useState('all');
  const [isModalOpen,    setIsModalOpen]    = useState(false);
  const [isDeleteModal,  setIsDeleteModal]  = useState(false);
  const [isEdit,         setIsEdit]         = useState(false);
  const [editId,         setEditId]         = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [isSaving,       setIsSaving]       = useState(false);
  const [uploadingMain,  setUploadingMain]  = useState(false);
  const [uploadingHover, setUploadingHover] = useState(false);
  const [form,           setForm]           = useState(initialForm);

  const fileRef  = useRef(null);
  const hoverRef = useRef(null);

  /* ── جلب المنتجات من Supabase ── */
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setProducts((data || []).map(fromDb));
    } catch (err) {
      console.error(err);
      toast.error('فشل في تحميل المنتجات');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  /* ── ضغط الصورة (Base64) ── */
  const compressImage = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > 900) { h = Math.round((h * 900) / w); w = 900; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
      };
    });

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    type === 'main' ? setUploadingMain(true) : setUploadingHover(true);
    try {
      const b64 = await compressImage(file);
      setForm(f => type === 'main' ? { ...f, image: b64 } : { ...f, hoverImage: b64 });
    } catch {
      toast.error('خطأ أثناء معالجة الصورة');
    } finally {
      type === 'main' ? setUploadingMain(false) : setUploadingHover(false);
    }
  };

  /* ── CRUD ── */
  const openAdd  = ()        => { setForm(initialForm); setIsEdit(false); setIsModalOpen(true); };
  const openEdit = (product) => { setForm({ ...product }); setEditId(product.id); setIsEdit(true); setIsModalOpen(true); };

  const saveProduct = async () => {
    if (!form.name || !form.price) return toast.error('يرجى تعبئة الحقول المطلوبة');
    setIsSaving(true);
    try {
      if (isEdit) {
        const { error } = await supabase
          .from('products')
          .update(toDb(form))
          .eq('id', editId);
        if (error) throw error;
        toast.success('تم التعديل بنجاح');
      } else {
        const { error } = await supabase
          .from('products')
          .insert(toDb(form));
        if (error) throw error;
        toast.success('تم إضافة المنتج بنجاح');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStock = async (product) => {
    const newStock = !product.inStock;
    // تحديث محلي فوري
    setProducts(ps => ps.map(p => p.id === product.id ? { ...p, inStock: newStock } : p));
    const { error } = await supabase
      .from('products')
      .update({ in_stock: newStock })
      .eq('id', product.id);
    if (error) {
      toast.error('فشل في مزامنة المخزون');
      setProducts(ps => ps.map(p => p.id === product.id ? { ...p, inStock: product.inStock } : p));
    } else {
      toast.success(newStock ? 'تم إعادة إتاحة المنتج' : 'تم تغيير الحالة إلى نفد');
    }
  };

  const confirmDelete = (product) => { setDeleteTarget(product); setIsDeleteModal(true); };

  const deleteProduct = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('تم حذف المنتج نهائياً');
      setIsDeleteModal(false);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الحذف');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = catFilter === 'all' ? products : products.filter(p => p.category === catFilter);
  const dynamicCategories = [...new Set(products.map(p => p.category).filter(Boolean))];

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#F8F5F2] font-sans text-[#4A4A4A]" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-3xl border border-[#D9A3AA]/20 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-[#4A4A4A] mb-1">إدارة متجر لحظة فن 🛍️</h1>
          <p className="text-sm font-bold text-[#D9A3AA]">{products.length} منتج مسجّل</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/store" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 bg-[#F8F5F2] text-[#4A4A4A] hover:text-[#D9A3AA] px-5 py-2.5 rounded-xl font-bold transition-colors border border-[#D9A3AA]/20 text-sm"
          >
            عرض المتجر <ExternalLink size={16} />
          </a>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-[#D9A3AA] text-white hover:bg-[#C48A92] px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-[#D9A3AA]/30 text-sm"
          >
            إضافة منتج <Plus size={16} />
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex overflow-x-auto gap-3 pb-4 mb-6">
        <button
          onClick={() => setCatFilter('all')}
          className={`px-6 py-2 rounded-full font-bold text-sm transition-all whitespace-nowrap border ${catFilter === 'all' ? 'bg-[#4A4A4A] text-white border-[#4A4A4A]' : 'bg-white text-[#4A4A4A] border-[#D9A3AA]/20 hover:bg-[#F8F5F2]'}`}
        >
          الكل ({products.length})
        </button>
        {dynamicCategories.map(key => {
          const cfg = getCatStyle(key);
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setCatFilter(key)}
              className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all whitespace-nowrap border ${catFilter === key ? `${cfg.bg} text-white border-transparent` : `bg-white ${cfg.text} border-[#D9A3AA]/20 hover:bg-[#F8F5F2]`}`}
            >
              <Icon size={14} /> {cfg.label} ({products.filter(p => p.category === key).length})
            </button>
          );
        })}
      </div>

      {/* ── Products Grid ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#D9A3AA] mb-4" />
          <p className="font-bold text-[#4A4A4A]/70">جاري تحميل المنتجات...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-[#4A4A4A]/40 font-bold">
          {products.length === 0 ? 'لا توجد منتجات بعد — ابدأ بإضافة أول منتج' : 'لا توجد منتجات في هذه الفئة'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map(product => {
            const cat = getCatStyle(product.category);
            return (
              <div key={product.id} className="bg-white rounded-3xl overflow-hidden border border-[#D9A3AA]/20 shadow-sm hover:shadow-lg transition-all flex flex-col group">

                {/* صورة المنتج */}
                <div className="h-48 relative bg-gradient-to-br from-[#D9A3AA]/10 to-[#C5A059]/10 flex items-center justify-center overflow-hidden">
                  {product.image
                    ? <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <img src={fallbackLogo} alt={product.name} className="w-full h-full object-contain p-6 opacity-30 grayscale group-hover:scale-105 transition-transform duration-500 mix-blend-multiply" />
                  }
                  <div className="absolute top-3 left-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black shadow-sm ${product.inStock ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {product.inStock ? 'متاح' : 'نفد'}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 flex flex-col gap-1">
                    <span className={`flex items-center gap-1 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-black shadow-sm ${cat.text}`}>
                      <cat.icon size={10} /> {cat.label}
                    </span>
                    {product.isBestSeller && (
                      <span className="flex items-center gap-1 bg-[#C5A059] text-white px-2.5 py-1 rounded-full text-[10px] font-black shadow-sm">
                        <Star size={10} fill="currentColor" /> الأكثر مبيعاً
                      </span>
                    )}
                  </div>
                </div>

                {/* تفاصيل */}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-black text-[#4A4A4A] text-base line-clamp-2 leading-snug mb-1">{product.name}</h3>
                  <p className="text-xs text-[#4A4A4A]/60 line-clamp-2 mb-4 flex-1">{product.description || 'لا يوجد وصف'}</p>

                  <div className="flex items-end justify-between mb-4">
                    <span className="font-black text-2xl text-[#D9A3AA] leading-none">{product.price} <span className="text-xs">ر.س</span></span>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        product.stockQuantity === 0 ? 'bg-red-100 text-red-600' :
                        product.stockQuantity <= 5  ? 'bg-amber-100 text-amber-700' :
                                                      'bg-emerald-50 text-emerald-600'
                      }`}>
                        {product.stockQuantity === 0 ? 'نفد' : `${product.stockQuantity} قطعة`}
                      </span>
                      <span className="text-[10px] text-[#4A4A4A]/40 font-bold">#{product.sortOrder}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-[#F8F5F2]">
                    <button
                      onClick={() => openEdit(product)}
                      className="flex-1 bg-[#F8F5F2] hover:bg-[#D9A3AA]/10 text-[#4A4A4A] py-2 rounded-xl text-xs font-bold transition-colors flex justify-center items-center gap-1"
                    >
                      <Edit3 size={14} /> تعديل
                    </button>
                    <button
                      onClick={() => toggleStock(product)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors flex justify-center items-center gap-1 ${product.inStock ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                    >
                      {product.inStock ? 'إيقاف' : 'إتاحة'}
                    </button>
                    <button
                      onClick={() => confirmDelete(product)}
                      className="px-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors flex justify-center items-center"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ Modal الإضافة/التعديل ══ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl my-auto animate-in zoom-in-95 duration-200">

            <div className="p-6 border-b border-[#F8F5F2] flex justify-between items-center bg-[#F8F5F2]/50 rounded-t-3xl">
              <h2 className="text-xl font-black text-[#4A4A4A]">{isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white rounded-full text-[#4A4A4A]/50 hover:text-red-500 shadow-sm transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

              {/* الاسم */}
              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1.5">اسم المنتج <span className="text-red-500">*</span></label>
                <input
                  type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: ألبوم جلدي أسود"
                  className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/30 rounded-xl px-4 py-3 outline-none focus:border-[#D9A3AA] focus:ring-2 ring-[#D9A3AA]/20 transition-all font-bold text-[#4A4A4A]"
                />
              </div>

              {/* الوصف */}
              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1.5">الوصف (اختياري)</label>
                <textarea
                  rows="2" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="وصف مختصر للمنتج..."
                  className="w-full resize-none bg-[#F8F5F2] border border-[#D9A3AA]/30 rounded-xl px-4 py-3 outline-none focus:border-[#D9A3AA] focus:ring-2 ring-[#D9A3AA]/20 transition-all text-sm text-[#4A4A4A]"
                />
              </div>

              {/* السعر + الفئة */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#4A4A4A] mb-1.5">السعر (ر.س) <span className="text-red-500">*</span></label>
                  <input
                    type="number" min="0" step="0.5" dir="ltr" value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/30 rounded-xl px-4 py-3 outline-none focus:border-[#D9A3AA] focus:ring-2 ring-[#D9A3AA]/20 transition-all font-black text-xl text-[#C5A059] text-right"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#4A4A4A]/60 block mb-2">الفئة <span className="text-red-500">*</span></label>
                  <div className="space-y-2">
                    <select
                      value={dynamicCategories.includes(form.category) ? form.category : '__NEW__'}
                      onChange={e => {
                        if (e.target.value !== '__NEW__') {
                          setForm(f => ({ ...f, category: e.target.value }));
                        } else {
                          setForm(f => ({ ...f, category: '' }));
                        }
                      }}
                      className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/20 rounded-xl px-4 py-3 outline-none focus:border-[#D9A3AA] transition-colors cursor-pointer"
                    >
                      <option value="" disabled>اختر الفئة...</option>
                      {dynamicCategories.map(cat => (
                        <option key={cat} value={cat}>{getCatStyle(cat).label}</option>
                      ))}
                      <option value="__NEW__">➕ إضافة فئة جديدة...</option>
                    </select>
                    {!dynamicCategories.includes(form.category) && (
                      <input
                        type="text"
                        value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                        placeholder="اكتب اسم الفئة الجديدة..."
                        className="w-full bg-white border-2 border-[#C5A059]/50 rounded-xl px-4 py-3 outline-none focus:border-[#C5A059] transition-colors"
                        required
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* الصورة الرئيسية */}
              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1.5">الصورة الرئيسية</label>
                <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={e => handleImageUpload(e, 'main')} />
                <div
                  onClick={() => !form.image && fileRef.current.click()}
                  className={`h-36 rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden transition-colors ${form.image ? 'border-[#D9A3AA] bg-[#F8F5F2]' : 'border-dashed border-[#D9A3AA]/40 hover:border-[#D9A3AA] bg-white cursor-pointer'}`}
                >
                  {uploadingMain ? (
                    <div className="flex flex-col items-center"><Loader2 size={24} className="animate-spin text-[#D9A3AA] mb-2" /><span className="text-xs font-bold text-[#D9A3AA]">جاري الضغط...</span></div>
                  ) : form.image ? (
                    <>
                      <img src={form.image} alt="معاينة" className="h-full w-full object-contain p-2" />
                      <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, image: null })); }} className="absolute bottom-2 left-2 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold hover:bg-red-600 shadow-md">إزالة</button>
                      <button onClick={e => { e.stopPropagation(); fileRef.current.click(); }} className="absolute bottom-2 right-2 bg-[#4A4A4A] text-white px-2 py-1 rounded-lg text-xs font-bold hover:bg-[#D9A3AA] shadow-md">تغيير</button>
                    </>
                  ) : (
                    <div className="text-center">
                      <UploadCloud size={32} className="mx-auto text-[#D9A3AA]/50 mb-2" />
                      <p className="text-sm font-bold text-[#4A4A4A]/70">اضغطي لرفع صورة</p>
                      <p className="text-[10px] text-[#4A4A4A]/40 mt-1">يتم ضغط الصورة تلقائياً</p>
                    </div>
                  )}
                </div>
              </div>

              {/* صورة Hover */}
              <div>
                <label className="block text-sm font-bold text-[#4A4A4A] mb-1.5">صورة Hover (اختياري)</label>
                <input type="file" accept="image/*" ref={hoverRef} className="hidden" onChange={e => handleImageUpload(e, 'hover')} />
                <div
                  onClick={() => !form.hoverImage && hoverRef.current.click()}
                  className={`h-32 rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden transition-colors ${form.hoverImage ? 'border-[#C5A059] bg-[#F8F5F2]' : 'border-dashed border-[#C5A059]/40 hover:border-[#C5A059] bg-white cursor-pointer'}`}
                >
                  {uploadingHover ? (
                    <div className="flex flex-col items-center"><Loader2 size={24} className="animate-spin text-[#C5A059] mb-2" /><span className="text-xs font-bold text-[#C5A059]">جاري الضغط...</span></div>
                  ) : form.hoverImage ? (
                    <>
                      <img src={form.hoverImage} alt="Hover" className="h-full w-full object-contain p-2" />
                      <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, hoverImage: null })); }} className="absolute bottom-2 left-2 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold hover:bg-red-600 shadow-md">إزالة</button>
                    </>
                  ) : (
                    <div className="text-center">
                      <ImageIcon size={28} className="mx-auto text-[#C5A059]/50 mb-2" />
                      <p className="text-sm font-bold text-[#4A4A4A]/60">صورة بديلة عند تمرير الماوس</p>
                    </div>
                  )}
                </div>
              </div>

              {/* الترتيب + الكمية + المخزون + الأكثر مبيعاً */}
              <div className="grid grid-cols-4 gap-4 border-t border-[#F8F5F2] pt-4">
                <div>
                  <label className="block text-xs font-bold text-[#4A4A4A] mb-1.5">ترتيب العرض</label>
                  <input
                    type="number" min="0" dir="ltr" value={form.sortOrder}
                    onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                    className="w-full bg-[#F8F5F2] border border-[#D9A3AA]/30 rounded-xl px-4 py-2.5 outline-none focus:border-[#D9A3AA] text-center font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4A4A4A] mb-1.5">الكمية المتوفرة <span className="text-red-500">*</span></label>
                  <input
                    type="number" min="0" dir="ltr" value={form.stockQuantity}
                    onChange={e => setForm(f => ({ ...f, stockQuantity: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-[#F8F5F2] border border-[#C5A059]/40 rounded-xl px-4 py-2.5 outline-none focus:border-[#C5A059] text-center font-black text-[#C5A059] text-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4A4A4A] mb-1.5">حالة المخزون</label>
                  <div
                    onClick={() => setForm(f => ({ ...f, inStock: !f.inStock }))}
                    className={`cursor-pointer w-full h-[42px] rounded-xl flex items-center px-2 gap-2 transition-colors ${form.inStock ? 'bg-emerald-100' : 'bg-gray-100'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg shadow-sm flex items-center justify-center text-white transition-colors ${form.inStock ? 'bg-emerald-500' : 'bg-gray-400'}`}>
                      {form.inStock ? <Check size={16} /> : <X size={16} />}
                    </div>
                    <span className={`text-xs font-black ${form.inStock ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {form.inStock ? 'متاح' : 'نفد'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4A4A4A] mb-1.5">الأكثر مبيعاً</label>
                  <div
                    onClick={() => setForm(f => ({ ...f, isBestSeller: !f.isBestSeller }))}
                    className={`cursor-pointer w-full h-[42px] rounded-xl flex items-center px-2 gap-2 transition-colors ${form.isBestSeller ? 'bg-[#C5A059]/20' : 'bg-gray-100'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg shadow-sm flex items-center justify-center text-white transition-colors ${form.isBestSeller ? 'bg-[#C5A059]' : 'bg-gray-400'}`}>
                      <Star size={16} fill={form.isBestSeller ? 'currentColor' : 'none'} />
                    </div>
                    <span className={`text-xs font-black ${form.isBestSeller ? 'text-[#C5A059]' : 'text-gray-500'}`}>
                      {form.isBestSeller ? 'نعم' : 'لا'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#F8F5F2] flex gap-3 bg-[#F8F5F2]/30 rounded-b-3xl">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-[#4A4A4A]/60 hover:bg-[#4A4A4A]/5 transition-colors">
                إلغاء
              </button>
              <button
                onClick={saveProduct}
                disabled={isSaving || uploadingMain || uploadingHover}
                className="flex-1 bg-gradient-to-r from-[#D9A3AA] to-[#C5A059] text-white py-3 rounded-xl font-black shadow-lg shadow-[#D9A3AA]/30 hover:scale-[1.02] transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:hover:scale-100"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {isSaving ? 'جاري الحفظ...' : (isEdit ? 'حفظ التعديلات' : 'إضافة المنتج')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal تأكيد الحذف ══ */}
      {isDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="text-5xl mb-4">🗑️</div>
            <h3 className="text-xl font-black text-[#4A4A4A] mb-2">حذف المنتج</h3>
            <p className="text-sm text-[#4A4A4A]/70 mb-6 leading-relaxed">
              سيتم حذف <strong className="text-red-500">"{deleteTarget?.name}"</strong> نهائياً. هذا الإجراء لا يمكن التراجع عنه.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteModal(false)} className="flex-1 py-3 rounded-xl font-bold text-[#4A4A4A] bg-[#F8F5F2] hover:bg-gray-200 transition-colors">
                إلغاء
              </button>
              <button
                onClick={deleteProduct}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-md transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {isSaving ? 'جاري الحذف...' : 'حذف نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
