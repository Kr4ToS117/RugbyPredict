import { ProbabilityBar } from "../probability-bar";

export default function ProbabilityBarExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-2xl space-y-6">
        <ProbabilityBar
          homeProb={45.2}
          drawProb={28.5}
          awayProb={26.3}
          homeTeam="Toulouse"
          awayTeam="La Rochelle"
        />
        <ProbabilityBar
          homeProb={62.8}
          drawProb={18.2}
          awayProb={19.0}
          homeTeam="Leinster"
          awayTeam="Munster"
        />
      </div>
    </div>
  );
}
