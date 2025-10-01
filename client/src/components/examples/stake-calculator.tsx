import { StakeCalculator } from "../stake-calculator";

export default function StakeCalculatorExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-md">
        <StakeCalculator bankroll={1000} edge={5.2} />
      </div>
    </div>
  );
}
