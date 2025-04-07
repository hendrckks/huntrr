import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { useToast } from "../hooks/useToast";
import { Link } from "react-router-dom";

const CookieBanner = () => {
  const { toast } = useToast();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consentStatus = localStorage.getItem("cookieConsent");
    if (!consentStatus) {
      setShowBanner(true);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(
      "cookieConsent",
      JSON.stringify({
        necessary: true,
        functional: true,
        analytics: true,
        timestamp: new Date().toISOString(),
      })
    );
    setShowBanner(false);
    toast({
      title: "Cookies Accepted",
      description: "Your cookie preferences have been saved.",
      duration: 3000,
    });
  };

  const handleEssentialOnly = () => {
    localStorage.setItem(
      "cookieConsent",
      JSON.stringify({
        necessary: true,
        functional: false,
        analytics: false,
        timestamp: new Date().toISOString(),
      })
    );
    setShowBanner(false);
    toast({
      title: "Cookie Preferences Saved",
      description: "Only essential cookies will be used.",
      duration: 3000,
    });
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-[350px] w-[90%] rounded-lg border border-black/20 dark:border-white/20 bg-background p-3 shadow-lg">
      <div className="flex flex-col space-y-3">
        <p className="text-sm text-muted-foreground">
          We use cookies to personalize content and analyze traffic. Read our{" "}
          <Link to="/cookie-policy" className="text-primary hover:underline">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleEssentialOnly}
            className="text-xs px-3 py-1 h-auto"
          >
            Okay
          </Button>
          <Button 
            size="sm" 
            onClick={handleAcceptAll}
            className="text-xs px-3 py-1 h-auto"
          >
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
