import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

interface CookiePreferences {
  functional: boolean;
  analytics: boolean;
}

const CookiePolicy = () => {
  const [preferences, setPreferences] = useState<CookiePreferences>({
    functional: true,
    analytics: true,
  });

  const handleSavePreferences = () => {
    localStorage.setItem(
      "cookieConsent",
      JSON.stringify({
        ...preferences,
        timestamp: new Date().toISOString(),
      })
    );
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cookie Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-3">What Are Cookies?</h2>
              <p className="text-muted-foreground">
                Cookies are small text files that are stored on your device when
                you visit our website. They help us provide you with a better
                experience by remembering your preferences, analyzing how you use
                our site, and enabling certain features to work properly.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-3">Types of Cookies We Use</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Essential Cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    These cookies are necessary for the website to function
                    properly. They enable core functionality such as user
                    authentication, session management, and security. You cannot
                    disable these cookies as they are essential for the website to
                    work correctly.
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 ml-4">
                    <li>Firebase Authentication tokens</li>
                    <li>Session security tokens</li>
                    <li>CSRF protection tokens</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold">Functional Cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    These cookies enable the website to provide enhanced
                    functionality and personalization. They may be set by us or by
                    third-party providers whose services we have added to our
                    pages.
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 ml-4">
                    <li>User preferences</li>
                    <li>Language settings</li>
                    <li>Theme preferences</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold">Analytics Cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    These cookies help us understand how visitors interact with our
                    website by collecting and reporting information anonymously.
                    This helps us improve our website and services.
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 ml-4">
                    <li>Page view statistics</li>
                    <li>User behavior analytics</li>
                    <li>Performance monitoring</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-3">Managing Your Cookie Preferences</h2>
              <p className="text-muted-foreground mb-4">
                You can manage your cookie preferences at any time. Please note
                that disabling certain cookies may impact the functionality of our
                website.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Essential Cookies</h3>
                    <p className="text-sm text-muted-foreground">Required for basic site functionality</p>
                  </div>
                  <Button variant="outline" disabled>
                    Always Active
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Functional Cookies</h3>
                    <p className="text-sm text-muted-foreground">Enhanced features and personalization</p>
                  </div>
                  <Button
                    variant={preferences.functional ? "default" : "outline"}
                    onClick={() =>
                      setPreferences({
                        ...preferences,
                        functional: !preferences.functional,
                      })
                    }
                  >
                    {preferences.functional ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Analytics Cookies</h3>
                    <p className="text-sm text-muted-foreground">Help us improve our website</p>
                  </div>
                  <Button
                    variant={preferences.analytics ? "default" : "outline"}
                    onClick={() =>
                      setPreferences({
                        ...preferences,
                        analytics: !preferences.analytics,
                      })
                    }
                  >
                    {preferences.analytics ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              </div>

              <div className="mt-6">
                <Button onClick={handleSavePreferences}>Save Preferences</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CookiePolicy;