import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'How do the illustrations actually look like my child?',
    answer: 'We use advanced AI image generation trained on the 2-3 photos you upload. The technology creates consistent character illustrations that match your child\'s appearance - hair color, skin tone, features - across every page of the book. Parents consistently tell us their kids recognize themselves immediately.',
  },
  {
    question: 'Is my child\'s photo data safe?',
    answer: 'Absolutely. Photos are processed through encrypted channels, used only to generate illustrations, and permanently deleted within 30 days of book creation. We never share, sell, or use photos for any other purpose. You can request immediate deletion at any time.',
  },
  {
    question: 'How long does it take to receive a book?',
    answer: 'Digital books are delivered instantly after generation (typically 5-10 minutes). Printed hardcovers ship within 2-3 business days and arrive in 5-7 business days depending on your location. Rush shipping is available for an additional fee.',
  },
  {
    question: 'What age range are the books for?',
    answer: 'We create stories for children ages 2-10. The reading level, vocabulary, story complexity, and illustration style all adjust based on the age you specify. Younger kids get simpler stories with more pictures; older kids get chapter-style adventures.',
  },
  {
    question: 'Can I preview the book before ordering a print?',
    answer: 'Yes! Every order includes a full digital preview. You can review every page, request adjustments to the story or illustrations, and only proceed to print when you\'re completely satisfied. We want you to love it.',
  },
  {
    question: 'What if my child\'s interests change?',
    answer: 'That\'s exactly why we built the monthly subscription. You can update their profile anytime - new interests, new reading level, new favorite things. Each new story reflects who they are right now, not who they were six months ago.',
  },
  {
    question: 'How is this different from other personalized books?',
    answer: 'Most competitors swap a name into a pre-written template with generic illustrations. We generate entirely new stories based on your child\'s specific interests, and create illustrations from their actual photos. Every book is genuinely unique - no two are alike.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="section-padding bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">
            Questions parents ask
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Everything you need to know before creating your child's first adventure.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <p className="px-5 pb-5 text-gray-600 leading-relaxed">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
