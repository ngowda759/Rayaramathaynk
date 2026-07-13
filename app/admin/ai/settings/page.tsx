"use client";

import { useState, useEffect } from "react";
import { 
  Save, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle,
  MessageSquare,
  Settings as SettingsIcon,
  Eye,
  EyeOff
} from "lucide-react";
import { getAISettings, saveAISettings, AISettings, DEFAULT_AI_SETTINGS } from "@/lib/ai/settings";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";

export default function AISettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Form state
  const [systemPrompt, setSystemPrompt] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const settings = await getAISettings();
      setSystemPrompt(settings.systemPrompt);
      setWelcomeMessage(settings.welcomeMessage);
      setEnabled(settings.enabled);
    } catch (error) {
      console.error("Error loading AI settings:", error);
      showMsg("error", "Failed to load AI settings");
    } finally {
      setLoading(false);
    }
  }

  function showMsg(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleSave() {
    if (!systemPrompt.trim()) {
      showMsg("error", "System prompt is required");
      return;
    }

    if (!welcomeMessage.trim()) {
      showMsg("error", "Welcome message is required");
      return;
    }

    setSaving(true);
    try {
      await saveAISettings({
        systemPrompt: systemPrompt.trim(),
        welcomeMessage: welcomeMessage.trim(),
        enabled,
      });
      showMsg("success", "AI settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      showMsg("error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (confirm("Reset all AI settings to defaults?")) {
      setSystemPrompt(DEFAULT_AI_SETTINGS.systemPrompt);
      setWelcomeMessage(DEFAULT_AI_SETTINGS.welcomeMessage);
      setEnabled(DEFAULT_AI_SETTINGS.enabled);
      showMsg("success", "Settings reset to defaults (save to apply)");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="AI Chat Settings"
        description="Configure the chatbot behavior, instructions, and messages."
      />

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
          message.type === "success" 
            ? "bg-green-50 text-green-700 border border-green-200" 
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <SettingsIcon className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900">Chatbot Configuration</h2>
              <p className="text-sm text-stone-500">These settings control how the AI chatbot behaves</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-stone-600" />
              <div>
                <p className="font-medium text-stone-900">Enable AI Chat</p>
                <p className="text-sm text-stone-500">Show or hide the chat widget on the website</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* System Prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-stone-700">
                System Prompt / Instructions
              </label>
              <button
                onClick={() => setShowPromptPreview(!showPromptPreview)}
                className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
              >
                {showPromptPreview ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Hide Preview
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Show Preview
                  </>
                )}
              </button>
            </div>
            
            {showPromptPreview && (
              <div className="mb-3 p-4 bg-stone-100 rounded-lg border border-stone-200">
                <p className="text-xs text-stone-500 mb-2">Preview (how AI sees this):</p>
                <div className="text-sm text-stone-700 whitespace-pre-wrap font-masked">
                  {systemPrompt || <span className="italic text-stone-400">No instructions set</span>}
                </div>
              </div>
            )}
            
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={16}
              placeholder="Enter AI system instructions..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
            />
            <p className="text-xs text-stone-500 mt-1">
              These instructions guide the AI on how to behave, respond, and what to include/exclude.
              Supports Markdown formatting.
            </p>
          </div>

          {/* Welcome Message */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Welcome Message
            </label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={6}
              placeholder="Enter welcome message..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <p className="text-xs text-stone-500 mt-1">
              This message is shown when users first open the chat. Supports Markdown and emojis.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-stone-200 bg-stone-50">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-stone-600 hover:text-stone-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Settings
          </button>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Tips for Writing Effective Instructions</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Be specific</strong> - Tell the AI exactly what role it should play</li>
          <li>• <strong>Set boundaries</strong> - Clearly state what the AI should NOT do</li>
          <li>• <strong>Include examples</strong> - Show how responses should look</li>
          <li>• <strong>Mention tone</strong> - Describe the communication style (formal, friendly, devotional, etc.)</li>
          <li>• <strong>Reference your data</strong> - Tell it to use the training data for answers</li>
        </ul>
      </div>
    </div>
  );
}
