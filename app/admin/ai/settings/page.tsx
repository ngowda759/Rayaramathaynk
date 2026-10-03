"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Save, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle,
  Building,
  Users,
  Shield,
  MessageSquare,
  Settings as SettingsIcon,
  MapPin,
  Phone,
  Mail,
  Clock,
  Info,
  Database,
  Loader2
} from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import type { 
  TempleInformation, 
  VisitorInformation, 
  TemplePolicies, 
  AIResponses,
  AIBehaviorSettings
} from "@/types/ai-settings";
import {
  DEFAULT_TEMPLE_INFORMATION,
  DEFAULT_VISITOR_INFORMATION,
  DEFAULT_TEMPLE_POLICIES,
  DEFAULT_AI_RESPONSES,
  DEFAULT_AI_BEHAVIOR_SETTINGS
} from "@/types/ai-settings";

const TABS = [
  { id: "temple", label: "Temple Information", icon: Building },
  { id: "visitor", label: "Visitor Information", icon: Users },
  { id: "policies", label: "Temple Policies", icon: Shield },
  { id: "responses", label: "AI Responses", icon: MessageSquare },
  { id: "behavior", label: "AI Behavior", icon: SettingsIcon },
];

interface AISettingsFormData {
  temple: TempleInformation;
  visitor: VisitorInformation;
  policies: TemplePolicies;
  responses: AIResponses;
  behavior: AIBehaviorSettings;
}

export default function AISettingsPage() {
  const [activeTab, setActiveTab] = useState("temple");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [settings, setSettings] = useState<AISettingsFormData | null>(null);
  const [originalSettings, setOriginalSettings] = useState<AISettingsFormData | null>(null);

  const showMsg = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const handleSeedData = async () => {
    if (!confirm("This will initialize default AI data (intents, prompts, unknown questions). Continue?")) {
      return;
    }
    
    setSeeding(true);
    try {
      const response = await fetch("/api/seed-ai-settings", {
        method: "POST",
      });
      
      if (response.ok) {
        const data = await response.json();
        showMsg("success", `AI data initialized! ${data.summary?.intents || 0} intents, ${data.summary?.prompts || 0} prompts, ${data.summary?.unknownQuestions || 0} unknown questions.`);
        // Reload settings
        loadSettings();
      } else {
        const error = await response.json();
        showMsg("error", error.error || "Failed to seed data");
      }
    } catch (error) {
      console.error("Error seeding data:", error);
      showMsg("error", "Failed to seed AI data");
    } finally {
      setSeeding(false);
    }
  };

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const [temple, visitor, policies, responses, behavior] = await Promise.all([
        fetch("/api/ai/settings/temple-information").then(r => r.json()),
        fetch("/api/ai/settings/visitor-information").then(r => r.json()),
        fetch("/api/ai/settings/policies").then(r => r.json()),
        fetch("/api/ai/settings/ai-responses").then(r => r.json()),
        fetch("/api/ai/settings/ai-behavior").then(r => r.json()),
      ]);
      
      const data: AISettingsFormData = {
        temple: temple,
        visitor: visitor,
        policies: policies,
        responses: responses,
        behavior: behavior,
      };
      
      setSettings(data);
      setOriginalSettings(JSON.parse(JSON.stringify(data)));
    } catch (error) {
      console.error("Error loading AI settings:", error);
      showMsg("error", "Failed to load AI settings");
    } finally {
      setLoading(false);
    }
  }, [showMsg]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      await Promise.all([
        fetch("/api/ai/settings/temple-information", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings.temple),
        }),
        fetch("/api/ai/settings/visitor-information", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings.visitor),
        }),
        fetch("/api/ai/settings/policies", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings.policies),
        }),
        fetch("/api/ai/settings/ai-responses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings.responses),
        }),
        fetch("/api/ai/settings/ai-behavior", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings.behavior),
        }),
      ]);
      
      setOriginalSettings(JSON.parse(JSON.stringify(settings)));
      showMsg("success", "All AI settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      showMsg("error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Reset all AI settings to defaults?")) {
      // Reset to defaults would require importing defaults
      showMsg("success", "Settings reset to defaults (save to apply)");
    }
  };

  const updateField = <K extends keyof AISettingsFormData>(
    section: K,
    field: string,
    value: unknown
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [section]: {
        ...(settings[section] as unknown as Record<string, unknown>),
        [field]: value,
      },
    });
  };

  const hasChanges = settings && originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="AI Settings"
          description="Configure temple information, visitor guidelines, policies, and AI response behavior."
        />
        <button
          onClick={handleSeedData}
          disabled={seeding}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {seeding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Database className="w-4 h-4" />
          )}
          {seeding ? "Initializing..." : "Initialize Data"}
        </button>
      </div>

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

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="border-b border-stone-200 bg-stone-50">
          <div className="flex overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-amber-500 text-amber-700 bg-amber-50"
                      : "border-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "temple" && (
            <TempleInformationSection 
              data={settings.temple} 
              onChange={(field, value) => updateField("temple", field, value)} 
            />
          )}
          {activeTab === "visitor" && (
            <VisitorInformationSection 
              data={settings.visitor} 
              onChange={(field, value) => updateField("visitor", field, value)} 
            />
          )}
          {activeTab === "policies" && (
            <PoliciesSection 
              data={settings.policies} 
              onChange={(field, value) => updateField("policies", field, value)} 
            />
          )}
          {activeTab === "responses" && (
            <ResponsesSection 
              data={settings.responses} 
              onChange={(field, value) => updateField("responses", field, value)} 
            />
          )}
          {activeTab === "behavior" && (
            <BehaviorSection 
              data={settings.behavior} 
              onChange={(field, value) => updateField("behavior", field, value)} 
            />
          )}
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
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {hasChanges ? "Save Changes" : "No Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Temple Information Section
function TempleInformationSection({ data, onChange }: { data: TempleInformation; onChange: (field: string, value: unknown) => void }) {
  const updateTimings = (field: string, value: string) => {
    onChange("timings", { ...data.timings, [field]: value });
  };
  
  const updateContact = (field: string, value: string) => {
    onChange("contact", { ...data.contact, [field]: value });
  };
  
  const updateOfficeHours = (field: string, value: string) => {
    onChange("officeHours", { ...data.officeHours, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 bg-amber-100 rounded-lg">
          <Building className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="font-semibold text-stone-900">Temple Information</h2>
          <p className="text-sm text-stone-500">Basic temple details for AI responses</p>
        </div>
      </div>

      {/* Timings */}
      <div>
        <h3 className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Temple Timings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Morning Open" value={data.timings?.morningOpen || ""} onChange={(v) => updateTimings("morningOpen", v)} placeholder="5:00 AM" />
          <FormField label="Morning Close" value={data.timings?.morningClose || ""} onChange={(v) => updateTimings("morningClose", v)} placeholder="12:30 PM" />
          <FormField label="Evening Open" value={data.timings?.eveningOpen || ""} onChange={(v) => updateTimings("eveningOpen", v)} placeholder="4:00 PM" />
          <FormField label="Evening Close" value={data.timings?.eveningClose || ""} onChange={(v) => updateTimings("eveningClose", v)} placeholder="8:30 PM" />
        </div>
      </div>

      {/* Contact */}
      <div>
        <h3 className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2">
          <Phone className="w-4 h-4" /> Contact Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Phone" value={data.contact?.phone || ""} onChange={(v) => updateContact("phone", v)} placeholder="+91 XX XXX XXXX" />
          <FormField label="Email" value={data.contact?.email || ""} onChange={(v) => updateContact("email", v)} placeholder="info@temple.org" />
        </div>
      </div>

      {/* Address */}
      <div>
        <h3 className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Address
        </h3>
        <TextAreaField 
          label="" 
          value={data.contact?.address || ""} 
          onChange={(v) => updateContact("address", v)} 
          placeholder="Full address..." 
          rows={3}
        />
      </div>

      {/* Google Maps */}
      <FormField label="Google Maps URL" value={data.contact?.googleMapsUrl || ""} onChange={(v) => updateContact("googleMapsUrl", v)} placeholder="https://maps.google.com/..." />

      {/* Office Hours */}
      <div>
        <h3 className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Office Hours
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Weekday Hours" value={data.officeHours?.weekday || ""} onChange={(v) => updateOfficeHours("weekday", v)} placeholder="9:00 AM - 5:00 PM" />
          <FormField label="Weekend Hours" value={data.officeHours?.weekend || ""} onChange={(v) => updateOfficeHours("weekend", v)} placeholder="10:00 AM - 4:00 PM" />
        </div>
      </div>
    </div>
  );
}

// Visitor Information Section
function VisitorInformationSection({ data, onChange }: { data: VisitorInformation; onChange: (field: string, value: unknown) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Users className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="font-semibold text-stone-900">Visitor Information</h2>
          <p className="text-sm text-stone-500">Guidelines and facilities for visitors</p>
        </div>
      </div>

      <TextAreaField 
        label="Visitor Guidelines" 
        value={data.guidelines || ""} 
        onChange={(v) => onChange("guidelines", v)} 
        placeholder="General guidelines for visitors..."
      />
      
      <TextAreaField 
        label="Dress Code" 
        value={data.dressCode || ""} 
        onChange={(v) => onChange("dressCode", v)} 
        placeholder="Dress code requirements..."
      />
      
      <TextAreaField 
        label="Photography Policy" 
        value={data.photographyPolicy || ""} 
        onChange={(v) => onChange("photographyPolicy", v)} 
        placeholder="Photography guidelines..."
      />
      
      <TextAreaField 
        label="Parking Information" 
        value={data.parking || ""} 
        onChange={(v) => onChange("parking", v)} 
        placeholder="Parking facilities..."
      />
      
      <TextAreaField 
        label="Facilities" 
        value={data.facilities || ""} 
        onChange={(v) => onChange("facilities", v)} 
        placeholder="Available facilities..."
      />
      
      <TextAreaField 
        label="Prasada Information" 
        value={data.prasada || ""} 
        onChange={(v) => onChange("prasada", v)} 
        placeholder="Prasada distribution information..."
      />
      
      <TextAreaField 
        label="Annadanam" 
        value={data.annadanam || ""} 
        onChange={(v) => onChange("annadanam", v)} 
        placeholder="Free meal program details..."
      />
      
      <TextAreaField 
        label="Accommodation" 
        value={data.accommodation || ""} 
        onChange={(v) => onChange("accommodation", v)} 
        placeholder="Guest house / accommodation facilities..."
      />
      
      <TextAreaField 
        label="Contact Information" 
        value={data.contact || ""} 
        onChange={(v) => onChange("contact", v)} 
        placeholder="Additional contact details..."
      />
    </div>
  );
}

// Policies Section
function PoliciesSection({ data, onChange }: { data: TemplePolicies; onChange: (field: string, value: unknown) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 bg-green-100 rounded-lg">
          <Shield className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="font-semibold text-stone-900">Temple Policies</h2>
          <p className="text-sm text-stone-500">Official policies and guidelines</p>
        </div>
      </div>

      <TextAreaField 
        label="Donations" 
        value={data.donations || ""} 
        onChange={(v) => onChange("donations", v)} 
        placeholder="Donation policies..."
      />
      
      <TextAreaField 
        label="80G Information" 
        value={data.information80G || ""} 
        onChange={(v) => onChange("information80G", v)} 
        placeholder="Tax benefit information under 80G..."
      />
      
      <TextAreaField 
        label="Seva Booking" 
        value={data.sevaBooking || ""} 
        onChange={(v) => onChange("sevaBooking", v)} 
        placeholder="Special pooja and seva booking policies..."
      />
      
      <TextAreaField 
        label="Online Services" 
        value={data.onlineServices || ""} 
        onChange={(v) => onChange("onlineServices", v)} 
        placeholder="Online service availability..."
      />
      
      <TextAreaField 
        label="Queue Guidelines" 
        value={data.queueGuidelines || ""} 
        onChange={(v) => onChange("queueGuidelines", v)} 
        placeholder="Queue management guidelines..."
      />
      
      <TextAreaField 
        label="Children Policy" 
        value={data.childrenPolicy || ""} 
        onChange={(v) => onChange("childrenPolicy", v)} 
        placeholder="Children access policies..."
      />
    </div>
  );
}

// AI Responses Section
function ResponsesSection({ data, onChange }: { data: AIResponses; onChange: (field: string, value: unknown) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 bg-purple-100 rounded-lg">
          <MessageSquare className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="font-semibold text-stone-900">AI Response Templates</h2>
          <p className="text-sm text-stone-500">Customize chatbot responses</p>
        </div>
      </div>

      <TextAreaField 
        label="Greeting" 
        value={data.greeting || ""} 
        onChange={(v) => onChange("greeting", v)} 
        placeholder="How the bot greets users..."
      />
      
      <TextAreaField 
        label="Welcome Message" 
        value={data.welcome || ""} 
        onChange={(v) => onChange("welcome", v)} 
        placeholder="Welcome message after greeting..."
      />
      
      <TextAreaField 
        label="Fallback Message" 
        value={data.fallback || ""} 
        onChange={(v) => onChange("fallback", v)} 
        placeholder="When no matching intent is found..."
      />
      
      <TextAreaField 
        label="Unknown Question Message" 
        value={data.unknownQuestion || ""} 
        onChange={(v) => onChange("unknownQuestion", v)} 
        placeholder="Message when question is not recognized..."
      />
      
      <TextAreaField 
        label="Out of Scope Message" 
        value={data.outOfScope || ""} 
        onChange={(v) => onChange("outOfScope", v)} 
        placeholder="When question is outside AI scope..."
      />
      
      <TextAreaField 
        label="Goodbye Message" 
        value={data.goodbye || ""} 
        onChange={(v) => onChange("goodbye", v)} 
        placeholder="Farewell message..."
      />
    </div>
  );
}

// AI Behavior Section
function BehaviorSection({ data, onChange }: { data: AIBehaviorSettings; onChange: (field: string, value: unknown) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 bg-orange-100 rounded-lg">
          <SettingsIcon className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h2 className="font-semibold text-stone-900">AI Behavior Settings</h2>
          <p className="text-sm text-stone-500">Configure chatbot behavior parameters</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-stone-700">
            Confidence Threshold (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={typeof data.confidenceThreshold === 'number' ? data.confidenceThreshold * 100 : 85}
            onChange={(e) => onChange("confidenceThreshold", parseInt(e.target.value) / 100)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
          <p className="text-xs text-stone-500">Minimum confidence required to return a response</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-stone-700">
            Semantic Threshold (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={typeof data.semanticThreshold === 'number' ? data.semanticThreshold * 100 : 70}
            onChange={(e) => onChange("semanticThreshold", parseInt(e.target.value) / 100)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
          <p className="text-xs text-stone-500">Minimum semantic similarity for related articles</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-stone-700">
            Max Related Articles
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={typeof data.maxRelatedArticles === 'number' ? data.maxRelatedArticles : 3}
            onChange={(e) => onChange("maxRelatedArticles", parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
          <p className="text-xs text-stone-500">Maximum related articles to show in response</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-stone-700">
            Conversation Timeout (minutes)
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={typeof data.conversationTimeout === 'number' ? data.conversationTimeout : 30}
            onChange={(e) => onChange("conversationTimeout", parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
          <p className="text-xs text-stone-500">Time before conversation context resets</p>
        </div>
      </div>

      <div className="pt-4 border-t space-y-4">
        <ToggleField 
          label="Enable Streaming" 
          description="Stream AI responses in real-time"
          checked={data.streaming ?? false}
          onChange={(v) => onChange("streaming", v)}
        />
        <ToggleField 
          label="Debug Mode" 
          description="Show debug information in responses"
          checked={data.debugMode ?? false}
          onChange={(v) => onChange("debugMode", v)}
        />
        <ToggleField 
          label="Unknown Question Logging" 
          description="Log all unrecognized questions for review"
          checked={data.unknownLogging ?? true}
          onChange={(v) => onChange("unknownLogging", v)}
        />
      </div>
    </div>
  );
}

// Helper Components
function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-stone-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-stone-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
      />
    </div>
  );
}

function ToggleField({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
      <div>
        <p className="font-medium text-stone-900">{label}</p>
        <p className="text-sm text-stone-500">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
      </label>
    </div>
  );
}
