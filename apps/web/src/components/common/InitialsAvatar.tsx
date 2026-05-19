import {
  Avatar as ShadcnAvatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClass: Record<Size, string> = {
  xs: "size-4 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-12 text-sm",
  lg: "size-16 text-base",
  xl: "size-24 text-4xl",
};

const palette = [
  "bg-[oklch(0.7_0.13_30)]",
  "bg-[oklch(0.65_0.14_260)]",
  "bg-[oklch(0.6_0.16_300)]",
  "bg-[oklch(0.65_0.13_150)]",
  "bg-[oklch(0.6_0.18_20)]",
  "bg-[oklch(0.65_0.14_200)]",
  "bg-[oklch(0.6_0.16_330)]",
  "bg-[oklch(0.62_0.15_100)]",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function InitialsAvatar({
  name,
  imageUrl,
  size = "md",
  online,
}: {
  name: string;
  imageUrl?: string | null;
  size?: Size;
  online?: boolean;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const color = palette[hash(name) % palette.length];
  return (
    <ShadcnAvatar className={sizeClass[size]}>
      {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
      <AvatarFallback
        className={`${color} text- font-semibold${sizeClass[size]} text-white`}
        delayMs={500}
      >
        {initial}
      </AvatarFallback>
      {online && <AvatarBadge className="z-0 size-3 bg-emerald-500 bg-blend-normal" />}
    </ShadcnAvatar>
  );
}
