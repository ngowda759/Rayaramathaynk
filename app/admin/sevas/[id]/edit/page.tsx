"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import FormContainer from "@/components/ui/form/FormContainer";
import FormSection from "@/components/ui/form/FormSection";
import FormTextField from "@/components/ui/form/FormTextField";
import FormTextArea from "@/components/ui/form/FormTextArea";
import FormSelectField from "@/components/ui/form/FormSelectField";
import FormSwitchField from "@/components/ui/form/FormSwitchField";
import FormActions from "@/components/ui/form/FormActions";

import { memberService, volunteerService } from "@/services/volunteer.service";
import { Member, Volunteer, MemberRequest, VolunteerRequest } from "@/types/volunteer";

function EditMemberVolunteerForm() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "members";

  const id = params.id as string;

  const [item, setItem] = useState<Member | Volunteer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    idField: "",
    name: "",
    phone: "",
    sex: "Male" as "Male" | "Female" | "Other",
    active: true,
    address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadItem() {
      try {
        let data: Member | Volunteer | null = null;
        if (tab === "members") {
          data = await memberService.getMemberById(id);
        } else {
          data = await volunteerService.getVolunteerById(id);
        }

        if (!data) {
          toast.error("Record not found.");
          router.push("/admin/sevas");
          return;
        }

        setItem(data);
        const idField = tab === "members" 
          ? (data as Member).memberId 
          : (data as Volunteer).volunteerId;
        setFormData({
          idField,
          name: data.name,
          phone: data.phone,
          sex: data.sex,
          active: data.active,
          address: data.address,
        });
      } catch (error) {
        console.error("Failed to load record:", error);
        toast.error("Failed to load record.");
        router.push("/admin/sevas");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadItem();
    }
  }, [id, router, tab]);

  function updateField(key: string, value: any) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: "" }));
    }
  }

  function validate() {
    const validationErrors: Record<string, string> = {};
    if (!formData.idField.trim()) {
      validationErrors.idField = tab === "members" ? "Member ID is required." : "Volunteer ID is required.";
    }
    if (!formData.name.trim()) {
      validationErrors.name = "Name is required.";
    }
    if (!formData.phone.trim()) {
      validationErrors.phone = "Phone is required.";
    }
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      if (tab === "members") {
        const data: MemberRequest = {
          memberId: formData.idField,
          name: formData.name,
          phone: formData.phone,
          sex: formData.sex,
          active: formData.active,
          address: formData.address,
        };
        await memberService.updateMember(id, data);
        toast.success("Member updated successfully.");
      } else {
        const data: VolunteerRequest = {
          volunteerId: formData.idField,
          name: formData.name,
          phone: formData.phone,
          sex: formData.sex,
          active: formData.active,
          address: formData.address,
        };
        await volunteerService.updateVolunteer(id, data);
        toast.success("Volunteer updated successfully.");
      }
      router.push("/admin/sevas");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update record.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title={tab === "members" ? "Edit Member" : "Edit Volunteer"}
          description="Loading..."
        />
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <>
      <AdminPageHeader
        title={tab === "members" ? "Edit Member" : "Edit Volunteer"}
        description="Update the details below."
      />

      <FormContainer onSubmit={handleUpdate}>
        <FormSection
          title="Basic Information"
          description="Enter the basic details."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <FormTextField
              label={tab === "members" ? "Member ID" : "Volunteer ID"}
              value={formData.idField}
              required
              error={errors.idField}
              onChange={(e) => updateField("idField", e.target.value)}
            />

            <FormTextField
              label="Name"
              value={formData.name}
              required
              error={errors.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormTextField
              label="Phone"
              value={formData.phone}
              required
              error={errors.phone}
              onChange={(e) => updateField("phone", e.target.value)}
            />

            <FormSelectField
              label="Sex"
              value={formData.sex}
              options={[
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
                { value: "Other", label: "Other" },
              ]}
              onChange={(e) => updateField("sex", e.target.value)}
            />
          </div>

          <FormTextArea
            label="Address"
            value={formData.address}
            onChange={(e) => updateField("address", e.target.value)}
            rows={3}
          />

          <FormSwitchField
            label="Active Status"
            checked={formData.active}
            onChange={(checked) => updateField("active", checked)}
          />
        </FormSection>

        <FormActions
          loading={saving}
          submitLabel={tab === "members" ? "Update Member" : "Update Volunteer"}
          onCancel={() => router.push("/admin/sevas")}
        />
      </FormContainer>
    </>
  );
}

export default function EditMemberVolunteerPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <EditMemberVolunteerForm />
    </Suspense>
  );
}
