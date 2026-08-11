import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home } from "lucide-react";

import { PageContainer } from "@/components/common/PageContainer";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

export default function NotFound() {
  return (
    <PageContainer className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-6xl font-bold text-primary">404</p>
        <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild className="mt-6">
          <Link to={ROUTES.home}>
            <Home className="size-4" />
            Back to home
          </Link>
        </Button>
      </motion.div>
    </PageContainer>
  );
}
