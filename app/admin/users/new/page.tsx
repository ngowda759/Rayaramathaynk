import UserForm from "@/components/admin/users/UserForm";

export default function NewUserPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">
        Add New User
      </h1>

      <UserForm />
    </div>
  );
}
