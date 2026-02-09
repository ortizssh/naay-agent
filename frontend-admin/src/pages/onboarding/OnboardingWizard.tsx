import { useState, useEffect } from 'react';
import StepIndicator from '../../components/common/StepIndicator';
import PlatformSelect from './steps/PlatformSelect';
import ConnectStore from './steps/ConnectStore';
import StoreInfo from './steps/StoreInfo';
import ConfigureWidget from './steps/ConfigureWidget';
import SyncAndActivate from './steps/SyncAndActivate';
import { clientApi } from '../../services/api';
import logoKova from '../../img/logo-kova.png';

interface OnboardingWizardProps {
  initialStep?: number;
  onComplete: () => void;
}

function OnboardingWizard({ initialStep = 0, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedPlatform, setSelectedPlatform] = useState('shopify');
  const [isConnecting, setIsConnecting] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState({
    position: 'bottom-right',
    color: '#6d5cff',
    welcomeMessage: 'Hola! Como puedo ayudarte?',
    brandName: '',
    subtitle: 'Asistente de compras con IA',
  });

  const totalSteps = 5;

  useEffect(() => {
    // Check URL for oauth success
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'success') {
      const step = parseInt(params.get('step') || '2', 10);
      setCurrentStep(step);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load brand name from store info when reaching ConfigureWidget
  useEffect(() => {
    if (currentStep === 3 && !widgetConfig.brandName) {
      clientApi.getStoreInfo().then(response => {
        if (response.data?.widget_brand_name) {
          setWidgetConfig(prev => ({
            ...prev,
            brandName: response.data.widget_brand_name || prev.brandName,
          }));
        }
      }).catch(() => {});
    }
  }, [currentStep]);

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
        widgetBrandName: widgetConfig.brandName,
        widgetSubtitle: widgetConfig.subtitle,
      });

      // Update onboarding step
      await clientApi.updateOnboardingStep(3, {
        widgetPosition: widgetConfig.position,
        widgetColor: widgetConfig.color,
        welcomeMessage: widgetConfig.welcomeMessage,
        widgetBrandName: widgetConfig.brandName,
        widgetSubtitle: widgetConfig.subtitle,
      });

      setCurrentStep(4);
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const handleComplete = async () => {
    try {
      await clientApi.updateOnboardingStep(5);
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      onComplete();
    }
  };

  const handleSkip = async () => {
    try {
      await clientApi.updateOnboardingStep(5);
      onComplete();
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      // Still complete even if API fails
      onComplete();
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
            onComplete={onComplete}
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
          <StoreInfo
            onBack={() => setCurrentStep(1)}
            onNext={() => setCurrentStep(3)}
          />
        );
      case 3:
        return (
          <ConfigureWidget
            config={widgetConfig}
            onConfigChange={handleConfigChange}
            onBack={() => setCurrentStep(2)}
            onNext={handleNextFromConfig}
          />
        );
      case 4:
        return (
          <SyncAndActivate
            onBack={() => setCurrentStep(3)}
            onComplete={handleComplete}
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
          <img src={logoKova} alt="Kova" className="sidebar-logo-img" />
        </div>
        <div className="onboarding-header-right">
          <span className="onboarding-step-text">Paso {currentStep + 1} de {totalSteps}</span>
          <button onClick={handleSkip} className="btn-skip">
            Saltar configuracion
          </button>
        </div>
      </header>

      <div className="onboarding-content">
        <div className="onboarding-card">
          <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
          {renderStep()}
        </div>
      </div>
    </div>
  );
}

export default OnboardingWizard;
