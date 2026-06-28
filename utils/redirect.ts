import { UserProfile } from "@/types/user";

export function getDashboardRoute(profile: UserProfile | null) {
  if (!profile) return "/";

  switch (profile.role) {
    case "super_admin":
    case "temple_admin":
      return "/admin";

    case "priest":
      return "/priest";

    case "staff":
      return "/staff";

    case "volunteer":
      return "/volunteer";

    case "devotee":
      return "/devotee";

    default:
      return "/";
  }
}
