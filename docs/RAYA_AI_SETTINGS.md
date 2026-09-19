# Raya AI Settings Configuration

This document outlines the centralized configuration schema for the Raya AI assistant.
These settings are managed by admins via the AI Management Center dashboard.

## 1. General Settings
- **enabled** (boolean): Toggle the AI assistant on/off.
- **botName** (string): The display name of the AI.
- **botSubtitle** (string): The subtitle shown in the chat UI.
- **welcomeMessage** (string): The initial greeting.
- **closingMessage** (string): The message used when saying goodbye.
- **defaultLanguage** (string): Standard language (e.g., "en").
- **supportedLanguages** (array): List of supported languages.

## 2. Safety Settings
- **retrievalRequired** (boolean): If true, responses MUST be backed by structured data or KB articles.
- **allowLLMOnlyResponse** (boolean): If true, the system may fall back to an LLM without structured data (Default: false).
- **requireSourceForFacts** (boolean): Always attach a source citation to factual responses.
- **unknownQuestionBehaviour** ("fallback" | "escalate" | "silent"): Defines what happens when confidence is too low.
- **outOfScopeBehaviour** ("fallback" | "strict" | "silent"): Defines what happens when queries are out of scope.

## 3. Behavior Settings
- **confidenceThreshold** (number): Minimum confidence score required to not trigger the unknown fallback (0-100).
- **maxKnowledgeResults** (number): Maximum number of KB articles to retrieve and evaluate.
- **enableFollowUpContext** (boolean): Use session context for follow-up questions.
- **enableSuggestedQuestions** (boolean): Display suggested quick actions.
- **enableDebugMode** (boolean): Return debug metadata in the API response.
- **enableUnknownQuestionLogging** (boolean): Log failed queries for admin review.
