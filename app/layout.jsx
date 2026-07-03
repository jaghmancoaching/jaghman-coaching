import "./globals.css";

export const metadata = {
  title: "Jaghman Coaching — تدريب مخصص ومتابعة حقيقية",
  description:
    "منصة Jaghman Coaching: برامج تدريب مجانية مثبتة علمياً (Push/Pull/Legs, Upper/Lower, Full Body)، وبرنامج مخصص لجسمك وهدفك مع حساب السعرات (TDEE) وخطة غذائية ومتابعة شخصية من مدرب معتمد.",
  keywords: [
    "برنامج تدريب", "Push Pull Legs", "جدول تمارين", "خطة غذائية",
    "حساب السعرات", "مدرب شخصي", "Jaghman Coaching", "تضخيم", "تنشيف",
  ],
  icons: { icon: "/icon.png" },
  openGraph: {
    title: "Jaghman Coaching — تدريب مخصص ومتابعة حقيقية",
    description: "برامج مجانية مثبتة علمياً + تخصيص كامل لجسمك وهدفك بإشراف مدرب معتمد.",
    images: ["/logo.png"],
    locale: "ar",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
