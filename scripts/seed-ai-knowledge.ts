#!/usr/bin/env npx ts-node

/**
 * Seed AI Knowledge Script
 * 
 * This script imports default knowledge files into the Firebase database.
 * Run with: npm run seed:ai
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient } from '../lib/supabase/admin';


const SEED_DIR = path.join(process.cwd(), 'seed', 'ai');
import { knowledgeArticleSchema } from '../lib/ai/knowledge/validation';

// Knowledge categories required for complete coverage
const REQUIRED_CATEGORIES = [
  'temple-timings',
  'visitor-guidelines',
  'dress-code',
  'facilities',
  'parking',
  'volunteer',
  'faq',
  'contact',
  'donation',
  'photography',
  'accommodation',
  'history',
  'raghavendra-swamy',
  'brindavana'
];

interface SeedArticle {
  title: string;
  category: string;
  content: string;
  published?: boolean;
  [key: string]: unknown;
}



async function seedKnowledge(overwrite: boolean = false): Promise<void> {
  console.log('🚀 Starting AI Knowledge Seed to Supabase...\n');

  // Check if seed directory exists
  if (!fs.existsSync(SEED_DIR)) {
    console.error(`❌ Seed directory not found: ${SEED_DIR}`);
    process.exit(1);
  }

  const supabase = createAdminClient();
  if (!supabase) {
    console.error("Failed to initialize Supabase admin client.");
    process.exit(1);
  }

  // Get all seed files
  const seedFiles = fs.readdirSync(SEED_DIR).filter(f => f.endsWith('.json'));

  if (seedFiles.length === 0) {
    console.log('⚠️  No seed files found in', SEED_DIR);
    process.exit(0);
  }

  console.log(`📁 Found ${seedFiles.length} seed files\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of seedFiles) {
    const filePath = path.join(SEED_DIR, file);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const article = JSON.parse(content);

      if (!article.category) {
        console.log(`⚠️  Skipping ${file}: missing 'category' field`);
        skipped++;
        continue;
      }

      // We don't check for existing articles here to allow updates during seed.
      // Upsert will handle overwriting or creating. If overwrite is strictly false,
      // you could add a SELECT check here. For robust seeding, upsert is usually preferred.

      const articleSlug = article.category.replace(/-/g, '_');

      const { error } = await supabase
        .from('ai_knowledge')
        .upsert({
          slug: articleSlug,
          title: article.title || articleSlug,
          category: article.category,
          keywords: Array.isArray(article.tags) ? article.tags.map(String) : [],
          content: article.content || '',
          language: 'en',
          approved: article.published ?? false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'slug' });

      if (error) {
        console.error(`❌ Error importing ${file}:`, error);
        errors++;
      } else {
        console.log(`✅ Imported: ${article.title || articleSlug} (${article.category})`);
        imported++;
      }

    } catch (error) {
      console.error(`❌ Error importing ${file}:`, error);
      errors++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Seed Summary:`);
  console.log(`   ✅ Imported: ${imported}`);
  console.log(`   ⏭️  Skipped:  ${skipped}`);
  console.log(`   ❌ Errors:   ${errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (imported > 0) {
    console.log('✨ AI Knowledge seeded successfully!\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const overwrite = args.includes('--overwrite') || args.includes('-o');

seedKnowledge(overwrite).catch(console.error);
