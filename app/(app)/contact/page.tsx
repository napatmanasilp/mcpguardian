"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface FormState {
  status: "idle" | "submitting" | "success" | "error";
  error?: string;
}

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });
  const [state, setState] = useState<FormState>({ status: "idle" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ status: "submitting" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Failed to submit inquiry");
      }

      setState({ status: "success" });
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    }
  };

  if (state.status === "success") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <Card className="w-full max-w-lg border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Mail className="size-6 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold">Message Received</h2>
            <p className="text-sm text-slate-400">
              Thank you for reaching out. Our team will get back to you within 1–2 business days.
            </p>
            <Link href="/upgrade">
              <Button variant="outline" className="mt-4 gap-2">
                <ArrowLeft className="size-4" />
                Back to Pricing
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Link
            href="/upgrade"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="size-3" />
            Back to Pricing
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Contact Sales</h1>
          <p className="text-sm text-slate-400">
            Interested in MCPGuardian Enterprise? Fill out the form below and our team will reach out to discuss your requirements.
          </p>
        </div>

        {/* Form */}
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardHeader>
            <CardTitle className="text-base">Enterprise Inquiry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Your full name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Your company name"
                  required
                  value={form.company}
                  onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Tell us about your security requirements, team size, and timeline..."
                  rows={5}
                  required
                  value={form.message}
                  onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                />
              </div>

              {state.status === "error" && (
                <p className="text-sm text-red-400">{state.error}</p>
              )}

              <Button
                type="submit"
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                disabled={state.status === "submitting"}
              >
                {state.status === "submitting" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Send className="size-4" />
                    Send Inquiry
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
