-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "general" JSONB NOT NULL DEFAULT '{}',
    "safety" JSONB NOT NULL DEFAULT '{}',
    "extended_behavior" JSONB NOT NULL DEFAULT '{}',
    "temple_information" JSONB NOT NULL DEFAULT '{}',
    "visitor_information" JSONB NOT NULL DEFAULT '{}',
    "temple_policies" JSONB NOT NULL DEFAULT '{}',
    "ai_responses" JSONB NOT NULL DEFAULT '{}',
    "ai_behavior" JSONB NOT NULL DEFAULT '{}',
    "prompt" JSONB NOT NULL DEFAULT '{}',
    "intents" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "version" INTEGER DEFAULT 1,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_knowledge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firestore_id" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kannada_title" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "content" TEXT NOT NULL,
    "kannada_content" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "last_reviewed" TIMESTAMPTZ(6),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firestore_id" TEXT,
    "user_id" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message" TEXT,
    "detected_language" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firestore_id" TEXT,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "model" TEXT,
    "latency" DECIMAL(10,2),
    "detected_language" TEXT,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unknown_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firestore_id" TEXT,
    "question" TEXT NOT NULL,
    "question_lower" TEXT,
    "detected_intent" TEXT,
    "confidence" DECIMAL(5,2),
    "language" TEXT,
    "timestamp" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "session_id" TEXT,
    "times_asked" INTEGER DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_to" TEXT DEFAULT 'unassigned',
    "last_asked" TIMESTAMPTZ(6),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "response" TEXT,
    "added_to_knowledge_article_id" TEXT,
    "notes" TEXT,

    CONSTRAINT "unknown_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_intent_distribution" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firestore_id" TEXT,
    "intent" TEXT NOT NULL,
    "category" TEXT,
    "language" TEXT,
    "confidence" DECIMAL(5,2),
    "timestamp" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "session_id" TEXT,
    "message_id" TEXT,

    CONSTRAINT "ai_intent_distribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_latency_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firestore_id" TEXT,
    "total_latency" DECIMAL(10,2) NOT NULL,
    "intent_detection_time" DECIMAL(10,2) NOT NULL,
    "retrieval_time" DECIMAL(10,2) NOT NULL,
    "generation_time" DECIMAL(10,2) NOT NULL,
    "timestamp" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_type" TEXT,
    "model" TEXT,
    "session_id" TEXT,

    CONSTRAINT "ai_latency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firestore_id" TEXT,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "phone_number" TEXT,
    "photo_url" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firestore_id" TEXT,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "profile_image" TEXT,
    "bio" TEXT,
    "gotra" TEXT,
    "nakshatra" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "favorites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recently_viewed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bookmarks" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_knowledge_firestore_id_key" ON "ai_knowledge"("firestore_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_knowledge_slug_key" ON "ai_knowledge"("slug");

-- CreateIndex
CREATE INDEX "idx_ai_knowledge_category" ON "ai_knowledge"("category");

-- CreateIndex
CREATE INDEX "idx_ai_knowledge_approved" ON "ai_knowledge"("approved");

-- CreateIndex
CREATE INDEX "idx_ai_knowledge_slug" ON "ai_knowledge"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_firestore_id_key" ON "chat_sessions"("firestore_id");

-- CreateIndex
CREATE INDEX "idx_chat_sessions_user_id" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_firestore_id_key" ON "chat_messages"("firestore_id");

-- CreateIndex
CREATE INDEX "idx_chat_messages_session_id" ON "chat_messages"("session_id");

-- CreateIndex
CREATE INDEX "idx_chat_messages_timestamp" ON "chat_messages"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "unknown_questions_firestore_id_key" ON "unknown_questions"("firestore_id");

-- CreateIndex
CREATE INDEX "idx_unknown_questions_timestamp" ON "unknown_questions"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ai_intent_distribution_firestore_id_key" ON "ai_intent_distribution"("firestore_id");

-- CreateIndex
CREATE INDEX "idx_ai_intent_dist_timestamp" ON "ai_intent_distribution"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ai_latency_records_firestore_id_key" ON "ai_latency_records"("firestore_id");

-- CreateIndex
CREATE INDEX "idx_ai_latency_records_timestamp" ON "ai_latency_records"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "users_firestore_id_key" ON "users"("firestore_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_firestore_id_key" ON "profiles"("firestore_id");

