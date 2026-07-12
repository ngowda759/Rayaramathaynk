"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import { shlokas, shlokaCategories } from "@/data/shlokas";
import { ChevronDown, ChevronUp, BookOpen, Moon } from "lucide-react";

export default function ShlokasPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedShloka, setExpandedShloka] = useState<string | null>(null);
  const [isAvailable] = useState(() => {
    const hour = new Date().getHours();
    return hour < 23;
  });

  const filteredShlokas = selectedCategory === "All"
    ? shlokas
    : shlokas.filter(s => s.category === selectedCategory);

  const toggleShloka = (id: string) => {
    setExpandedShloka(expandedShloka === id ? null : id);
  };

  // Show unavailable message after 11 PM
  if (!isAvailable) {
    return (
      <>
        <Navbar />
        <main className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-amber-50 to-white px-6 py-12 sm:px-8 lg:px-12 flex items-center justify-center">
          <div className="max-w-md text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 text-orange-600 mb-6">
              <Moon className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900 mb-4">
              ಶ್ಲೋಕಗಳು ಲಭ್ಯವಿಲ್ಲ
            </h1>
            <h2 className="text-xl text-stone-700 mb-4">
              Shlokas Not Available
            </h2>
            <p className="text-stone-600 mb-6">
              ಶ್ಲೋಕಗಳನ್ನು ರಾತ್ರಿ 11 ಗಂಟೆಯ ನಂತರ ವೀಕ್ಷಿಸಲಾಗುವುದಿಲ್ಲ.
            </p>
            <p className="text-stone-500 text-sm">
              Shlokas can only be viewed before 11:00 PM as per temple tradition. 
              Please visit again tomorrow.
            </p>
            <p className="text-amber-600 mt-6 font-medium">
              🙏 ಓಂ ಶಾಂತಿಃ ಶಾಂತಿಃ ಶಾಂತಿಃ 🙏
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-amber-50 to-white px-6 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <Breadcrumb current="Shlokas" />
        </div>
        <SectionHeading
          title="ಶ್ಲೋಕಗಳು / Shlokas & Stotrams"
          subtitle="Sacred hymns and prayers for daily worship"
        />

        {/* Om Symbol */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-white text-3xl font-bold shadow-lg">
            ಓಂ
          </div>
        </div>

        {/* Category Filter */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {shlokaCategories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category
                    ? "bg-orange-600 text-white shadow-md"
                    : "bg-white text-stone-600 border border-stone-200 hover:border-orange-300 hover:text-orange-600"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Shlokas List */}
        <div className="max-w-4xl mx-auto space-y-4">
          {filteredShlokas.map((shloka) => (
            <div
              key={shloka.id}
              className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md"
            >
              <button
                onClick={() => toggleShloka(shloka.id)}
                className="w-full p-5 flex items-center justify-between text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 text-orange-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">
                      {shloka.title}
                    </h3>
                    <p className="text-sm text-orange-700 mt-0.5">
                      {shloka.titleKannada}
                    </p>
                    <span className="inline-block mt-2 text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full">
                      {shloka.category}
                    </span>
                    {shloka.author && (
                      <p className="text-xs text-stone-500 mt-1 italic">
                        by {shloka.author}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                  {expandedShloka === shloka.id ? (
                    <ChevronUp className="w-5 h-5 text-stone-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-stone-400" />
                  )}
                </div>
              </button>

              {expandedShloka === shloka.id && (
                <div className="px-5 pb-5 border-t border-stone-100 pt-4">
                  {shloka.meaning && (
                    <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-sm text-stone-600 italic">
                        {shloka.meaning}
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {shloka.verses.map((verse, index) => (
                      <p
                        key={index}
                        className={`font-serif text-lg leading-relaxed text-stone-800 ${
                          verse.startsWith("ಪ್ರಭಾತ") || verse.includes("ಶ್ಲೋಕ:")
                            ? "text-orange-700 font-medium bg-orange-50 px-3 py-2 rounded-lg"
                            : "pl-4 border-l-2 border-orange-200"
                        }`}
                      >
                        {verse}
                      </p>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-stone-100 text-center">
                    <p className="text-sm text-stone-500">
                      ಓಂ ಶಾಂತಿಃ ಶಾಂತಿಃ ಶಾಂತಿಃ | Om Shanti Shanti Shanti
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredShlokas.length === 0 && (
          <div className="text-center py-12 text-stone-500">
            <p>No shlokas found in this category.</p>
          </div>
        )}

        {/* Footer Note */}
        <div className="max-w-4xl mx-auto mt-12 p-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-100 text-center">
          <p className="text-stone-700 font-medium">
            🙏 ಓಂ ಸಹ ನಾವವತು | ಸಹ ನೌ ಭುನಕ್ತು | ಸಹ ವೀರ್ಯಂ ಕರವಾವಹೈ 🙏
          </p>
          <p className="text-sm text-stone-600 mt-2">
            May we all be blessed with peace, prosperity, and divine knowledge.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
