import { AtSign, CircleAlert, X } from "lucide-react";

import { DetailRow } from "@/components/common/DetailRow";
import { HeaderIconButton } from "@/components/common/HeaderIconButton";
import { PanelHeader } from "@/components/common/PanelHeader";
import { ProfileIdentity } from "@/components/profile/ProfileIdentity";

export function DMInfoPanel({
  onClose,
  name,
  username,
  bio,
}: {
  onClose: () => void;
  name: string;
  username: string;
  bio?: string;
}) {
  return (
    <>
      <PanelHeader>
        <HeaderIconButton onClick={onClose} aria-label="Close info">
          <X className="size-5" />
        </HeaderIconButton>
        <h2 className="text-base font-semibold">User Info</h2>
      </PanelHeader>

      <div className="flex-1 overflow-y-auto px-6 py-7">
        <ProfileIdentity displayName={name} name={name} status="online" />

        <ul className="mt-7 space-y-4">
          <DetailRow icon={AtSign} value={username} label="Username" />
          {bio && <DetailRow icon={CircleAlert} value={bio} label="Bio" />}
        </ul>
      </div>
    </>
  );
}
