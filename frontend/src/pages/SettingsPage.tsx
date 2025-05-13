
import { useState } from "react";
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import GreenButton from "@/components/GreenButton";
import { useAuth } from "@/contexts/AuthContext";
import { 
  User, 
  Lock,
  Smartphone,
  Bell,
  CreditCard,
  CheckCircle,
  Shield,
  ChevronRight,
  LogOut,
  Building
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";

const SettingsPage = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [transactionAlerts, setTransactionAlerts] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  
  // Offline preferences
  const [autoReserveEnabled, setAutoReserveEnabled] = useState(false);
  const [autoReserveAmount, setAutoReserveAmount] = useState(20);
  const [qrExpiration, setQrExpiration] = useState(5);

  const handleChangePassword = () => {
    // Would handle password change logic here
    if (passwordNew !== passwordConfirm) {
      toast({
        title: "Passwords don't match",
        description: "Your new password and confirmation must match.",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Password updated",
      description: "Your password has been changed successfully."
    });
    
    setPasswordCurrent("");
    setPasswordNew("");
    setPasswordConfirm("");
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Preferences saved",
      description: "Your notification settings have been updated."
    });
  };

  const handleSaveOfflineSettings = () => {
    toast({
      title: "Offline settings saved",
      description: "Your offline payment preferences have been updated."
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-dark">Settings</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Settings Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <WhiteCard className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-greenleaf-100 flex items-center justify-center">
                  <User size={32} className="text-greenleaf-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-dark">{user?.username || "User Name"}</h2>
                  <p className="text-dark-lighter">{user?.email || "user@example.com"}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="ml-auto"
                >
                  Edit Profile
                </Button>
              </div>
              
              <Accordion type="single" collapsible>
                <AccordionItem value="personal-info">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <User size={18} />
                      Personal Information
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="first-name">First Name</Label>
                          <Input 
                            id="first-name" 
                            defaultValue={user?.username?.split(" ")[0] || ""}
                            placeholder="First name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last-name">Last Name</Label>
                          <Input 
                            id="last-name" 
                            defaultValue={user?.username?.split(" ")[1] || ""}
                            placeholder="Last name"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input 
                          id="email" 
                          type="email"
                          defaultValue={user?.email || ""}
                          placeholder="Your email"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input 
                          id="phone" 
                          placeholder="Your phone number"
                        />
                      </div>
                      
                      <div className="pt-2 flex justify-end">
                        <GreenButton>Save Changes</GreenButton>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="security">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <Lock size={18} />
                      Security
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <h3 className="font-medium text-dark">Change Password</h3>
                      
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input 
                          id="current-password" 
                          type="password"
                          value={passwordCurrent}
                          onChange={e => setPasswordCurrent(e.target.value)}
                          placeholder="Your current password"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input 
                          id="new-password" 
                          type="password"
                          value={passwordNew}
                          onChange={e => setPasswordNew(e.target.value)}
                          placeholder="Your new password"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input 
                          id="confirm-password" 
                          type="password"
                          value={passwordConfirm}
                          onChange={e => setPasswordConfirm(e.target.value)}
                          placeholder="Confirm your new password"
                        />
                      </div>
                      
                      <div className="pt-2 flex justify-end">
                        <Button 
                          variant="outline" 
                          className="flex items-center gap-2"
                          onClick={handleChangePassword}
                          disabled={!passwordCurrent || !passwordNew || !passwordConfirm}
                        >
                          <Shield size={16} />
                          Update Password
                        </Button>
                      </div>
                      
                      <Separator className="my-4" />
                      
                      <div className="space-y-4">
                        <h3 className="font-medium text-dark">Two-Factor Authentication</h3>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-dark">Enable 2FA</p>
                            <p className="text-sm text-dark-lighter">
                              Add an extra layer of security to your account
                            </p>
                          </div>
                          <Switch id="2fa" defaultChecked={false} />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="notifications">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <Bell size={18} />
                      Notifications
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-dark">Email Notifications</p>
                          <p className="text-sm text-dark-lighter">
                            Receive transaction confirmations and account updates
                          </p>
                        </div>
                        <Switch 
                          id="email-notifications" 
                          checked={emailNotifications}
                          onCheckedChange={setEmailNotifications}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-dark">Push Notifications</p>
                          <p className="text-sm text-dark-lighter">
                            Get alerts on your device about account activity
                          </p>
                        </div>
                        <Switch 
                          id="push-notifications" 
                          checked={pushNotifications}
                          onCheckedChange={setPushNotifications}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-dark">Transaction Alerts</p>
                          <p className="text-sm text-dark-lighter">
                            Get notified about new transactions in your account
                          </p>
                        </div>
                        <Switch 
                          id="transaction-alerts" 
                          checked={transactionAlerts}
                          onCheckedChange={setTransactionAlerts}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-dark">Marketing Communications</p>
                          <p className="text-sm text-dark-lighter">
                            Receive news, updates, and special offers
                          </p>
                        </div>
                        <Switch 
                          id="marketing-emails" 
                          checked={marketingEmails}
                          onCheckedChange={setMarketingEmails}
                        />
                      </div>
                      
                      <div className="pt-2 flex justify-end">
                        <GreenButton onClick={handleSaveNotifications}>
                          Save Preferences
                        </GreenButton>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="offline-settings">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <Smartphone size={18} />
                      Offline Settings
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-dark">Auto-Reserve Funds</p>
                          <p className="text-sm text-dark-lighter">
                            Automatically reserve funds for offline use
                          </p>
                        </div>
                        <Switch 
                          id="auto-reserve" 
                          checked={autoReserveEnabled}
                          onCheckedChange={setAutoReserveEnabled}
                        />
                      </div>
                      
                      {autoReserveEnabled && (
                        <div className="space-y-2 pl-6 border-l-2 border-gray-100">
                          <Label htmlFor="auto-reserve-amount">Auto-Reserve Amount ($)</Label>
                          <Input 
                            id="auto-reserve-amount" 
                            type="number"
                            value={autoReserveAmount}
                            onChange={e => setAutoReserveAmount(Number(e.target.value))}
                            min={5}
                            max={500}
                          />
                          <p className="text-xs text-dark-lighter">
                            This amount will be automatically reserved for offline use
                          </p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label htmlFor="qr-expiration">QR Code Expiration (minutes)</Label>
                        <Input 
                          id="qr-expiration" 
                          type="number"
                          value={qrExpiration}
                          onChange={e => setQrExpiration(Number(e.target.value))}
                          min={1}
                          max={60}
                        />
                        <p className="text-xs text-dark-lighter">
                          How long generated QR codes remain valid
                        </p>
                      </div>
                      
                      <div className="pt-2 flex justify-end">
                        <GreenButton onClick={handleSaveOfflineSettings}>
                          Save Settings
                        </GreenButton>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </WhiteCard>
            
            {/* Connected Devices */}
            <WhiteCard className="p-6">
              <h2 className="text-lg font-semibold text-dark flex items-center gap-2 mb-4">
                <Smartphone size={18} />
                Connected Devices
              </h2>
              
              <div className="space-y-4">
                <div className="p-4 border rounded-lg flex items-center">
                  <div className="bg-greenleaf-100 p-2 rounded-full mr-3">
                    <Smartphone size={20} className="text-greenleaf-600" />
                  </div>
                  <div>
                    <p className="text-dark font-medium">Current Device</p>
                    <p className="text-sm text-dark-lighter">Last active: Just now</p>
                  </div>
                  <CheckCircle size={18} className="text-greenleaf-500 ml-auto" />
                </div>
                
                <div className="text-center py-4 text-dark-lighter">
                  No other devices are logged in
                </div>
              </div>
            </WhiteCard>
          </div>
          
          {/* Payment Methods Column */}
          <div className="space-y-6">
            {/* Payment Methods */}
            <WhiteCard className="p-6">
              <h2 className="text-lg font-semibold text-dark flex items-center gap-2 mb-4">
                <CreditCard size={18} />
                Payment Methods
              </h2>
              
              <div className="space-y-4">
                <Button className="w-full justify-start text-left" variant="outline">
                  <CreditCard size={16} className="mr-2" />
                  Add Card
                  <ChevronRight size={16} className="ml-auto" />
                </Button>
                
                <Button className="w-full justify-start text-left" variant="outline">
                  <Building size={16} className="mr-2" />
                  Link Bank Account
                  <ChevronRight size={16} className="ml-auto" />
                </Button>
              </div>
            </WhiteCard>
            
            {/* Help & Support */}
            <WhiteCard className="p-6">
              <h2 className="text-lg font-semibold text-dark mb-4">
                Help & Support
              </h2>
              
              <div className="space-y-3">
                <Button className="w-full justify-start text-left" variant="outline">
                  Contact Support
                  <ChevronRight size={16} className="ml-auto" />
                </Button>
                
                <Button className="w-full justify-start text-left" variant="outline">
                  FAQ
                  <ChevronRight size={16} className="ml-auto" />
                </Button>
                
                <Button className="w-full justify-start text-left" variant="outline">
                  Privacy Policy
                  <ChevronRight size={16} className="ml-auto" />
                </Button>
                
                <Button className="w-full justify-start text-left" variant="outline">
                  Terms of Service
                  <ChevronRight size={16} className="ml-auto" />
                </Button>
              </div>
            </WhiteCard>
            
            {/* Account Actions */}
            <WhiteCard className="p-6">
              <h2 className="text-lg font-semibold text-dark mb-4">
                Account Actions
              </h2>
              
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-left text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={logout}
                >
                  <LogOut size={16} className="mr-2" />
                  Log out
                </Button>
              </div>
            </WhiteCard>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;
