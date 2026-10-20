import type { JSX } from "react";

import { Bilingual } from "@/components/seva/ui/Bilingual";
import { formatSevaDate } from "@/lib/seva/time";
import { COUNTER_TEXT } from "@/lib/seva/strings/counter";

/**
 * "Day closed" (Design Book 9.10 step 7): today's day close is done for this counter, so the counter saves no new
 * receipt until a temple admin reopens the day with a reason (C-24).
 */
export function DayClosedNotice({ date }: { date: string }): JSX.Element {
  return (
    <div role="alert" className="flex flex-col gap-1 rounded-(--radius-surface) border border-(--border-strong) bg-(--secondary) px-5 py-4">
      <b>
        {COUNTER_TEXT.dayClosedTitle.en} - {formatSevaDate(date)}
      </b>
      <span className="kn" lang="kn">
        {COUNTER_TEXT.dayClosedTitle.kn}
      </span>
      <Bilingual as="div" en={COUNTER_TEXT.dayClosedBody.en} kn={COUNTER_TEXT.dayClosedBody.kn} className="text-(length:--text-ui)" />
    </div>
  );
}

export default DayClosedNotice;
