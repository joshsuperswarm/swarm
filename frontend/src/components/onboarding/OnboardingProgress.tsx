interface OnboardingProgressProps {
  currentStep: 'api-keys' | 'default-repo';
}

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const steps = [
    { key: 'api-keys', label: 'API Keys' },
    { key: 'default-repo', label: 'Default Repository' }
  ];

  return (
    <div className="flex justify-center items-center space-x-4 mb-6">
      {steps.map((step, index) => (
        <div key={step.key} className="flex items-center">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
            ${step.key === currentStep 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-600'
            }
          `}>
            {index + 1}
          </div>
          <span className={`ml-2 text-sm ${
            step.key === currentStep ? 'text-blue-600 font-medium' : 'text-gray-500'
          }`}>
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <div className="w-8 h-px bg-gray-300 mx-4" />
          )}
        </div>
      ))}
    </div>
  );
}