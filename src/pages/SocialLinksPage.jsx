import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, House, Share2, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

import logo from '../assets/logo-art-moment.svg';
import instagramIcon from '../assets/instagram icon.svg';
import snapchatIcon from '../assets/SnapChat icon.svg';
import tiktokIcon from '../assets/tiktok icon.svg';
import whatsappIcon from '../assets/whatsapp icon.svg';
import telegramIcon from '../assets/telegram icon.svg';
import gmailIcon from '../assets/gmail icon.svg';

const SOCIAL_LINKS = [
  {
    id: 'whatsapp',
    name: 'واتساب',
    account: '0560301744',
    description: 'للطلبات والاستفسارات وخدمة العملاء',
    icon: whatsappIcon,
    url: 'https://wa.me/966560301744',
    color: '#25D366',
  },
  {
    id: 'instagram',
    name: 'إنستغرام',
    account: '@art.moment26',
    description: 'أحدث المنتجات والأفكار والصور',
    icon: instagramIcon,
    url: 'https://www.instagram.com/art.moment26/',
    color: '#D9468D',
  },
  {
    id: 'snapchat',
    name: 'سناب شات',
    account: 'omsayedkamal',
    description: 'كواليس العمل والطلبات اليومية',
    icon: snapchatIcon,
    url: 'https://www.snapchat.com/add/omsayedkamal',
    color: '#D4AD24',
  },
  {
    id: 'tiktok',
    name: 'تيك توك',
    account: '@art.moment26',
    description: 'مقاطع الطباعة والتغليف والمنتجات',
    icon: tiktokIcon,
    url: 'https://www.tiktok.com/@art.moment26',
    color: '#252525',
  },
  {
    id: 'telegram',
    name: 'تيليجرام',
    account: '@artmoment26',
    description: 'تحديثات لحظة فن والتواصل المباشر',
    icon: telegramIcon,
    url: 'https://t.me/artmoment26',
    color: '#229ED9',
  },
  {
    id: 'gmail',
    name: 'البريد الإلكتروني',
    account: 'art.moment26@gmail.com',
    description: 'للمراسلات وخدمة ما بعد البيع',
    icon: gmailIcon,
    url: 'mailto:art.moment26@gmail.com',
    color: '#C84A3F',
  },
];

export default function SocialLinksPage() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'حسابات لحظة فن | Art Moment';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const sharePage = async () => {
    const shareData = {
      title: 'لحظة فن | Art Moment',
      text: 'جميع حسابات لحظة فن الرسمية في مكان واحد',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setCopied(false);
      }
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8F5F2] text-[#393737] font-['Tajawal']">
      <header className="h-20 border-b border-[#D9A3AA]/20 bg-white/90">
        <div className="h-full w-full px-4 sm:px-7 lg:px-10 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#D9A3AA]/25 bg-white text-[#4A4A4A] transition-colors hover:border-[#C5A059] hover:text-[#C5A059]"
            aria-label="العودة إلى الصفحة الرئيسية"
          >
            <House size={19} />
          </Link>

          <Link to="/" className="flex items-center gap-3" aria-label="لحظة فن">
            <div className="text-left leading-tight">
              <p className="text-lg font-black">لحظة فن</p>
              <p dir="ltr" className="text-[10px] font-bold tracking-[0.16em] text-[#C5A059]">
                ART MOMENT
              </p>
            </div>
            <img src={logo} alt="" className="h-11 w-11 object-contain" />
          </Link>

          <button
            type="button"
            onClick={sharePage}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#D9A3AA]/25 bg-white text-[#4A4A4A] transition-colors hover:border-[#D9A3AA] hover:text-[#D9A3AA]"
            aria-label={copied ? 'تم نسخ رابط الصفحة' : 'مشاركة الصفحة'}
          >
            {copied ? <Check size={19} /> : <Share2 size={19} />}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-9 sm:px-7 sm:pt-12">
        <section className="text-center">
          <img
            src={logo}
            alt="شعار لحظة فن"
            className="mx-auto h-24 w-24 object-contain sm:h-28 sm:w-28"
          />
          <p className="mt-4 text-xs font-black text-[#C5A059]">الحسابات الرسمية</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">لحظة فن في مكان واحد</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#4A4A4A]/65 sm:text-base">
            تابعي جديد الطباعة والمنتجات، وتواصلي معنا مباشرة عبر حساباتنا الرسمية.
          </p>
        </section>

        <section
          aria-label="حسابات التواصل الاجتماعي"
          className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {SOCIAL_LINKS.map((social) => (
            <a
              key={social.id}
              href={social.url}
              target={social.url.startsWith('mailto:') ? '_self' : '_blank'}
              rel="noopener noreferrer"
              className="group flex min-h-24 items-center gap-4 rounded-lg border border-[#D9A3AA]/20 bg-white p-4 shadow-[0_8px_26px_rgba(57,55,55,0.06)] transition-all hover:-translate-y-0.5 hover:border-[#C5A059]/55 hover:shadow-[0_14px_34px_rgba(57,55,55,0.10)] focus:outline-none focus:ring-4 focus:ring-[#D9A3AA]/20"
            >
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${social.color}12` }}
              >
                <img src={social.icon} alt="" className="h-9 w-9 object-contain" />
              </span>

              <span className="min-w-0 flex-1 text-right">
                <span className="flex items-center gap-2">
                  <strong className="text-base font-black">{social.name}</strong>
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: social.color }}
                  />
                </span>
                <span dir="ltr" className="mt-1 block truncate text-left text-xs font-bold text-[#4A4A4A]/75">
                  {social.account}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#4A4A4A]/55">
                  {social.description}
                </span>
              </span>

              <ExternalLink
                size={18}
                className="shrink-0 text-[#4A4A4A]/30 transition-colors group-hover:text-[#C5A059]"
              />
            </a>
          ))}
        </section>

        <section className="mt-7 grid grid-cols-2 gap-3">
          <Link
            to="/store"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#4A4A4A] px-4 text-sm font-black text-white transition-colors hover:bg-[#393737]"
          >
            <ShoppingBag size={18} />
            المتجر
          </Link>
          <Link
            to="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#D9A3AA]/30 bg-white px-4 text-sm font-black text-[#4A4A4A] transition-colors hover:border-[#C5A059]"
          >
            الصفحة الرئيسية
            <ArrowLeft size={18} />
          </Link>
        </section>

        <button
          type="button"
          onClick={sharePage}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold text-[#A8893C] transition-colors hover:bg-white"
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}
          {copied ? 'تم نسخ رابط الصفحة' : 'مشاركة أو نسخ رابط الحسابات'}
        </button>
      </main>

      <footer className="border-t border-[#D9A3AA]/15 px-4 py-6 text-center text-xs font-bold text-[#4A4A4A]/45">
        جميع الحقوق محفوظة للحظة فن © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
