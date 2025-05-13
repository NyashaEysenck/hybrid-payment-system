import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, Cloud, Shield, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GreenButton from "@/components/GreenButton";
import { useAuth } from "@/contexts/AuthContext";

const SignUpPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { register } = useAuth(); // Moved to top level with other hooks

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
  
    try {
      const username = name;
      await register(username, email, password);
      
      toast({
        title: "Account Created",
        description: "Your NexaPay account has been created successfully!",
      });
      
      navigate("/login");
    } catch (error) {
      console.log(error);
      toast({
        title: "Sign Up Failed",
        description: error instanceof Error ? error.message : "Registration failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold text-nexapay-600">NexaPay</h1>
        <p className="mt-2 text-center text-sm text-dark-lighter">
          Create your account to start secure payments
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-5xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Panel (Sign Up Form) */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Create Account</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <div className="mt-1">
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-primary"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="mt-1">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-primary"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="mt-1">
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-primary"
                    />
                  </div>
                </div>

                <div>
                  <GreenButton
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Sign Up"
                    )}
                  </GreenButton>
                </div>

                <div className="mt-4 text-center">
                  <span className="text-gray-600">Already have an account?</span>
                  <Link to="/login" className="ml-1 font-medium text-nexapay-600 hover:text-nexapay-500">
                    Sign in
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

export default SignUpPage;
