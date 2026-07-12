import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import { BookOpen, Sparkles } from "lucide-react";

const guruParampara = [
  {
    number: "01",
    name: "Madwacharyaru",
    kannada:
      "ಬ್ರಹ್ಮಾಂತಾಗುರವ: ಸಾಕ್ಷಾದಿಷ್ಟಂ ದೈವಂ ಶ್ರೀಯ:ಪತಿ: ಆಚಾರ್ಯಾ: ಶ್ರೀಮದಾಚಾರ್ಯಾ: ಸಂತುಮೇ ಜನ್ಮ ಜನ್ಮನಿ ||",
    description:
      "The great preceptor who is the very essence of the Vedas, the divine master of all, the supreme teacher - Sri Madhvacharya",
  },
  {
    number: "02",
    name: "Padmanabha Teertharu",
    kannada:
      "ಪೂರ್ಣಪ್ರಜ್ಞ ಕೃತಂ ಭಾಷ್ಯಾಮಾದೌ ತದ್ಭಾವಪೂರ್ವಕಂ ಯೋ ವ್ಯಾಕರೋನ್ನಮಸ್ಮೈ ಪದ್ಮನಾಭಾಖ್ಯ ಯೋಗಿನೇ ||",
    description:
      "The learned scholar who composed the bhashya (commentary) with complete knowledge and understanding",
  },
  {
    number: "03",
    name: "Narahari Teertharu",
    kannada:
      "ಸಸೀತಾ ಮೂಲರಾಮಾರ್ಚಾ ಕೋಶೇ ಗಜಪತೇ ಸ್ಥಿತಾ ಯೇನಾನೀತಾ ನಮಸ್ತಸ್ಮೈ ಶ್ರೀಮನ್ ನೃಹರಿ ಭಿಕ್ಷವೇ ||",
    description:
      "The saint who tended to the Lord like a devotee, carrying the essence of devotion",
  },
  {
    number: "04",
    name: "Madhava Teertharu",
    kannada:
      "ಸಾಧಿತಾಖಿಲ ಸತ್ತತ್ವಂ ಬಾಧಿತಾಖಿಲ ದುರ್ಮತಂ ಬೊಧಿತಾಖಿಲ ಸನ್ಮಾರ್ಗಂ ಮಾಧವಾಖ್ಯ ಗುರುಂ ಭಜೇ ||",
    description:
      "The guru who established all truths, refuted all false doctrines, and illuminated the path of righteousness",
  },
  {
    number: "05",
    name: "Akshobhya Teertharu",
    kannada:
      "ಯೋ ವಿದ್ಯಾರಣ್ಯ ವಿಪಿನಂ ತತ್ವಮಸ್ಸಿನಾಛ್ಛಿನತ ಶ್ರೀಮದಕ್ಷೋಭ್ಯತೀರ್ಥಾಯ ನಮಸ್ತಸ್ಮೈ ಮಹಾತ್ಮನೇ ||",
    description:
      "The great soul who cut through the forest of ignorance with the sword of knowledge",
  },
  {
    number: "06",
    name: "Jayateertharu",
    kannada:
      "ಯಸ್ಯ ವಾಕ್ಕಾಮಧೇನುರ್ನ: ಕಾಮಿತಾರ್ಥನ್ ಪ್ರಯಚ್ಛತಿ ಸೇವೇ ತಂ ಜಯಯೋಗೀಂದ್ರಂ ಕಾಮಬಾಣಚ್ಚಿದಂ ಸದಾ ||",
    description:
      "The victorious one whose words shower desired fruits upon devotees like the flow of honey",
  },
  {
    number: "07",
    name: "Vidhyadirajaru",
    kannada:
      "ಮಾದ್ಯದದ್ವೈತ್ಯಂಧಕಾರ ಪ್ರದ್ಯೋತನಮಹರ್ನಿಶಂ ವಿದ್ಯಾಧಿರಾಜ ಸುಗುರೂಂ ಹೃದ್ಯಾಮಿತ ಗುರೂಂ ಭಜೇ ||",
    description:
      "The king of knowledge who illuminates the darkness of duality, the beloved guru of all scholars",
  },
  {
    number: "08",
    name: "Kaveendra Teertharu",
    kannada:
      "ವೀಂದ್ರಾರೂಢ ಪದಾಸಕ್ತಂ ರಾಜೇಂದ್ರ ಮುನಿಸೇವಿತಂ ಶ್ರೀ ಕವೀಂದ್ರ ಮುನಿಂ ವಂದೇ ಭಜತಾಂ ಚಂದ್ರ ಸನ್ನಿಭಂ ||",
    description:
      "The poet-king among saints, served by great devotees, like the moon among stars",
  },
  {
    number: "09",
    name: "Vageesha Teertharu",
    kannada:
      "ವಾಸುದೇವ ಪದದ್ವಂದ್ವ ವಾರಿಜಾಸಕ್ತ ಮಾನಸಂ ಪದ ವ್ಯಾಖ್ಯಾನ ಕುಶಲಂ ವಾಗೀಶ ಯತಿಮಾಶ್ರಯೇ ||",
    description:
      "The master of speech who is devoted to Vasudeva's feet and excels in explaining divine truths",
  },
  {
    number: "10",
    name: "Ramachandra Teertharu",
    kannada:
      "ದ್ಯುಮಣ್ಯಬೀಜನಾಬ್ದಿಂದುಂ ರಾಮವ್ಯಾಸಪದಾರ್ಚಕ: ರಾಮಚಂದ್ರ ಗುರುರ್ಭ್ರುಯಾತ್ ಕಾಮಿತಾರ್ಥ ಪ್ರದಾಯಕ: ||",
    description:
      "The guru born from the lineage of Ramanuja, like the moon from the ocean of nectar, fulfilling all desires",
  },
  {
    number: "11",
    name: "Vibhudhendra Teertharu",
    kannada:
      "ಅಕೇರಲಂ ತಥಾ ಸೇತುಂ ಮಾಗಂಗಂ ಚ ಹಿಮಾಲಯಂ ನಿರಾಕೃತಾದ್ವೈತ ಶೈವಂ ವಿಭುದೇಂದ್ರ ಗುರೂಂ ಭಜೇ ||",
    description:
      "The wise guru who crossed the oceans, bridges, rivers and mountains, worshipping the non-dual Shaiva doctrine",
  },
  {
    number: "12",
    name: "Jitamitra Teertharu",
    kannada: "ಸಪ್ತರಾತ್ರದ ಕೃಷ್ಣವೇಣ್ಯಾ ಮುಶಿತ್ವಾ ಪುನರುತ್ಥಿತದ ಜಿತಾಮಿತ್ರ ಗುರು ವಂದೇ ವಿಭುದೇಂದ್ರ ಕರೋದ್ಭವದ ||",
    description: "The victorious friend who conquered all enemies of knowledge",
  },
  {
    number: "13",
    name: "Raghunandana Teertharu",
    kannada: "ಪರೈರಪಹೃತಾ ಮೂಲರಾಮಾರ್ಚಾ ಗುರ್ವನುಗ್ರಹಾತ್ ಯೇನಾನೀತಾ ನಮಸ್ತಸ್ಮೈ ರಘುನಂದನ್ ಭಿಕ್ಷವೇ ||",
    description: "The one who received the essence of service to the Lord's feet through the guru's grace",
  },
  {
    number: "14",
    name: "Surendra Teertharu",
    kannada: "ಯಶ್ಚಕಾರೋಪವಾಸೇನ ತ್ರಿವಾರದ ಭೂ ಪ್ರದಕ್ಷಿಣದ ತಸ್ಮೈ ನಮೋ ಯತೀಂದ್ರಾಯ ಶ್ರೀ ಸುರೇಂದ್ರ ತಪಸ್ವಿನೇ ||",
    description: "The austere practitioner who worshipped with three daily circuits of the earth through renunciation",
  },
  {
    number: "15",
    name: "Vijayeendra Teertharu",
    kannada: "ಭಕ್ತಾನಾಂ ಮಾನಸಾಂ ಭೋಜಭಾನವೇ ಕಾಮಧೇನವೇ ಭಜತಾಂ ಕಲ್ಪತರವೇ ಜಯೀಂದ್ರ ಗುರವೇ ನಮಃ ||",
    description: "The lord of victory who is the wish-fulfilling tree for devotees, fulfilling all desires",
  },
  {
    number: "16",
    name: "Sudheendra Teertharu",
    kannada: "ಕುಶಾಗ್ರಮತಯೇ ಭಾನುದ್ಯುತಯೇ ವಾದಿ ಭೀತಯೇ ಆರಾಧಿತ ಶ್ರೀಪತಯೇ ಶ್ರೀಸುಧೀಂದ್ರ ಯತಯೇ ನಮಃ ||",
    description: "The excellent one who is the crest-jewel of scholars, radiant like the sun, worshipped by the learned",
  },
  {
    number: "17",
    name: "Raghavendra Teertharu",
    kannada: "ದುರ್ವಾದಿಧ್ವಾಂತರವಯೇ ವೈಷ್ಣವೇಂದೀವರೇಂದವೇ ಶ್ರೀ ರಾಘವೇಂದ್ರ ಗುರವೇ ನಮೋ ಅತ್ಯಂತ ದಯಾಳವೇ ||",
    description:
      "The presiding deity of our Matha, the great saint who is the embodiment of Lord Rama's grace, extremely compassionate",
  },
];

export default function GuruparamparaPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 py-8 md:py-10">
          <div className="absolute inset-0 opacity-10">
            <div
              className="h-full w-full"
              style={{
                backgroundImage: "url('/images/Hero.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-6">
            <Breadcrumb current="Guru Parampara" />
            <div className="text-center mt-4">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 backdrop-blur">
                <Sparkles className="h-5 w-5 text-amber-200" />
                <span className="text-sm font-medium text-white">
                  Sacred Tradition
                </span>
              </div>

              <h1 className="text-4xl font-bold text-white md:text-5xl">
                The Sacred Guru Parampara
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-xl text-amber-100">
                The Lineage of Pontiffs from Sri Madhwacharya to Present
              </p>

              <div className="mt-8 flex justify-center gap-8 text-amber-200">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">
                    {guruParampara.length}
                  </div>
                  <div className="text-sm">Gurus</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">800+</div>
                  <div className="text-sm">Years</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Intro Section */}
        <section className="px-6 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <BookOpen className="mx-auto h-16 w-16 text-amber-600" />
            <h2 className="mt-6 text-3xl font-bold text-stone-900">
              Preserving the Divine Lineage
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-stone-600">
              The Guru Parampara of Sri Raghavendra Swamy Matha traces its
              lineage from Sri Madhvacharya through an unbroken chain of
              spiritual masters. Each pontiff in this lineage has contributed
              to the preservation and propagation of Dwaita philosophy, Vedic
              traditions, and the service to Lord Rama.
            </p>
          </div>
        </section>

        {/* Guru Parampara List */}
        <section className="bg-gradient-to-b from-amber-50 to-white px-6 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-5xl">
            <div className="space-y-6">
              {guruParampara.map((guru, index) => (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-3xl border border-amber-200 bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-lg"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                    {/* Number Badge */}
                    <div className="flex-shrink-0">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-xl font-bold text-white shadow-lg">
                        {guru.number}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-stone-900">
                        {guru.name}
                      </h3>

                      {/* Kannada Sloka */}
                      <div className="mt-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 p-6">
                        <p className="text-lg leading-relaxed text-stone-700 font-serif italic">
                          &ldquo;{guru.kannada}&rdquo;
                        </p>
                      </div>

                      {/* Description */}
                      <p className="mt-4 leading-relaxed text-stone-600">
                        {guru.description}
                      </p>
                    </div>
                  </div>

                  {/* Decorative Element */}
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 opacity-50 blur-2xl" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing Section */}
        <section className="px-6 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <div className="rounded-3xl bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 p-12 text-white">
              <h2 className="text-3xl font-bold">|| Gururājō Vijayatē ||</h2>
              <p className="mt-4 text-lg text-amber-100">
                May the Guru&apos;s glory always prevail. Through this sacred
                lineage, the divine teachings continue to guide and illuminate
                the path of devotion for all seekers.
              </p>

              <div className="mt-8 flex justify-center gap-6 text-amber-200">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">
                    || Hari Sarvōttama ||
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">
                    || Vāyu Jīvōttama ||
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
