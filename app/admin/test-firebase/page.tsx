"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function TestFirebasePage() {
  const [status, setStatus] = useState<string>("Initial");
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function test() {
      setStatus("Starting...");
      try {
        console.log("db is:", db);
        setStatus("db = " + (db ? "defined" : "null"));
        
        if (!db) {
          setStatus("Firebase not initialized");
          return;
        }
        
        setStatus("Querying Firestore...");
        const snapshot = await getDocs(collection(db, "events"));
        setStatus("Got " + snapshot.docs.length + " events");
        setData(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e: any) {
        setError(e.message || String(e));
        setStatus("Error: " + e.message);
      }
    }
    
    test();
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>Firebase Test Page</h1>
      <p><strong>Status:</strong> {status}</p>
      <p><strong>Data count:</strong> {data.length}</p>
      {error && <p style={{ color: "red" }}><strong>Error:</strong> {error}</p>}
      <details>
        <summary>Raw Data</summary>
        <pre style={{ background: "#f4f4f4", padding: "10px", overflow: "auto" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
