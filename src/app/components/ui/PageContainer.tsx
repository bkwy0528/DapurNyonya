import * as React from 'react';

export default function PageContainer({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="page-container">
      <div className={`page-container__inner ${narrow ? 'page-container__inner--narrow' : ''}`}>
        {children}
      </div>
    </div>
  );
}
