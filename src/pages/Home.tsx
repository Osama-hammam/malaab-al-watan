import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, MapPin } from "lucide-react";

import { PageContainer } from "@/components/common/PageContainer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LOCATIONS, FIELD_PRICE_EGP, WORKING_HOURS } from "@/constants/fields";
import { ROUTES } from "@/constants/routes";

export default function Home() {
  return (
    <PageContainer>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-start gap-4"
      >
        <Badge variant="secondary" className="gap-1.5">
          <Clock className="size-3.5" />
          Open daily {WORKING_HOURS.openHour % 12 || 12}:00 PM –{" "}
          {WORKING_HOURS.closeHour}:00 AM
        </Badge>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Book your football field in seconds
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Reserve a half field (5v5) or a full field (7v7) at{" "}
          {LOCATIONS.map((location, index) => (
            <span key={location.id}>
              {index > 0 && (index === LOCATIONS.length - 1 ? " or " : ", ")}
              <span dir="rtl" lang="ar" className="font-medium text-foreground">
                {location.branchName}
              </span>
            </span>
          ))}
          . Pick a slot, upload your payment, and you're on the pitch.
        </p>

        <Button asChild size="lg" className="mt-2">
          <Link to={ROUTES.booking}>
            Book a field
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </motion.section>

      <section className="mt-12 grid gap-6 sm:grid-cols-2">
        {LOCATIONS.map((location, index) => (
          <motion.div
            key={location.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 * index }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <MapPin className="size-5 shrink-0 text-primary" />
                  <span dir="rtl" lang="ar">
                    {location.name}
                  </span>
                </CardTitle>
                <CardDescription>
                  {location.subFields.length} pitch options available
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {location.subFields.map((subField) => (
                  <div
                    key={subField.id}
                    className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3"
                  >
                    <span className="text-sm font-medium">
                      {subField.label}
                    </span>
                    <span className="text-sm font-semibold text-primary">
                      {FIELD_PRICE_EGP[subField.type]} EGP
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>
    </PageContainer>
  );
}
