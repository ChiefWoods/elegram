import { InitialsAvatar } from "@/components/common/InitialsAvatar";

export function ProfileIdentity({
  name,
  imageUrl,
  displayName,
  status,
}: {
  name: string;
  imageUrl?: string | null;
  displayName: string;
  status: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <InitialsAvatar name={name} imageUrl={imageUrl} size="xl" />
      <div className="text-center">
        <div className="text-xl font-semibold">{displayName}</div>
        <div className="text-sm text-muted-foreground">{status}</div>
      </div>
    </div>
  );
}
