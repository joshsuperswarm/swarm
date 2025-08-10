import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OnboardingService } from '@/services/onboarding';
import { useBackendApi } from '@/services/auth';
import { OnboardingLayout } from './OnboardingLayout';

export function ApiKeysForm() {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const api = useBackendApi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!anthropicKey.trim() && !openaiKey.trim()) {
      setError('Please provide at least one API key');
      return;
    }

    setIsSubmitting(true);
    try {
      await api(async (token) => {
        await OnboardingService.updateApiKeys(token, {
          anthropic_api_key: anthropicKey.trim() || undefined,
          openai_api_key: openaiKey.trim() || undefined,
        });
      });
      
      navigate('/onboarding/default-repo');
    } catch (err) {
      console.error('Failed to save API keys:', err);
      setError('Failed to save API keys. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipOpenAI = async () => {
    if (!anthropicKey.trim()) {
      setError('Please provide at least the Anthropic API key');
      return;
    }

    setIsSubmitting(true);
    try {
      await api(async (token) => {
        await OnboardingService.updateApiKeys(token, {
          anthropic_api_key: anthropicKey.trim(),
        });
      });
      
      navigate('/onboarding/default-repo');
    } catch (err) {
      console.error('Failed to save API keys:', err);
      setError('Failed to save API keys. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipAnthropic = async () => {
    if (!openaiKey.trim()) {
      setError('Please provide at least the OpenAI API key');
      return;
    }

    setIsSubmitting(true);
    try {
      await api(async (token) => {
        await OnboardingService.updateApiKeys(token, {
          openai_api_key: openaiKey.trim(),
        });
      });
      
      navigate('/onboarding/default-repo');
    } catch (err) {
      console.error('Failed to save API keys:', err);
      setError('Failed to save API keys. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OnboardingLayout 
      currentStep="api-keys"
      title="Add your AI API keys to get started"
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

        <div>
          <label htmlFor="openai-key" className="block text-sm font-medium text-gray-700 mb-1">
            OpenAI API Key
          </label>
          <div className="relative">
            <Input
              id="openai-key"
              type={showOpenaiKey ? 'text' : 'password'}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="pr-10"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowOpenaiKey(!showOpenaiKey)}
            >
              {showOpenaiKey ? (
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
            disabled={isSubmitting || (!anthropicKey.trim() && !openaiKey.trim())}
            className="w-full"
          >
            {isSubmitting ? 'Saving...' : 'Save & Continue'}
          </Button>
          
          {anthropicKey.trim() && !openaiKey.trim() && (
            <Button 
              type="button"
              variant="outline"
              onClick={handleSkipOpenAI}
              disabled={isSubmitting}
              className="w-full"
            >
              Continue with Anthropic only
            </Button>
          )}

          {openaiKey.trim() && !anthropicKey.trim() && (
            <Button 
              type="button"
              variant="outline"
              onClick={handleSkipAnthropic}
              disabled={isSubmitting}
              className="w-full"
            >
              Continue with OpenAI only
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 text-center">
          Your API keys are encrypted and stored securely
        </div>
      </form>
    </OnboardingLayout>
  );
}