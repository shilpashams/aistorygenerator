import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Clock, Heart } from 'lucide-react';

export function FinalCTA() {
  return (
    <section id="cta" className="section-padding bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white" />
        <div className="absolute bottom-10 right-10 w-60 h-60 rounded-full bg-white" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-white" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative">
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white text-balance">
          Their next bedtime story could star them
        </h2>
        <p className="mt-4 text-lg sm:text-xl text-white/80 max-w-2xl mx-auto">
          Two photos. Five questions. One story they'll never forget. Create a personalized
          adventure in under 5 minutes.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/create/photos"
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-brand-700 bg-white rounded-full shadow-xl hover:shadow-2xl hover:bg-gray-50 transform hover:-translate-y-0.5 transition-all duration-200 group"
          >
            Create Their Adventure Now
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6 text-white/70">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span className="text-sm">Safe & child-friendly content</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Ready in under 5 minutes</span>
          </div>
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            <span className="text-sm">Loved by 2,400+ families</span>
          </div>
        </div>

        <p className="mt-6 text-sm text-white/50">
          No account needed. Start creating instantly.
        </p>
      </div>
    </section>
  );
}
