import Link from "next/link";
import type { Business } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";

type OverviewBusinessCardProps = {
  business: Business;
  created?: string | null;
  updated?: string | null;
  businessId: string;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_1fr] gap-2 border-b border-border/60 py-2.5 text-sm last:border-0">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function DoctorIllustration() {
  return (
    <svg
      viewBox="0 0 200 160"
      className="h-full w-full max-h-[140px] text-chart-1"
      aria-hidden
    >
      <ellipse cx="100" cy="145" rx="70" ry="8" fill="var(--app-chart-1-soft)" />
      <rect x="55" y="95" width="90" height="42" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="100" cy="52" r="22" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M88 48h24M100 36v24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M70 75 Q100 62 130 75" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="72" y="108" width="56" height="6" rx="2" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export function OverviewBusinessCard({
  business,
  created,
  updated,
  businessId,
}: OverviewBusinessCardProps) {
  const plan = business.subscription_plan?.trim() || "free";
  const planStatus = business.subscription_status?.trim() || "active";

  return (
    <Card className="flex flex-col overflow-hidden p-0 sm:flex-row">
      <div className="flex flex-1 flex-col p-5 sm:p-6 lg:p-7">
        <p className="text-sm font-bold uppercase tracking-wide text-foreground">
          {business.name}
        </p>
        {business.business_type && (
          <p className="mt-1 text-sm text-muted-foreground">{business.business_type}</p>
        )}
        <Link
          href={`/dashboard/${businessId}/edit`}
          className={`${buttonClasses("primary", "sm")} mt-4 w-fit`}
        >
          Edit Business Details
        </Link>
        <dl className="mt-5">
          {business.email && <DetailRow label="Email" value={business.email} />}
          {business.phone && <DetailRow label="Phone" value={business.phone} />}
          {business.address && <DetailRow label="Address" value={business.address} />}
          <DetailRow label="Timezone" value={business.timezone || "—"} />
          {created && <DetailRow label="Created" value={created} />}
          {updated && <DetailRow label="Last updated" value={updated} />}
          <DetailRow label="Plan" value={`${plan} · ${planStatus}`} />
        </dl>
      </div>
      <div className="flex items-center justify-center bg-gradient-to-br from-[#f0fdf4] to-[#ecfdf5] p-6 sm:w-[38%] sm:min-w-[200px]">
        <DoctorIllustration />
      </div>
    </Card>
  );
}
