import * as React from 'react';

export default function FormSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className || ''}`}>
      {children}
    </div>
  );
}
