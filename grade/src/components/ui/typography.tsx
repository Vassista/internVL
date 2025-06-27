import React from 'react';

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
}

export function EducationalHeading({
  children,
  className = ""
}: TypographyProps) {
  return (
    <h1 className={`font-sans text-3xl font-semibold ${className}`}>
      {children}
    </h1>
  );
}

export function EducationalSubheading({
  children,
  className = ""
}: TypographyProps) {
  return (
    <h2 className={`font-sans text-xl ${className}`}>
      {children}
    </h2>
  );
}

export function EducationalText({
  children,
  className = ""
}: TypographyProps) {
  return (
    <p className={`font-sans ${className}`}>
      {children}
    </p>
  );
}
