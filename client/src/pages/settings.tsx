import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Save } from "lucide-react";
import { useState } from "react";

export default function Settings() {
  const [showKeys, setShowKeys] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure API keys, mappings, and system preferences
        </p>
      </div>

      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="api-keys" data-testid="tab-api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="mappings" data-testid="tab-mappings">Team Mappings</TabsTrigger>
          <TabsTrigger value="scheduling" data-testid="tab-scheduling">Scheduling</TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-roles">User Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="top14-key">Top14 API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="top14-key"
                    type={showKeys ? "text" : "password"}
                    placeholder="Enter API key"
                    defaultValue="sk_test_..."
                    data-testid="input-top14-key"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setShowKeys(!showKeys)}
                    data-testid="button-toggle-keys"
                  >
                    {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weather-key">Weather API Key</Label>
                <Input
                  id="weather-key"
                  type={showKeys ? "text" : "password"}
                  placeholder="Enter API key"
                  defaultValue="wx_live_..."
                  data-testid="input-weather-key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="odds-key">Odds Provider Key</Label>
                <Input
                  id="odds-key"
                  type={showKeys ? "text" : "password"}
                  placeholder="Enter API key"
                  defaultValue="odds_api_..."
                  data-testid="input-odds-key"
                />
              </div>

              <Button className="w-full" data-testid="button-save-keys">
                <Save className="h-4 w-4 mr-2" />
                Save API Keys
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Name Mappings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure team name aliases for different data sources
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduling" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job Scheduling</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure automated data collection and model training schedules
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">User Roles & Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage user access levels (Admin, Data, Analyst, Viewer)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
