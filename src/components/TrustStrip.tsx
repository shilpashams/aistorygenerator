export function TrustStrip() {
  return (
    <section className="relative bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-center text-sm text-gray-400 uppercase tracking-wider mb-6">Trusted by parents and educators</p>
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 opacity-60">
          {['Elementary Schools', 'Homeschool Co-ops', 'Reading Programs', 'Gift Services', 'Libraries'].map((name) => (
            <span key={name} className="text-sm font-semibold text-gray-400 whitespace-nowrap">{name}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
