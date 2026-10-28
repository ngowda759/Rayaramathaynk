import { Seva, SevaRequest } from "@/types/seva";
import { getAllSevasAction, getSevaByIdAction } from "@/app/actions/sevas";

/**
 * Seva catalogue.
 *
 * Reads go through the public server actions in `app/actions/sevas.ts`, which query
 * Supabase `sevas` with the service role and return only active, online-offered rows.
 * There is no Firestore path: if the read fails it throws, so an empty list can only
 * mean "no sevas", never a swallowed permission or connectivity failure.
 *
 * The admin catalogue is edited through the seva counter (`/api/seva/sevas`), which
 * has its own audited flow, so this module is read-only. The former `createSeva` /
 * `updateSeva` / `deleteSeva` methods were unused and are removed rather than kept as
 * a service-role write path reachable from the browser.
 */

function rowToSeva(item: Record<string, unknown>): Seva {
  return {
    id: (item.firestore_id as string) || (item.id as string),
    name: item.name as string,
    description: item.description as string,
    category: item.category as string,
    amount: Number(item.amount),
    duration: Number(item.duration),
    imageUrl: (item.image_url as string) || "",
    active: item.active as boolean,
    displayOrder: item.display_order as number,
    createdAt: item.created_at as string,
    updatedAt: (item.updated_at as string) || (item.created_at as string),
  } as Seva;
}

class SevaService {
  async getAllSevas(): Promise<Seva[]> {
    const data = await getAllSevasAction();
    return (data ?? []).map(rowToSeva);
  }

  async getSevaById(id: string): Promise<Seva | null> {
    try {
      const item = await getSevaByIdAction(id);
      return rowToSeva(item);
    } catch (error) {
      // A single missing row is a legitimate "not found"; anything else is surfaced.
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "PGRST116") {
        return null;
      }
      throw error;
    }
  }
}

export const sevaService = new SevaService();

export type { SevaRequest };
