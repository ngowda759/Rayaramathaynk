"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Quote, QuoteCategory, QuoteLanguage, QUOTE_CATEGORIES, FestivalName, Weekday } from "@/types/quote";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

const festivalOptions: { id: FestivalName; label: string }[] = [
  { id: "raghavendra_aradhana", label: "Sri Raghavendra Aradhana" },
  { id: "guru_purnima", label: "Guru Purnima" },
  { id: "madhwa_navami", label: "Madhwa Navami" },
  { id: "vyasa_pooja", label: "Vyasa Pooja" },
  { id: "rama_navami", label: "Rama Navami" },
  { id: "krishna_janmashtami", label: "Krishna Janmashtami" },
  { id: "narasimha_jayanti", label: "Narasimha Jayanti" },
  { id: "hanuman_jayanti", label: "Hanuman Jayanti" },
  { id: "deepavali", label: "Deepavali" },
  { id: "vaikuntha_ekadashi", label: "Vaikuntha Ekadashi" },
  { id: "brahmotsava", label: "Temple Brahmotsava" },
  { id: "navaratri", label: "Navaratri" },
  { id: "mahashivaratri", label: "Mahashivaratri" },
  { id: "ratha_saptami", label: "Ratha Saptami" },
  { id: "makara_sankramana", label: "Makara Sankramana" },
];

const weekdayOptions = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const languageOptions: { value: QuoteLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "kn", label: "Kannada" },
  { value: "sa", label: "Sanskrit" },
  { value: "mixed", label: "Mixed" },
];

interface QuoteFormData {
  slug: string;
  title: string;
  category: QuoteCategory;
  priority: number;
  language: QuoteLanguage;
  content: {
    kannada?: string;
    sanskrit?: string;
    transliteration?: string;
    translationEnglish?: string;
  };
  source: string;
  author?: string;
  verseNumber?: number;
  tags: string[];
  active: boolean;
  featured: boolean;
  festivalOnly: boolean;
  festivalNames: FestivalName[];
  weekdayOnly: number | null;
  displayWeight: number;
}

const initialFormData: QuoteFormData = {
  slug: "",
  title: "",
  category: "raghavendra_stotra",
  priority: 5,
  language: "kn",
  content: {
    kannada: "",
    sanskrit: "",
    transliteration: "",
    translationEnglish: "",
  },
  source: "",
  author: "",
  verseNumber: undefined,
  tags: [],
  active: true,
  featured: false,
  festivalOnly: false,
  festivalNames: [],
  weekdayOnly: null,
  displayWeight: 1,
};

export default function NewQuotePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<QuoteFormData>(initialFormData);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleContentChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        [field]: value,
      },
    }));
  };

  const handleFestivalToggle = (festival: FestivalName) => {
    setFormData((prev) => ({
      ...prev,
      festivalNames: prev.festivalNames.includes(festival)
        ? prev.festivalNames.filter((f) => f !== festival)
        : [...prev.festivalNames, festival],
    }));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const generateSlug = () => {
    const slug = formData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    handleChange("slug", slug);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!formData.category) {
      newErrors.category = "Category is required";
    }

    if (!formData.source.trim()) {
      newErrors.source = "Source is required";
    }

    if (!formData.content.kannada?.trim() && 
        !formData.content.sanskrit?.trim() && 
        !formData.content.translationEnglish?.trim()) {
      newErrors.content = "At least one content field is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Please fix the errors before submitting.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/admin/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          slug: formData.slug || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create quote");
      }

      toast.success("Quote created successfully!");
      router.push("/admin/quotes");
    } catch (error: any) {
      console.error("Failed to create quote:", error);
      toast.error(error.message || "Failed to create quote.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Add New Quote"
        description="Create a new devotional quote, stotram, or spiritual teaching."
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/quotes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Quotes
            </Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Basic Information</h3>
          
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                onBlur={generateSlug}
                placeholder="e.g., Sri Raghavendra Stotra - Verse 1"
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => handleChange("slug", e.target.value)}
                placeholder="auto-generated-from-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleChange("category", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {QUOTE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {QUOTE_CATEGORIES.find((c) => c.id === formData.category)?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Primary Language</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => handleChange("language", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">
                Source <span className="text-destructive">*</span>
              </Label>
              <Input
                id="source"
                value={formData.source}
                onChange={(e) => handleChange("source", e.target.value)}
                placeholder="e.g., Sri Raghavendra Stotra"
              />
              {errors.source && (
                <p className="text-sm text-destructive">{errors.source}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                value={formData.author || ""}
                onChange={(e) => handleChange("author", e.target.value)}
                placeholder="e.g., Sri Appannacharya"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="verseNumber">Verse Number</Label>
              <Input
                id="verseNumber"
                type="number"
                value={formData.verseNumber || ""}
                onChange={(e) =>
                  handleChange(
                    "verseNumber",
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority (1-10, lower = higher)</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) =>
                  handleChange("priority", parseInt(e.target.value) || 5)
                }
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Quote Content</h3>
          
          {errors.content && (
            <p className="mb-4 text-sm text-destructive">{errors.content}</p>
          )}

          <Tabs defaultValue="kannada" className="space-y-4">
            <TabsList>
              <TabsTrigger value="kannada">Kannada</TabsTrigger>
              <TabsTrigger value="sanskrit">Sanskrit</TabsTrigger>
              <TabsTrigger value="transliteration">Transliteration</TabsTrigger>
              <TabsTrigger value="english">English Translation</TabsTrigger>
            </TabsList>

            <TabsContent value="kannada">
              <Textarea
                value={formData.content.kannada || ""}
                onChange={(e) => handleContentChange("kannada", e.target.value)}
                placeholder="Enter Kannada text..."
                className="min-h-[150px] font-kannada"
              />
            </TabsContent>

            <TabsContent value="sanskrit">
              <Textarea
                value={formData.content.sanskrit || ""}
                onChange={(e) => handleContentChange("sanskrit", e.target.value)}
                placeholder="Enter Sanskrit/Devanagari text..."
                className="min-h-[150px]"
              />
            </TabsContent>

            <TabsContent value="transliteration">
              <Textarea
                value={formData.content.transliteration || ""}
                onChange={(e) => handleContentChange("transliteration", e.target.value)}
                placeholder="Enter IAST transliteration..."
                className="min-h-[150px]"
              />
            </TabsContent>

            <TabsContent value="english">
              <Textarea
                value={formData.content.translationEnglish || ""}
                onChange={(e) =>
                  handleContentChange("translationEnglish", e.target.value)
                }
                placeholder="Enter English translation..."
                className="min-h-[150px]"
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Tags */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Tags</h3>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Add a tag..."
            />
            <Button type="button" variant="outline" onClick={handleAddTag}>
              Add Tag
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Press Enter or click Add Tag to add. Tags help with search and categorization.
          </p>
        </div>

        {/* Display Rules */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Display Rules</h3>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => handleChange("active", checked)}
                />
                <Label htmlFor="active">Active</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="featured"
                  checked={formData.featured}
                  onCheckedChange={(checked) => handleChange("featured", checked)}
                />
                <Label htmlFor="featured">Featured</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="festivalOnly"
                  checked={formData.festivalOnly}
                  onCheckedChange={(checked) =>
                    handleChange("festivalOnly", checked)
                  }
                />
                <Label htmlFor="festivalOnly">Festival Only</Label>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weekdayOnly">Specific Weekday</Label>
                <Select
                  value={formData.weekdayOnly?.toString() || "none"}
                  onValueChange={(value) =>
                    handleChange(
                      "weekdayOnly",
                      value === "none" ? null : (parseInt(value!, 10) as Weekday)
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any day</SelectItem>
                    {weekdayOptions.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayWeight">Display Weight</Label>
                <Input
                  id="displayWeight"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.displayWeight}
                  onChange={(e) =>
                    handleChange("displayWeight", parseInt(e.target.value) || 1)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Higher weight = more likely to be selected
                </p>
              </div>
            </div>

            {formData.festivalOnly && (
              <div className="space-y-2">
                <Label>Associated Festivals</Label>
                <div className="grid gap-2 md:grid-cols-3">
                  {festivalOptions.map((festival) => (
                    <div key={festival.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={festival.id}
                        checked={formData.festivalNames.includes(festival.id)}
                        onCheckedChange={() => handleFestivalToggle(festival.id)}
                      />
                      <Label htmlFor={festival.id} className="text-sm">
                        {festival.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/quotes")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Quote"}
          </Button>
        </div>
      </form>
    </div>
  );
}
