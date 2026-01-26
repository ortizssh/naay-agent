interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      {Array.from({ length: totalSteps }, (_, index) => (
        <div
          key={index}
          className={`step-dot ${
            index < currentStep ? 'completed' : ''
          } ${index === currentStep ? 'active' : ''}`}
        />
      ))}
    </div>
  );
}

export default StepIndicator;
