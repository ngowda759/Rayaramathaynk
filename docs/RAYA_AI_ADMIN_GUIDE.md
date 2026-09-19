# Raya AI Admin Guide

This guide explains how administrators can configure and manage the Raya AI assistant via the Admin Dashboard.

## 1. Overview Dashboard
The AI Management Center provides a high-level overview of chatbot health, total interactions, intent detection success rates, and the number of pending unknown questions.

## 2. Settings Management
Navigate to **Admin > AI > Settings**. The settings are divided into logical sections:

- **General Settings**: Update the bot's name, subtitle, and welcome/closing messages. Choose the active languages.
- **Safety Settings**:
  - Ensure **Retrieval Required** is checked to prevent hallucinations.
  - Disable **Allow LLM Only Response** in production.
- **Behavior Settings**:
  - Adjust the **Confidence Threshold**. A higher threshold (e.g., 85%) means the bot will fall back to "I don't know" more often if it's unsure. A lower threshold might lead to incorrect intent matching.

## 3. Knowledge Base
Navigate to **Admin > AI > Knowledge Base**.

- **Create/Edit Articles**: Add specific, factual content that doesn't fit into structured data (like History or Philosophy).
- **Publish Workflow**: Draft -> Review -> Published. Only \`Published\` articles are queried by the public AI.
- **Keywords**: Add exact match and semantic keywords (in English and Kannada) to improve retrieval accuracy.

## 4. Unknown Questions
Navigate to **Admin > AI > Unknown Questions**.

When a user asks a question that falls below the confidence threshold, it lands here.
1. **Review**: Read the user's raw query.
2. **Action**:
   - If it's a gap in knowledge, write a new Knowledge Base article or add it to an existing one.
   - If it's a failure in intent detection, add the query as a new keyword/example to the respective intent.
3. **Resolve**: Mark the question as resolved to clear it from the queue.

## 5. Analytics
Navigate to **Admin > AI > Analytics**.

Monitor real-time metrics:
- **Top Intents**: See what users ask about the most (e.g., Timings, Sevas).
- **Fallback Rate**: Monitor how often the bot hits the "Unknown Question" fallback. A rising fallback rate indicates missing knowledge or changing user behavior.
