/**
 * Browser client for the staff routes (the Staff and roles page, Task A4-11).
 *
 * After a successful `onboard` the page sends Firebase's own set-password email (C-56). A change that went only part
 * of the way fails with SevaClientError code 'partial_failure' whose `detail` is StaffPartialFailure (which step was
 * done, which failed), so the page can say exactly where the person now stands.
 */

import type { StaffOnboardRequest, StaffUpdateRequest } from "@/lib/seva/schemas";
import type {
  NextStaffNoResponse,
  StaffListFilter,
  StaffListResponse,
  StaffMember,
  StaffOnboardResponse,
} from "@/types/seva-staff";
import { sevaFetch } from "./http";

/** Request bodies: the same zod schemas check them on the server (lib/seva/schemas.ts). */
export interface StaffApi {
  list(filter: StaffListFilter): Promise<StaffMember[]>;
  nextStaffNo(): Promise<number>;
  onboard(body: StaffOnboardRequest): Promise<StaffOnboardResponse>;
  update(id: string, body: StaffUpdateRequest): Promise<void>;
}

const STAFF_PATH = "/api/seva/staff";

export function staffApi(token: () => Promise<string>): StaffApi {
  return {
    async list(filter) {
      const res = await sevaFetch<StaffListResponse>(`${STAFF_PATH}?filter=${encodeURIComponent(filter)}`, {
        token: await token(),
      });
      return res.staff;
    },
    async nextStaffNo() {
      const res = await sevaFetch<NextStaffNoResponse>(`${STAFF_PATH}?view=next-staff-no`, { token: await token() });
      return res.nextStaffNo;
    },
    async onboard(body) {
      return sevaFetch<StaffOnboardResponse>(STAFF_PATH, { method: "POST", body, token: await token() });
    },
    async update(id, body) {
      await sevaFetch<unknown>(`${STAFF_PATH}/${encodeURIComponent(id)}`, { method: "PUT", body, token: await token() });
    },
  };
}
