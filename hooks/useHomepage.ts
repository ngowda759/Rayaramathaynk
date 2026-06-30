"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { HomepageConfig } from "@/types/homepage";

export function useHomepage() {
  const [homepage, setHomepage] = useState<HomepageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "homepage", "config"),
      (snapshot) => {

       	if (snapshot.exists()) {
  	setHomepage(snapshot.data() as HomepageConfig);
	} else {
  	setHomepage(null);
	}

	setLoading(false);
      },
      (error) => {
        console.error("Homepage listener:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    homepage,
    loading,
  };
}
