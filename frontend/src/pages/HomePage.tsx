import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { QrCode, Zap, Shield, ArrowRight, CheckCircle, ChevronDown } from "lucide-react";
import GreenButton from "@/components/GreenButton";
import { Button } from "@/components/ui/button";

const HomePage = () => {
  const [isVisible, setIsVisible] = useState<{[key: string]: boolean}>({
    hero: false,
    features: false,
    howItWorks: false,
    testimonials: false
  });
  const sectionsRef = useRef<{[key: string]: HTMLElement | null}>({
    hero: null,
    features: null,
    howItWorks: null,
    testimonials: null
  });

  // Animation on scroll
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(prev => ({...prev, [entry.target.id]: true}));
        }
      });
    }, { threshold: 0.1 });

    Object.keys(sectionsRef.current).forEach(key => {
      if (sectionsRef.current[key]) {
        observer.observe(sectionsRef.current[key]!);
      }
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const animationClass = (section: string) => 
    isVisible[section] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10';

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-nexapay-50">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-nexapay-600 flex items-center">
            <span className="w-8 h-8 bg-nexapay-500 rounded-full mr-2"></span>
            NexaPay
          </h1>
          <nav className="hidden md:flex gap-6">
            <button onClick={() => scrollToSection('features')} className="text-gray-700 hover:text-nexapay-600 transition-colors">Features</button>
            <button onClick={() => scrollToSection('howItWorks')} className="text-gray-700 hover:text-nexapay-600 transition-colors">How It Works</button>
            <button onClick={() => scrollToSection('testimonials')} className="text-gray-700 hover:text-nexapay-600 transition-colors">Testimonials</button>
          </nav>
          <div className="flex gap-4">
            <Link to="/login">
              <Button variant="outline" className="font-medium border-nexapay-200 text-nexapay-700 hover:bg-nexapay-50">
                Login
              </Button>
            </Link>
            <Link to="/signup">
              <GreenButton>
                Sign Up
              </GreenButton>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        id="hero" 
        ref={el => sectionsRef.current.hero = el}
        className="py-20 px-4 md:py-32 relative overflow-hidden"
      >
        <div className="container mx-auto max-w-6xl">
          <div className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-700 transform ${animationClass('hero')}`}>
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Secure <span className="text-nexapay-600">Online & Offline</span> Payments
              </h1>
              <p className="text-xl text-gray-600">
                The innovative wallet that works seamlessly both online and offline.
                Pay anywhere with QR codes, even when you're not connected.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Link to="/signup">
                  <GreenButton size="lg" className="px-8 py-3 text-lg">
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </GreenButton>
                </Link>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="px-8 py-3 text-lg border-nexapay-200 text-nexapay-700"
                  onClick={() => scrollToSection('howItWorks')}
                >
                  Learn More
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square max-w-md mx-auto bg-nexapay-100 rounded-2xl p-6 shadow-lg transform rotate-3 relative">
                <div className="absolute inset-0 bg-white/20 backdrop-blur-sm rounded-2xl"></div>
                <div className="absolute -top-6 -right-6 bg-nexapay-500 text-white p-4 rounded-full shadow-lg">
                  <QrCode size={32} />
                </div>
                <div className="relative z-10 h-full flex flex-col justify-center items-center">
                  <img src="/placeholder.svg" alt="App Demo" className="w-4/5 mx-auto shadow-xl rounded-xl" />
                  <div className="mt-6 bg-white p-3 rounded-lg shadow-md">
                    <p className="text-nexapay-600 font-medium">Scan to pay anywhere</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-16">
            <button 
              onClick={() => scrollToSection('features')} 
              className="text-gray-500 hover:text-nexapay-600 transition-colors animate-bounce"
            >
              <ChevronDown size={32} />
            </button>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section 
        id="features" 
        ref={el => sectionsRef.current.features = el} 
        className="py-20 px-4"
      >
        <div className="container mx-auto max-w-6xl">
          <div className={`text-center mb-16 transition-all duration-700 transform ${animationClass('features')}`}>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Why Choose NexaPay?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform combines security, convenience, and innovation to provide the best payment experience.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className={`bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all duration-500 transform hover:-translate-y-1 ${animationClass('features')} delay-100`}>
              <div className="bg-nexapay-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <QrCode size={28} className="text-nexapay-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-800 text-center">Offline Payments</h3>
              <p className="text-gray-600 text-center">
                Make and receive payments even without an internet connection using secure QR codes.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center text-gray-600">
                  <CheckCircle size={16} className="text-nexapay-500 mr-2" />
                  <span>Works without internet</span>
                </li>
                <li className="flex items-center text-gray-600">
                  <CheckCircle size={16} className="text-nexapay-500 mr-2" />
                  <span>Secure encryption</span>
                </li>
                <li className="flex items-center text-gray-600">
                  <CheckCircle size={16} className="text-nexapay-500 mr-2" />
                  <span>Instant confirmation</span>
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className={`bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all duration-500 transform hover:-translate-y-1 ${animationClass('features')} delay-200`}>
              <div className="bg-nexapay-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Zap size={28} className="text-nexapay-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-800 text-center">Instant Transfers</h3>
              <p className="text-gray-600 text-center">
                Send and receive money instantly between NexaPay users. No waiting periods.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center text-gray-600">
                  <CheckCircle size={16} className="text-nexapay-500 mr-2" />
                  <span>Real-time transactions</span>
                </li>
                <li className="flex items-center text-gray-600">
                  <CheckCircle size={16} className="text-nexapay-500 mr-2" />
                  <span>No transfer fees</span>
                </li>
                <li className="flex items-center text-gray-600">
                  <CheckCircle size={16} className="text-nexapay-500 mr-2" />
                  <span>Works 24/7</span>
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className={`bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all duration-500 transform hover:-translate-y-1 ${animationClass('features')} delay-300`}>
              <div className="bg-nexapay-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield size={28} className="text-nexapay-600" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-800 text-center">Bank-Level Security</h3>
              <p className="text-gray-600 text-center">
                End-to-end encryption and offline token system ensures your money stays secure.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center text-gray-600">
                  <CheckCircle size={16} className="text-nexapay-500 mr-2" />
                  <span>End-to-end encryption</span>
                </li>
                <li className="flex items-center text-gray-600">
                  <CheckCircle size={16} className="text-nexapay-500 mr-2" />
                  <span>Two-factor authentication</span>
                </li>
                <li className="flex items-center text-gray-600">
                  <CheckCircle size={16} className="text-nexapay-500 mr-2" />
                  <span>Fraud protection</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section 
        id="howItWorks" 
        ref={el => sectionsRef.current.howItWorks = el}
        className="py-20 px-4 bg-gradient-to-b from-white to-nexapay-50"
      >
        <div className="container mx-auto max-w-6xl">
          <div className={`text-center mb-16 transition-all duration-700 transform ${animationClass('howItWorks')}`}>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              How NexaPay Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Simple, secure, and fast payments in just a few steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-4 relative">
            {/* Line connecting steps */}
            <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-1 bg-nexapay-200 z-0"></div>

            {/* Step 1 */}
            <div className={`relative z-10 transition-all duration-700 transform ${animationClass('howItWorks')} delay-100`}>
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-nexapay-500 text-white rounded-full flex items-center justify-center mx-auto -mt-10 mb-4 text-xl font-bold">1</div>
                <h3 className="text-xl font-semibold mb-4 text-center">Create Account</h3>
                <p className="text-gray-600 text-center">
                  Sign up with your email, set up your profile and link your bank account or card.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className={`relative z-10 md:mt-16 transition-all duration-700 transform ${animationClass('howItWorks')} delay-200`}>
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-nexapay-500 text-white rounded-full flex items-center justify-center mx-auto -mt-10 mb-4 text-xl font-bold">2</div>
                <h3 className="text-xl font-semibold mb-4 text-center">Reserve Offline Funds</h3>
                <p className="text-gray-600 text-center">
                  Set aside money for offline use with our secure token system. Use them anywhere.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className={`relative z-10 transition-all duration-700 transform ${animationClass('howItWorks')} delay-300`}>
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-nexapay-500 text-white rounded-full flex items-center justify-center mx-auto -mt-10 mb-4 text-xl font-bold">3</div>
                <h3 className="text-xl font-semibold mb-4 text-center">Pay with QR Codes</h3>
                <p className="text-gray-600 text-center">
                  Scan or display QR codes to make payments, online or offline. Fast and secure.
                </p>
              </div>
            </div>
          </div>

          <div className={`mt-16 text-center transition-all duration-700 transform ${animationClass('howItWorks')} delay-400`}>
            <Link to="/signup">
              <GreenButton size="lg" className="px-8 py-3 text-lg">
                Get Started Today
              </GreenButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section 
        id="testimonials" 
        ref={el => sectionsRef.current.testimonials = el}
        className="py-20 px-4 bg-white"
      >
        <div className="container mx-auto max-w-6xl">
          <div className={`text-center mb-16 transition-all duration-700 transform ${animationClass('testimonials')}`}>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              What Our Users Say
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Join thousands of satisfied users who love NexaPay
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className={`bg-gradient-to-tr from-nexapay-50 to-white p-6 rounded-xl shadow-md transition-all duration-700 transform ${animationClass('testimonials')} delay-100`}>
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-nexapay-200 rounded-full flex-shrink-0"></div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-800">Sarah M.</h4>
                  <p className="text-gray-500 text-sm">Small Business Owner</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "NexaPay has transformed how I manage payments at my coffee shop. The offline feature is a lifesaver during internet outages!"
              </p>
            </div>

            {/* Testimonial 2 */}
            <div className={`bg-gradient-to-tr from-nexapay-50 to-white p-6 rounded-xl shadow-md transition-all duration-700 transform ${animationClass('testimonials')} delay-200`}>
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-nexapay-200 rounded-full flex-shrink-0"></div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-800">Alex T.</h4>
                  <p className="text-gray-500 text-sm">Freelance Photographer</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "I can now accept payments at remote photoshoot locations with no cell service. It's revolutionary for my business!"
              </p>
            </div>

            {/* Testimonial 3 */}
            <div className={`bg-gradient-to-tr from-nexapay-50 to-white p-6 rounded-xl shadow-md transition-all duration-700 transform ${animationClass('testimonials')} delay-300`}>
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-nexapay-200 rounded-full flex-shrink-0"></div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-800">Michael J.</h4>
                  <p className="text-gray-500 text-sm">Digital Nomad</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "As someone who travels to remote areas, NexaPay has been a game-changer. I can manage payments anywhere in the world!"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <span className="w-6 h-6 bg-nexapay-500 rounded-full mr-2"></span>
                NexaPay
              </h3>
              <p className="text-gray-400">
                Secure online and offline payments for everyone, everywhere.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Press</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Developers</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-500">
            <p> {new Date().getFullYear()} NexaPay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
