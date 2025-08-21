import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateApiKeysMutation } from '@/services/queries';
import { OnboardingLayout } from './OnboardingLayout';

export function ApiKeysForm() {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const updateKeys = useUpdateApiKeysMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!anthropicKey.trim()) {
      setError('Please provide your Anthropic API key');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateKeys.mutateAsync({ anthropic_api_key: anthropicKey.trim() });
      navigate('/onboarding/default-repo');
    } catch {
      setError('Failed to save API keys. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <OnboardingLayout 
      currentStep="api-keys"
      title="Add your Anthropic API key to get started"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="anthropic-key" className="block text-sm font-medium text-gray-700 mb-1">
            Anthropic API Key
          </label>
          <div className="relative">
            <Input
              id="anthropic-key"
              type={showAnthropicKey ? 'text' : 'password'}
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="pr-10"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowAnthropicKey(!showAnthropicKey)}
            >
              {showAnthropicKey ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="flex flex-col space-y-3">
          <Button 
            type="submit" 
            disabled={isSubmitting || !anthropicKey.trim()}
            className="w-full"
          >
            {isSubmitting ? 'Saving...' : 'Save & Continue'}
          </Button>
        </div>

        <div className="text-xs text-gray-500 text-center">
          Your API keys are encrypted and stored securely
        </div>
      </form>
    </OnboardingLayout>
  );
}