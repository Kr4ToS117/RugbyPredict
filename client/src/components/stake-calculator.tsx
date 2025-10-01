import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface StakeCalculatorProps {
  bankroll?: number;
  edge?: number;
}

export function StakeCalculator({ bankroll = 1000, edge = 5.2 }: StakeCalculatorProps) {
  const [strategy, setStrategy] = useState("kelly");
  const [kellyFraction, setKellyFraction] = useState([0.25]);

  const calculateStake = () => {
    if (strategy === "kelly") {
      return ((edge / 100) * bankroll * kellyFraction[0]).toFixed(2);
    } else if (strategy === "percentage") {
      return (bankroll * 0.02).toFixed(2);
    } else {
      return "10.00";
    }
  };

  return (
    <Card data-testid="card-stake-calculator">
      <CardHeader>
        <CardTitle className="text-base">Stake Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="strategy">Strategy</Label>
          <Select value={strategy} onValueChange={setStrategy}>
            <SelectTrigger id="strategy" data-testid="select-strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kelly">Kelly Criterion</SelectItem>
              <SelectItem value="percentage">Fixed 2%</SelectItem>
              <SelectItem value="flat">Flat €10</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {strategy === "kelly" && (
          <div className="space-y-2">
            <Label>Kelly Fraction: {kellyFraction[0].toFixed(2)}</Label>
            <Slider
              value={kellyFraction}
              onValueChange={setKellyFraction}
              max={1}
              step={0.05}
              className="w-full"
              data-testid="slider-kelly-fraction"
            />
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Suggested Stake:</span>
            <span className="text-2xl font-bold font-mono" data-testid="text-suggested-stake">
              €{calculateStake()}
            </span>
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Bankroll: €{bankroll}</span>
            <span>Edge: {edge}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
