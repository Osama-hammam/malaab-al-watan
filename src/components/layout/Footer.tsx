import { Link } from "react-router-dom";
import { Phone, MapPin, MessageCircle } from "lucide-react";

import { env } from "@/config/env";
import { ROUTES } from "@/constants/routes";

export function Footer() {
  return (
    <footer dir="rtl" lang="ar" className="border-t bg-muted/30 mt-16">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-black">
                ⚽
              </div>
              <span className="font-bold text-foreground">{env.appName}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              احجز ملعبك المفضل بسهولة وسرعة — ملاعب عشب صناعي مضاءة بالكامل.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="mb-3 font-bold text-sm text-foreground">روابط سريعة</h3>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li><Link to={ROUTES.home} className="hover:text-primary transition-colors">الرئيسية</Link></li>
              <li><Link to={ROUTES.booking} className="hover:text-primary transition-colors">احجز الآن</Link></li>
              <li><Link to={ROUTES.dashboardLogin} className="hover:text-primary transition-colors">لوحة التحكم</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-3 font-bold text-sm text-foreground">تواصل معنا</h3>
            <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              <li>
                <a href="tel:+201066328651" className="flex items-center gap-2 hover:text-primary transition-colors">
                  <Phone className="size-4 shrink-0 text-primary" />
                  <span dir="ltr">01066328651</span>
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-primary" />
                <span>السبعين والأولي — القاهرة</span>
              </li>
              <li>
                <a
                  href="https://wa.me/201066328651"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-green-600 font-medium hover:text-green-700 transition-colors"
                >
                  <MessageCircle className="size-4" />
                  تواصل عبر واتساب
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {env.appName} — جميع الحقوق محفوظة
        </div>
      </div>
    </footer>
  );
}
