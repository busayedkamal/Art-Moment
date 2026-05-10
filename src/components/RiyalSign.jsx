// src/components/RiyalSign.jsx
// رمز الريال السعودي الرسمي — الصادر عن البنك المركزي السعودي (SAMA)
export default function RiyalSign({ light = false, size = '0.88em' }) {
  return (
    <img
      src="/Saudi_Riyal_Symbol.png"
      alt="ريال"
      style={{
        height: size,
        width: 'auto',
        display: 'inline-block',
        verticalAlign: '-0.1em',
        // brightness(0) → يجعل الصورة سوداء تماماً بغض النظر عن لونها الأصلي
        // invert(1)     → يقلبها لأبيض عند استخدامها على خلفية داكنة
        filter: light ? 'brightness(0) invert(1)' : 'brightness(0)',
      }}
    />
  );
}
