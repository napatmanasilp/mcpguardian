import { ShieldLogo } from "@/components/auth/shield-logo";
import { Card, CardContent } from "@/components/ui/card";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <ShieldLogo />
        <Card className="border-border/60 shadow-lg">
          <CardContent className="pt-6">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthLayout;
