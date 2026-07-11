"use client";
import { useEffect, useState } from "react";
import { db, validateFirebaseConfig } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function TestFirebasePage() {
  const [status, setStatus] = useState<string>("Initial");
  const [configStatus, setConfigStatus] = useState<any>(null);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function test() {
      setStatus("Checking config...");
      try {
        // Check validation
        const validation = validateFirebaseConfig();
        setConfigStatus(validation);
        setStatus("Config validated: " + JSON.stringify(validation));
        
        console.log("db is:", db);
        console.log("Config validation:", validation);
        
        if (!db) {
          setStatus("Firebase not initialized - check env vars above");
          return;
        }
        
        setStatus("Querying Firestore...");
        const snapshot = await getDocs(collection(db, "events"));
        setStatus("Got " + snapshot.docs.length + " events");
        setData(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })));
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
      
      {configStatus && (
        <div style={{ background: "#f4f4f4", padding: "10px", margin: "10px 0" }}>
          <h3>Firebase Config Validation:</h3>
          <p><strong>isValid:</strong> {configStatus.isValid ? "✅ true" : "❌ false"}</p>
          <p><strong>Missing Fields:</strong> {configStatus.missingFields.length === 0 ? "None" : configStatus.missingFields.join(", ")}</p>
        </div>
      )}
      
      <details>
        <summary>Raw Data</summary>
        <pre style={{ background: "#f4f4f4", padding: "10px", overflow: "auto" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
