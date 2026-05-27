import { Camera, Brain, Shield, BookMarked } from 'lucide-react';

export function Features() {
  const features = [
    {
      icon: Camera,
      title: 'Photo-Accurate Illustrations',
      description: 'Our AI creates illustrations from your photos so your child recognizes themselves on every single page. Not clipart. Not generic faces.',
      color: 'text-ocean-600 bg-ocean-50',
    },
    {
      icon: Brain,
      title: 'Interest-Driven Stories',
      description: 'Dinosaurs, space, cooking, sports, animals - the story theme is built around what your child actually cares about right now.',
      color: 'text-forest-600 bg-forest-50',
    },
    {
      icon: Shield,
      title: 'Parent-Controlled Content',
      description: 'Flag fears, sensitivities, or topics to avoid. You set the boundaries. Every story respects them completely.',
      color: 'text-red-600 bg-red-50',
    },
    {
      icon: BookMarked,
      title: 'Reading-Level Matched',
      description: 'Stories match your child\'s actual reading ability. Vocabulary, sentence length, and complexity grow with them.',
      color: 'text-ocean-600 bg-ocean-50',
    },
  ];

  return (
    <section id="features" className="section-padding bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 text-balance">
            Every detail built for one child
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            This isn't a name swap with clip art. Every element of the book is generated specifically for your kid.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 card-hover">
              <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
