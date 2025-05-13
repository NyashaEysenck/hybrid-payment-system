// Updated LoginPage.tsx
import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, QrCode, Cloud, Shield, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GreenButton from "@/components/GreenButton";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({ email: "", password: "" });
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const validateForm = useCallback(() => {
    let valid = true;
    const errors = { email: "", password: "" };
    
    if (!email) {
      errors.email = "Email is required";
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = "Email is invalid";
      valid = false;
    }
    
    if (!password) {
      errors.password = "Password is required";
      valid = false;
    }
    
    setFormErrors(errors);
    return valid;
  }, [email, password]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (error) {
      // Error handled in AuthContext
    } finally {
      setIsLoading(false);
    }
  }, [email, password, isLoading, login, navigate, validateForm]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold text-nexapay-600">NexaPay</h1>
        <p className="mt-2 text-center text-sm text-dark-lighter">
          Secure online banking with offline capabilities
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-5xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                {user ? "Continue Session" : "Welcome Back"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`mt-1 ${formErrors.email ? 'border-red-500' : ''}`}
                    disabled={isLoading}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`mt-1 ${formErrors.password ? 'border-red-500' : ''}`}
                    disabled={isLoading}
                  />
                  {formErrors.password && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                  )}
                </div>

                <GreenButton
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {user ? "Unlocking..." : "Signing in..."}
                    </>
                  ) : user ? "Unlock Wallet" : "Sign in"}
                </GreenButton>

                <div className="text-center">
                  <Link to="/signup" className="text-nexapay-600 hover:text-nexapay-500">
                    {user ? "Switch account" : "Create an account"}
                  </Link>
                </div>
              </form>
            </div>

              {/* Right Panel (Feature Highlights) */}
  <div className="border-l pl-8 hidden md:block">
  <h2 className="text-2xl font-semibold text-gray-800 mb-6">Key Features</h2>
  
  <div className="space-y-6">
    {/* Feature 1 */}
    <div className="flex">
      <div className="flex-shrink-0">
        <div className="bg-nexapay-100 w-12 h-12 rounded-full flex items-center justify-center">
          <QrCode className="h-6 w-6 text-nexapay-600" />
        </div>
      </div>
      <div className="ml-4">
        <h3 className="text-lg font-medium text-gray-800">Pay Offline</h3>
        <p className="mt-1 text-gray-500">
          Make payments even without an internet connection using secure QR codes.
        </p>
      </div>
    </div>

    {/* Feature 2 */}
    <div className="flex">
      <div className="flex-shrink-0">
        <div className="bg-nexapay-100 w-12 h-12 rounded-full flex items-center justify-center">
          <Cloud className="h-6 w-6 text-nexapay-600" />
        </div>
      </div>
      <div className="ml-4">
        <h3 className="text-lg font-medium text-gray-800">Sync Anywhere</h3>
        <p className="mt-1 text-gray-500">
          Your transactions sync automatically when you reconnect to the internet.
        </p>
      </div>
    </div>

    {/* Feature 3 */}
    <div className="flex">
      <div className="flex-shrink-0">
        <div className="bg-nexapay-100 w-12 h-12 rounded-full flex items-center justify-center">
          <div className="relative">
            <Shield className="h-6 w-6 text-nexapay-600" />
            <Lock className="h-3 w-3 text-nexapay-600 absolute bottom-0 right-0" />
          </div>
        </div>
      </div>
      <div className="ml-4">
        <h3 className="text-lg font-medium text-gray-800">No Double Spending</h3>
        <p className="mt-1 text-gray-500">
          Our unique token system ensures your money can only be spent once, even offline.
        </p>
      </div>
    </div>
  </div>
</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;