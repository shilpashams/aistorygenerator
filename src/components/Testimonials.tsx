import { Star, Quote } from 'lucide-react';

export function Testimonials() {
  const testimonials = [
    {
      quote: "My son has never asked to re-read a book before. He's asked for his dinosaur adventure every night for two weeks. He points at the pictures and says 'that's me!' with the biggest smile.",
      name: 'Sarah M.',
      role: 'Mom of a 4-year-old',
      rating: 5,
    },
    {
      quote: "I teach second grade and ordered books for my whole class. The kids were absolutely floored. They couldn't believe they were in a real book. Several parents reached out asking where to order more.",
      name: 'Jennifer K.',
      role: '2nd Grade Teacher',
      rating: 5,
    },
    {
      quote: "We've tried three other personalized book companies. This is the first time the illustrations actually look like our daughter. She recognized herself immediately. Worth every penny.",
      name: 'David & Rachel T.',
      role: 'Parents of a 6-year-old',
      rating: 5,
    },
  ];

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

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name} className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm card-hover">
              <Quote className="w-8 h-8 text-brand-200 mb-4" />
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-brand-400 text-brand-400" />
                ))}
              </div>
              <p className="text-gray-700 leading-relaxed italic">"{testimonial.quote}"</p>
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="font-semibold text-gray-900">{testimonial.name}</p>
                <p className="text-sm text-gray-500">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof bar */}
        <div className="mt-12 bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">98%</p>
              <p className="text-sm text-gray-500 mt-1">of kids ask for another story</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">4.9</p>
              <p className="text-sm text-gray-500 mt-1">average parent rating</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">3.2x</p>
              <p className="text-sm text-gray-500 mt-1">more re-reads vs. competitors</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">12K+</p>
              <p className="text-sm text-gray-500 mt-1">stories created so far</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
