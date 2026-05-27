import { Upload, MessageSquare, BookOpen, Truck } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      number: '01',
      title: 'Upload 2-3 Photos',
      description: 'Share a few clear photos of your child. Our AI learns their appearance to create illustrations that actually look like them.',
      color: 'bg-ocean-50 text-ocean-600',
    },
    {
      icon: MessageSquare,
      number: '02',
      title: 'Describe Their Personality',
      description: 'Tell us their age, interests, favorite things, reading level, and anything to avoid. Takes under 2 minutes.',
      color: 'bg-forest-50 text-forest-600',
    },
    {
      icon: BookOpen,
      number: '03',
      title: 'AI Crafts Their Story',
      description: 'Our AI generates a unique narrative and custom illustrations. A dinosaur rescue for dino kids. A space adventure for star gazers.',
      color: 'bg-brand-50 text-brand-600',
    },
    {
      icon: Truck,
      number: '04',
      title: 'Read',
      description: 'Get the digital version instantly.',
      color: 'bg-sand-100 text-sand-700',
    },
  ];

  return (
    <section id="how-it-works" className="section-padding bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">
            From photos to storybook in minutes
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Four simple steps. No design skills needed. No waiting weeks for delivery.
          </p>
          <div className="mt-8 max-w-sm mx-auto">
            <img
              src="/ChatGPT_Image_May_27,_2026,_11_11_31_AM.png"
              alt="Example of a child illustrated in cartoon style"
              className="w-full rounded-2xl shadow-lg border border-gray-100"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {steps.map((step) => (
            <div key={step.number} className="relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm card-hover">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{step.number}</span>
              <div className={`mt-3 w-12 h-12 rounded-xl ${step.color} flex items-center justify-center`}>
                <step.icon className="w-6 h-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>

        {/* Connecting line for desktop */}
        <div className="hidden lg:block relative mt-0">
          <div className="absolute top-0 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-ocean-200 via-forest-200 to-brand-200 -translate-y-[7.5rem]" />
        </div>
      </div>
    </section>
  );
}
