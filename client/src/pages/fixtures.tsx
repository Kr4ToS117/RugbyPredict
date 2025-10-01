import { MatchCard } from "@/components/match-card";
import { StakeCalculator } from "@/components/stake-calculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

//todo: remove mock functionality
const matches = [
  {
    competition: "Top14",
    homeTeam: "Toulouse",
    awayTeam: "La Rochelle",
    date: "Sat, Dec 14, 21:05",
    venue: "Stadium de Toulouse",
    homeProb: 52.3,
    drawProb: 22.1,
    awayProb: 25.6,
    edge: 5.8,
  },
  {
    competition: "URC",
    homeTeam: "Leinster",
    awayTeam: "Munster",
    date: "Sun, Dec 15, 15:30",
    venue: "Aviva Stadium",
    homeProb: 68.2,
    drawProb: 15.3,
    awayProb: 16.5,
    edge: 3.2,
  },
  {
    competition: "Top14",
    homeTeam: "Racing 92",
    awayTeam: "Stade Français",
    date: "Sun, Dec 15, 17:00",
    venue: "Paris La Défense Arena",
    homeProb: 45.8,
    drawProb: 26.2,
    awayProb: 28.0,
    edge: 1.8,
  },
];

export default function Fixtures() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Fixtures & Picks</h1>
        <p className="text-muted-foreground mt-1">
          View predictions and calculate optimal stakes
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fixtures..."
            className="pl-10"
            data-testid="input-search-fixtures"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-full md:w-[200px]" data-testid="select-league">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Leagues</SelectItem>
            <SelectItem value="top14">Top14</SelectItem>
            <SelectItem value="urc">URC</SelectItem>
            <SelectItem value="premiership">Premiership</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" data-testid="button-filter">
          More Filters
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {matches.map((match, idx) => (
            <MatchCard key={idx} {...match} />
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <StakeCalculator bankroll={1000} edge={5.8} />
          </div>
        </div>
      </div>
    </div>
  );
}
