import type { Metadata } from "next";

import { CounterScreen } from "@/components/seva/counter/CounterScreen";
import { SevaGate } from "@/components/seva/shell/SevaGate";

export const metadata: Metadata = {
  title: "Counter - Receipt Book",
};

/**
 * The seva counter (Design Book 9). Open to everyone allowed to issue counter receipts (receptionists, temple admins,
 * super admins); the screen itself asks for a registered counter PC and the office checks every call again.
 */
export default function CounterPage() {
  return (
    <SevaGate action="counter.issue">
      <CounterScreen />
    </SevaGate>
  );
}
