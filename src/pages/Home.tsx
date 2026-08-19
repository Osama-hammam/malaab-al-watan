import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { Link } from "react-router-dom";
import { useRef } from "react";
import {
  CalendarCheck,
  MapPin,
  Clock,
  Star,
  CheckCircle2,
  MessageCircle,
  Zap,
  Shield,
  Users,
  ChevronLeft,
  Trophy,
  Flame,
} from "lucide-react";

import { ROUTES } from "@/constants/routes";
import { FIELD_PRICE_EGP } from "@/constants/fields";
import { HomeScheduleWidget } from "@/components/home/HomeScheduleWidget";

const FEATURES = [
  { icon: Zap, title: "حجز فوري", desc: "احجز ملعبك في ثوانٍ بدون انتظار", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  { icon: Shield, title: "دفع آمن", desc: "دفع عبر فودافون كاش مع إثبات التحويل", color: "text-blue-400", bg: "bg-blue-400/10" },
  { icon: Clock, title: "مفتوح طوال الليل", desc: "من الساعة 2 ظهراً حتى 4 صباحاً", color: "text-primary", bg: "bg-primary/10" },
  { icon: Star, title: "ملاعب مضاءة", desc: "عشب صناعي عالي الجودة بإضاءة كاملة", color: "text-orange-400", bg: "bg-orange-400/10" },
];

const HOW_STEPS = [
  { num: "١", title: "اختر الموقع", desc: "السبعين أو الأولي", icon: MapPin },
  { num: "٢", title: "اختر الملعب", desc: "5×5 أو 9×9", icon: Trophy },
  { num: "٣", title: "اختر الموعد", desc: "اليوم والساعة المناسبة", icon: Clock },
  { num: "٤", title: "أدخل بياناتك", desc: "الاسم ورقم الهاتف", icon: Users },
  { num: "٥", title: "ادفع وأرسل", desc: "فودافون كاش وارفع إثبات الدفع", icon: CheckCircle2 },
];

const BRANCHES = [
  {
    id: "mubarak-al-sabeen",
    name: "ملعب الوطن — السبعين",
    shortName: "السبعين",
    address: "السبعين، القاهرة",
    emoji: "🏟️",
    fields: [
      { label: "ملعب 5×5 — الأول", price: FIELD_PRICE_EGP.A },
      { label: "ملعب 5×5 — الثاني", price: FIELD_PRICE_EGP.B },
      { label: "ملعب 9×9", price: FIELD_PRICE_EGP.AB, note: "= الأول + الثاني" },
    ],
  },
  {
    id: "al-oula",
    name: "ملعب الوطن — الأولي",
    shortName: "الأولي",
    address: "الأولي، القاهرة",
    emoji: "⚽",
    fields: [
      { label: "ملعب 5×5 — الأول", price: FIELD_PRICE_EGP.A },
      { label: "ملعب 5×5 — الثاني", price: FIELD_PRICE_EGP.B },
      { label: "ملعب 9×9", price: FIELD_PRICE_EGP.AB, note: "= الأول + الثاني" },
    ],
  },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};


const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.75 },
  show: { opacity: 1, scale: 1 },
};

export default function Home() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const ballY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const ballRotate = useTransform(scrollYProgress, [0, 1], [0, 180]);

  return (
    <div dir="rtl" lang="ar">

      {/* ===== HERO ===== */}
      <section ref={heroRef} className="hero-bg pitch-pattern relative overflow-hidden py-24 sm:py-32">
        {/* Decorative floating balls */}
        <motion.div
          style={{ y: ballY, rotate: ballRotate }}
          className="absolute -left-10 top-10 text-7xl opacity-20 select-none pointer-events-none"
        >⚽</motion.div>
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [0, 15, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-8 top-24 text-5xl opacity-10 select-none pointer-events-none"
        >⚽</motion.div>
        <motion.div
          animate={{ y: [0, 16, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute left-1/3 bottom-8 text-4xl opacity-10 select-none pointer-events-none"
        >⚽</motion.div>

        {/* Ripple rings */}
        <div className="absolute right-16 top-16 size-48 opacity-10 pointer-events-none">
          <div className="ripple-ring absolute inset-0" />
          <div className="ripple-ring absolute inset-0" />
          <div className="ripple-ring absolute inset-0" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center text-white">
          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            className="sport-badge mx-auto mb-6 w-fit"
          >
            <span className="size-2 rounded-full bg-green-400 animate-pulse" />
            متاح الحجز الآن
            <Flame className="size-3.5 text-yellow-400" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 text-5xl font-black leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl"
          >
            احجز ملعبك
            <br />
            <span className="text-shimmer">في ثوانٍ ⚽</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22 }}
            className="mx-auto mb-10 max-w-xl text-base text-white/75 sm:text-lg leading-relaxed"
          >
            ملاعب عشب صناعي مضاءة بالكامل في موقعين — السبعين والأولي.
            <br />
            حجز فوري، دفع بفودافون كاش، وتأكيد سريع.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.34 }}
            className="flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              to={ROUTES.booking}
              className="btn-glow relative flex items-center gap-2.5 rounded-full bg-primary px-9 py-4 text-base font-black text-white shadow-2xl shadow-primary/40 transition-all hover:scale-105 hover:shadow-primary/50 active:scale-95"
            >
              <CalendarCheck className="size-5" />
              احجز الآن
            </Link>
            <a
              href="https://wa.me/201066328651"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-full border-2 border-white/25 bg-white/10 px-7 py-4 text-base font-bold text-white backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/20"
            >
              <MessageCircle className="size-5" />
              تواصل عبر واتساب
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.6 }}
            className="mt-14 flex flex-wrap items-center justify-center gap-10"
          >
            {[
              { value: "٢", label: "موقع" },
              { value: "٦", label: "ملاعب" },
              { value: "١٤", label: "ساعة يومياً" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.1, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
                className="text-center"
              >
                <div className="text-4xl font-black text-gradient">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-white/60">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== SCHEDULE WIDGET ===== */}
      <section className="mx-auto max-w-5xl px-4 py-8 relative z-20 -mt-14">
        <HomeScheduleWidget />
      </section>

      {/* ===== FEATURES ===== */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <h2 className="mb-2 text-3xl font-black text-foreground">لماذا ملعب الوطن؟</h2>
          <p className="text-muted-foreground">كل اللي محتاجه في مكان واحد</p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="card-hover group flex flex-col gap-4 rounded-3xl border-2 bg-card p-6 shadow-sm"
            >
              <div className={`flex size-12 items-center justify-center rounded-2xl ${f.bg} transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                <f.icon className={`size-6 ${f.color}`} />
              </div>
              <div>
                <h3 className="font-black text-foreground">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== BRANCHES ===== */}
      <section className="relative overflow-hidden py-20">
        {/* Subtle green wavy bg */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/3 to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary">
              <MapPin className="size-3.5" />
              موقعانا
            </span>
            <h2 className="mt-2 text-3xl font-black text-foreground">ملاعبنا</h2>
            <p className="mt-1 text-muted-foreground">اختر من موقعين متاحين في القاهرة</p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-6 sm:grid-cols-2"
          >
            {BRANCHES.map((branch) => (
              <motion.div
                key={branch.id}
                variants={fadeUp}
                className="card-hover group relative overflow-hidden rounded-3xl border-2 bg-card p-7 shadow-md"
              >
                {/* BG blob */}
                <div className="absolute -left-8 -top-8 size-32 rounded-full bg-primary/5 blur-2xl transition-all group-hover:scale-150 group-hover:bg-primary/10" />

                <div className="relative">
                  <div className="mb-5 flex items-start justify-between">
                    <div>
                      <div className="mb-2 text-4xl">{branch.emoji}</div>
                      <h3 className="text-xl font-black text-foreground">{branch.name}</h3>
                      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="size-3.5 text-primary" />
                        {branch.address}
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 flex flex-col gap-2.5">
                    {branch.fields.map((field) => (
                      <div
                        key={field.label}
                        className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3 transition-colors group-hover:bg-muted/70"
                      >
                        <div>
                          <span className="text-sm font-bold text-foreground">{field.label}</span>
                          {"note" in field && field.note && (
                            <span className="mr-1.5 text-xs text-muted-foreground">({field.note})</span>
                          )}
                        </div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-black text-primary">
                          {field.price} ج.م
                        </span>
                      </div>
                    ))}
                  </div>

                  <Link
                    to={`${ROUTES.booking}?branch=${branch.id}`}
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] hover:shadow-primary/40 active:scale-95"
                  >
                    احجز في {branch.shortName}
                    <ChevronLeft className="size-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="hero-bg pitch-pattern relative overflow-hidden py-20">
        <div className="relative z-10 mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-14 text-center text-white"
          >
            <h2 className="mb-2 text-3xl font-black">كيف يعمل الحجز؟</h2>
            <p className="text-white/65">خطوات بسيطة في دقيقتين</p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-5 sm:grid-cols-5"
          >
            {HOW_STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                variants={scaleIn}
                className="group flex flex-col items-center gap-3 text-center"
              >
                <div className="relative">
                  <div className="flex size-16 items-center justify-center rounded-full bg-white/10 text-2xl font-black text-white border-2 border-white/20 backdrop-blur-sm shadow-xl transition-transform group-hover:scale-110 group-hover:-rotate-3">
                    {step.num}
                  </div>
                  {i < HOW_STEPS.length - 1 && (
                    <div className="absolute top-1/2 -left-4 hidden h-0.5 w-8 -translate-y-1/2 bg-white/20 sm:block" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">{step.title}</h3>
                  <p className="mt-0.5 text-xs text-white/60">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-14 flex justify-center"
          >
            <Link
              to={ROUTES.booking}
              className="btn-glow flex items-center gap-2.5 rounded-full bg-white px-10 py-4 text-base font-black text-primary shadow-2xl shadow-black/30 transition-all hover:scale-105 active:scale-95"
            >
              <CalendarCheck className="size-5" />
              ابدأ الحجز الآن
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== CONTACT CTA ===== */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: [0.34, 1.16, 0.64, 1] }}
          className="card-hover rounded-3xl border-2 bg-card p-10 shadow-xl"
        >
          <div className="mb-4 text-5xl animate-float inline-block">💬</div>
          <h2 className="mb-3 text-2xl font-black text-foreground">هل لديك استفسار؟</h2>
          <p className="mb-7 text-muted-foreground leading-relaxed">
            تواصل معنا مباشرة عبر واتساب وسنرد عليك في أقرب وقت.
          </p>
          <a
            href="https://wa.me/201066328651"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 rounded-full bg-green-500 px-9 py-4 font-black text-white shadow-xl shadow-green-500/30 transition-all hover:scale-105 hover:bg-green-600 active:scale-95"
          >
            <MessageCircle className="size-5" />
            تحدث معنا على واتساب
          </a>
        </motion.div>
      </section>

      {/* ===== WhatsApp Floating Button ===== */}
      <a
        href="https://wa.me/201066328651"
        target="_blank"
        rel="noopener noreferrer"
        title="تواصل معنا عبر واتساب"
        className="whatsapp-float animate-float flex size-14 items-center justify-center rounded-full bg-green-500 text-white shadow-xl shadow-green-500/40 transition-transform hover:scale-110"
      >
        <MessageCircle className="size-7" />
      </a>
    </div>
  );
}
