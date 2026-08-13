import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Crop,
  FileImage,
  Image as ImageIcon,
  Images,
  Loader2,
  Minus,
  Plus,
  RotateCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

const DRAFT_STORAGE_KEY = 'art_moment_print_draft';
const MAX_FILE_SIZE = 35 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const copy = {
  ar: {
    back: 'العودة للرئيسية', title: 'اطبع صورك', lead: 'حوّل صورك إلى مطبوعات حقيقية بخطوات واضحة.',
    privacy: 'صورك محفوظة في مساحة خاصة ولا تظهر للعامة.', choose: 'اختاري الطباعة', upload: 'ارفعي الصور',
    review: 'راجعي الصور', summary: 'راجعي السعر', size: 'مقاس الطباعة', finish: 'التشطيب', glossy: 'لامع', matte: 'مطفي',
    perPrint: 'للصورة الواحدة', continue: 'متابعة لرفع الصور', dropTitle: 'اسحبي الصور هنا أو اختاريها من جهازك',
    dropHint: 'JPG أو PNG أو WebP أو HEIC، بحد أقصى 35MB للصورة', browse: 'اختيار الصور', files: 'ملف',
    copies: 'نسخة مطبوعة', uploading: 'جاري الرفع', uploaded: 'اكتمل الرفع', failed: 'تعذر الرفع', retry: 'إعادة المحاولة',
    low: 'الدقة قد لا تكون كافية لهذا المقاس', good: 'الدقة مناسبة', rotate: 'تدوير', crop: 'قص', remove: 'حذف',
    applyAll: 'تطبيق العدد على الكل', fit: 'كامل الصورة', fill: 'ملء الإطار', zoom: 'التكبير', positionX: 'الموضع الأفقي',
    positionY: 'الموضع الرأسي', close: 'إغلاق', addMore: 'إضافة صور', reviewButton: 'مراجعة الصور',
    fileCount: 'عدد الملفات', printCount: 'إجمالي النسخ', unitPrice: 'سعر النسخة', total: 'الإجمالي',
    warnings: 'صور تحتاج مراجعة الدقة', addCart: 'إضافة طلب الطباعة إلى السلة', edit: 'العودة للتعديل',
    originals: 'نحتفظ بالملفات الأصلية دون ضغط أو تعديل. التدوير والقص تعليمات للطباعة فقط.', empty: 'أضيفي صورة واحدة على الأقل.',
    configuring: 'جاري تجهيز مساحة الرفع الآمنة...', invalidType: 'هذا النوع من الملفات غير مدعوم.', tooLarge: 'حجم الصورة أكبر من 35MB.',
    uploadProblem: 'تعذر رفع بعض الصور. أعيدي المحاولة قبل المتابعة.', saved: 'تمت إضافة طلب الطباعة إلى السلة.',
    step: 'الخطوة', of: 'من', cropTitle: 'ضبط إطار الطباعة', noAccount: 'لا تحتاجين إلى حساب الآن. تسجيل الدخول سيكون عند إتمام الطلب فقط.',
    privacyTitle: 'صورك خاصة بك',
    privacyDetails: 'تُحفظ الصور في مساحة خاصة وتُستخدم فقط لتنفيذ طلب الطباعة. روابط الوصول مؤقتة ومحدودة الصلاحية.',
    privacyRetention: 'تُحذف المسودة غير المكتملة بعد 7 أيام، وتُحذف ملفات الطلب بعد 30 يوماً من التسليم أو الإلغاء.',
    privacyLink: 'تفاصيل سياسة الصور والخصوصية',
  },
  en: {
    back: 'Back home', title: 'Print your photos', lead: 'Turn your photos into beautiful prints through a clear, simple flow.',
    privacy: 'Your photos are stored privately and are never public.', choose: 'Choose print', upload: 'Upload photos',
    review: 'Review photos', summary: 'Review price', size: 'Print size', finish: 'Finish', glossy: 'Glossy', matte: 'Matte',
    perPrint: 'per print', continue: 'Continue to upload', dropTitle: 'Drop photos here or choose them from your device',
    dropHint: 'JPG, PNG, WebP or HEIC, up to 35MB each', browse: 'Choose photos', files: 'files',
    copies: 'print copies', uploading: 'Uploading', uploaded: 'Uploaded', failed: 'Upload failed', retry: 'Retry',
    low: 'Resolution may be too low for this size', good: 'Resolution looks good', rotate: 'Rotate', crop: 'Crop', remove: 'Delete',
    applyAll: 'Apply copies to all', fit: 'Fit full photo', fill: 'Fill frame', zoom: 'Zoom', positionX: 'Horizontal position',
    positionY: 'Vertical position', close: 'Close', addMore: 'Add photos', reviewButton: 'Review photos',
    fileCount: 'Files', printCount: 'Total prints', unitPrice: 'Unit price', total: 'Total', warnings: 'Low-resolution warnings',
    addCart: 'Add print order to cart', edit: 'Back to edit', originals: 'Original files stay unchanged. Rotate and crop are print instructions only.',
    empty: 'Add at least one photo.', configuring: 'Preparing a secure upload space...', invalidType: 'This file type is not supported.',
    tooLarge: 'This image is larger than 35MB.', uploadProblem: 'Some photos could not be uploaded. Retry before continuing.',
    saved: 'Print order added to your cart.', step: 'Step', of: 'of', cropTitle: 'Adjust print frame',
    noAccount: 'No account is needed yet. Sign in only when you complete checkout.',
    privacyTitle: 'Your photos stay yours',
    privacyDetails: 'Photos are kept in private storage and used only to fulfil your print order. Access links are temporary and time-limited.',
    privacyRetention: 'Unfinished drafts are deleted after 7 days. Order files are deleted 30 days after delivery or cancellation.',
    privacyLink: 'Photo and privacy policy details',
  },
};

const optionCopy = {
  ar: {
    material: 'الخامة', surface: 'السطح', borders: 'الحواف', fitMethod: 'طريقة ملاءمة الصورة للمقاس',
    photo_paper: 'ورق صور', magnetic: 'مغناطيسي', adhesive: 'لاصق', mounted: 'مثبت على قاعدة',
    none: 'بدون', borderless: 'بدون حواف', white_border: 'حواف بيضاء',
    fillTitle: 'ملء الورق', fillDescription: 'تملأ الصورة مساحة الطباعة، وقد يُقص جزء بسيط من الأطراف إذا اختلفت النسبة.',
    fitTitle: 'إظهار الصورة كاملة', fitDescription: 'تظهر الصورة كاملة، وقد تظهر هوامش عند اختلاف نسبة الصورة عن المقاس.',
    unavailable: 'غير متوفر بهذا المقاس', unavailableNow: 'غير متاح حاليًا', uploadedFiles: 'الصور المرفوعة', totalPrints: 'إجمالي النسخ المطبوعة',
    uploadProgress: 'تقدم رفع الصور', uploadedOf: 'تم رفع', draftRestored: 'تم استعادة مسودة طلب الطباعة',
    draftNumber: 'رقم المسودة', reviewConsent: 'راجعت الصور والكميات وإعدادات الطباعة، وأوافق على تنفيذ الطباعة وفق الملفات المرسلة والشروط.',
    orderConfiguration: 'إعداد الطباعة', paperType: 'نوع الخامة', fitSummary: 'ملاءمة الصورة',
    incompleteUploads: 'انتظري اكتمال رفع جميع الصور أو أعيدي محاولة الملفات المتعثرة.',
    queued: 'في قائمة الانتظار', details: 'التفاصيل', allPhotos: 'تطبيق على جميع الصور', recommendedProducts: 'أكملي حفظ ذكرياتك',
    recommendedHint: 'بعد إضافة الطلب، ستجدين في السلة منتجات متوافقة مع مقاس الطباعة.',
    incompatibleMaterial: 'الخامة المختارة غير متاحة مع مقاس', chooseAnotherMaterial: 'اختاري خامة أخرى.',
    configurationAdjusted: 'تم تحديث الخيارات لتناسب التركيبة المتاحة.', livePrice: 'السعر الحالي', quoteCopies: 'نسخة',
  },
  en: {
    material: 'Material', surface: 'Surface', borders: 'Borders', fitMethod: 'How the photo fits the print size',
    photo_paper: 'Photo paper', magnetic: 'Magnetic', adhesive: 'Adhesive', mounted: 'Mounted',
    none: 'None', borderless: 'Borderless', white_border: 'White border',
    fillTitle: 'Fill paper', fillDescription: 'Fills the print area and may crop a small part of the edges when aspect ratios differ.',
    fitTitle: 'Show full photo', fitDescription: 'Shows the complete photo and may add margins when aspect ratios differ.',
    unavailable: 'Unavailable for this size', unavailableNow: 'Currently unavailable', uploadedFiles: 'Uploaded files', totalPrints: 'Total printed copies',
    uploadProgress: 'Upload progress', uploadedOf: 'Uploaded', draftRestored: 'Your print draft was restored',
    draftNumber: 'Draft ID', reviewConsent: 'I reviewed the photos, quantities and print settings, and approve printing from the submitted files under the terms.',
    orderConfiguration: 'Print configuration', paperType: 'Material', fitSummary: 'Photo fit',
    incompleteUploads: 'Wait for every upload to finish or retry failed files.', queued: 'Queued', details: 'Details',
    allPhotos: 'Apply to every photo', recommendedProducts: 'Complete your memory set',
    recommendedHint: 'After adding this job, the cart will suggest products compatible with your print size.',
    incompatibleMaterial: 'The selected material is unavailable for size', chooseAnotherMaterial: 'Choose another material.',
    configurationAdjusted: 'Options were adjusted to an available combination.', livePrice: 'Current price', quoteCopies: 'prints',
  },
};

const SIZE_DETAILS = { '4x6': '10 × 15 cm', A5: '14.8 × 21 cm', A4: '21 × 29.7 cm' };
const MATERIALS = ['photo_paper', 'magnetic', 'adhesive', 'mounted'];
const SURFACES = ['glossy', 'matte'];
const BORDERS = ['borderless', 'white_border'];
const LEGACY_VARIANTS = ['4x6', 'A4'].flatMap((printSize, sizeIndex) => SURFACES.map((surface, surfaceIndex) => ({
  id: `legacy:${printSize}:${surface}`,
  print_size: printSize,
  material: 'photo_paper',
  surface,
  border_style: 'borderless',
  pricing_mode: printSize === 'A4' ? 'existing_a4' : 'existing_4x6',
  unit_price: null,
  effective_unit_price: null,
  available: true,
  sort_order: (sizeIndex * 10) + surfaceIndex,
})));

async function functionError(error) {
  try {
    const body = await error?.context?.clone?.().json?.();
    return body?.error || error?.message || 'print_builder_failed';
  } catch {
    return error?.message || 'print_builder_failed';
  }
}

function imageDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight, preview: url });
    };
    image.onerror = () => resolve({ width: 1, height: 1, preview: url });
    image.src = url;
  });
}

async function createPreviewBlob(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78));
  } catch {
    return null;
  }
}

function formatMoney(value, language) {
  return `${Number(value || 0).toFixed(2)} ${language === 'ar' ? 'ر.س' : 'SAR'}`;
}

export default function PrintBuilder() {
  const { language, direction } = useLanguage();
  const text = copy[language] || copy.ar;
  const optionsText = optionCopy[language] || optionCopy.ar;
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const previewUrlsRef = useRef(new Set());
  const photoUpdateQueuesRef = useRef(new Map());
  const photoUpdateErrorRef = useRef(false);
  const [step, setStep] = useState(1);
  const [printSize, setPrintSize] = useState('4x6');
  const [finish, setFinish] = useState('glossy');
  const [variants, setVariants] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [material, setMaterial] = useState('photo_paper');
  const [borderStyle, setBorderStyle] = useState('borderless');
  const [fitMode, setFitMode] = useState('fill');
  const [defaultCopies, setDefaultCopies] = useState(1);
  const [draft, setDraft] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [photos, setPhotos] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [cropPhotoId, setCropPhotoId] = useState(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [variantNotice, setVariantNotice] = useState('');
  const [liveQuote, setLiveQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [pendingPhotoUpdates, setPendingPhotoUpdates] = useState(0);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadVariants = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('print-builder', { body: { action: 'list_variants' } });
        if (error) throw error;
        if (cancelled) return;
        const receivedVariants = data?.variants || [];
        const supportsAvailability = receivedVariants.some((variant) => typeof variant.available === 'boolean');
        const nextVariants = supportsAvailability ? receivedVariants : LEGACY_VARIANTS;
        setVariants(nextVariants);
        const initial = nextVariants.find((variant) => variant.available && variant.print_size === '4x6')
          || nextVariants.find((variant) => variant.available);
        const hasSavedDraft = Boolean(localStorage.getItem(DRAFT_STORAGE_KEY));
        if (initial && !hasSavedDraft) {
          setSelectedVariantId((current) => current || initial.id);
          setPrintSize((current) => current || initial.print_size);
          setMaterial(initial.material);
          setFinish(initial.surface);
          setBorderStyle(initial.border_style);
        }
      } catch (error) {
        console.info('Print variants are not deployed yet; using the current print sizes.', error?.message || '');
        if (!cancelled && !localStorage.getItem(DRAFT_STORAGE_KEY)) {
          setVariants(LEGACY_VARIANTS);
          setSelectedVariantId(LEGACY_VARIANTS[0].id);
        }
      }
    };
    loadVariants();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restoreDraft = async () => {
      try {
        const saved = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || 'null');
        if (!saved?.draftId || !saved?.accessToken) return;
        const { data, error } = await supabase.functions.invoke('print-builder', {
          body: { action: 'get_draft', draftId: saved.draftId, accessToken: saved.accessToken },
        });
        if (error || cancelled || !data?.draft || data.draft.status === 'ordered') return;
        setDraft(data.draft);
        setAccessToken(saved.accessToken);
        setPrintSize(data.draft.print_size || '4x6');
        setFinish(data.draft.surface || data.draft.finish || 'glossy');
        setSelectedVariantId(data.draft.variant_id || '');
        setMaterial(data.draft.material || 'photo_paper');
        setBorderStyle(data.draft.border_style || 'borderless');
        setFitMode(data.draft.fit_mode || 'fill');
        setDefaultCopies(Number(data.draft.default_copies || 1));
        setPhotos((data.files || []).map((file) => ({
          id: file.id,
          localId: file.id,
          name: file.original_name,
          size: Number(file.size_bytes || 0),
          width: file.width,
          height: file.height,
          copies: Number(file.copies || 1),
          rotation: Number(file.rotation || 0),
          crop: file.crop || { mode: data.draft.fit_mode || 'fill', zoom: 1, x: 50, y: 50 },
          status: file.upload_status === 'uploaded' ? 'uploaded' : 'failed',
          progress: file.upload_status === 'uploaded' ? 100 : 0,
          preview: file.preview_url || null,
        })));
        setRestoredDraft(true);
        if ((data.files || []).some((file) => file.upload_status === 'uploaded')) {
          setStep((data.files || []).every((file) => file.upload_status === 'uploaded') ? 3 : 2);
        }
      } catch {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    };
    restoreDraft();
    return () => { cancelled = true; };
  }, []);

  const uploadedPhotos = photos.filter((photo) => photo.status === 'uploaded');
  const failedPhotos = photos.filter((photo) => photo.status === 'failed');
  const activeUploads = photos.filter((photo) => ['preparing', 'uploading'].includes(photo.status));
  const totalCopies = uploadedPhotos.reduce((sum, photo) => sum + Number(photo.copies || 0), 0);
  const cropPhoto = photos.find((photo) => photo.id === cropPhotoId);
  const uploadPercent = photos.length
    ? Math.round(photos.reduce((sum, photo) => sum + Number(photo.progress || 0), 0) / photos.length)
    : 0;

  const steps = [text.choose, text.upload, text.review, text.summary];
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const availableVariants = variants.filter((variant) => variant.available !== false);
  const quoteCopies = Math.max(1, totalCopies || defaultCopies);
  const displayUnitPrice = Number(liveQuote?.unitPrice ?? draft?.snapshot_unit_price ?? draft?.unit_price ?? selectedVariant?.effective_unit_price ?? 0);
  const displaySubtotal = Number(liveQuote?.subtotal ?? draft?.snapshot_subtotal ?? draft?.subtotal ?? (displayUnitPrice * quoteCopies));

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!selectedVariantId || selectedVariant?.available === false) {
        setLiveQuote(null);
        return;
      }
      if (selectedVariantId.startsWith('legacy:')) {
        setLiveQuote(draft ? {
          unitPrice: Number(draft.unit_price || 0),
          subtotal: Number(draft.subtotal || 0),
          totalCopies: quoteCopies,
        } : null);
        return;
      }
      setQuoteLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('print-builder', {
          body: { action: 'quote', variantId: selectedVariantId, totalCopies: quoteCopies },
        });
        if (error) throw error;
        if (!cancelled) setLiveQuote(data);
      } catch {
        if (!cancelled) setLiveQuote(draft ? {
          unitPrice: Number(draft.snapshot_unit_price ?? draft.unit_price ?? 0),
          subtotal: Number(draft.snapshot_subtotal ?? draft.subtotal ?? 0),
          totalCopies: quoteCopies,
        } : null);
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [defaultCopies, draft, quoteCopies, selectedVariant?.available, selectedVariantId]);

  const chooseVariant = (changes) => {
    const desired = {
      print_size: changes.printSize ?? printSize,
      material: changes.material ?? material,
      surface: changes.finish ?? finish,
      border_style: changes.borderStyle ?? borderStyle,
    };
    let match = availableVariants.find((variant) => (
      variant.print_size === desired.print_size
      && variant.material === desired.material
      && variant.surface === desired.surface
      && variant.border_style === desired.border_style
    ));
    if (!match) {
      const sameMaterial = availableVariants.filter((variant) => (
        variant.print_size === desired.print_size && variant.material === desired.material
      ));
      if (changes.printSize !== undefined && sameMaterial.length === 0) {
        setPrintSize(desired.print_size);
        setMaterial('');
        setFinish('');
        setBorderStyle('');
        setSelectedVariantId('');
        setVariantNotice(`${optionsText.incompatibleMaterial} ${desired.print_size}. ${optionsText.chooseAnotherMaterial}`);
        setReviewConfirmed(false);
        return false;
      }
      match = sameMaterial[0];
    }
    if (!match) return false;
    setSelectedVariantId(match.id);
    setPrintSize(match.print_size);
    setMaterial(match.material);
    setFinish(match.surface);
    setBorderStyle(match.border_style);
    setReviewConfirmed(false);
    const wasAdjusted = match.surface !== desired.surface || match.border_style !== desired.border_style;
    setVariantNotice(wasAdjusted ? optionsText.configurationAdjusted : '');
    if (draft && accessToken) {
      invokeBuilder({
        action: 'update_draft', draftId: draft.id, accessToken, variantId: match.id,
      }).then((data) => setDraft(data.draft)).catch(() => {
        toast.error(language === 'ar' ? 'تعذر حفظ إعداد الطباعة الجديد.' : 'Could not save the new print configuration.');
      });
    }
    return true;
  };

  const invokeBuilder = async (body) => {
    const { data, error } = await supabase.functions.invoke('print-builder', { body });
    if (error) throw new Error(await functionError(error));
    return data;
  };

  const ensureDraft = async () => {
    if (draft && accessToken) return { draft, accessToken };
    if (!selectedVariantId) throw new Error('print_variant_unavailable');
    setIsPreparing(true);
    try {
      const data = selectedVariantId.startsWith('legacy:')
        ? await invokeBuilder({ action: 'create_draft', printSize, finish, defaultCopies })
        : await invokeBuilder({ action: 'create_draft', variantId: selectedVariantId, fitMode, defaultCopies });
      setDraft(data.draft);
      setAccessToken(data.accessToken);
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ draftId: data.draft.id, accessToken: data.accessToken }));
      return data;
    } finally {
      setIsPreparing(false);
    }
  };

  const uploadPhoto = async (localPhoto, activeDraft, token) => {
    setPhotos((current) => current.map((photo) => photo.localId === localPhoto.localId ? { ...photo, status: 'preparing', progress: 12 } : photo));
    try {
      const dimensions = await imageDimensions(localPhoto.file);
      previewUrlsRef.current.add(dimensions.preview);
      setPhotos((current) => current.map((photo) => photo.localId === localPhoto.localId ? {
        ...photo, preview: dimensions.preview, width: dimensions.width, height: dimensions.height,
        status: 'uploading', progress: 35,
      } : photo));

      const request = await invokeBuilder({
        action: 'request_upload', draftId: activeDraft.id, accessToken: token,
        file: { name: localPhoto.file.name, size: localPhoto.file.size, type: localPhoto.file.type },
        sortOrder: localPhoto.sortOrder,
      });
      const { error: uploadError } = await supabase.storage
        .from('print-originals')
        .uploadToSignedUrl(request.upload.path, request.upload.token, localPhoto.file, {
          contentType: localPhoto.file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const previewBlob = await createPreviewBlob(localPhoto.file);
      if (previewBlob && request.previewUpload?.path && request.previewUpload?.token) {
        const { error: previewUploadError } = await supabase.storage
          .from('print-previews')
          .uploadToSignedUrl(request.previewUpload.path, request.previewUpload.token, previewBlob, {
            contentType: 'image/webp', upsert: false,
          });
        if (previewUploadError) console.warn('Print preview upload failed:', previewUploadError);
      }
      setPhotos((current) => current.map((photo) => photo.localId === localPhoto.localId ? { ...photo, progress: 88 } : photo));

      const confirmation = await invokeBuilder({
        action: 'confirm_upload', draftId: activeDraft.id, accessToken: token, fileId: request.file.id,
        width: dimensions.width, height: dimensions.height,
      });
      setDraft(confirmation.draft);
      setPhotos((current) => current.map((photo) => photo.localId === localPhoto.localId ? {
        ...photo, id: request.file.id, status: 'uploaded', progress: 100,
      } : photo));
    } catch (error) {
      console.error('Print photo upload error:', error);
      setPhotos((current) => current.map((photo) => photo.localId === localPhoto.localId ? {
        ...photo, status: 'failed', progress: 0, error: error.message,
      } : photo));
    }
  };

  const addFiles = async (fileList) => {
    const accepted = [];
    Array.from(fileList || []).forEach((file) => {
      if (!ACCEPTED_TYPES.has(file.type)) return toast.error(`${file.name}: ${text.invalidType}`);
      if (file.size > MAX_FILE_SIZE) return toast.error(`${file.name}: ${text.tooLarge}`);
      accepted.push({
        localId: crypto.randomUUID(), file, name: file.name, size: file.size, copies: defaultCopies,
        rotation: 0, crop: { mode: fitMode, zoom: 1, x: 50, y: 50 }, status: 'queued', progress: 0,
        sortOrder: photos.length + accepted.length,
      });
    });
    if (!accepted.length) return;
    setStep(2);
    setPhotos((current) => [...current, ...accepted]);
    try {
      const session = await ensureDraft();
      let cursor = 0;
      const worker = async () => {
        while (cursor < accepted.length) {
          const photo = accepted[cursor];
          cursor += 1;
          await uploadPhoto(photo, session.draft, session.accessToken);
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, accepted.length) }, () => worker()));
    } catch (error) {
      console.error('Print draft creation error:', error);
      toast.error(text.uploadProblem);
      setPhotos((current) => current.map((photo) => accepted.some((item) => item.localId === photo.localId)
        ? { ...photo, status: 'failed', error: error.message }
        : photo));
    }
  };

  const retryPhoto = async (photo) => {
    if (!photo.file) return;
    const session = await ensureDraft();
    await uploadPhoto({ ...photo, id: undefined }, session.draft, session.accessToken);
  };

  const updatePhoto = async (photoId, changes) => {
    setPhotos((current) => current.map((photo) => photo.id === photoId ? { ...photo, ...changes } : photo));
    const previousQueue = photoUpdateQueuesRef.current.get(photoId) || Promise.resolve();
    setPendingPhotoUpdates((current) => current + 1);

    let queuedUpdate;
    queuedUpdate = previousQueue
      .catch(() => undefined)
      .then(async () => {
        const data = await invokeBuilder({
          action: 'update_file', draftId: draft.id, accessToken, fileId: photoId, ...changes,
        });
        setDraft(data.draft);
        return data;
      })
      .catch((error) => {
        photoUpdateErrorRef.current = true;
        toast.error(language === 'ar' ? 'تعذر حفظ التعديل.' : 'Could not save the change.');
        return { error };
      })
      .finally(() => {
        if (photoUpdateQueuesRef.current.get(photoId) === queuedUpdate) {
          photoUpdateQueuesRef.current.delete(photoId);
        }
        setPendingPhotoUpdates((current) => Math.max(0, current - 1));
      });

    photoUpdateQueuesRef.current.set(photoId, queuedUpdate);
    return queuedUpdate;
  };

  const flushPhotoUpdates = async () => {
    const updates = [...photoUpdateQueuesRef.current.values()];
    if (updates.length) await Promise.all(updates);
    if (photoUpdateErrorRef.current) {
      photoUpdateErrorRef.current = false;
      throw new Error('photo_update_failed');
    }
  };

  const removePhoto = async (photo) => {
    if (!photo.id) {
      setPhotos((current) => current.filter((item) => item.localId !== photo.localId));
      return;
    }
    try {
      const data = await invokeBuilder({ action: 'remove_file', draftId: draft.id, accessToken, fileId: photo.id });
      setDraft(data.draft);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      if (photo.preview) URL.revokeObjectURL(photo.preview);
      previewUrlsRef.current.delete(photo.preview);
    } catch {
      toast.error(language === 'ar' ? 'تعذر حذف الصورة.' : 'Could not delete the photo.');
    }
  };

  const applyCopiesToAll = async (copies) => {
    const normalized = Math.min(999, Math.max(1, Number(copies || 1)));
    setDefaultCopies(normalized);
    if (draft && accessToken) {
      const data = await invokeBuilder({
        action: 'update_draft', draftId: draft.id, accessToken, defaultCopies: normalized,
      });
      setDraft(data.draft);
    }
    await Promise.all(uploadedPhotos.map((photo) => updatePhoto(photo.id, { copies: normalized })));
  };

  const applyFitToAll = async (mode) => {
    const normalized = mode === 'fit' ? 'fit' : 'fill';
    setFitMode(normalized);
    setPhotos((current) => current.map((photo) => ({
      ...photo, crop: { ...(photo.crop || {}), mode: normalized },
    })));
    if (!draft || !accessToken) return;
    try {
      const data = await invokeBuilder({
        action: 'update_draft', draftId: draft.id, accessToken, fitMode: normalized,
      });
      setDraft(data.draft);
    } catch {
      toast.error(language === 'ar' ? 'تعذر حفظ طريقة ملاءمة الصور.' : 'Could not save the photo fit setting.');
    }
  };

  const goToReview = () => {
    if (!uploadedPhotos.length) return toast.error(text.empty);
    if (activeUploads.length || failedPhotos.length) return toast.error(text.uploadProblem);
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToSummary = async () => {
    if (!uploadedPhotos.length) return toast.error(text.empty);
    if (photos.length !== uploadedPhotos.length) return toast.error(optionsText.incompleteUploads);
    try {
      await flushPhotoUpdates();
    } catch {
      return;
    }
    setReviewConfirmed(false);
    setStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToCart = async () => {
    setIsSealing(true);
    try {
      if (!reviewConfirmed) return toast.error(optionsText.reviewConsent);
      if (photos.length !== uploadedPhotos.length) return toast.error(optionsText.incompleteUploads);
      await flushPhotoUpdates();
      const data = await invokeBuilder({
        action: 'seal_draft', draftId: draft.id, accessToken, reviewConfirmed: true,
      });
      const readyDraft = data.draft;
      const snapshotUnitPrice = Number(readyDraft.snapshot_unit_price ?? readyDraft.unit_price ?? 0);
      const snapshotSubtotal = Number(readyDraft.snapshot_subtotal ?? readyDraft.subtotal ?? 0);
      const snapshotTotalCopies = Number(readyDraft.snapshot_total_copies ?? readyDraft.total_copies ?? 0);
      const savedCart = JSON.parse(localStorage.getItem('art_moment_cart') || '[]');
      const cartItem = {
        id: `print-${readyDraft.id}`,
        cartKey: `print:${readyDraft.id}`,
        itemType: 'print',
        printDraftId: readyDraft.id,
        printDraftToken: accessToken,
        name: language === 'ar' ? `طباعة صور ${readyDraft.print_size}` : `${readyDraft.print_size} photo prints`,
        price: snapshotSubtotal,
        qty: 1,
        fixedQuantity: true,
        inStock: true,
        stockQuantity: null,
        printDetails: {
          printSize: readyDraft.print_size,
          material: readyDraft.material,
          surface: readyDraft.surface,
          borderStyle: readyDraft.border_style,
          fitMode: readyDraft.fit_mode,
          fileCount: readyDraft.file_count,
          totalCopies: snapshotTotalCopies,
          unitPrice: snapshotUnitPrice,
          totalPrice: snapshotSubtotal,
          snapshotAt: readyDraft.snapshot_at,
        },
      };
      const nextCart = [...savedCart.filter((item) => item.printDraftId !== readyDraft.id), cartItem];
      localStorage.setItem('art_moment_cart', JSON.stringify(nextCart));
      toast.success(text.saved);
      navigate('/store/cart');
    } catch (error) {
      console.error('Seal print draft error:', error);
      const reason = await functionError(error);
      const messageByReason = {
        print_draft_empty: language === 'ar' ? 'أضيفي صورة واحدة على الأقل قبل المتابعة.' : 'Add at least one photo before continuing.',
        print_draft_expired: language === 'ar' ? 'انتهت صلاحية مسودة الصور. ابدئي طلب طباعة جديدًا.' : 'This photo draft has expired. Start a new print order.',
        print_draft_locked: language === 'ar' ? 'تمت إضافة هذا الطلب للسلة مسبقًا.' : 'This print order has already been added to the cart.',
        print_uploads_incomplete: optionsText.incompleteUploads,
        print_review_confirmation_required: optionsText.reviewConsent,
        print_variant_unavailable: language === 'ar' ? 'تركيبة الطباعة المختارة غير متاحة حاليًا.' : 'The selected print configuration is unavailable.',
      };
      toast.error(messageByReason[reason] || (language === 'ar' ? 'تعذر تجهيز طلب الطباعة للسلة.' : 'Could not prepare the print order.'));
    } finally {
      setIsSealing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] font-[Tajawal] text-[#171717]" dir={direction}>
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#FAF9F7]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-black/55 transition hover:text-black">
            {direction === 'rtl' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />} {text.back}
          </Link>
          <div className="flex items-center gap-2 font-black"><Images size={20} className="text-[#C6A56B]" /> {text.title}</div>
          <div className="hidden items-center gap-2 text-xs font-bold text-emerald-700 sm:flex"><ShieldCheck size={17} /> {text.privacy}</div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 pb-28 pt-8 sm:px-6 sm:pb-8 lg:px-10 lg:py-12">
        <section className="mb-8 grid gap-8 border-b border-black/[0.07] pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <span className="mb-3 inline-flex items-center gap-2 text-xs font-black text-[#C6A56B]"><Sparkles size={15} /> PRINT BUILDER</span>
            <h1 className="text-4xl font-black sm:text-5xl">{text.title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-8 text-black/55">{text.lead}</p>
          </div>
          <p className="max-w-md border-s-2 border-[#E8B4BC] ps-4 text-sm leading-7 text-black/55">{text.noAccount}</p>
        </section>

        <section className="mb-8 grid gap-4 border-s-4 border-emerald-500 bg-emerald-50/70 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5" aria-labelledby="print-privacy-title">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
            <ShieldCheck size={22} />
          </span>
          <div>
            <h2 id="print-privacy-title" className="text-sm font-black text-emerald-950">{text.privacyTitle}</h2>
            <p className="mt-1 text-xs font-bold leading-6 text-emerald-950/65">{text.privacyDetails}</p>
            <p className="mt-1 text-[11px] font-bold leading-5 text-emerald-800">{text.privacyRetention}</p>
          </div>
          <Link to="/privacy#photo-files" className="inline-flex min-h-11 items-center justify-center border border-emerald-700/20 bg-white px-4 text-xs font-black text-emerald-800 transition-colors hover:bg-emerald-100">
            {text.privacyLink}
          </Link>
        </section>

        {restoredDraft && draft && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-[#C6A56B]/35 bg-[#C6A56B]/10 px-4 py-3 text-sm">
            <strong>{optionsText.draftRestored}</strong>
            <span className="font-bold text-black/55">{optionsText.draftNumber}: {String(draft.id).slice(0, 8)} · {uploadedPhotos.length}/{photos.length} {text.files}</span>
          </div>
        )}

        <div className="mb-2 text-xs font-black text-black/55 sm:hidden">{text.step} {step} {text.of} 4 · {steps[step - 1]}</div>
        <div className="mb-8 grid grid-cols-4 gap-2" aria-label={`${text.step} ${step} ${text.of} 4`}>
          {steps.map((label, index) => {
            const number = index + 1;
            const active = number === step;
            const complete = number < step;
            return (
              <button key={label} type="button" disabled={number >= step} onClick={() => setStep(number)} className="min-w-0 text-start disabled:cursor-default">
                <div className={`mb-2 h-1 rounded-full transition-colors ${number <= step ? 'bg-[#171717]' : 'bg-black/10'}`} />
                <div className={`flex items-center gap-2 text-[10px] font-black sm:text-sm ${active ? 'text-black' : complete ? 'text-[#C6A56B]' : 'text-black/35'}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${number <= step ? 'border-[#171717] bg-[#171717] text-white' : 'border-black/10'}`}>
                    {complete ? <Check size={13} /> : number}
                  </span>
                  <span className="hidden truncate sm:block">{label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {step === 1 && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,.85fr)]">
            <div className="border-t-2 border-[#171717] bg-white p-5 sm:p-8">
              <div className="mb-6 flex items-center gap-3"><FileImage size={24} /><h2 className="text-xl font-black">{optionsText.orderConfiguration}</h2></div>
              <fieldset>
                <legend className="mb-3 text-sm font-black">{text.size}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {['4x6', 'A5', 'A4'].map((size) => {
                    const available = availableVariants.some((variant) => variant.print_size === size);
                    return <button key={size} type="button" disabled={!available} onClick={() => chooseVariant({ printSize: size })} className={`relative min-h-24 border p-3 text-start transition ${printSize === size ? 'border-[#171717] bg-[#171717] text-white' : 'border-black/10 bg-[#FAF9F7] hover:border-black/35'} disabled:cursor-not-allowed disabled:opacity-60`}><span className="block text-xl font-black">{size}</span><span className="mt-2 block text-[10px] opacity-60">{SIZE_DETAILS[size]}</span>{!available && <span className="mt-1 block text-[9px] font-bold">{optionsText.unavailableNow}</span>}{printSize === size && <CheckCircle2 className="absolute end-3 top-3" size={18} />}</button>;
                  })}
                </div>
              </fieldset>
              <fieldset className="mt-7 border-t border-black/[0.06] pt-6">
                <legend className="mb-3 text-sm font-black">{optionsText.material}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MATERIALS.map((value) => {
                    const available = availableVariants.some((variant) => variant.print_size === printSize && variant.material === value);
                    return <button key={value} type="button" disabled={!available} onClick={() => chooseVariant({ material: value })} className={`min-h-14 border px-3 py-2 text-xs font-black ${material === value ? 'border-[#E8B4BC] bg-[#E8B4BC]/15' : 'border-black/10'} disabled:cursor-not-allowed disabled:opacity-60`}>{optionsText[value]}{!available && <span className="mt-1 block text-[8px] font-bold">{optionsText.unavailableNow}</span>}</button>;
                  })}
                </div>
              </fieldset>
              {material === 'photo_paper' && <fieldset className="mt-7 border-t border-black/[0.06] pt-6"><legend className="mb-3 text-sm font-black">{optionsText.surface}</legend><div className="grid grid-cols-2 gap-2">{SURFACES.map((value) => { const available = availableVariants.some((variant) => variant.print_size === printSize && variant.material === material && variant.surface === value); return <button key={value} type="button" disabled={!available} onClick={() => chooseVariant({ finish: value })} className={`min-h-14 border px-4 font-black ${finish === value ? 'border-[#E8B4BC] bg-[#E8B4BC]/15' : 'border-black/10'} disabled:opacity-60`}>{value === 'matte' ? text.matte : text.glossy}{!available && <span className="mt-1 block text-[9px]">{optionsText.unavailableNow}</span>}</button>; })}</div></fieldset>}
              <fieldset className="mt-7 border-t border-black/[0.06] pt-6">
                <legend className="mb-3 text-sm font-black">{optionsText.borders}</legend>
                <div className="grid grid-cols-2 gap-3">
                  {BORDERS.map((value) => { const available = availableVariants.some((variant) => variant.print_size === printSize && variant.material === material && variant.surface === finish && variant.border_style === value); return <button key={value} type="button" disabled={!available} onClick={() => chooseVariant({ borderStyle: value })} className={`border p-3 text-start ${borderStyle === value ? 'border-[#171717]' : 'border-black/10'} disabled:opacity-60`}><span className={`mb-3 block aspect-[3/2] bg-[#ddd] ${value === 'white_border' ? 'border-[8px] border-white shadow-inner' : ''}`} /><strong className="text-xs">{optionsText[value]}</strong>{!available && <span className="mt-1 block text-[9px] font-bold">{optionsText.unavailableNow}</span>}</button>; })}
                </div>
              </fieldset>
              {variantNotice && <p role="status" className="mt-5 border-s-4 border-amber-500 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-900">{variantNotice}</p>}
            </div>
            <div className="border-t-2 border-[#E8B4BC] bg-white p-5 sm:p-8">
              <div className="mb-6 flex items-center gap-3"><Crop size={24} className="text-[#C6A56B]" /><h2 className="text-xl font-black">{optionsText.fitMethod}</h2></div>
              <div className="space-y-3">{[['fill', optionsText.fillTitle, optionsText.fillDescription], ['fit', optionsText.fitTitle, optionsText.fitDescription]].map(([value, label, description]) => <button key={value} type="button" onClick={() => applyFitToAll(value)} className={`w-full border p-4 text-start transition ${fitMode === value ? 'border-[#171717] bg-[#171717] text-white' : 'border-black/10 bg-[#FAF9F7]'}`}><span className="flex items-center justify-between gap-3"><strong>{label}</strong>{fitMode === value && <CheckCircle2 size={18} />}</span><span className="mt-2 block text-xs leading-6 opacity-60">{description}</span></button>)}</div>
              <div className="mt-7 border border-[#C6A56B]/30 bg-[#C6A56B]/10 p-4">
                <p className="text-xs font-bold leading-6 text-black/65">{selectedVariant?.available ? `${printSize} · ${optionsText[material]} · ${finish === 'matte' ? text.matte : finish === 'glossy' ? text.glossy : optionsText.none} · ${optionsText[borderStyle]}` : optionsText.unavailableNow}</p>
                <div className="mt-4 flex items-end justify-between gap-4 border-t border-[#C6A56B]/20 pt-4">
                  <div><span className="block text-[10px] font-bold text-black/45">{optionsText.livePrice}</span><strong className="mt-1 block text-2xl font-black">{quoteLoading ? '...' : formatMoney(displaySubtotal, language)}</strong></div>
                  <span className="text-xs font-black text-black/55">{quoteCopies} {optionsText.quoteCopies} · {formatMoney(displayUnitPrice, language)}</span>
                </div>
              </div>
              <button type="button" disabled={!selectedVariant?.available || isPreparing || (!selectedVariantId.startsWith('legacy:') && displayUnitPrice <= 0)} onClick={() => { setStep(2); fileInputRef.current?.click(); }} className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 bg-[#171717] px-5 py-4 font-black text-white transition hover:bg-[#333] disabled:opacity-40">{text.continue} {direction === 'rtl' ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}</button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <div
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => { event.preventDefault(); setIsDragging(false); addFiles(event.dataTransfer.files); }}
              className={`border-2 border-dashed p-8 text-center transition sm:p-14 ${isDragging ? 'border-[#E8B4BC] bg-[#E8B4BC]/10' : 'border-black/15 bg-white'}`}
            >
              <UploadCloud size={42} className="mx-auto mb-4 text-[#C6A56B]" />
              <h2 className="text-xl font-black">{isPreparing ? text.configuring : text.dropTitle}</h2>
              <p className="mt-2 text-sm text-black/45">{text.dropHint}</p>
              <button type="button" disabled={isPreparing} onClick={() => fileInputRef.current?.click()} className="mt-5 min-h-12 bg-[#171717] px-7 py-3 text-sm font-black text-white disabled:opacity-50">{text.browse}</button>
            </div>

            {photos.length > 0 && (
              <div className="mt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2 text-xs font-black">
                    <span className="bg-white px-3 py-2">{uploadedPhotos.length} {text.files}</span>
                    <span className="bg-white px-3 py-2">{totalCopies} {text.copies}</span>
                  </div>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-11 items-center gap-2 border border-black/10 bg-white px-4 py-2 text-xs font-black"><Plus size={15} /> {text.addMore}</button>
                </div>
                <div className="mb-4 border border-black/[0.07] bg-white p-4">
                  <div className="flex items-center justify-between gap-3 text-xs font-black"><span>{optionsText.uploadProgress}</span><span>{optionsText.uploadedOf} {uploadedPhotos.length} {text.of} {photos.length} · {uploadPercent}%</span></div>
                  <div className="mt-3 h-2 overflow-hidden bg-black/5"><div className="h-full bg-[#C6A56B] transition-[width] duration-300" style={{ width: `${uploadPercent}%` }} /></div>
                </div>
                <div className="space-y-2">
                  {photos.map((photo) => (
                    <div key={photo.localId} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 border border-black/[0.07] bg-white p-3 sm:grid-cols-[4rem_minmax(0,1fr)_9rem_auto]">
                      <div className="aspect-square overflow-hidden bg-[#FAF9F7]">{photo.preview ? <img src={photo.preview} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto h-full text-black/15" />}</div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{photo.name}</p>
                        <p className="mt-1 text-[11px] text-black/40">{(photo.size / 1024 / 1024).toFixed(1)} MB</p>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/5"><div className={`h-full transition-all ${photo.status === 'failed' ? 'bg-red-500' : 'bg-[#C6A56B]'}`} style={{ width: `${photo.progress || 0}%` }} /></div>
                        <div className="mt-2 text-[10px] font-bold sm:hidden">
                          {photo.status === 'uploaded' && <span className="text-emerald-600">{text.uploaded}</span>}
                          {photo.status === 'queued' && <span className="text-black/45">{optionsText.queued}</span>}
                          {['preparing', 'uploading'].includes(photo.status) && <span className="text-[#C6A56B]">{text.uploading}</span>}
                          {photo.status === 'failed' && (photo.file ? <button onClick={() => retryPhoto(photo)} className="text-red-600">{text.retry}</button> : <span className="text-red-600">{text.failed}</span>)}
                        </div>
                      </div>
                      <div className="hidden text-xs font-bold sm:block">
                        {photo.status === 'uploaded' && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={14} /> {text.uploaded}</span>}
                        {photo.status === 'queued' && <span className="text-black/45">{optionsText.queued}</span>}
                        {['preparing', 'uploading'].includes(photo.status) && <span className="flex items-center gap-1 text-[#C6A56B]"><Loader2 size={14} className="animate-spin" /> {text.uploading}</span>}
                        {photo.status === 'failed' && (photo.file ? <button onClick={() => retryPhoto(photo)} className="flex items-center gap-1 text-red-600">{text.retry}</button> : <span className="text-red-600">{text.failed}</span>)}
                      </div>
                      <button type="button" onClick={() => removePhoto(photo)} className="flex h-11 w-11 items-center justify-center text-red-500 hover:bg-red-50" title={text.remove} aria-label={text.remove}><Trash2 size={17} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={goToReview} disabled={activeUploads.length > 0} className="mt-6 flex w-full items-center justify-center gap-2 bg-[#171717] px-5 py-4 font-black text-white disabled:cursor-wait disabled:opacity-40">
                  {activeUploads.length ? <Loader2 size={18} className="animate-spin" /> : <Images size={18} />} {text.reviewButton}
                </button>
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-black/[0.07] py-4">
              <div><h2 className="text-xl font-black">{text.review}</h2><p className="mt-1 text-xs text-black/45">{text.originals}</p></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => applyCopiesToAll(defaultCopies - 1)} className="h-11 w-11 border border-black/10 bg-white"><Minus size={15} className="mx-auto" /></button>
                <span className="min-w-12 text-center font-black">{defaultCopies}</span>
                <button type="button" onClick={() => applyCopiesToAll(defaultCopies + 1)} className="h-11 w-11 border border-black/10 bg-white"><Plus size={15} className="mx-auto" /></button>
                <span className="ms-2 text-xs font-black">{text.applyAll}</span>
              </div>
            </div>
            <div className="mb-5 grid gap-3 border border-black/[0.07] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div><strong className="text-sm">{optionsText.fitMethod}</strong><p className="mt-1 text-xs leading-6 text-black/45">{fitMode === 'fill' ? optionsText.fillDescription : optionsText.fitDescription}</p></div>
              <div className="grid grid-cols-2 gap-2">{[['fill', optionsText.fillTitle], ['fit', optionsText.fitTitle]].map(([value, label]) => <button key={value} type="button" onClick={() => applyFitToAll(value)} className={`min-h-11 border px-3 text-xs font-black ${fitMode === value ? 'border-[#171717] bg-[#171717] text-white' : 'border-black/10'}`}>{label}</button>)}</div>
            </div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-s-4 border-[#C6A56B] bg-[#C6A56B]/10 p-4">
              <div><p className="text-xs font-bold text-black/50">{printSize} · {optionsText[material]} · {finish === 'matte' ? text.matte : finish === 'glossy' ? text.glossy : optionsText.none} · {optionsText[borderStyle]}</p><p className="mt-1 text-sm font-black">{totalCopies} {optionsText.quoteCopies}</p></div>
              <div className="text-end"><span className="text-[10px] font-bold text-black/45">{optionsText.livePrice}</span><strong className="block text-2xl font-black">{quoteLoading ? '...' : formatMoney(displaySubtotal, language)}</strong></div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {uploadedPhotos.map((photo) => (
                <article key={photo.id} className="overflow-hidden border border-black/[0.08] bg-white">
                  <div className={`relative aspect-[4/3] overflow-hidden bg-[#eee] ${borderStyle === 'white_border' ? 'p-2' : ''}`}>
                    {photo.preview ? <img src={photo.preview} alt={photo.name} className={`h-full w-full ${photo.crop?.mode === 'fill' ? 'object-cover' : 'object-contain'}`} style={{ transform: `rotate(${photo.rotation || 0}deg) scale(${photo.crop?.zoom || 1})`, objectPosition: `${photo.crop?.x || 50}% ${photo.crop?.y || 50}%` }} /> : <ImageIcon className="m-auto h-full text-black/15" />}
                  </div>
                  <div className="p-3">
                    <p className="hidden truncate text-xs font-black sm:block" title={photo.name}>{photo.name}</p>
                    <button type="button" onClick={() => setCropPhotoId(photo.id)} className="mb-2 text-[10px] font-black text-[#B97882] sm:hidden">{optionsText.details}</button>
                    <div className="mt-3 flex items-center justify-between border-y border-black/[0.06] py-2">
                      <span className="text-[10px] text-black/45">{text.copies}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updatePhoto(photo.id, { copies: Math.max(1, photo.copies - 1) })}><Minus size={14} /></button>
                        <strong>{photo.copies}</strong>
                        <button onClick={() => updatePhoto(photo.id, { copies: photo.copies + 1 })}><Plus size={14} /></button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => updatePhoto(photo.id, { rotation: ((photo.rotation || 0) + 90) % 360 })} className="flex items-center justify-center gap-1 bg-[#FAF9F7] px-2 py-2 text-[10px] font-black"><RotateCw size={13} /> {text.rotate}</button>
                      <button type="button" onClick={() => setCropPhotoId(photo.id)} className="flex items-center justify-center gap-1 bg-[#FAF9F7] px-2 py-2 text-[10px] font-black"><Crop size={13} /> {text.crop}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={() => setStep(2)} className="border border-black/10 bg-white px-6 py-3 text-sm font-black">{text.addMore}</button>
              <button type="button" disabled={pendingPhotoUpdates > 0} onClick={goToSummary} className="flex flex-1 items-center justify-center gap-2 bg-[#171717] px-6 py-3 text-sm font-black text-white disabled:opacity-50">{text.summary} {direction === 'rtl' ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="bg-white p-5 sm:p-8">
              <h2 className="text-2xl font-black">{text.summary}</h2>
              <div className="mt-7 grid grid-cols-2 gap-px bg-black/10 sm:grid-cols-4">
                {[[optionsText.uploadedFiles, uploadedPhotos.length], [optionsText.totalPrints, totalCopies], [text.unitPrice, formatMoney(displayUnitPrice, language)], [optionsText.fitSummary, fitMode === 'fill' ? optionsText.fillTitle : optionsText.fitTitle]].map(([label, value]) => (
                  <div key={label} className="bg-white p-4"><p className="text-[11px] text-black/45">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                <span className="border border-black/10 px-3 py-2 text-xs font-black">{printSize}</span>
                <span className="border border-black/10 px-3 py-2 text-xs font-black">{optionsText[material]}</span>
                <span className="border border-black/10 px-3 py-2 text-xs font-black">{finish === 'matte' ? text.matte : finish === 'glossy' ? text.glossy : optionsText.none}</span>
                <span className="border border-black/10 px-3 py-2 text-xs font-black">{optionsText[borderStyle]}</span>
                <span className="border border-black/10 px-3 py-2 text-xs font-black">{uploadedPhotos.length} {text.files}</span>
              </div>
              <div className="mt-7 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">{uploadedPhotos.map((photo) => <div key={photo.id} className="relative aspect-square overflow-hidden bg-[#FAF9F7]">{photo.preview && <img src={photo.preview} alt="" className={`h-full w-full ${photo.crop?.mode === 'fill' ? 'object-cover' : 'object-contain'}`} />}<span className="absolute bottom-1 end-1 bg-white px-1.5 py-0.5 text-[9px] font-black">×{photo.copies}</span></div>)}</div>
              <label className="mt-7 flex cursor-pointer items-start gap-3 border border-[#E8B4BC]/35 bg-[#E8B4BC]/10 p-4 text-sm font-bold leading-7"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} className="mt-1 h-5 w-5 accent-[#171717]" /><span>{optionsText.reviewConsent}</span></label>
              <div className="mt-5 border-s-4 border-[#C6A56B] bg-[#C6A56B]/10 p-4"><strong className="text-sm">{optionsText.recommendedProducts}</strong><p className="mt-1 text-xs leading-6 text-black/55">{optionsText.recommendedHint}</p></div>
            </div>
            <aside className="border-t-4 border-[#C6A56B] bg-[#171717] p-6 text-white sm:p-8">
              <p className="text-sm text-white/50">{text.total}</p>
              <p className="mt-2 text-4xl font-black">{formatMoney(displaySubtotal, language)}</p>
              <div className="mt-6 space-y-3 border-y border-white/10 py-5 text-sm">
                <div className="flex justify-between"><span className="text-white/50">{text.printCount}</span><strong>{draft?.total_copies || totalCopies}</strong></div>
                <div className="flex justify-between"><span className="text-white/50">{text.unitPrice}</span><strong>{formatMoney(displayUnitPrice, language)}</strong></div>
              </div>
              <button type="button" disabled={isSealing || !reviewConfirmed || photos.length !== uploadedPhotos.length} onClick={addToCart} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 bg-white px-5 py-4 font-black text-[#171717] disabled:opacity-50">
                {isSealing ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />} {text.addCart}
              </button>
              <button type="button" onClick={() => setStep(3)} className="mt-3 w-full px-5 py-3 text-sm font-bold text-white/60 hover:text-white">{text.edit}</button>
            </aside>
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[#FAF9F7]/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,.08)] backdrop-blur sm:hidden">
        {step === 1 && <button type="button" disabled={!selectedVariant?.available || (!selectedVariantId.startsWith('legacy:') && displayUnitPrice <= 0)} onClick={() => { setStep(2); fileInputRef.current?.click(); }} className="min-h-12 w-full bg-[#171717] px-5 font-black text-white disabled:opacity-40">{text.continue} · {formatMoney(displaySubtotal, language)}</button>}
        {step === 2 && <button type="button" disabled={!photos.length || activeUploads.length > 0 || failedPhotos.length > 0} onClick={goToReview} className="min-h-12 w-full bg-[#171717] px-5 font-black text-white disabled:opacity-40">{text.reviewButton} · {uploadedPhotos.length}/{photos.length}</button>}
        {step === 3 && <button type="button" disabled={pendingPhotoUpdates > 0} onClick={goToSummary} className="min-h-12 w-full bg-[#171717] px-5 font-black text-white disabled:opacity-50">{text.summary} · {totalCopies} {text.copies}</button>}
        {step === 4 && <button type="button" disabled={isSealing || !reviewConfirmed} onClick={addToCart} className="flex min-h-12 w-full items-center justify-center gap-2 bg-[#171717] px-5 font-black text-white disabled:opacity-40"><ShoppingCart size={18} /> {text.addCart} · {formatMoney(displaySubtotal, language)}</button>}
      </div>

      <input ref={fileInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />

      {cropPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && setCropPhotoId(null)}>
          <div className="w-full max-w-xl bg-[#FAF9F7] p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-center justify-between"><h3 className="text-xl font-black">{text.cropTitle}</h3><button onClick={() => setCropPhotoId(null)}><X size={22} /></button></div>
            <div className={`mx-auto overflow-hidden bg-black/5 ${borderStyle === 'white_border' ? 'p-3' : ''} ${printSize === 'A4' ? 'aspect-[210/297] max-h-[45vh]' : printSize === 'A5' ? 'aspect-[148/210] max-h-[45vh]' : 'aspect-[3/2]'}`}>
              <img src={cropPhoto.preview} alt="" className={`h-full w-full ${cropPhoto.crop?.mode === 'fill' ? 'object-cover' : 'object-contain'}`} style={{ transform: `rotate(${cropPhoto.rotation || 0}deg) scale(${cropPhoto.crop?.zoom || 1})`, objectPosition: `${cropPhoto.crop?.x || 50}% ${cropPhoto.crop?.y || 50}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[["fit", text.fit], ["fill", text.fill]].map(([mode, label]) => <button key={mode} onClick={() => updatePhoto(cropPhoto.id, { crop: { ...cropPhoto.crop, mode } })} className={`border px-3 py-3 text-xs font-black ${cropPhoto.crop?.mode === mode ? 'border-[#171717] bg-[#171717] text-white' : 'border-black/10 bg-white'}`}>{label}</button>)}
            </div>
            {[['zoom', text.zoom, 1, 3, 0.05], ['x', text.positionX, 0, 100, 1], ['y', text.positionY, 0, 100, 1]].map(([key, label, min, max, stepValue]) => (
              <label key={key} className="mt-4 block text-xs font-black">{label}<input type="range" min={min} max={max} step={stepValue} value={cropPhoto.crop?.[key] ?? (key === 'zoom' ? 1 : 50)} onChange={(event) => setPhotos((current) => current.map((photo) => photo.id === cropPhoto.id ? { ...photo, crop: { ...photo.crop, [key]: Number(event.target.value) } } : photo))} onMouseUp={() => updatePhoto(cropPhoto.id, { crop: photos.find((photo) => photo.id === cropPhoto.id)?.crop })} onTouchEnd={() => updatePhoto(cropPhoto.id, { crop: photos.find((photo) => photo.id === cropPhoto.id)?.crop })} className="mt-2 w-full accent-[#171717]" /></label>
            ))}
            <button type="button" onClick={() => setCropPhotoId(null)} className="mt-6 w-full bg-[#171717] px-5 py-3 font-black text-white">{text.close}</button>
          </div>
        </div>
      )}
    </div>
  );
}
