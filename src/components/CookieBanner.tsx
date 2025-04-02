import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { useToast } from "../hooks/useToast";

interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
}

const CookieBanner = () => {
  const { toast } = useToast();
  const [showBanner, setShowBanner] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    functional: true,
    analytics: true,
  });

  useEffect(() => {
    const consentStatus = localStorage.getItem("cookieConsent");
    if (!consentStatus) {
      setShowBanner(true);
    } else {
      const savedPreferences = JSON.parse(consentStatus);
      setPreferences({
        necessary: savedPreferences.necessary,
        functional: savedPreferences.functional,
        analytics: savedPreferences.analytics
      });
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

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-5 w-fit right-5 rounded-lg border border-black/20 dark:border-white/20 bg-background border-b p-4 shadow-lg z-[9999]">
      <div className="container mx-auto max-w-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Cookie Preferences</h3>
            <p className="text-sm text-muted-foreground mb-4">
              We use cookies to enhance your browsing experience and analyze our
              traffic. Please choose your preferences below.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="necessary"
                  checked={preferences.necessary}
                  disabled
                  className="h-4 w-4"
                />
                <label htmlFor="necessary" className="text-sm font-medium">
                  Necessary (Required)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="functional"
                  checked={preferences.functional}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      functional: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                <label htmlFor="functional" className="text-sm">
                  Functional (Enhanced features)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="analytics"
                  checked={preferences.analytics}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      analytics: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                <label htmlFor="analytics" className="text-sm">
                  Analytics (Usage data)
                </label>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 self-end">
            <Button
              className="text-sm"
              variant="outline"
              onClick={() => {
                const essentialPrefs = {
                  necessary: true,
                  functional: false,
                  analytics: false,
                };
                setPreferences(essentialPrefs);
                localStorage.setItem(
                  "cookieConsent",
                  JSON.stringify({
                    ...essentialPrefs,
                    timestamp: new Date().toISOString(),
                  })
                );
                setShowBanner(false);
                toast({
                  title: "Cookie Preferences Saved",
                  description: "Only essential cookies will be used.",
                  duration: 3000,
                });
              }}
            >
              Essential Only
            </Button>
            <Button onClick={handleAcceptAll} className="text-sm">
              Accept All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
