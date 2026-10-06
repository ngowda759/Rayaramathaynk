#!/usr/bin/env npx ts-node

/**
 * Seed AI Knowledge Script
 * 
 * This script imports default knowledge files into the Supabase database.
 * Run with: npm run seed:ai
 */

import { createAdminClient } from "../lib/supabase/admin";
import { SEED_ARTICLES } from "../lib/ai/knowledge/seed";

async function main() {
  console.log("Seeding AI Knowledge to Supabase...");
  const supabase = createAdminClient();

  if (!supabase) {
    console.error("Failed to initialize Supabase admin client.");
    process.exit(1);
  }

  for (const article of SEED_ARTICLES) {
    console.log(`Seeding: ${article.slug}`);
    const { error } = await supabase
      .from("ai_knowledge")
      .upsert({
        slug: article.slug,
        title: article.title,
        kannada_title: article.kannadaTitle,
        category: article.category,
        keywords: article.keywords,
        content: article.content,
        kannada_content: article.kannadaContent,
        language: article.language,
        approved: article.approved,
        last_reviewed: article.lastReviewed ? article.lastReviewed.toISOString() : null,
      }, { onConflict: 'slug' });

    if (error) {
      console.error(`Failed to seed ${article.slug}:`, error);
    }
  }

  console.log("Finished seeding AI Knowledge to Supabase.");
}

main().catch(console.error);
