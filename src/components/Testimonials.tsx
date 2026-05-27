import { Star, Quote } from 'lucide-react';

export function Testimonials() {
  return (
    <section className="section-padding bg-sand-50">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">
            Kids ask for these books by name
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            The best review isn't from a parent. It's a child asking to read their story again.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 items-start">
          {/* Review */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm card-hover">
            <Quote className="w-8 h-8 text-brand-200 mb-4" />
            <div className="flex gap-1 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-brand-400 text-brand-400" />
              ))}
            </div>
            <p className="text-gray-700 leading-relaxed italic">
              "My son has never asked to re-read a book before. He's asked for his dinosaur adventure every night for two weeks. He points at the pictures and says 'that's me!' with the biggest smile."
            </p>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="font-semibold text-gray-900">Sarah M.</p>
              <p className="text-sm text-gray-500">Mom of a 4-year-old</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm grid grid-cols-2 gap-6">
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">98%</p>
              <p className="text-sm text-gray-500 mt-1">of kids ask for another story</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">4.9</p>
              <p className="text-sm text-gray-500 mt-1">average parent rating</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">3.2x</p>
              <p className="text-sm text-gray-500 mt-1">more re-reads vs. competitors</p>
            </div>
            <div className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">12K+</p>
              <p className="text-sm text-gray-500 mt-1">stories created so far</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
