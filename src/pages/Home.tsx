import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { Link } from "react-router-dom";
import { useRef, useEffect } from "react";
import {
  CalendarCheck,
  MapPin,
  Clock,
  Star,
  MessageCircle,
  Zap,
  Shield,
  ChevronLeft,
} from "lucide-react";

import { ROUTES } from "@/constants/routes";
import { FIELD_PRICE_EGP } from "@/constants/fields";
import { HomeScheduleWidget } from "@/components/home/HomeScheduleWidget";

const FEATURES = [
  { icon: Zap, title: "في لمح البصر", desc: "بدون انتظار، ضغطة واحدة وتأكد حجزك" },
  { icon: Shield, title: "أمان وثقة", desc: "دفع مضمون عبر فودافون كاش" },
  { icon: Clock, title: "سهرانين للصبح", desc: "ملاعبنا مفتوحة من 2 ظهراً لـ 4 الفجر" },
  { icon: Star, title: "إضاءة نهارية", desc: "نجيلة صناعي وتغطية نور كاملة للملعب" },
];

const BRANCHES = [
  {
    id: "mubarak-al-sabeen",
    name: "ملعب السبعين",
    address: "السبعين، القاهرة",
    fields: [
      { label: "ملعب 5×5 (الأول)", price: FIELD_PRICE_EGP.A },
      { label: "ملعب 5×5 (الثاني)", price: FIELD_PRICE_EGP.B },
      { label: "ملعب 9×9", price: FIELD_PRICE_EGP.AB },
    ],
  },
  {
    id: "al-oula",
    name: "ملعب الأولي",
    address: "الأولي، القاهرة",
    fields: [
      { label: "ملعب 5×5 (الأول)", price: FIELD_PRICE_EGP.A },
      { label: "ملعب 5×5 (الثاني)", price: FIELD_PRICE_EGP.B },
      { label: "ملعب 9×9", price: FIELD_PRICE_EGP.AB },
    ],
  },
];

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export default function Home() {
  // Force dark mode on this page to match the neon theme
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  return (
    <div dir="rtl" lang="ar" className="relative min-h-screen overflow-hidden bg-background">
      
      {/* Immersive Background Effects */}
      <div className="moving-grid" />
      <div className="glow-blob primary w-[500px] h-[500px] top-[-10%] right-[-10%]" />
      <div className="glow-blob primary w-[400px] h-[400px] bottom-[20%] left-[-10%]" />
      
      {/* Huge Rolling Ball in the background */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute top-20 left-1/2 -translate-x-1/2 z-0 opacity-[0.03] pointer-events-none select-none text-[150vw] md:text-[80vw] leading-none"
      >
        ⚽
      </motion.div>

      {/* ===== HERO SECTION ===== */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[90vh] px-4 pt-20 pb-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full glass-panel px-5 py-2 text-sm font-bold text-primary neon-border"
        >
          <span className="size-2.5 rounded-full bg-primary animate-pulse" />
          الملعب جاهز والتحدي بيبدأ من هنا
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mb-6 text-6xl md:text-8xl font-black leading-tight tracking-tighter uppercase"
        >
          <span className="block text-foreground">أرض الملعب</span>
          <span className="block text-outline text-transparent" style={{ WebkitTextStroke: "2px var(--primary)" }}>مستنياك</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mb-10 max-w-lg text-lg md:text-xl text-muted-foreground"
        >
          عيش تجربة اللعب الاحترافي. ملاعب مجهزة بالكامل، حجز أونلاين في ثوانٍ، ومنافسة مفيش زيها.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col w-full sm:w-auto sm:flex-row items-center gap-4"
        >
          <Link
            to={ROUTES.booking}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-primary px-10 py-4 text-lg font-black text-primary-foreground shadow-[0_0_40px_oklch(0.72_0.22_142/40%)] transition-all hover:scale-105 active:scale-95"
          >
            <CalendarCheck className="size-6" />
            انزل العب دلوقتي
          </Link>
        </motion.div>
      </section>

      {/* ===== WIDGET OVERLAP ===== */}
      <section className="relative z-20 mx-auto max-w-5xl px-4 pb-20">
        <div className="glass-panel rounded-3xl p-1 neon-border">
          <HomeScheduleWidget />
        </div>
      </section>

      {/* ===== NON-TRADITIONAL FEATURES ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div>
            <h2 className="text-4xl md:text-6xl font-black text-foreground">ليه تختارنا؟</h2>
            <p className="text-primary font-bold mt-2 text-xl">لأن الكورة عندنا مش مجرد لعبة</p>
          </div>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="glass-panel relative overflow-hidden rounded-3xl p-8 transition-all hover:-translate-y-2 hover:shadow-[0_0_30px_oklch(0.72_0.22_142/20%)] group"
            >
              <div className="absolute -right-4 -top-4 size-24 rounded-full bg-primary/10 blur-xl group-hover:bg-primary/20 transition-colors" />
              <f.icon className="size-10 text-primary mb-6 relative z-10" />
              <h3 className="text-2xl font-black text-foreground mb-3 relative z-10">{f.title}</h3>
              <p className="text-muted-foreground relative z-10">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== CREATIVE BRANCHES DISPLAY ===== */}
      <section className="relative z-10 py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
        <div className="mx-auto max-w-6xl px-4 relative">
          
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-7xl font-black text-outline text-transparent" style={{ WebkitTextStroke: "1.5px rgba(255,255,255,0.8)" }}>
              ملاعبنا
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {BRANCHES.map((branch, i) => (
              <motion.div
                key={branch.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.2 }}
                viewport={{ once: true, margin: "-50px" }}
                className="glass-panel neon-border flex flex-col justify-between rounded-[2rem] p-8 md:p-10"
              >
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                      <MapPin className="size-7" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-foreground">{branch.name}</h3>
                      <p className="text-muted-foreground">{branch.address}</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-10">
                    {branch.fields.map((field) => (
                      <div key={field.label} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
                        <span className="text-lg font-bold text-foreground">{field.label}</span>
                        <span className="text-primary font-black text-xl">{field.price} <span className="text-sm text-muted-foreground">ج.م</span></span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  to={`${ROUTES.booking}?branch=${branch.id}`}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white/5 hover:bg-primary hover:text-primary-foreground px-6 py-5 text-lg font-black text-foreground transition-all active:scale-95 border border-white/10 hover:border-transparent"
                >
                  احجز في {branch.name}
                  <ChevronLeft className="size-5" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CALL TO ACTION ===== */}
      <section className="relative z-10 py-24 text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl glass-panel neon-border rounded-[3rem] p-10 md:p-16"
        >
          <div className="text-6xl mb-6 select-none">🔥</div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6">مستعد للماتش الجاي؟</h2>
          <p className="text-lg text-muted-foreground mb-10">
            لو عندك أي استفسار أو محتاج مساعدة في الحجز، تيم الدعم بتاعنا جاهز يرد عليك فوراً على الواتساب.
          </p>
          <a
            href="https://wa.me/201066328651"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 w-full md:w-auto rounded-full bg-[#25D366] px-10 py-5 text-lg font-black text-white shadow-[0_0_30px_rgba(37,211,102,0.4)] transition-transform hover:scale-105 active:scale-95"
          >
            <MessageCircle className="size-6" />
            تواصل معانا واتساب
          </a>
        </motion.div>
      </section>

    </div>
  );
}
