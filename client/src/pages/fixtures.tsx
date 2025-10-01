import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MatchCard } from "@/components/match-card";
import { StakeCalculator } from "@/components/stake-calculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

interface FixturesResponse {
  fixtures: Array<{
    id: string;
    competition: string | null;
    kickoffAt: string;
    venue: string | null;
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
    probabilities: { home: number; draw: number; away: number } | null;
    edge: number | null;
  }>;
  productionVersion: string | null;
}

function formatFixtureDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export default function Fixtures() {
  const { data, isLoading } = useQuery<FixturesResponse>({ queryKey: ["/api/fixtures"] });

  const matches = useMemo(
    () =>
      data?.fixtures.map((fixture) => {
        const probabilities = fixture.probabilities ?? { home: 0, draw: 0, away: 0 };
        const homeProb = Number(((probabilities.home ?? 0) * 100).toFixed(1));
        const drawProb = Number(((probabilities.draw ?? 0) * 100).toFixed(1));
        const awayProb = Number(((probabilities.away ?? 0) * 100).toFixed(1));

        return {
          id: fixture.id,
          competition: fixture.competition ?? "",
          homeTeam: fixture.homeTeam.name,
          awayTeam: fixture.awayTeam.name,
          date: formatFixtureDate(fixture.kickoffAt),
          venue: fixture.venue ?? "",
          homeProb,
          drawProb,
          awayProb,
          edge: fixture.edge !== null ? Number((fixture.edge * 100).toFixed(1)) : 0,
        };
      }) ?? [],
    [data],
  );

  const competitions = useMemo(() => {
    const unique = new Set<string>();
    matches.forEach((match) => {
      if (match.competition) {
        unique.add(match.competition);
      }
    });
    return Array.from(unique);
  }, [matches]);

  const topEdge = matches[0]?.edge ?? 0;

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
            {competitions.map((competition) => (
              <SelectItem key={competition} value={competition.toLowerCase()}>
                {competition}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" data-testid="button-filter">
          More Filters
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {isLoading
            ? [0, 1, 2].map((index) => <Skeleton key={index} className="h-40 w-full" />)
            : matches.map((match) => (
                <MatchCard key={match.id} {...match} />
              ))}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <StakeCalculator bankroll={1000} edge={topEdge} />
          </div>
        </div>
      </div>
    </div>
  );
}
