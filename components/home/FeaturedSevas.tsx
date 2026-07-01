import { getSevas } from "@/lib/sevas";
import FeaturedSevasClient from "./FeaturedSevasClient";

const sevas = getSevas();

export default function FeaturedSevas() {
  return <FeaturedSevasClient sevas={sevas} />;
}
