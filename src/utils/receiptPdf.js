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

export async function createReceiptPdfBase64(receipt, customer, orderLabel = '') {
  const verificationUrl = getReceiptVerificationUrl(receipt);
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 320,
    margin: 1,
    color: { dark: '#171717', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });
  const issuedAt = receipt.issued_at ? new Date(receipt.issued_at) : new Date();
  const root = document.createElement('div');
  root.setAttribute('dir', 'rtl');
  root.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;min-height:1123px;background:#FAF9F7;color:#171717;font-family:Arial,Tahoma,sans-serif;padding:64px;box-sizing:border-box;z-index:-1;';
  root.innerHTML = `
    <div style="position:relative;min-height:995px;border:1px solid #eadfe0;background:#fff;padding:44px;box-sizing:border-box;overflow:hidden;">
      <img src="${logoDataUrl}" alt="" style="position:absolute;width:470px;height:470px;object-fit:contain;opacity:.045;left:50%;top:49%;transform:translate(-50%,-50%);" />
      <div style="position:relative;z-index:1;">
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #171717;padding-bottom:24px;">
          <div>
            <div style="font-size:30px;font-weight:900;">إيصال قبض</div>
            <div style="font-size:14px;color:#6B6561;margin-top:5px;letter-spacing:0;">PAYMENT RECEIPT</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;"><img src="${logoDataUrl}" alt="Art Moment" style="width:78px;height:64px;object-fit:contain;" /><div style="text-align:right;"><strong style="display:block;font-size:18px;">لحظة فن</strong><span style="display:block;font-size:10px;color:#6B6561;margin-top:3px;">ART MOMENT</span></div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:28px;font-size:15px;">
          <div style="border:1px solid #eee4e5;padding:14px;"><span style="color:#6B6561;">رقم الإيصال</span><strong style="display:block;margin-top:7px;direction:ltr;text-align:right;">${escapeHtml(receipt.receipt_number)}</strong></div>
          <div style="border:1px solid #eee4e5;padding:14px;"><span style="color:#6B6561;">تاريخ الإصدار</span><strong style="display:block;margin-top:7px;">${escapeHtml(issuedAt.toLocaleDateString('en-GB'))} · ${escapeHtml(issuedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }))}</strong></div>
        </div>
        <div style="margin-top:22px;border-top:1px solid #eee4e5;border-bottom:1px solid #eee4e5;padding:22px 0;">
          <div style="font-size:13px;color:#6B6561;">استلمنا من</div>
          <div style="font-size:23px;font-weight:900;margin-top:7px;">${escapeHtml(customer.name)}</div>
        </div>
        <div style="margin-top:25px;text-align:center;background:#171717;color:#fff;padding:28px;">
          <div style="font-size:13px;color:#fff9;">إجمالي المبلغ المستلم</div>
          <div style="font-size:38px;font-weight:900;margin-top:8px;direction:ltr;">${Number(receipt.amount).toFixed(2)} ر.س</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px;font-size:14px;">
          <div style="background:#FAF9F7;padding:14px;"><span style="color:#6B6561;">طريقة الاستلام</span><strong style="display:block;margin-top:6px;">${paymentMethodLabel(receipt.payment_method)}</strong></div>
          <div style="background:#FAF9F7;padding:14px;"><span style="color:#6B6561;">تاريخ الاستلام</span><strong style="display:block;margin-top:6px;direction:ltr;text-align:right;">${escapeHtml(new Date(`${receipt.payment_date}T12:00:00`).toLocaleDateString('en-GB'))}</strong></div>
          ${receipt.payment_method === 'bank_transfer' ? `<div style="background:#FAF9F7;padding:14px;"><span style="color:#6B6561;">البنك</span><strong style="display:block;margin-top:6px;">${escapeHtml(receipt.bank_name || '—')}</strong></div><div style="background:#FAF9F7;padding:14px;"><span style="color:#6B6561;">مرجع التحويل</span><strong style="display:block;margin-top:6px;direction:ltr;text-align:right;">${escapeHtml(receipt.transfer_reference || '—')}</strong></div>` : ''}
          <div style="background:#FAF9F7;padding:14px;grid-column:1/-1;"><span style="color:#6B6561;">مرتبط بالطلب</span><strong style="display:block;margin-top:6px;">${escapeHtml(orderLabel || 'لا')}</strong></div>
        </div>
        <div style="margin-top:20px;border-right:4px solid #C6A56B;background:#fffaf2;padding:16px;">
          <div style="font-size:13px;color:#6B6561;">البيان</div>
          <div style="font-size:16px;font-weight:700;line-height:1.8;margin-top:5px;">${escapeHtml(receipt.description)}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:22px;margin-top:30px;border-top:1px solid #eee4e5;padding-top:24px;">
          <img src="${qrDataUrl}" alt="QR" style="width:120px;height:120px;" />
          <div style="max-width:300px;">
            <strong style="font-size:15px;">تحقق من صحة الإيصال</strong>
            <p style="font-size:12px;color:#6B6561;line-height:1.8;margin:7px 0 0;">امسح الرمز لعرض السجل الأصلي من موقع Art Moment. لا يعرض الرابط رقم الجوال أو بيانات التحويل الحساسة.</p><div style="display:flex;align-items:center;justify-content:flex-start;gap:6px;font-size:12px;font-weight:800;margin-top:8px;"><span>رمز التحقق:</span><strong dir="ltr">${escapeHtml(verificationCode(receipt))}</strong></div>
          </div>
        </div>
        <div style="text-align:center;color:#6B6561;font-size:12px;margin-top:24px;">Art Moment · Printing & Painting · www.art-moment.com</div>
      </div>
    </div>`;
  document.body.appendChild(root);
  try {
    await document.fonts?.ready;
    await Promise.all([...root.querySelectorAll('img')].map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; })));
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const canvas = await html2canvas(root, { scale: 2, backgroundColor: '#FAF9F7', useCORS: true, logging: false });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    return pdf.output('datauristring').split(',')[1];
  } finally {
    root.remove();
  }
}