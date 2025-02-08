import type React from "react";
import { useState } from "react";
import { KeyRound, Mail, Loader2 } from "lucide-react";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "../../lib/firebase/clientApp";
import { loginSchema, type UserRole } from "../../lib/types/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../hooks/useToast";
import { AuthStateManager } from "../../lib/firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase/clientApp";
import type { User } from "../../lib/types/auth";

// Import shadcn components
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardContent } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";

const AdminAuthFlow: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const validatedData = loginSchema.parse({ email, password });
      await setPersistence(auth, browserSessionPersistence);
      
      const userCredential = await signInWithEmailAndPassword(
        auth,
        validatedData.email,
        validatedData.password
      );

      const idTokenResult = await userCredential.user.getIdTokenResult(true);
      console.log("Claims on Login:", idTokenResult.claims);

      if (idTokenResult.claims.role !== "admin") {
        throw new Error("You do not have admin privileges.");
      }

      const userRef = doc(db, "users", userCredential.user.uid);
      await updateDoc(userRef, {
        lastLoggedIn: serverTimestamp(),
      });

      const userWithRole: User = {
        ...userCredential.user,
        role: idTokenResult.claims.role as UserRole,
      };

      setUser(userWithRole);

      const authManager = AuthStateManager.getInstance();
      await authManager.startSessionTimeout();

      console.log("Admin user logged in:", userWithRole);
      navigate("/admin-dashboard");

      toast({
        title: "Welcome!",
        variant: "success",
        description: "Admin Sign In successful",
        duration: 5000,
      });
    } catch (error: any) {
      let errorMessage = "Login failed";

      if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "No admin account found with this email.";
      } else if (error.message === "You do not have admin privileges.") {
        errorMessage = "You do not have admin privileges.";
      }

      setError(errorMessage);
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center md:mt-0 mt-20">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <h2 className="text-xl font-medium text-center">Admin Login</h2>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                  className="pl-10"
                />
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-10"
                />
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Login as Admin
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuthFlow;
