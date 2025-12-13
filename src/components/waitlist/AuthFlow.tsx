import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, Phone, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const emailSchema = z.string().email("Please enter a valid email");
const phoneSchema = z.string().min(10, "Please enter a valid phone number");

type AuthMethod = "select" | "google" | "phone" | "email";
type PhoneStep = "input" | "otp";
type EmailStep = "input" | "password";

export const AuthFlow = () => {
  const [method, setMethod] = useState<AuthMethod>("select");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("input");
  const [emailStep, setEmailStep] = useState<EmailStep>("input");
  const [loading, setLoading] = useState(false);
  
  // Form values
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/waitlist`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with Google");
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async () => {
    try {
      phoneSchema.parse(phone);
    } catch {
      toast.error("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+1${phone}`;
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });
      if (error) throw error;
      setPhoneStep("otp");
      toast.success("OTP sent to your phone");
    } catch (error: any) {
      toast.error(error.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+1${phone}`;
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: "sms",
      });
      if (error) throw error;
      toast.success("Phone verified successfully!");
    } catch (error: any) {
      toast.error(error.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    try {
      emailSchema.parse(email);
    } catch {
      toast.error("Please enter a valid email");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/waitlist`,
          },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("Email already registered. Please sign in instead.");
            setIsSignUp(false);
          } else {
            throw error;
          }
        } else {
          toast.success("Account created successfully!");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Signed in successfully!");
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const renderMethodSelector = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Join the Waitlist</h2>
        <p className="text-gray-600">Sign in to secure your spot</p>
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full h-14 bg-white border-2 border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-gray-300 rounded-xl font-medium"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Continue with Google
        </Button>

        <Button
          onClick={() => setMethod("phone")}
          className="w-full h-14 bg-white border-2 border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-gray-300 rounded-xl font-medium"
        >
          <Phone className="w-5 h-5 mr-3" />
          Continue with Phone
        </Button>

        <Button
          onClick={() => setMethod("email")}
          className="w-full h-14 bg-white border-2 border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-gray-300 rounded-xl font-medium"
        >
          <Mail className="w-5 h-5 mr-3" />
          Continue with Email
        </Button>
      </div>
    </motion.div>
  );

  const renderPhoneFlow = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <button
        onClick={() => {
          setMethod("select");
          setPhoneStep("input");
          setPhone("");
          setOtp("");
        }}
        className="text-gray-500 hover:text-gray-900 text-sm font-medium"
      >
        ← Back
      </button>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {phoneStep === "input" ? "Enter your phone" : "Verify OTP"}
        </h2>
        <p className="text-gray-600">
          {phoneStep === "input" 
            ? "We'll send you a verification code" 
            : `Code sent to ${phone}`}
        </p>
      </div>

      {phoneStep === "input" ? (
        <div className="space-y-4">
          <Input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-14 text-lg rounded-xl border-2"
          />
          <Button
            onClick={handlePhoneSubmit}
            disabled={loading}
            className="w-full h-14 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Code"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center">
            <InputOTP value={otp} onChange={setOtp} maxLength={6}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            onClick={handleOtpVerify}
            disabled={loading || otp.length !== 6}
            className="w-full h-14 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify"}
          </Button>
        </div>
      )}
    </motion.div>
  );

  const renderEmailFlow = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <button
        onClick={() => {
          setMethod("select");
          setEmailStep("input");
          setEmail("");
          setPassword("");
        }}
        className="text-gray-500 hover:text-gray-900 text-sm font-medium"
      >
        ← Back
      </button>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isSignUp ? "Create account" : "Welcome back"}
        </h2>
        <p className="text-gray-600">
          {isSignUp ? "Enter your email to get started" : "Sign in to continue"}
        </p>
      </div>

      <div className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-14 text-lg rounded-xl border-2"
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-14 text-lg rounded-xl border-2"
        />
        <Button
          onClick={handleEmailAuth}
          disabled={loading}
          className="w-full h-14 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isSignUp ? "Sign Up" : "Sign In"}
        </Button>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center text-gray-600 hover:text-gray-900 text-sm font-medium"
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-[400px]">
      {method === "select" && renderMethodSelector()}
      {method === "phone" && renderPhoneFlow()}
      {method === "email" && renderEmailFlow()}
    </div>
  );
};
