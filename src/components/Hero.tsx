import { Link } from 'react-router-dom';
import { Sparkles, Star, ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-sand-50 via-white to-ocean-50">
      <div className="absolute top-20 left-10 w-20 h-20 bg-brand-100 rounded-full opacity-60 animate-float" />
      <div className="absolute top-40 right-20 w-14 h-14 bg-ocean-100 rounded-full opacity-50 animate-float-delay" />
      <div className="absolute bottom-32 left-1/4 w-10 h-10 bg-forest-100 rounded-full opacity-40 animate-float" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 sm:pt-32 sm:pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 border border-brand-100 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-brand-500" />
              <span className="text-sm font-medium text-brand-700">AI-Powered Personalization</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight text-balance">
              Your Child.{' '}
              <span className="text-brand-500">The Hero.</span>{' '}
              Every Single Page.
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed">
              Personalized storybooks where your child sees themselves in every illustration and
              lives adventures built around their unique interests. Not a name swap. A story crafted for one kid.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link to="/create/photos" className="btn-primary group">
                Create Their First Adventure
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#how-it-works" className="btn-secondary">
                See How It Works
              </a>
            </div>

            <div className="mt-10 flex items-center gap-6">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-brand-200 to-brand-400 flex items-center justify-center"
                  >
                    <Star className="w-4 h-4 text-white" />
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-4 h-4 fill-brand-400 text-brand-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Loved by 2,400+ families</p>
              </div>
            </div>
          </div>

          <div className="relative lg:pl-8">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-brand-900/10">
              <img
                src="https://images.pexels.com/photos/3661193/pexels-photo-3661193.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Child reading a personalized storybook"
                className="w-full h-auto object-cover aspect-[4/3]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>

            <div className="absolute -bottom-6 -left-4 sm:left-4 bg-white rounded-xl shadow-lg p-4 border border-gray-100 animate-float-delay">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-forest-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-forest-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Story Generated!</p>
                  <p className="text-xs text-gray-500">"Dino Rescue Mission" for Max, age 5</p>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 -right-4 sm:right-4 bg-white rounded-xl shadow-lg p-3 border border-gray-100 animate-float">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-ocean-100 flex items-center justify-center">
                  <Star className="w-4 h-4 text-ocean-600" />
                </div>
                <p className="text-xs font-medium text-gray-700">8 pages of Magic</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
