/**
 * The seva route guard - the authorisation boundary of every `/api/seva/*` route (DB §3.2, §3.3, §15.1).
 *
 * Order of checks (each failure answers at once):
 *  1. sign-in        - the identity adapter verifies the token (revoked or disabled logins fail)   401 unauthenticated
 *  2. access profile - Firestore `isActive` must be exactly true; no profile at all                 403 staff_inactive / forbidden
 *  3. role           - the profile role must map to one of the four seva roles (C-62)               403 forbidden
 *  4. staff row      - Supabase `staff` by external uid, status `active` ('invited' only for `me`)   403 forbidden / staff_inactive
 *  5. device         - `x-seva-device` when the route asks for one                                   403 device_required / device_unknown
 *  6. view-only      - blocks every write action                                                     403 view_only
 *  7. matrix         - `can(actor, action, ctx)`                                                     403 forbidden
 * Both stores must say "active", so drift between them can only deny (DB §3.2). A store that cannot be read
 * answers 500 internal. The person's email is never taken from the Firestore profile (A1 security gate L-4).
 */

import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { SevaError, type SevaErrorCode } from "@/lib/seva/errors";
import { can, isWriteAction, mapFirestoreRole, type PermissionContext, type SevaActor } from "@/lib/seva/permissions";
import { businessDate } from "@/lib/seva/time";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SevaAction } from "@/types/seva";
import { verifyDeviceHeader } from "./device";
import { getIdentityAdapter } from "./identity";
import { sevaErrorResponse } from "./respond";

export const SEVA_DEVICE_HEADER = "x-seva-device";

export type ActorResult =
  | { ok: true; actor: SevaActor; device: { id: string; counterId: number } | null }
  | { ok: false; response: NextResponse };

export interface RequireSevaActorOptions {
  /**
   * 'required': the call must come from a live registered counter PC.
   * 'optional': a valid header is used (it gives receptionists their own-counter context); a missing, stale or wrong
   * one is ignored, so a replaced PC can still reach pages that do not need it.
   * Left out: the header is not read at all.
   */
  device?: "required" | "optional";
  /** Facts about the record being touched. `counterIdOfDevice` and `todayBusinessDate` are always set by the guard. */
  ctx?: PermissionContext;
}

interface StaffRow {
  id: string;
  staff_no: number;
  full_name: string;
  view_only: boolean;
  status: string;
}

function deny(code: SevaErrorCode): ActorResult {
  return { ok: false, response: sevaErrorResponse(new SevaError(code)) };
}

async function findStaff(externalUid: string): Promise<StaffRow | null> {
  const { data, error } = await createAdminClient()
    .from("staff")
    .select("id, staff_no, full_name, view_only, status")
    .eq("firebase_uid", externalUid)
    .maybeSingle();
  if (error) throw new SevaError("internal");
  if (!data) return null;
  const row = data as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.staff_no !== "number" ||
    typeof row.full_name !== "string" ||
    typeof row.view_only !== "boolean" ||
    typeof row.status !== "string"
  ) {
    throw new SevaError("internal");
  }
  return { id: row.id, staff_no: row.staff_no, full_name: row.full_name, view_only: row.view_only, status: row.status };
}

export async function requireSevaActor(
  req: NextRequest,
  action: SevaAction,
  opts: RequireSevaActorOptions = {},
): Promise<ActorResult> {
  try {
    const identity = getIdentityAdapter();

    const caller = await identity.verifyRequest(req);
    if (!caller) return deny("unauthenticated");

    const profile = await identity.getAccessProfile(caller.externalUid);
    if (!profile) return deny("forbidden");
    if (profile.isActive !== true) return deny("staff_inactive");

    const role = mapFirestoreRole(profile.role);
    if (!role) return deny("forbidden");

    const staff = await findStaff(caller.externalUid);
    if (!staff) return deny("forbidden");
    const usable = staff.status === "active" || (staff.status === "invited" && action === "me");
    if (!usable) return deny("staff_inactive");

    let device: { id: string; counterId: number } | null = null;
    if (opts.device) {
      const header = req.headers.get(SEVA_DEVICE_HEADER);
      if (header) device = await verifyDeviceHeader(header);
      if (opts.device === "required" && !device) return deny(header ? "device_unknown" : "device_required");
    }

    const actor: SevaActor = {
      staffId: staff.id,
      uid: caller.externalUid,
      role,
      viewOnly: staff.view_only,
      staffNo: staff.staff_no,
      name: staff.full_name,
    };

    if (actor.viewOnly && isWriteAction(action)) return deny("view_only");

    const ctx: PermissionContext = { ...opts.ctx, todayBusinessDate: businessDate(new Date()) };
    // Only a verified device gives the own-counter context; a value from the caller is never trusted.
    if (device) ctx.counterIdOfDevice = device.counterId;
    else delete ctx.counterIdOfDevice;
    if (!can(actor, action, ctx)) return deny("forbidden");

    return { ok: true, actor, device };
  } catch (error) {
    return { ok: false, response: sevaErrorResponse(error) };
  }
}
