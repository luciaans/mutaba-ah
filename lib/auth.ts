import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserProfile = {
  id: string;
  username: string;
  full_name: string;
  role: "admin" | "ustaz";
  is_active: boolean;
};

export async function getCurrentProfile(): Promise<UserProfile | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("id, username, full_name, role, is_active").eq("id", user.id).maybeSingle();
    if (!data || !data.is_active || (data.role !== "admin" && data.role !== "ustaz")) return null;
    return data as UserProfile;
  } catch {
    return null;
  }
}

export async function requireProfile(): Promise<UserProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireRole(role: UserProfile["role"]): Promise<UserProfile> {
  const profile = await requireProfile();
  if (profile.role !== role) redirect("/");
  return profile;
}
