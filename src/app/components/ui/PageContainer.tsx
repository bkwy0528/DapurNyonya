import * as React from 'react';

export default function PageContainer({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="min-h-screen pb-12 pt-6">
      <div className={`mx-auto w-full px-4 md:px-6 ${narrow ? 'max-w-md' : 'max-w-4xl'}`}>
        {children}
      </div>
    </div>
  );
}
