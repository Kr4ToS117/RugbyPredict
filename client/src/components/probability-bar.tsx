import { cn } from "@/lib/utils";

interface ProbabilityBarProps {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  homeTeam: string;
  awayTeam: string;
  className?: string;
}

export function ProbabilityBar({
  homeProb,
  drawProb,
  awayProb,
  homeTeam,
  awayTeam,
  className,
}: ProbabilityBarProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-8 rounded-md overflow-hidden border border-border">
        <div
          className="bg-chart-1 flex items-center justify-center text-white text-sm font-medium"
          style={{ width: `${homeProb}%` }}
        >
          {homeProb > 15 && `${homeProb.toFixed(1)}%`}
        </div>
        <div
          className="bg-muted flex items-center justify-center text-foreground text-sm font-medium"
          style={{ width: `${drawProb}%` }}
        >
          {drawProb > 10 && `${drawProb.toFixed(1)}%`}
        </div>
        <div
          className="bg-chart-2 flex items-center justify-center text-white text-sm font-medium"
          style={{ width: `${awayProb}%` }}
        >
          {awayProb > 15 && `${awayProb.toFixed(1)}%`}
        </div>
      </div>
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{homeTeam}</span>
        <span>Draw</span>
        <span>{awayTeam}</span>
      </div>
    </div>
  );
}
