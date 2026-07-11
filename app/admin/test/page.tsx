"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function FirebaseTestPage() {
  async function handleTest() {
    if (!db) {
      alert("Firebase is not configured. Please set up Firebase environment variables.");
      return;
    }
    try {
      console.log("Testing Firestore...");

      const docRef = await addDoc(collection(db, "test"), {
        message: "Hello from Temple Portal",
        createdAt: serverTimestamp(),
      });

      console.log("Success:", docRef.id);
      alert(`Success! Document created: ${docRef.id}`);
    } catch (error) {
      console.error("Firestore Error:", error);
      alert(
        error instanceof Error ? error.message : JSON.stringify(error)
      );
    }
  }

  return (
    <div className="p-10">
      <h1 className="mb-6 text-3xl font-bold">Firebase Test</h1>

      <button
        type="button"
        onClick={handleTest}
        className="rounded bg-blue-600 px-6 py-3 text-white"
      >
        Test Firestore
      </button>
    </div>
  );
}
