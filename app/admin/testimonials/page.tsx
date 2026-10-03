"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Star, 
  X, 
  Plus,
  Image as ImageIcon,
  Search,
  Edit2,
  ExternalLink,
  FolderOpen,
  CheckCircle,
  Check,
  XCircle,
  AlertTriangle,
  Filter
} from "lucide-react";
import { 
  getAllTestimonials, 
  createTestimonial, 
  updateTestimonial,
  deleteTestimonial,
  approveTestimonial,
  rejectTestimonial
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
  const [imageError, setImageError] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
    // Load testimonials on mount - this is intentional for initial data fetch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTestimonials();
  }, [loadTestimonials]);

  const filteredTestimonials = testimonials.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.quote.toLowerCase().includes(searchQuery.toLowerCase());
    
    switch (filter) {
      case "pending":
        return matchesSearch && !t.approved && !t.rejected;
      case "approved":
        return matchesSearch && t.approved;
      case "rejected":
        return matchesSearch && t.rejected;
      default:
        return matchesSearch;
    }
  });

  async function handleApprove(id: string) {
    try {
      await approveTestimonial(id);
      toast.success("Testimonial approved!");
      loadTestimonials();
    } catch (error) {
      toast.error("Failed to approve testimonial");
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectTestimonial(id, rejectReason);
      toast.success("Testimonial rejected");
      setRejectingId(null);
      setRejectReason("");
      loadTestimonials();
    } catch (error) {
      toast.error("Failed to reject testimonial");
    }
  }

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
      setImageError(false);
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
      setImageError(false);
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
    setImageError(false);
  }

  function handleImageChange(value: string) {
    setFormData({ ...formData, image: value });
    setImagePreview(value || null);
    setImageError(false);
  }

  // Convert filename to full path
  function getImageSrc(src: string): string {
    if (!src) return "";
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return src;
    }
    if (src.startsWith("/")) {
      return src;
    }
    // Images stored in public/images/testimonials/ folder
    return `/images/testimonials/${src}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.name || !formData.location || !formData.quote || !formData.years) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // Prepare testimonial data
      const testimonialData = {
        name: formData.name.trim(),
        location: formData.location.trim(),
        quote: formData.quote.trim(),
        years: formData.years.trim(),
        image: formData.image.trim() || undefined,
      };

      if (editingTestimonial) {
        // Include approved status if editing
        await updateTestimonial(editingTestimonial.id, {
          ...testimonialData,
          approved: editingTestimonial.approved ?? false,
        });
        toast.success("Testimonial updated successfully!");
      } else {
        await createTestimonial(testimonialData);
        toast.success("Testimonial created successfully!");
      }
      closeModal();
      loadTestimonials();
    } catch (error) {
      console.error("Error saving testimonial:", error);
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

      {/* Instructions */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="flex items-start gap-3">
          <FolderOpen className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Image Upload Instructions</p>
            <p className="text-amber-700 mt-1">
              Upload images to <code className="bg-amber-100 px-1 rounded">public/images/testimonials/</code> folder in your GitHub repository.
              Then enter the filename below (e.g., <code className="bg-amber-100 px-1 rounded">name_phone.jpg</code>) or the full path.
            </p>
          </div>
        </div>
      </div>

      {/* Firestore Notice */}
      <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-green-800">Data synced to Firestore</p>
            <p className="text-green-700 mt-1">
              Testimonials are saved to Firestore and will appear consistently on all devices (mobile, tablet, desktop).
              New submissions require approval before appearing on the public page.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 max-w-md">
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
        
        {/* Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-stone-400" />
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-stone-800 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            All ({testimonials.length})
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "pending"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            Pending ({testimonials.filter(t => !t.approved && !t.rejected).length})
          </button>
          <button
            onClick={() => setFilter("approved")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "approved"
                ? "bg-green-600 text-white"
                : "bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            Approved ({testimonials.filter(t => t.approved).length})
          </button>
          <button
            onClick={() => setFilter("rejected")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "rejected"
                ? "bg-red-600 text-white"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            Rejected ({testimonials.filter(t => t.rejected).length})
          </button>
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
              className={`bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-shadow ${
                testimonial.rejected 
                  ? "border-red-200" 
                  : testimonial.approved 
                    ? "border-green-200" 
                    : "border-stone-200"
              }`}
            >
              {/* Image Header */}
              <div className="relative h-32 bg-gradient-to-br from-amber-100 to-orange-100">
                {testimonial.image ? (
                  <Image
                    src={getImageSrc(testimonial.image)}
                    alt={testimonial.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-6xl">🙏</div>
                  </div>
                )}
                {/* Submitted by badge */}
                {testimonial.submittedBy === "public" && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
                    Public
                  </div>
                )}
                {testimonial.submittedBy === "admin" && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-purple-500 text-white text-xs font-medium rounded-full">
                    Admin
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-stone-900">{testimonial.name}</h3>
                    <p className="text-sm text-stone-500">{testimonial.location}</p>
                    {testimonial.phone && (
                      <p className="text-xs text-stone-400 mt-1">📞 {testimonial.phone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Status Badge */}
                    {testimonial.approved && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        <Check className="w-3 h-3" />
                        Approved
                      </span>
                    )}
                    {testimonial.rejected && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                        <X className="w-3 h-3" />
                        Rejected
                      </span>
                    )}
                    {!testimonial.approved && !testimonial.rejected && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Rejection Reason */}
                {testimonial.rejected && testimonial.rejectionReason && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <strong>Reason:</strong> {testimonial.rejectionReason}
                  </div>
                )}

                <blockquote className="text-sm text-stone-600 italic line-clamp-3 mb-4">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>

                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  <Star className="w-3 h-3" />
                  {testimonial.years}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
                  <div className="flex items-center gap-2">
                    {!testimonial.approved && !testimonial.rejected && (
                      <>
                        <button
                          onClick={() => handleApprove(testimonial.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(testimonial.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                          Reject
                        </button>
                      </>
                    )}
                    {testimonial.rejected && (
                      <button
                        onClick={() => handleApprove(testimonial.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Approve Instead
                      </button>
                    )}
                    {testimonial.approved && (
                      <button
                        onClick={() => setRejectingId(testimonial.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </button>
                    )}
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectingId && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setRejectingId(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900">Reject Testimonial</h3>
                  <p className="text-sm text-stone-500">Are you sure you want to reject this testimonial?</p>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Reason for rejection (optional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this testimonial is being rejected..."
                  rows={3}
                  className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setRejectingId(null)}
                  className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(rejectingId)}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
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
                
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  {/* Image Preview */}
                  <div className="flex-shrink-0">
                    <div className="relative w-32 h-32 rounded-xl border-2 border-dashed border-stone-300 overflow-hidden bg-stone-50">
                      {imagePreview ? (
                        <Image
                          src={getImageSrc(imagePreview)}
                          alt="Preview"
                          fill
                          className="object-cover"
                          onError={() => setImageError(true)}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-400">
                          <ImageIcon className="w-8 h-8 mb-2" />
                          <span className="text-xs">No image</span>
                        </div>
                      )}
                      {imagePreview && imageError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-100 text-stone-500 text-xs text-center p-2">
                          <span>Image not found</span>
                          <span className="text-[10px] mt-1">Check if file exists</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Image Path Input */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">
                        Image Filename or Path
                      </label>
                      <input
                        type="text"
                        value={formData.image}
                        onChange={(e) => handleImageChange(e.target.value)}
                        placeholder="devotee-1.jpg or /testimonials/devotee-1.jpg"
                        className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    
                    <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                      <p className="font-medium mb-1">📁 Save images to GitHub:</p>
                      <code className="block bg-amber-100 px-2 py-1 rounded mt-1">
                        public/testimonials/
                      </code>
                      <p className="mt-2">Examples:</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li><code className="bg-amber-100 px-1 rounded">devotee-1.jpg</code></li>
                        <li><code className="bg-amber-100 px-1 rounded">/testimonials/devotee-1.png</code></li>
                        <li><code className="bg-amber-100 px-1 rounded">https://example.com/photo.jpg</code></li>
                      </ul>
                    </div>
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

                {/* Approved Checkbox */}
                {editingTestimonial && (
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingTestimonial.approved || false}
                        onChange={(e) => {
                          setEditingTestimonial({
                            ...editingTestimonial,
                            approved: e.target.checked
                          });
                        }}
                        className="w-5 h-5 text-green-600 border-stone-300 rounded focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-stone-700">
                        Approved for public display
                      </span>
                    </label>
                    <p className="mt-1 text-xs text-stone-500 ml-8">
                      Only approved testimonials will appear on the public page
                    </p>
                  </div>
                )}
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
