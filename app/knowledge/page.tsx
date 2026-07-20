import { Metadata } from "next";
import KnowledgeCentreClient from "@/components/knowledge/KnowledgeCentreClient";
import { knowledgeService } from "@/services/knowledge.service";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Knowledge Centre | Rayaramathaynk",
  description: "Explore the rich spiritual knowledge about Sri Raghavendra Swamy Matha - from temple history to rituals, philosophy, and more.",
};

export const revalidate = 3600;

export default async function KnowledgeCentrePage() {
  const data = await knowledgeService.getKnowledgeCentreData();

  return (
    <>
      <Navbar />
      <KnowledgeCentreClient initialData={data} />
      <Footer />
    </>
  );
}
