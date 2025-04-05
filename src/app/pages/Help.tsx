import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import {
  Mail,
  MessageSquare,
  Phone,
  HelpCircle,
  FileText,
  Shield,
  Home,
  User,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../../hooks/useToast";

const Help = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleStartChat = () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to chat with support",
        variant: "warning",
        duration: 5000,
      });
      navigate("/login");
      return;
    }

    // Navigate to chats with the admin ID as a parameter
    navigate(`/chats?landlordId=z3Au7wwm20ZIfgtsjcxaBCRphGn1`);
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Help & Support</h1>
        <p className="text-muted-foreground">
          Find answers to common questions or reach out for assistance
        </p>
      </div>

      <Tabs defaultValue="faq" className="w-full px-2 md:px-0">
        <div className="w-full md:w-fit overflow-x-auto pb-4">
          <TabsList className="bg-black/5 dark:bg-white/10 w-max md:min-w-full overflow-scroll inline-flex p-1 gap-2">
            <TabsTrigger value="faq">Frequently Asked Questions</TabsTrigger>
            <TabsTrigger value="contact">Contact Support</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">How do I create an account?</h3>
                <p className="text-sm text-muted-foreground">
                  Click on the "Login " button on the 3 dot button at the
                  bottom of the sidebar. You can register using your email or
                  your google account. Follow the prompts to complete your
                  profile information.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">How do I edit my profile?</h3>
                <p className="text-sm text-muted-foreground">
                  Once logged in, navigate to the sidebar and click on "Settings
                  & Privacy". Here you can update your personal information,
                  contact details, update or change your passwords, and
                  preferences.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">
                  What is KYC verification and why is it required?
                </h3>
                <p className="text-sm text-muted-foreground">
                  KYC (Know Your Customer) verification helps us confirm your
                  identity for security purposes. This process is required for
                  landlords to list properties. It helps create a trusted
                  community on Huntrr.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">How do I reset my password?</h3>
                <p className="text-sm text-muted-foreground">
                  Click on "Forgot Password" on the login page. Enter your email
                  address, and we'll send you a link to reset your password.
                  Follow the instructions in the email to create a new password.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Listings & Properties
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">
                  How do I create a property listing?
                </h3>
                <p className="text-sm text-muted-foreground">
                  After completing KYC verification, go to your dashboard or
                  sidebar and click "Create Listing". Fill out the property
                  details, upload photos, set your pricing, and specify
                  availability. Review all information before publishing.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">
                  How do I edit or remove my listing?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Go to your dashboard, find the listing you want to modify, and
                  click the pen icon. Make your changes and save. To remove a
                  listing, click on the options menu for that listing and select
                  "Remove Listing".
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">
                  How do I bookmark properties I'm interested in?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Click the bookmark icon on any property listing to save it to
                  your bookmarks. You can view all your bookmarked properties by
                  clicking on "Bookmarks" in the sidebar menu.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">
                  What information should I include in my listing?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Include accurate details about location, size, number of
                  rooms, amenities, rent, deposit, availability dates, and
                  high-quality photos. The more detailed your listing, the more
                  likely you'll attract serious inquiries.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Communication & Bookings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">
                  How do I contact a landlord about a property?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Click the chat with owner button on the property listing. This
                  will open a chat where you can communicate directly with the
                  landlord. Be specific about your questions and interest in the
                  property.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">How do I schedule a viewing?</h3>
                <p className="text-sm text-muted-foreground">
                  After contacting the landlord through the messaging system,
                  you can discuss and arrange a viewing time that works for both
                  parties. Some properties may offer online viewing options as
                  well.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">
                  What should I do if I don't receive a response?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Landlords typically respond within 24-48 hours. If you haven't
                  received a response after this time, you can send a follow-up
                  message or contact our support team for assistance.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Safety & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">
                  How does Huntrr ensure user safety?
                </h3>
                <p className="text-sm text-muted-foreground">
                  We implement KYC verification for all landlord users, secure
                  messaging within the platform, property verification
                  processes, and a flagging system for suspicious activities. We
                  also provide safety tips for property viewings.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">
                  What should I do if I suspect a scam?
                </h3>
                <p className="text-sm text-muted-foreground">
                  If you encounter suspicious behavior, click the "flagging"
                  button on the listing or user profile. Our team will
                  investigate promptly. Never send money or personal financial
                  information outside our secure platform.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">
                  How is my personal information protected?
                </h3>
                <p className="text-sm text-muted-foreground">
                  We use industry-standard encryption and security measures to
                  protect your data. We only share your information with other
                  users as necessary for property transactions. Review our
                  Privacy Policy for more details.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Our Support Team</CardTitle>
              <CardDescription>
                We're here to help with any questions or issues you may have.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="p-6 border border-muted">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <Mail className="h-8 w-8 text-primary" />
                    <h3 className="font-semibold text-lg">Email Support</h3>
                    <p className="text-sm text-muted-foreground">
                      Get a response within 24 hours
                    </p>
                    <Button className="mt-2">support@huntrr.com</Button>
                  </div>
                </Card>

                <Card className="p-6 border border-muted">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <Phone className="h-8 w-8 text-primary" />
                    <h3 className="font-semibold text-lg">Phone Support</h3>
                    <p className="text-sm text-muted-foreground">
                      Available Monday-Friday, 9am-5pm
                    </p>
                    <Button className="mt-2 ">(555) 123-4567</Button>
                  </div>
                </Card>
              </div>

              <Card className="p-6 border border-muted">
                <div className="flex flex-col items-center text-center space-y-3">
                  <MessageSquare className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold text-lg">Live Chat</h3>
                  <p className="text-sm text-muted-foreground">
                    Chat with our support team in real-time
                  </p>
                  <Button
                    className="mt-2 select-none "
                    // disabled={true}
                    onClick={handleStartChat}
                  >
                    Start Chat
                  </Button>
                </div>
              </Card>

              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Emergency Contact</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      For urgent matters related to safety or security concerns
                      with a property or user, please call our emergency line at
                      (555) 987-6543.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Helpful Resources</CardTitle>
              <CardDescription>
                Guides and information to help you make the most of Huntrr
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-4 border border-muted hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <FileText className="h-6 w-6 text-primary" />
                    <div>
                      <h3 className="font-semibold">Tenant Guide</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Everything you need to know about finding and securing
                        your ideal rental property.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border border-muted hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <FileText className="h-6 w-6 text-primary" />
                    <div>
                      <h3 className="font-semibold">Landlord Guide</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Tips for creating attractive listings and managing your
                        properties effectively.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border border-muted hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <Shield className="h-6 w-6 text-primary" />
                    <div>
                      <h3 className="font-semibold">Safety Guidelines</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Important safety tips for property viewings and online
                        interactions.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border border-muted hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-6 w-6 text-primary" />
                    <div>
                      <h3 className="font-semibold">KYC Verification Guide</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Step-by-step instructions for completing the
                        verification process.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="mt-4">
                <h3 className="font-semibold mb-3">Legal Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer">
                    <FileText className="h-4 w-4" />
                    <span>Terms of Service</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer">
                    <FileText className="h-4 w-4" />
                    <span>Privacy Policy</span>
                  </div>
                  <Link
                    to="/cookie-policy"
                    className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Cookie Policy</span>
                  </Link>
                  <div className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer">
                    <FileText className="h-4 w-4" />
                    <span>Acceptable Use Policy</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Help;
