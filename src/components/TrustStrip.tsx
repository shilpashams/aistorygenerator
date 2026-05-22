import { BookOpen, Users, Award } from 'lucide-react';

export function TrustStrip() {
  const stats = [
    { icon: BookOpen, value: '12,000+', label: 'Stories Created' },
    { icon: Users, value: '2,400+', label: 'Happy Families' },
    { icon: Award, value: '4.9/5', label: 'Parent Rating' },
  ];

  return (
    <section className="relative bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                <stat.icon className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-10 border-t border-gray-100">
          <p className="text-center text-sm text-gray-400 uppercase tracking-wider mb-6">Trusted by parents and educators</p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 opacity-60">
            {['Elementary Schools', 'Homeschool Co-ops', 'Reading Programs', 'Gift Services', 'Libraries'].map((name) => (
              <span key={name} className="text-sm font-semibold text-gray-400 whitespace-nowrap">{name}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
