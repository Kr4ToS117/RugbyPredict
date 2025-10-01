import { MatchCard } from "../match-card";

export default function MatchCardExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <MatchCard
          competition="Top14"
          homeTeam="Toulouse"
          awayTeam="La Rochelle"
          date="Sat, Dec 14, 21:05"
          venue="Stadium de Toulouse"
          homeProb={52.3}
          drawProb={22.1}
          awayProb={25.6}
          edge={5.8}
        />
        <MatchCard
          competition="URC"
          homeTeam="Leinster"
          awayTeam="Munster"
          date="Sun, Dec 15, 15:30"
          venue="Aviva Stadium"
          homeProb={68.2}
          drawProb={15.3}
          awayProb={16.5}
        />
      </div>
    </div>
  );
}
