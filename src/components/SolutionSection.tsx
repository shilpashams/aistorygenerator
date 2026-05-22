import { Link } from 'react-router-dom';
import { CheckCircle, Sparkles } from 'lucide-react';

export function SolutionSection() {
  const benefits = [
    'Stories built around their actual interests, not a template',
    'AI illustrations that look like your child on every page',
    'Adventures that match their reading level and vocabulary',
    'Content that avoids topics you flag (fears, sensitivities)',
    'New stories monthly with the same character they love',
  ];

  return (
    <section className="section-padding bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="rounded-2xl overflow-hidden shadow-xl">
              <img
                src="https://images.pexels.com/photos/3662667/pexels-photo-3662667.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Child excitedly reading their personalized storybook"
                className="w-full h-auto object-cover aspect-[4/3]"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 sm:right-8 bg-white rounded-xl shadow-lg p-4 border border-gray-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-500" />
                <span className="text-sm font-semibold text-gray-800">100% unique to your child</span>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 text-balance">
              A storybook that knows your kid better than any template ever could
            </h2>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">
              Adventures Of builds stories around who your child actually is. Upload a few photos,
              answer five quick questions, and get a fully personalized story with illustrations that
              look like them - doing exactly what they love.
            </p>

            <ul className="mt-8 space-y-4">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-forest-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Link to="/create/photos" className="btn-primary">
                Start Their Story
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
