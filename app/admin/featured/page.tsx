"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Star,
  StarOff,
  Calendar,
  Image as ImageIcon,
  BookOpen,
  Heart,
  Sparkles,
  ChevronRight,
  GripVertical,
  Plus,
  X,
  Save,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit,
  ToggleLeft,
  ToggleRight,
  Clock,
  ExternalLink
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  getDocs, 
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

interface FeaturedItem {
  id: string;
  contentId: string;
  contentType: "event" | "announcement" | "seva" | "knowledge" | "gallery" | "custom";
  title: string;
  description?: string;
  imageUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
  priority: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ContentOption {
  id: string;
  type: "event" | "announcement" | "seva" | "knowledge" | "gallery";
  title: string;
  imageUrl?: string;
  linkUrl: string;
}

const defaultFeatured: FeaturedItem[] = [
  {
    id: "1",
    contentId: "hero-banner",
    contentType: "custom",
    title: "Welcome to Sri Raghavendra Swamy Matha",
    description: "Experience divine peace and spirituality at our sacred temple",
    imageUrl: "/images/Hero.jpg",
    linkUrl: "/journey",
    linkLabel: "Plan Your Visit",
    priority: 1,
    isActive: true,
  },
  {
    id: "2",
    contentId: "donation-cta",
    contentType: "custom",
    title: "Support Our Mission",
    description: "Your contributions help maintain the temple and serve the community",
    linkUrl: "/donation",
    linkLabel: "Donate Now",
    priority: 2,
    isActive: true,
  },
];

export default function FeaturedContentPage() {
  const { profile } = useAuth();
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>(defaultFeatured);
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadFeaturedContent = useCallback(async () => {
    setLoading(true);
    try {
      // Load featured items from Firestore
      if (db) {
        const featuredSnap = await getDocs(
          query(collection(db, "featuredContent"), orderBy("priority", "asc"))
        );
        
        if (!featuredSnap.empty) {
          const items: FeaturedItem[] = [];
          featuredSnap.docs.forEach(doc => {
            const data = doc.data();
            items.push({
              id: doc.id,
              contentId: data.contentId,
              contentType: data.contentType,
              title: data.title,
              description: data.description,
              imageUrl: data.imageUrl,
              linkUrl: data.linkUrl,
              linkLabel: data.linkLabel,
              priority: data.priority,
              isActive: data.isActive ?? true,
              startDate: data.startDate?.toDate?.() || undefined,
              endDate: data.endDate?.toDate?.() || undefined,
              createdAt: data.createdAt?.toDate?.(),
              updatedAt: data.updatedAt?.toDate?.(),
            });
          });
          if (items.length > 0) {
            setFeaturedItems(items);
          }
        }
      }

      // Load content options for selection
      const options: ContentOption[] = [];
      
      if (db) {
        const [eventsSnap, announcementsSnap, sevasSnap, knowledgeSnap] = await Promise.all([
          getDocs(collection(db, "events")),
          getDocs(collection(db, "announcements")),
          getDocs(collection(db, "sevas")),
          getDocs(collection(db, "knowledge")),
        ]);

        eventsSnap.docs.forEach(doc => {
          const data = doc.data();
          options.push({
            id: doc.id,
            type: "event",
            title: data.title || "Untitled Event",
            imageUrl: data.imageUrl,
            linkUrl: `/events/${doc.id}`,
          });
        });

        announcementsSnap.docs.forEach(doc => {
          const data = doc.data();
          options.push({
            id: doc.id,
            type: "announcement",
            title: data.title || "Untitled Announcement",
            imageUrl: data.imageUrl,
            linkUrl: `/announcements/${doc.id}`,
          });
        });

        sevasSnap.docs.forEach(doc => {
          const data = doc.data();
          options.push({
            id: doc.id,
            type: "seva",
            title: data.name || data.title || "Untitled Seva",
            imageUrl: data.imageUrl,
            linkUrl: `/sevas`,
          });
        });

        knowledgeSnap.docs.forEach(doc => {
          const data = doc.data();
          options.push({
            id: doc.id,
            type: "knowledge",
            title: data.title?.en || data.title || "Untitled Article",
            imageUrl: data.image,
            linkUrl: `/knowledge/article/${doc.id}`,
          });
        });
      }

      setContentOptions(options);
    } catch (error) {
      console.error("Error loading featured content:", error);
      setFeaturedItems(defaultFeatured);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Data fetching pattern
    loadFeaturedContent();
  }, [loadFeaturedContent]);

  const saveChanges = async () => {
    if (!db) return;
    
    setSaving(true);
    try {
      // Save to Firestore - in production, you'd batch these operations
      for (const item of featuredItems) {
        if (item.id.startsWith("new-")) {
          // New item - create it
          await addDoc(collection(db, "featuredContent"), {
            contentId: item.contentId,
            contentType: item.contentType,
            title: item.title,
            description: item.description,
            imageUrl: item.imageUrl,
            linkUrl: item.linkUrl,
            linkLabel: item.linkLabel,
            priority: item.priority,
            isActive: item.isActive,
            startDate: item.startDate ? new Date(item.startDate) : null,
            endDate: item.endDate ? new Date(item.endDate) : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Existing item - update it
          await updateDoc(doc(db, "featuredContent", item.id), {
            priority: item.priority,
            isActive: item.isActive,
            updatedAt: serverTimestamp(),
          });
        }
      }
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving featured content:", error);
    } finally {
      setSaving(false);
    }
  };

  const addNewItem = (option: ContentOption) => {
    const newItem: FeaturedItem = {
      id: `new-${Date.now()}`,
      contentId: option.id,
      contentType: option.type,
      title: option.title,
      imageUrl: option.imageUrl,
      linkUrl: option.linkUrl,
      linkLabel: option.type.charAt(0).toUpperCase() + option.type.slice(1),
      priority: featuredItems.length + 1,
      isActive: true,
    };
    setFeaturedItems([...featuredItems, newItem]);
    setHasChanges(true);
    setShowAddModal(false);
  };

  const addCustomItem = () => {
    const newItem: FeaturedItem = {
      id: `new-${Date.now()}`,
      contentId: "custom",
      contentType: "custom",
      title: "New Featured Item",
      description: "",
      linkUrl: "/",
      linkLabel: "Learn More",
      priority: featuredItems.length + 1,
      isActive: true,
    };
    setFeaturedItems([...featuredItems, newItem]);
    setHasChanges(true);
  };

  const removeItem = (id: string) => {
    setFeaturedItems(featuredItems.filter(item => item.id !== id));
    setHasChanges(true);
  };

  const toggleActive = (id: string) => {
    setFeaturedItems(featuredItems.map(item => 
      item.id === id ? { ...item, isActive: !item.isActive } : item
    ));
    setHasChanges(true);
  };

  const moveItem = (id: string, direction: "up" | "down") => {
    const index = featuredItems.findIndex(item => item.id === id);
    if (direction === "up" && index > 0) {
      const newItems = [...featuredItems];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      // Update priorities
      newItems.forEach((item, i) => item.priority = i + 1);
      setFeaturedItems(newItems);
      setHasChanges(true);
    } else if (direction === "down" && index < featuredItems.length - 1) {
      const newItems = [...featuredItems];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      // Update priorities
      newItems.forEach((item, i) => item.priority = i + 1);
      setFeaturedItems(newItems);
      setHasChanges(true);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "event":
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case "announcement":
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case "seva":
        return <Heart className="w-4 h-4 text-red-500" />;
      case "knowledge":
        return <BookOpen className="w-4 h-4 text-emerald-500" />;
      case "gallery":
        return <ImageIcon className="w-4 h-4 text-purple-500" />;
      default:
        return <Star className="w-4 h-4 text-amber-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 p-6">
        <div className="max-w-4xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-stone-200 rounded w-1/4" />
          <div className="h-64 bg-stone-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-stone-500 mb-2">
            <Link href="/admin" className="hover:text-amber-600">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-stone-700">Featured Content</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 flex items-center gap-3">
                <Star className="w-8 h-8 text-amber-500" />
                Featured Content
              </h1>
              <p className="text-stone-600 mt-1">
                Manage highlighted content and banners
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasChanges && (
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Content
              </button>
            </div>
          </div>
        </div>

        {/* Featured Items */}
        <div className="space-y-4">
          {featuredItems.map((item, index) => (
            <div
              key={item.id}
              className={`bg-white rounded-xl border ${item.isActive ? "border-stone-200" : "border-stone-200 opacity-60"} overflow-hidden`}
            >
              <div className="flex items-stretch">
                {/* Drag Handle & Image */}
                <div className="flex items-center gap-3 p-4 border-r border-stone-100">
                  <GripVertical className="w-5 h-5 text-stone-400 cursor-grab" />
                  <div className="w-16 h-16 rounded-lg bg-stone-100 overflow-hidden relative flex-shrink-0">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.title} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getTypeIcon(item.contentType)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeIcon(item.contentType)}
                        <span className="text-xs font-medium text-stone-500 uppercase">
                          {item.contentType}
                        </span>
                        {!item.isActive && (
                          <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-500 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-stone-900 truncate">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-stone-500 mt-1 line-clamp-1">{item.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-stone-400">
                        <span className="flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          {item.linkUrl}
                        </span>
                        {item.linkLabel && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
                            {item.linkLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleActive(item.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          item.isActive 
                            ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200" 
                            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                        }`}
                        title={item.isActive ? "Active - Click to deactivate" : "Inactive - Click to activate"}
                      >
                        {item.isActive ? (
                          <ToggleRight className="w-5 h-5" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => moveItem(item.id, "up")}
                        disabled={index === 0}
                        className="p-2 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
                        title="Move up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveItem(item.id, "down")}
                        disabled={index === featuredItems.length - 1}
                        className="p-2 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 disabled:opacity-30"
                        title="Move down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {featuredItems.length === 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
              <StarOff className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-stone-700 mb-2">No featured content</h3>
              <p className="text-stone-500 mb-4">
                Start adding featured content to highlight important items on your site
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                <Plus className="w-5 h-5" />
                Add Featured Content
              </button>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-2">💡 Tips</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Featured content appears on the homepage and relevant pages</li>
            <li>• Use priority order to control display sequence</li>
            <li>• Toggle active status to temporarily hide content without removing it</li>
            <li>• Images are recommended for better visual appeal (recommended size: 1200x600px)</li>
          </ul>
        </div>
      </div>

      {/* Add Content Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h3 className="font-semibold text-stone-900">Add Featured Content</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-auto">
              {/* Custom Content Option */}
              <div className="mb-6">
                <button
                  onClick={addCustomItem}
                  className="w-full p-4 border-2 border-dashed border-stone-300 rounded-xl text-left hover:border-amber-400 hover:bg-amber-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Plus className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-stone-700">Create Custom Banner</p>
                      <p className="text-sm text-stone-500">Design a custom featured banner</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Content Type Tabs */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-stone-600">Select from existing content:</h4>
                
                {["event", "announcement", "seva", "knowledge"].map(type => (
                  <div key={type}>
                    <p className="text-xs font-medium text-stone-500 uppercase mb-2 flex items-center gap-2">
                      {getTypeIcon(type)}
                      {type}s
                    </p>
                    <div className="space-y-2">
                      {contentOptions
                        .filter(opt => opt.type === type)
                        .slice(0, 5)
                        .map(option => (
                          <button
                            key={option.id}
                            onClick={() => addNewItem(option)}
                            className="w-full flex items-center gap-3 p-3 border border-stone-200 rounded-lg hover:bg-stone-50 hover:border-amber-300 transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded bg-stone-100 overflow-hidden relative flex-shrink-0">
                              {option.imageUrl ? (
                                <Image src={option.imageUrl} alt="" fill className="object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {getTypeIcon(type)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-stone-700 truncate">{option.title}</p>
                              <p className="text-xs text-stone-400 truncate">{option.linkUrl}</p>
                            </div>
                            <Plus className="w-5 h-5 text-stone-400" />
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
