"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Upload, X, CheckCircle, Loader2 } from "lucide-react";
import { submitTestimonial } from "@/services/testimonial.service";
import toast from "react-hot-toast";

interface TestimonialSubmissionFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

// Helper function to generate filename from name and phone
function generatePhotoFilename(name: string, phone: string): string {
  // Convert name to lowercase, replace spaces with underscores, remove special chars
  const sanitizedName = name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  
  // Clean phone - remove all non-numeric except +
  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
  
  if (cleanPhone) {
    return `${sanitizedName}_${cleanPhone}.jpg`;
  }
  return `${sanitizedName}.jpg`;
}

export default function TestimonialSubmissionForm({ onSuccess, onClose }: TestimonialSubmissionFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    quote: "",
    phone: "",
  });
  const [image, setImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Limit file size to 2MB
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImage(result);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user", // Front camera
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Could not access camera. Please check permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Mirror the image for front camera
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setImage(dataUrl);
        setImagePreview(dataUrl);
        stopCamera();
        toast.success("Photo captured!");
      }
    }
  }, [stopCamera]);

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!formData.location.trim()) {
      toast.error("Please enter your city");
      return;
    }
    if (!formData.quote.trim()) {
      toast.error("Please share your experience");
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit with base64 image - the service will upload to Vercel Blob Storage
      const result = await submitTestimonial({
        name: formData.name.trim(),
        location: formData.location.trim(),
        quote: formData.quote.trim(),
        phone: formData.phone.trim() || undefined,
        image: image || undefined,
      });

      console.log("[TestimonialForm] Submitted successfully, ID:", result);
      setIsSubmitted(true);
      toast.success("Thank you for sharing your experience!");
      
      if (onSuccess) {
        setTimeout(onSuccess, 2000);
      }
    } catch (error) {
      console.error("Error submitting testimonial:", error);
      toast.error("Failed to submit testimonial. Please check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center shadow-xl">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-stone-900 mb-4">
          Thank You!
        </h3>
        <p className="text-stone-600 mb-6">
          Your testimonial has been submitted successfully. 
          It will be reviewed by our team and will appear on the page once approved.
        </p>
        <p className="text-sm text-stone-500 mb-6">
          ॐ Sri Raghavendraya Namaha ॐ
        </p>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  if (showCamera) {
    return (
      <div className="bg-white rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-stone-900">Take Photo</h3>
          <button
            onClick={stopCamera}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
        
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] mb-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={stopCamera}
            className="flex-1 px-4 py-3 border border-stone-300 text-stone-700 rounded-xl hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={capturePhoto}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            Capture
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-stone-900">Share Your Experience</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Photo Section */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Photo (Optional)
          </label>
          {imagePreview ? (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-32 h-32 rounded-xl object-cover border-2 border-amber-200"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-stone-300 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-colors"
              >
                <Upload className="w-5 h-5 text-stone-400" />
                <span className="text-sm text-stone-600">Upload Photo</span>
              </button>
              <button
                type="button"
                onClick={startCamera}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-stone-300 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-colors"
              >
                <Camera className="w-5 h-5 text-stone-400" />
                <span className="text-sm text-stone-600">Take Photo</span>
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <p className="text-xs text-stone-500 mt-2">
            Upload a photo or use your phone camera. Max 2MB.
          </p>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Your full name"
            className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
            required
          />
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder="e.g., Bangalore, Mysore"
            className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
            required
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Phone Number (Optional)
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="+91 98765 43210"
            className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
          />
          <p className="text-xs text-stone-500 mt-1">
            Optional - for photo filename identification
          </p>
        </div>

        {/* Experience */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Your Experience <span className="text-red-500">*</span>
          </label>
          <textarea
            name="quote"
            value={formData.quote}
            onChange={handleInputChange}
            placeholder="Share how your visit to the Matha impacted you..."
            rows={4}
            className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all resize-none"
            required
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Submit Testimonial
            </>
          )}
        </button>

        <p className="text-xs text-stone-500 text-center">
          By submitting, you agree that your testimonial may be displayed on our website.
        </p>
      </form>
    </div>
  );
}
