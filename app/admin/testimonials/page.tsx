"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Star, 
  Check, 
  X, 
  Plus,
  Upload,
  Image as ImageIcon,
  Search,
  Edit2,
  ExternalLink
} from "lucide-react";
import { 
  getAllTestimonials, 
  createTestimonial, 
  updateTestimonial,
  deleteTestimonial 
} from "@/services/testimonial.service";
import { Testimonial } from "@/types/homepage";
import toast from "react-hot-toast";
import Image from "next/image";
import Link from "next/link";

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    quote: "",
    years: "",
    image: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const loadTestimonials = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllTestimonials();
      setTestimonials(data);
    } catch (err) {
      console.error("Failed to load testimonials:", err);
      toast.error("Failed to load testimonials");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTestimonials();
  }, [loadTestimonials]);

  const filteredTestimonials = testimonials.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.quote.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function openModal(testimonial?: Testimonial) {
    if (testimonial) {
      setEditingTestimonial(testimonial);
      setFormData({
        name: testimonial.name,
        location: testimonial.location,
        quote: testimonial.quote,
        years: testimonial.years,
        image: testimonial.image || "",
      });
      setImagePreview(testimonial.image || null);
    } else {
      setEditingTestimonial(null);
      setFormData({
        name: "",
        location: "",
        quote: "",
        years: "",
        image: "",
      });
      setImagePreview(null);
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingTestimonial(null);
    setFormData({
      name: "",
      location: "",
      quote: "",
      years: "",
      image: "",
    });
    setImagePreview(null);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setFormData({ ...formData, image: value });
    setImagePreview(value || null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name || !formData.location || !formData.quote || !formData.years) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingTestimonial) {
        await updateTestimonial(editingTestimonial.id, {
          name: formData.name,
          location: formData.location,
          quote: formData.quote,
          years: formData.years,
          image: formData.image || undefined,
        });
        toast.success("Testimonial updated successfully!");
      } else {
        await createTestimonial({
          name: formData.name,
          location: formData.location,
          quote: formData.quote,
          years: formData.years,
          image: formData.image || undefined,
        });
        toast.success("Testimonial created successfully!");
      }
      closeModal();
      loadTestimonials();
    } catch {
      toast.error("Failed to save testimonial");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this testimonial?")) return;
    try {
      await deleteTestimonial(id);
      toast.success("Testimonial deleted");
      loadTestimonials();
    } catch {
      toast.error("Failed to delete testimonial");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Testimonials</h1>
          <p className="text-stone-500 mt-1">
            Manage devotee testimonials for the public page
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/testimonials"
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Public Page
          </Link>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Testimonial
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search testimonials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Testimonials Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
        </div>
      ) : filteredTestimonials.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
          <Star className="w-12 h-12 mx-auto mb-4 text-stone-300" />
          <p className="text-stone-500">No testimonials found</p>
          <button
            onClick={() => openModal()}
            className="mt-4 text-amber-600 hover:text-amber-700 font-medium"
          >
            Add your first testimonial
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTestimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Image Header */}
              <div className="relative h-32 bg-gradient-to-br from-amber-100 to-orange-100">
                {testimonial.image ? (
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-6xl">🙏</div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-stone-900">{testimonial.name}</h3>
                    <p className="text-sm text-stone-500">{testimonial.location}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openModal(testimonial)}
                      className="p-2 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(testimonial.id)}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <blockquote className="text-sm text-stone-600 italic line-clamp-3 mb-4">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>

                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  <Star className="w-3 h-3" />
                  {testimonial.years}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-stone-900">
                {editingTestimonial ? "Edit Testimonial" : "Add New Testimonial"}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Image Upload Section */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-stone-700">
                  Profile Image
                </label>
                
                <div className="flex items-start gap-6">
                  {/* Image Preview */}
                  <div className="flex-shrink-0">
                    <div className="relative w-32 h-32 rounded-xl border-2 border-dashed border-stone-300 overflow-hidden bg-stone-50">
                      {imagePreview ? (
                        <Image
                          src={imagePreview}
                          alt="Preview"
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-400">
                          <ImageIcon className="w-8 h-8 mb-2" />
                          <span className="text-xs">No image</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Image URL Input */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">
                        Image URL
                      </label>
                      <input
                        type="url"
                        value={formData.image}
                        onChange={handleImageChange}
                        placeholder="https://example.com/image.jpg"
                        className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <p className="text-xs text-stone-500">
                      Enter an image URL from the web or upload an image to the gallery and paste the URL here.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Devotee name"
                    className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="City, State"
                    className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Duration / Badge <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.years}
                    onChange={(e) => setFormData({ ...formData, years: e.target.value })}
                    placeholder="e.g., 10 years devotee, Regular visitor"
                    className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Quote / Testimonial <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.quote}
                    onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                    placeholder="Share the devotee's experience..."
                    rows={4}
                    className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
                >
                  {editingTestimonial ? "Update" : "Create"} Testimonial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
