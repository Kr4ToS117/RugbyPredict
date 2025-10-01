import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ValidationCard } from "@/components/validation-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ValidationIssueResponse {
  issues: Array<{
    id: string;
    fixture: string;
    field: string;
    severity: "high" | "medium" | "low";
    sources: Array<{ name: string; value: string }>;
  }>;
}

export default function Validation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<ValidationIssueResponse>({
    queryKey: ["/api/validation/issues"],
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, source }: { id: string; source: string }) => {
      await apiRequest("POST", "/api/validation/resolve", { id, source });
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/validation/issues"] });
      toast({
        title: "Conflict resolved",
        description: `Used data from ${variables.source}`,
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unexpected error";
      toast({
        title: "Unable to resolve issue",
        description: message,
        variant: "destructive",
      });
    },
  });

  const issues = data?.issues ?? [];

  const handleResolve = (issueId: string, chosenSource: string) => {
    resolveMutation.mutate({ id: issueId, source: chosenSource });
  };

  const isMutating = resolveMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Validation Queue</h1>
        <p className="text-muted-foreground mt-1">
          Resolve data conflicts and discrepancies
        </p>
      </div>

      {isError ? (
        <div className="text-center py-12">
          <p className="text-destructive">Unable to load validation queue.</p>
        </div>
      ) : isLoading && issues.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={idx} className="border rounded-lg p-6 animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : issues.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No pending validation issues</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {issues.map((issue) => (
            <ValidationCard
              key={issue.id}
              issue={issue}
              onResolve={isMutating ? undefined : handleResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}
