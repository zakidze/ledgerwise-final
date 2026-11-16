import { Suspense } from "react";
import CompanyDetailsClient from "./CompanyDetailsClient";

export function generateStaticParams() {
  return [{ id: "comp_bala_sample" }, { id: "Bala" }];
}

export default async function CompanyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const companyId = decodeURIComponent(resolvedParams?.id || "");

  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-[#94a3b8]">
          Loading company details...
        </div>
      }
    >
      <CompanyDetailsClient companyId={companyId} />
    </Suspense>
  );
}
