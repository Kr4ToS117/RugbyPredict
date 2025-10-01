import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin } from "lucide-react";
import { ProbabilityBar } from "./probability-bar";

interface MatchCardProps {
  competition: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  venue: string;
  homeProb: number;
  drawProb: number;
  awayProb: number;
  edge?: number;
}

export function MatchCard({
  competition,
  homeTeam,
  awayTeam,
  date,
  venue,
  homeProb,
  drawProb,
  awayProb,
  edge,
}: MatchCardProps) {
  return (
    <Card className="hover-elevate" data-testid="card-match">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="bg-chart-1/10 text-chart-1 border-chart-1/20">
            {competition}
          </Badge>
          {edge && edge > 3 && (
            <Badge className="bg-chart-2 text-white">
              +{edge.toFixed(1)}% Edge
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-lg">{homeTeam}</span>
            <span className="text-sm text-muted-foreground">vs</span>
            <span className="font-semibold text-lg">{awayTeam}</span>
          </div>
          
          <ProbabilityBar
            homeProb={homeProb}
            drawProb={drawProb}
            awayProb={awayProb}
            homeTeam=""
            awayTeam=""
          />
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{date}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span>{venue}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
