import QRCode from 'qrcode';
import logoDataUrl from '../assets/logo-art-moment-receipt.png?inline';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function getReceiptVerificationUrl(receipt) {
  return `${window.location.origin}/receipt/${encodeURIComponent(receipt.receipt_number)}/${encodeURIComponent(receipt.verification_token)}`;
}

function paymentMethodLabel(method) {
  return method === 'bank_transfer' ? 'تحويل مصرفي' : 'نقدًا';
}

function verificationCode(receipt) {
  if (receipt.verification_code) return String(receipt.verification_code).toUpperCase();
  const compact = String(receipt.verification_token || '').replaceAll('-', '').slice(0, 8).toUpperCase();
  return compact ? `${compact.slice(0, 4)}-${compact.slice(4, 8)}` : '—';
}

function orderLabelMarkup(orderLabel) {
  const label = String(orderLabel || '').trim();
  if (!label || label === 'لا' || label === 'غير مرتبط بطلب') return escapeHtml(label || 'لا');
  const match = label.match(/^(.*?)(#[^\s]+)$/u);
  if (!match) return escapeHtml(label);
  return `<span class="rtl">${escapeHtml(match[1].trim())}</span> <span class="ltr">${escapeHtml(match[2])}</span>`;
}

function mixedTextMarkup(value) {
  return String(value ?? '').split(/(#[A-Za-z0-9-]+)/g).map((part) => (
    /^#[A-Za-z0-9-]+$/.test(part) ? `<span class="ltr">${escapeHtml(part)}</span>` : escapeHtml(part)
  )).join('');
}
function amountMarkup(amount) {
  return `<span class="ltr">${Number(amount).toFixed(2)}</span><span class="rtl" style="font-size:22px;">ر.س</span>`;
}

export async function createReceiptPdfBase64(receipt, customer, orderLabel = '') {
  const verificationUrl = getReceiptVerificationUrl(receipt);
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 320,
    margin: 1,
    color: { dark: '#171717', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });
  const issuedAt = receipt.issued_at ? new Date(receipt.issued_at) : new Date();
  const issuedDate = issuedAt.toLocaleDateString('en-GB');
  const issuedTime = issuedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const paymentDate = new Date(`${receipt.payment_date}T12:00:00`).toLocaleDateString('en-GB');
  const root = document.createElement('div');
  root.setAttribute('dir', 'rtl');
  root.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;height:1123px;background:#FAF9F7;color:#171717;font-family:Tahoma,Arial,sans-serif;padding:64px;box-sizing:border-box;z-index:-1;letter-spacing:0;font-stretch:normal;';
  root.innerHTML = `
    <style>
      .receipt-pdf, .receipt-pdf * { box-sizing:border-box; letter-spacing:0 !important; font-stretch:normal !important; }
      .receipt-pdf .rtl { direction:rtl; unicode-bidi:isolate; }
      .receipt-pdf .ltr { direction:ltr; unicode-bidi:isolate; display:inline-block; }
    </style>
    <div class="receipt-pdf" style="position:relative;width:666px;height:995px;border:1px solid #eadfe0;background:#fff;padding:44px;overflow:hidden;">
      <img src="${logoDataUrl}" alt="" style="position:absolute;width:380px;height:auto;aspect-ratio:1/1;object-fit:contain;opacity:.032;left:50%;top:49%;transform:translate(-50%,-50%);" />
      <div style="position:relative;z-index:1;">
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #171717;padding-bottom:24px;">
          <div class="rtl" style="text-align:right;">
            <div style="font-size:30px;font-weight:900;">إيصال قبض</div>
            <div class="ltr" style="font-size:14px;color:#6B6561;margin-top:5px;">PAYMENT RECEIPT</div>
          </div>
          <img src="${logoDataUrl}" alt="Art Moment" style="display:block;width:88px;height:auto;aspect-ratio:1/1;object-fit:contain;" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:28px;font-size:15px;">
          <div class="rtl" style="border:1px solid #eee4e5;padding:14px;text-align:right;"><span style="color:#6B6561;">رقم الإيصال</span><strong class="ltr" style="display:block;margin-top:7px;text-align:right;">${escapeHtml(receipt.receipt_number)}</strong></div>
          <div class="rtl" style="border:1px solid #eee4e5;padding:14px;text-align:right;"><span style="color:#6B6561;">تاريخ الإصدار</span><strong class="ltr" style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:7px;"><span>${escapeHtml(issuedDate)}</span><span aria-hidden="true">·</span><span>${escapeHtml(issuedTime)}</span></strong></div>
        </div>
        <div class="rtl" style="margin-top:22px;border-top:1px solid #eee4e5;border-bottom:1px solid #eee4e5;padding:22px 0;text-align:right;">
          <div style="font-size:13px;color:#6B6561;">استلمنا من</div>
          <div style="font-size:23px;font-weight:900;margin-top:7px;">${escapeHtml(customer.name)}</div>
        </div>
        <div class="rtl" style="margin-top:25px;text-align:center;background:#171717;color:#fff;padding:28px;">
          <div style="font-size:13px;color:#fff9;">إجمالي المبلغ المستلم</div>
          <div style="display:flex;direction:ltr;align-items:baseline;justify-content:center;gap:8px;font-size:38px;font-weight:900;margin-top:8px;">${amountMarkup(receipt.amount)}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px;font-size:14px;">
          <div class="rtl" style="background:#FAF9F7;padding:14px;text-align:right;"><span style="color:#6B6561;">طريقة الاستلام</span><strong style="display:block;margin-top:6px;">${paymentMethodLabel(receipt.payment_method)}</strong></div>
          <div class="rtl" style="background:#FAF9F7;padding:14px;text-align:right;"><span style="color:#6B6561;">تاريخ الاستلام</span><strong class="ltr" style="display:block;margin-top:6px;text-align:right;">${escapeHtml(paymentDate)}</strong></div>
          ${receipt.payment_method === 'bank_transfer' ? `<div class="rtl" style="background:#FAF9F7;padding:14px;text-align:right;"><span style="color:#6B6561;">البنك</span><strong style="display:block;margin-top:6px;">${escapeHtml(receipt.bank_name || '—')}</strong></div><div class="rtl" style="background:#FAF9F7;padding:14px;text-align:right;"><span style="color:#6B6561;">مرجع التحويل</span><strong class="ltr" style="display:block;margin-top:6px;text-align:right;">${escapeHtml(receipt.transfer_reference || '—')}</strong></div>` : ''}
          <div class="rtl" style="background:#FAF9F7;padding:14px;grid-column:1/-1;text-align:right;"><span style="color:#6B6561;">مرتبط بالطلب</span><strong style="display:flex;align-items:center;justify-content:flex-start;gap:5px;margin-top:6px;">${orderLabelMarkup(orderLabel)}</strong></div>
        </div>
        <div class="rtl" style="margin-top:20px;border-right:4px solid #C6A56B;background:#fffaf2;padding:16px;text-align:right;">
          <div style="font-size:13px;color:#6B6561;">البيان</div>
          <div style="font-size:16px;font-weight:700;line-height:1.8;margin-top:5px;">${mixedTextMarkup(receipt.description)}</div>
        </div>
        <div class="rtl" style="display:flex;align-items:center;justify-content:center;gap:22px;margin-top:30px;border-top:1px solid #eee4e5;padding-top:24px;">
          <img src="${qrDataUrl}" alt="QR" style="display:block;width:128px;height:128px;min-width:128px;max-width:128px;aspect-ratio:1/1;object-fit:contain;flex:0 0 128px;" />
          <div style="max-width:300px;text-align:right;">
            <strong style="font-size:15px;">تحقق من صحة الإيصال</strong>
            <p style="font-size:12px;color:#6B6561;line-height:1.8;margin:7px 0 0;">امسح الرمز لعرض السجل الأصلي من موقع Art Moment. لا يعرض الرابط رقم الجوال أو بيانات التحويل الحساسة.</p>
            <div style="display:flex;align-items:center;justify-content:flex-start;gap:6px;font-size:12px;font-weight:800;margin-top:8px;"><span>رمز التحقق:</span><strong class="ltr">${escapeHtml(verificationCode(receipt))}</strong></div>
          </div>
        </div>
        <div class="ltr" style="display:block;text-align:center;color:#6B6561;font-size:12px;margin-top:24px;">Art Moment · Printing & Painting · www.art-moment.com</div>
      </div>
    </div>`;
  document.body.appendChild(root);
  try {
    await document.fonts?.ready;
    await Promise.all([...root.querySelectorAll('img')].map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; })));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const canvas = await html2canvas(root, { scale: 2, backgroundColor: '#FAF9F7', useCORS: true, logging: false });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const canvasRatio = canvas.width / canvas.height;
    const pageRatio = pageWidth / pageHeight;
    let renderWidth;
    let renderHeight;
    if (canvasRatio > pageRatio) {
      renderWidth = pageWidth;
      renderHeight = renderWidth / canvasRatio;
    } else {
      renderHeight = pageHeight;
      renderWidth = renderHeight * canvasRatio;
    }
    const offsetX = (pageWidth - renderWidth) / 2;
    const offsetY = (pageHeight - renderHeight) / 2;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');
    return pdf.output('datauristring').split(',')[1];
  } finally {
    root.remove();
  }
}