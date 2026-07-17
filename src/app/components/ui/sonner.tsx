"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Older users need longer to notice and read a toast
      duration={6000}
      // Clears the fixed bottom-nav bar (only rendered < md, only when
      // logged in) — matches .install-prompt's own bottom-24 clearance.
      mobileOffset={{ bottom: '6rem' }}
      toastOptions={{
        style: { fontSize: "1rem" },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
