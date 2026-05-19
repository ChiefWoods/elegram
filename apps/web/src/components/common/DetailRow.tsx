import type { LucideIcon } from "lucide-react";

export function DetailRow({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-base leading-snug">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </li>
  );
}
