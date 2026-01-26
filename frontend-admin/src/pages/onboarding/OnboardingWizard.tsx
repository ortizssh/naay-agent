import { useState, useEffect } from 'react';
import StepIndicator from '../../components/common/StepIndicator';
import PlatformSelect from './steps/PlatformSelect';
import ConnectStore from './steps/ConnectStore';
import ConfigureWidget from './steps/ConfigureWidget';
import Activate from './steps/Activate';
import { clientApi } from '../../services/api';

interface OnboardingWizardProps {
  initialStep?: number;
  onComplete: () => void;
}

function OnboardingWizard({ initialStep = 0, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedPlatform, setSelectedPlatform] = useState('shopify');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [widgetCode, setWidgetCode] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [widgetConfig, setWidgetConfig] = useState({
    position: 'bottom-right',
    color: '#6d5cff',
    welcomeMessage: 'Hola! Como puedo ayudarte?',
  });

  useEffect(() => {
    // Check URL for oauth success
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'success') {
      const step = parseInt(params.get('step') || '3', 10);
      setCurrentStep(step);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnectStore = async (domain: string) => {
    setIsConnecting(true);
    try {
      const response = await clientApi.connectStore(domain, selectedPlatform);
      if (response.data?.oauthUrl) {
        // Redirect to OAuth
        window.location.href = response.data.oauthUrl;
      }
    } catch (error) {
      setIsConnecting(false);
      throw error;
    }
  };

  const handleConfigChange = (key: string, value: string) => {
    setWidgetConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleNextFromConfig = async () => {
    try {
      // Save widget config
      await clientApi.updateWidgetConfig({
        widgetPosition: widgetConfig.position,
        widgetColor: widgetConfig.color,
        welcomeMessage: widgetConfig.welcomeMessage,
      });

      // Get widget code
      const codeResponse = await clientApi.getWidgetCode();
      setWidgetCode(codeResponse.data?.code || '');
      setShopDomain(codeResponse.data?.shopDomain || '');

      // Update onboarding step
      await clientApi.updateOnboardingStep(3, widgetConfig);

      setCurrentStep(3);
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const handleComplete = async () => {
    setIsActivating(true);
    try {
      await clientApi.updateOnboardingStep(4);
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsActivating(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <PlatformSelect
            selectedPlatform={selectedPlatform}
            onSelect={setSelectedPlatform}
            onNext={() => setCurrentStep(1)}
          />
        );
      case 1:
        return (
          <ConnectStore
            onBack={() => setCurrentStep(0)}
            onConnect={handleConnectStore}
            isConnecting={isConnecting}
          />
        );
      case 2:
        return (
          <ConfigureWidget
            config={widgetConfig}
            onConfigChange={handleConfigChange}
            onBack={() => setCurrentStep(1)}
            onNext={handleNextFromConfig}
          />
        );
      case 3:
        return (
          <Activate
            widgetCode={widgetCode}
            shopDomain={shopDomain}
            onBack={() => setCurrentStep(2)}
            onComplete={handleComplete}
            isActivating={isActivating}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="onboarding-container">
      <header className="onboarding-header">
        <div className="onboarding-logo">
          <div className="sidebar-logo-icon">K</div>
          <span className="sidebar-logo-text">Kova</span>
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          Paso {currentStep + 1} de 4
        </div>
      </header>

      <div className="onboarding-content">
        <div className="onboarding-card">
          <StepIndicator currentStep={currentStep} totalSteps={4} />
          {renderStep()}
        </div>
      </div>
    </div>
  );
}

export default OnboardingWizard;
