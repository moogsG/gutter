"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Check, X, GripVertical, Settings2, Calendar, ListChecks, Cloud, Briefcase, Zap, MessageSquareText, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { WidgetConfigEditor, hasWidgetConfig, defaultUiConfig } from "./WidgetConfigEditor";
import { LayoutFootprintSection } from "./today-focus/LayoutFootprintSection";
import { COL_SPAN_LABELS } from "./today-focus/grid-layout";
import { LayoutGridEditor } from "./today-focus/LayoutGridEditor";

interface MorningViewPrompt {
  id: string;
  title: string;
  prompt_text: string;
  source_type: string;
  source_config: string | null;
  ui_config: string | null;
  frequency: string;
  active: number;
  sort_order: number;
  last_run: string | null;
}

interface RecommendedStackAudit {
  presetId: "jynx-recommended";
  label: string;
  description: string;
  counts: {
    ready: number;
    stale: number;
    missing: number;
  };
  prompts: Array<{
    sourceType: string;
    title: string;
    state: "missing" | "stale" | "ready";
    reason: string;
  }>;
}

type UiConfigState = Record<string, unknown>;

export function MorningViewSettings() {
  const [prompts, setPrompts] = useState<MorningViewPrompt[]>([]);
  const [recommendedPreset, setRecommendedPreset] = useState<RecommendedStackAudit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPresetLoading, setIsPresetLoading] = useState(true);
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const emptyForm = {
    title: "",
    prompt_text: "",
    source_type: "static",
    frequency: "daily",
    uiConfig: {} as UiConfigState,
  };
  const [formData, setFormData] = useState(emptyForm);
  
  const sourceTypeIcons = {
    static: Settings2,
    journal_unresolved: ListChecks,
    journal_do_next: Zap,
    health_cut: HeartPulse,
    calendar_today: Calendar,
    meeting_prep_today: Calendar,
    weather: Cloud,
    jira_assigned: Briefcase,
    slack_context: MessageSquareText,
  };
  
  const sourceTypeLabels = {
    static: "Static Reminder",
    journal_unresolved: "Unresolved Tasks",
    journal_do_next: "Do Next (Working Set)",
    health_cut: "Health Cut",
    calendar_today: "Today's Calendar",
    meeting_prep_today: "Meeting Prep",
    weather: "Weather",
    jira_assigned: "Jira Issues",
    slack_context: "Slack Context",
  };

  const loadPrompts = async () => {
    try {
      const response = await fetch("/api/morning-view/prompts");
      if (!response.ok) throw new Error("Failed to load prompts");
      
      const data = await response.json();
      setPrompts(data.prompts || []);
    } catch (error) {
      console.error("Error loading prompts:", error);
      toast.error("Failed to load Today Focus prompts");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPresetAudit = async () => {
    try {
      const response = await fetch("/api/morning-view/presets");
      if (!response.ok) throw new Error("Failed to load preset audit");

      const data = await response.json();
      setRecommendedPreset(data.preset ?? null);
    } catch (error) {
      console.error("Error loading Today Focus preset audit:", error);
      toast.error("Failed to load Today Focus quickstart");
    } finally {
      setIsPresetLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts();
    loadPresetAudit();
  }, []);

  /** Merge in layout defaults for any source type that doesn't already have them */
  const withLayoutDefaults = (config: UiConfigState, sourceType: string): UiConfigState => {
    const base = defaultUiConfig(sourceType);
    return { colSpan: base.colSpan ?? 8, rowSpan: base.rowSpan ?? 1, order: base.order ?? 0, ...config };
  };

  const handleAdd = async () => {
    if (!formData.title || !formData.prompt_text) {
      toast.error("Title and prompt text are required");
      return;
    }

    try {
      const response = await fetch("/api/morning-view/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          promptText: formData.prompt_text,
          sourceType: formData.source_type,
          frequency: formData.frequency,
          sourceConfig: formData.source_type === "weather"
            ? JSON.stringify({ location: ((formData.uiConfig.location as string) || "Tulum").trim() || "Tulum" })
            : null,
          // All prompts get layout config; widget prompts also get display config
          uiConfig: withLayoutDefaults(
            hasWidgetConfig(formData.source_type)
              ? { ...defaultUiConfig(formData.source_type), ...formData.uiConfig }
              : formData.uiConfig,
            formData.source_type
          ),
        })
      });

      if (!response.ok) throw new Error("Failed to create prompt");

      toast.success("Today Focus prompt added");
      setIsAdding(false);
      setFormData(emptyForm);
      loadPrompts();
    } catch (error) {
      console.error("Error creating prompt:", error);
      toast.error("Failed to create prompt");
    }
  };

  const startEdit = (prompt: MorningViewPrompt) => {
    setEditingId(prompt.id);
    setIsAdding(false);
    let parsedUiConfig: UiConfigState = {};
    if (prompt.ui_config) {
      try { parsedUiConfig = JSON.parse(prompt.ui_config); } catch { /* ignore */ }
    }
    if (prompt.source_type === "weather" && prompt.source_config) {
      try {
        const parsedSourceConfig = JSON.parse(prompt.source_config);
        parsedUiConfig = {
          ...parsedUiConfig,
          ...(parsedSourceConfig?.location ? { location: parsedSourceConfig.location } : {}),
        };
      } catch {
        /* ignore */
      }
    }
    setFormData({
      title: prompt.title,
      prompt_text: prompt.prompt_text,
      source_type: prompt.source_type,
      frequency: prompt.frequency,
      uiConfig: parsedUiConfig,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ ...emptyForm, uiConfig: {} });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!formData.title || !formData.prompt_text) {
      toast.error("Title and prompt text are required");
      return;
    }

    try {
      const response = await fetch("/api/morning-view/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          title: formData.title,
          prompt_text: formData.prompt_text,
          source_type: formData.source_type,
          frequency: formData.frequency,
          source_config: formData.source_type === "weather"
            ? JSON.stringify({ location: ((formData.uiConfig.location as string) || "Tulum").trim() || "Tulum" })
            : null,
          uiConfig: withLayoutDefaults(
            hasWidgetConfig(formData.source_type)
              ? { ...defaultUiConfig(formData.source_type), ...formData.uiConfig }
              : formData.uiConfig,
            formData.source_type
          ),
        })
      });

      if (!response.ok) throw new Error("Failed to update prompt");

      toast.success("Prompt updated");
      setEditingId(null);
      setFormData(emptyForm);
      loadPrompts();
    } catch (error) {
      console.error("Error updating prompt:", error);
      toast.error("Failed to update prompt");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this morning view prompt?")) return;

    try {
      const response = await fetch(`/api/morning-view/prompts?id=${id}`, {
        method: "DELETE"
      });

      if (!response.ok) throw new Error("Failed to delete prompt");

      toast.success("Prompt deleted");
      loadPrompts();
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast.error("Failed to delete prompt");
    }
  };

  const handleApplyRecommended = async () => {
    setIsApplyingPreset(true);
    try {
      const response = await fetch("/api/morning-view/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: "jynx-recommended" }),
      });

      if (!response.ok) throw new Error("Failed to apply preset");

      const data = await response.json();
      setRecommendedPreset(data.preset ?? null);
      toast.success("Jynx recommended stack applied");
      await loadPrompts();
      await loadPresetAudit();
    } catch (error) {
      console.error("Error applying Today Focus preset:", error);
      toast.error("Failed to apply recommended stack");
    } finally {
      setIsApplyingPreset(false);
    }
  };

  const handleToggleActive = async (prompt: MorningViewPrompt) => {
    try {
      const response = await fetch("/api/morning-view/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: prompt.id,
          active: prompt.active === 1 ? 0 : 1
        })
      });

      if (!response.ok) throw new Error("Failed to update prompt");

      loadPrompts();
    } catch (error) {
      console.error("Error updating prompt:", error);
      toast.error("Failed to update prompt");
    }
  };
  
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(prompts);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update local state immediately for smooth UX
    setPrompts(items);
    
    // Update sort_order for all affected items
    try {
      for (let i = 0; i < items.length; i++) {
        if (items[i].sort_order !== i) {
          await fetch("/api/morning-view/prompts", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: items[i].id,
              sort_order: i
            })
          });
        }
      }
      toast.success("Order updated");
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order");
      loadPrompts(); // Reload on error
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Today Focus Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure recurring prompts and sources that feed your daily Today Focus summary
          </p>
        </div>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="w-4 h-4 mr-2" />
          Add Prompt
        </Button>
      </div>

      <Card className="bg-card/60 border-primary/15">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span>Quickstart Stack</span>
            {!isPresetLoading && recommendedPreset ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={recommendedPreset.counts.missing > 0 ? "destructive" : recommendedPreset.counts.stale > 0 ? "outline" : "secondary"}>
                  {recommendedPreset.counts.ready} ready
                </Badge>
                {recommendedPreset.counts.stale > 0 ? <Badge variant="outline">{recommendedPreset.counts.stale} stale</Badge> : null}
                {recommendedPreset.counts.missing > 0 ? <Badge variant="destructive">{recommendedPreset.counts.missing} missing</Badge> : null}
              </div>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPresetLoading ? (
            <p className="text-sm text-muted-foreground">Checking whether Today Focus is actually configured or just pretending.</p>
          ) : recommendedPreset ? (
            <>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">{recommendedPreset.label}</p>
                <p className="text-sm text-muted-foreground">{recommendedPreset.description}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {recommendedPreset.prompts.map((prompt) => (
                  <div key={prompt.sourceType} className="rounded-lg border border-border/60 bg-muted/25 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{prompt.title}</p>
                      <Badge variant={prompt.state === "ready" ? "secondary" : prompt.state === "stale" ? "outline" : "destructive"}>
                        {prompt.state}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{prompt.reason}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleApplyRecommended} disabled={isApplyingPreset}>
                  <Zap className="w-4 h-4 mr-2" />
                  {isApplyingPreset ? "Repairing..." : "Apply Jynx Recommended"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Repairs the five dependable daily widgets without deleting the rest of your custom prompts.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Preset audit unavailable right now.</p>
          )}
        </CardContent>
      </Card>

      {isAdding && (
        <Card className="bg-card/60 border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">New Today Focus Prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., LinkedIn Check-in"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt Text</Label>
              <Textarea
                id="prompt"
                value={formData.prompt_text}
                onChange={(e) => setFormData({ ...formData, prompt_text: e.target.value })}
                placeholder="e.g., Remind me about LinkedIn once a week"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source Type</Label>
                <select
                  id="source"
                  value={formData.source_type}
                  onChange={(e) => setFormData({ ...formData, source_type: e.target.value, uiConfig: defaultUiConfig(e.target.value) })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="static">Static Reminder</option>
                  <option value="journal_unresolved">Unresolved Tasks</option>
                  <option value="journal_do_next">Do Next (Working Set)</option>
                  <option value="health_cut">Health Cut</option>
                  <option value="calendar_today">Today&apos;s Calendar</option>
                  <option value="meeting_prep_today">Meeting Prep</option>
                  <option value="weather">Weather</option>
                  <option value="jira_assigned">Jira Issues</option>
                  <option value="slack_context">Slack Context</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <select
                  id="frequency"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="weekdays">Weekdays Only</option>
                  <option value="weekends">Weekends Only</option>
                </select>
              </div>
            </div>

            {hasWidgetConfig(formData.source_type) ? (
              <WidgetConfigEditor
                sourceType={formData.source_type}
                uiConfig={formData.uiConfig}
                onChange={(uiConfig) => setFormData({ ...formData, uiConfig })}
              />
            ) : (
              <LayoutFootprintSection
                uiConfig={formData.uiConfig}
                onChange={(uiConfig) => setFormData({ ...formData, uiConfig })}
              />
            )}

            <div className="flex gap-2">
              <Button onClick={handleAdd}>
                <Check className="w-4 h-4 mr-2" />
                Create
              </Button>
              <Button variant="outline" onClick={() => {
                setIsAdding(false);
                setFormData(emptyForm);
              }}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editingId && (
        <Card className="bg-card/60 border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Edit Morning View Prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-prompt">Prompt Text</Label>
              <Textarea
                id="edit-prompt"
                value={formData.prompt_text}
                onChange={(e) => setFormData({ ...formData, prompt_text: e.target.value })}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-source">Source Type</Label>
                <select
                  id="edit-source"
                  value={formData.source_type}
                  onChange={(e) => setFormData({ ...formData, source_type: e.target.value, uiConfig: defaultUiConfig(e.target.value) })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="static">Static Reminder</option>
                  <option value="journal_unresolved">Unresolved Tasks</option>
                  <option value="journal_do_next">Do Next (Working Set)</option>
                  <option value="health_cut">Health Cut</option>
                  <option value="calendar_today">Today&apos;s Calendar</option>
                  <option value="meeting_prep_today">Meeting Prep</option>
                  <option value="weather">Weather</option>
                  <option value="jira_assigned">Jira Issues</option>
                  <option value="slack_context">Slack Context</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-frequency">Frequency</Label>
                <select
                  id="edit-frequency"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="weekdays">Weekdays Only</option>
                  <option value="weekends">Weekends Only</option>
                </select>
              </div>
            </div>

            {hasWidgetConfig(formData.source_type) ? (
              <WidgetConfigEditor
                sourceType={formData.source_type}
                uiConfig={formData.uiConfig}
                onChange={(uiConfig) => setFormData({ ...formData, uiConfig })}
              />
            ) : (
              <LayoutFootprintSection
                uiConfig={formData.uiConfig}
                onChange={(uiConfig) => setFormData({ ...formData, uiConfig })}
              />
            )}

            <div className="flex gap-2">
              <Button onClick={handleSaveEdit}>
                <Check className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button variant="outline" onClick={cancelEdit}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visual grid editor — primary layout tool */}
      {prompts.length > 0 && (
        <LayoutGridEditor
          prompts={prompts}
          onSaved={loadPrompts}
        />
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Prompts
        </p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="prompts">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef}
              className="space-y-3"
            >
              {prompts.length === 0 ? (
                <Card className="bg-card/60">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">
                      No Today Focus prompts configured yet. Click "Add Prompt" to create one.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                prompts.map((prompt, index) => {
                  const SourceIcon = sourceTypeIcons[prompt.source_type as keyof typeof sourceTypeIcons] || Settings2;
                  return (
                    <Draggable key={prompt.id} draggableId={prompt.id} index={index}>
                      {(provided, snapshot) => (
                        <Card
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`bg-card/60 transition-shadow ${
                            prompt.active === 0 ? 'opacity-50' : ''
                          } ${
                            snapshot.isDragging ? 'shadow-lg' : ''
                          }`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start gap-3">
                              <div
                                {...provided.dragHandleProps}
                                className="pt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                              >
                                <GripVertical className="w-5 h-5" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <SourceIcon className="w-4 h-4 text-primary/70" />
                                  <CardTitle className="text-base">{prompt.title}</CardTitle>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {prompt.prompt_text}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEdit(prompt)}
                                  className="h-8 text-xs"
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleActive(prompt)}
                                  className="h-8 text-xs"
                                >
                                  {prompt.active === 1 ? "Disable" : "Enable"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(prompt.id)}
                                  className="h-8"
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                              <span>Source: {sourceTypeLabels[prompt.source_type as keyof typeof sourceTypeLabels] || prompt.source_type}</span>
                              <span>Frequency: {prompt.frequency}</span>
                              {(() => {
                                try {
                                  const cfg = prompt.ui_config ? JSON.parse(prompt.ui_config) : {};
                                  const cs = cfg.colSpan as 2 | 4 | 8 | undefined;
                                  if (cs && COL_SPAN_LABELS[cs]) {
                                    return <span className="text-primary/60">Layout: {COL_SPAN_LABELS[cs]}</span>;
                                  }
                                } catch { /* ignore */ }
                                return null;
                              })()}
                              {prompt.last_run && (
                                <span>Last run: {new Date(prompt.last_run).toLocaleDateString()}</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </Draggable>
                  );
                })
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
