import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ProblemSection } from './components/ProblemSection';
import { SolutionSection } from './components/SolutionSection';
import { HowItWorks } from './components/HowItWorks';
import { Testimonials } from './components/Testimonials';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import { Dashboard } from './pages/Dashboard';
import { WizardLayout } from './pages/create/WizardLayout';
import { PhotoUpload } from './pages/create/PhotoUpload';
import { ChildProfile } from './pages/create/ChildProfile';
import { ThemeSelection } from './pages/create/ThemeSelection';
import { StoryGenerating } from './pages/create/StoryGenerating';
import { StoryReader } from './pages/create/StoryReader';
import { WizardProvider } from './context/WizardContext';

function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <HowItWorks />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <WizardProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create" element={<WizardLayout />}>
            <Route path="photos" element={<PhotoUpload />} />
            <Route path="profile" element={<ChildProfile />} />
            <Route path="theme" element={<ThemeSelection />} />
            <Route path="generating" element={<StoryGenerating />} />
            <Route path="story/:storyId" element={<StoryReader />} />
          </Route>
        </Routes>
      </WizardProvider>
    </BrowserRouter>
  );
}

export default App;
