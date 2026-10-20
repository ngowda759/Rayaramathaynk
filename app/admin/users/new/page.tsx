import { redirect } from "next/navigation";

/**
 * Adding a person is onboarding (DB §13.6): the Staff and roles tab opens its Onboard staff dialog, which makes the
 * login, the role and the staff number together and sends Firebase's set-password email (C-56).
 */
export default function NewUserPage(): never {
  redirect("/admin/users?onboard=1");
}
