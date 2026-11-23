import { redirect } from "next/navigation";

/**
 * The per-account editor was retired with the directory's write verbs (AUTHZ-01): a role or
 * status change goes through the Staff and roles tab, which calls the staff module and its
 * permission matrix. Old bookmarks land there.
 */
export default function EditUserPage() {
  redirect("/admin/users?tab=staff");
}
