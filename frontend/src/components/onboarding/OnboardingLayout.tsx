import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import swarmLogo from '@/assets/swarm-logo.png';
import { OnboardingProgress } from './OnboardingProgress';

interface OnboardingLayoutProps {
  children: ReactNode;
  currentStep: 'api-keys' | 'default-repo';
  title: string;
}

export function OnboardingLayout({ children, currentStep, title }: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <img 
              src={swarmLogo} 
              alt="Swarm" 
              className="h-8 w-auto mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Set up your workspace
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              {title}
            </p>
            <OnboardingProgress currentStep={currentStep} />
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}