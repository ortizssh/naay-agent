import { useState, useEffect } from 'react';
import StepIndicator from '../../components/common/StepIndicator';
import PlatformSelect from './steps/PlatformSelect';
import ConnectStore from './steps/ConnectStore';
import StoreInfo from './steps/StoreInfo';
import SelectPlan from './steps/SelectPlan';
import ConfigureWidget from './steps/ConfigureWidget';
import SyncAndActivate from './steps/SyncAndActivate';
import WooInstructions from './steps/WooInstructions';
import { clientApi } from '../../services/api';
import logoKova from '../../img/kova-logo.svg';

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

  const totalSteps = 6;
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Check URL for oauth success
    if (params.get('oauth') === 'success') {
      const step = parseInt(params.get('step') || '2', 10);
      setCurrentStep(step);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Check URL for Stripe checkout success/cancel
    if (params.get('checkout') === 'success') {
      const step = parseInt(params.get('step') || '4', 10);
      setCurrentStep(step);
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('checkout') === 'cancelled') {
      const step = parseInt(params.get('step') || '3', 10);
      setCurrentStep(step);
      setCheckoutMessage('El pago fue cancelado. Puedes intentar de nuevo o elegir otro plan.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load brand name from store info when reaching ConfigureWidget
  useEffect(() => {
    if (currentStep === 4 && !widgetConfig.brandName) {
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
      await clientApi.updateOnboardingStep(4, {
        widgetPosition: widgetConfig.position,
        widgetColor: widgetConfig.color,
        welcomeMessage: widgetConfig.welcomeMessage,
        widgetBrandName: widgetConfig.brandName,
        widgetSubtitle: widgetConfig.subtitle,
      });

      setCurrentStep(5);
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const handleComplete = async () => {
    try {
      await clientApi.updateOnboardingStep(6);
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      onComplete();
    }
  };

  const handleSkip = async () => {
    try {
      await clientApi.updateOnboardingStep(6);
      onComplete();
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      // Still complete even if API fails
      onComplete();
    }
  };

  const isWoo = selectedPlatform === 'woocommerce';

  // WooCommerce: 3 steps (Platform → SelectPlan → WooInstructions)
  // Shopify: 6 steps (Platform → Connect → StoreInfo → SelectPlan → Widget → Sync)
  const wooTotalSteps = 3;
  const displayTotalSteps = isWoo ? wooTotalSteps : totalSteps;

  // Map current step to display step for WooCommerce
  const getDisplayStep = () => {
    if (!isWoo) return currentStep;
    // Woo steps: 0 → 0, 3 → 1, 4 → 2 (WooInstructions)
    if (currentStep === 0) return 0;
    if (currentStep === 3) return 1;
    if (currentStep === 4) return 2;
    return currentStep;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <PlatformSelect
            selectedPlatform={selectedPlatform}
            onSelect={setSelectedPlatform}
            onNext={() => {
              if (selectedPlatform === 'woocommerce') {
                setCurrentStep(3); // Skip to SelectPlan
              } else {
                setCurrentStep(1); // Shopify: ConnectStore
              }
            }}
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
          <>
            {checkoutMessage && (
              <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                <div className="alert-content">
                  <div className="alert-message">{checkoutMessage}</div>
                </div>
              </div>
            )}
            <SelectPlan
              onBack={() => {
                if (isWoo) {
                  setCurrentStep(0); // Back to PlatformSelect
                } else {
                  setCurrentStep(2); // Back to StoreInfo
                }
              }}
              onNext={() => setCurrentStep(4)}
            />
          </>
        );
      case 4:
        if (isWoo) {
          return (
            <WooInstructions
              onBack={() => setCurrentStep(3)}
              onComplete={handleComplete}
            />
          );
        }
        return (
          <ConfigureWidget
            config={widgetConfig}
            onConfigChange={handleConfigChange}
            onBack={() => setCurrentStep(3)}
            onNext={handleNextFromConfig}
          />
        );
      case 5:
        return (
          <SyncAndActivate
            onBack={() => setCurrentStep(4)}
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
          <span className="onboarding-step-text">Paso {getDisplayStep() + 1} de {displayTotalSteps}</span>
          <button onClick={handleSkip} className="btn-skip">
            Saltar configuracion
          </button>
        </div>
      </header>

      <div className="onboarding-content">
        <div className={`onboarding-card${currentStep === 3 ? ' onboarding-card-wide' : ''}`}>
          <StepIndicator currentStep={getDisplayStep()} totalSteps={displayTotalSteps} />
          {renderStep()}
        </div>
      </div>
    </div>
  );
}

export default OnboardingWizard;
