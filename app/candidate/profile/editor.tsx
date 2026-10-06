"use client";

import { useRouter } from "next/navigation";
import { ProfileForm, type ProfileValues } from "@/components/candidate/profile-form";

export function ProfileEditor({ initial }: { initial: ProfileValues }) {
  const router = useRouter();
  return <ProfileForm initial={initial} submitLabel="Сохранить" onSaved={() => router.push("/candidate")} />;
}
