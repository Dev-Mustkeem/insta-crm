"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name");
    const businessName = formData.get("businessName");
    const phone = formData.get("phone");
    const email = formData.get("email");
    const password = formData.get("password");

    try {
      await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ ownerName: name, businessName, phone, email, password }),
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create an account</h1>
        <p className="text-sm text-slate-500 mt-2">Create your organization. This first account becomes its super admin.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" name="name" required minLength={2} maxLength={100} placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessName">Organization Name</Label>
            <Input id="businessName" name="businessName" required minLength={2} maxLength={100} placeholder="Acme Corp" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" name="phone" required minLength={7} maxLength={20} placeholder="+91 9876543210" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" required maxLength={254} placeholder="you@company.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={8} maxLength={72} />
        </div>

        <Button type="submit" className="w-full bg-[#00A651] hover:bg-[#008f45]" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#0057A8] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
