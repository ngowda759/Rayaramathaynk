"use client";

import { useMemo, useState, type JSX } from "react";

import { CounterList, type CounterListApi } from "@/components/seva/settings/CounterList";
import { SevaGate } from "@/components/seva/shell/SevaGate";
import { Bilingual } from "@/components/seva/ui/Bilingual";
import { useSevaMe } from "@/hooks/seva/useSevaMe";
import { useAuth } from "@/hooks/useAuth";
import { RS } from "@/lib/seva/strings/receipt-settings";
import { businessDate, istParts } from "@/lib/seva/time";
import { counterApi } from "@/services/seva/counter.service";
import { reportsApi } from "@/services/seva/reports.service";
import { settingsApi } from "@/services/seva/settings.service";

/**
 * Settings - Counters (DB §13.2, §8.4; mockup settings-devotee.html#receipt-settings, `rs-replace`): counters with their
 * series and last numbers, the opening float, "+ Add a counter", "Register this PC" and "Replace this PC". The counter
 * page links here when a PC is not registered yet.
 *
 * Device calls go without this PC's device header: registration is for a PC that is not a counter yet (or is being
 * moved), and the route needs only a signed-in temple admin or super admin (`device.register`).
 */
function Counters(): JSX.Element {
  const { user } = useAuth();
  const { me, can } = useSevaMe();
  const [now] = useState(() => new Date());

  const api = useMemo<CounterListApi>(() => {
    const token = () => (user ? user.getIdToken() : Promise.reject(new Error("Sign in again to change settings.")));
    const settings = settingsApi(token);
    const devices = counterApi(token, () => null);
    const reports = reportsApi(token);
    return {
      listCounters: () => settings.listCounters(),
      addCounter: (input) => settings.addCounter(input),
      updateCounter: (id, patch) => settings.updateCounter(id, patch),
      continuity: (from, to) => reports.continuity(from, to),
      registerDevice: (b) => devices.registerDevice(b),
      replaceDevice: (b) => devices.replaceDevice(b),
    };
  }, [user]);

  const canEdit = can("settings.edit");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Bilingual as="h2" en={RS.countersTitle.en} kn={RS.countersTitle.kn} />
        {canEdit ? null : <Bilingual as="div" en={RS.viewOnly.en} kn={RS.viewOnly.kn} className="meta" />}
      </div>
      <CounterList
        api={api}
        canEdit={canEdit}
        canRegister={can("device.register")}
        thisPcCounterId={me?.counter?.id ?? null}
        year={istParts(now).year}
        today={businessDate(now)}
      />
    </div>
  );
}

export default function CounterSettingsPage(): JSX.Element {
  return (
    <SevaGate action="reports.view">
      <Counters />
    </SevaGate>
  );
}
