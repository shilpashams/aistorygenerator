import { XCircle } from 'lucide-react';

export function ProblemSection() {
  const painPoints = [
    {
      title: 'Same template, different name',
      description: 'Current "personalized" books just swap in a name. The story is identical for every child who orders one.',
    },
    {
      title: 'Illustrations that look nothing like them',
      description: 'Generic characters with a name tag underneath. Your child flips through and doesn\'t see themselves.',
    },
    {
      title: 'One storyline fits all',
      description: 'A princess adventure for a kid who only cares about dinosaurs. The story ignores who they actually are.',
    },
    {
      title: 'Three reads, then the drawer',
      description: 'Without real personalization, these books lose magic fast. $30 for something that collects dust.',
    },
  ];

  return (
    <section className="section-padding bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 text-balance">
            "Personalized" books that aren't personal at all
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            You've seen the ads. A book with your child's name on it. But when it arrives, it's a generic story
            with a name stamped in. The illustrations are clipart. The plot has nothing to do with your kid.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {painPoints.map((point) => (
            <div
              key={point.title}
              className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">{point.title}</h3>
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">{point.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <img
              src="https://images.pexels.com/photos/3755440/pexels-photo-3755440.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Child looking disappointed at a generic book"
              className="w-full h-48 sm:h-64 object-cover"
            />
            <div className="p-6 text-center">
              <p className="text-gray-600 italic">
                "I ordered a personalized book for my daughter. She looked at it, said 'that's not me,' and never picked it up again."
              </p>
              <p className="mt-2 text-sm text-gray-400">- Parent review of a leading competitor</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
