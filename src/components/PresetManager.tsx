import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Save, Download, Upload, Trash2, Copy, Share2 } from 'lucide-react';
import { GamePreset, CustomCategory } from '@/hooks/useCustomContent';
import { toast } from 'sonner';

interface PresetManagerProps {
  presets: GamePreset[];
  customCategories: CustomCategory[];
  currentSettings: {
    categories: string[];
    customCategoryIds: string[];
    modifiers: string[];
    imposterCount: number;
    roundCount: number;
    gameMode: string;
  };
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: GamePreset) => void;
  onDeletePreset: (id: string) => void;
  onExportPreset: (preset: GamePreset, includedCustomCategories: CustomCategory[]) => string;
  onImportPreset: (code: string) => { preset: GamePreset; customCategories: CustomCategory[] } | null;
  onSaveImported: (preset: GamePreset, categories: CustomCategory[]) => void;
}

export const PresetManager = ({
  presets,
  customCategories,
  currentSettings,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onExportPreset,
  onImportPreset,
  onSaveImported,
}: PresetManagerProps) => {
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [importCode, setImportCode] = useState('');
  const [shareCode, setShareCode] = useState<string | null>(null);

  const handleSave = () => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      toast.error('Please enter a preset name');
      return;
    }
    onSavePreset(trimmedName);
    setIsSaveOpen(false);
    setPresetName('');
    toast.success('Preset saved!');
  };

  const handleExport = (preset: GamePreset) => {
    const includedCategories = customCategories.filter(c => 
      preset.customCategoryIds.includes(c.id)
    );
    const code = onExportPreset(preset, includedCategories);
    setShareCode(code);
    navigator.clipboard.writeText(code);
    toast.success('Preset code copied to clipboard!');
  };

  const handleImport = () => {
    const trimmedCode = importCode.trim();
    if (!trimmedCode) {
      toast.error('Please enter a preset code');
      return;
    }

    const result = onImportPreset(trimmedCode);
    if (!result) {
      toast.error('Invalid preset code');
      return;
    }

    onSaveImported(result.preset, result.customCategories);
    setIsImportOpen(false);
    setImportCode('');
    toast.success(`Imported "${result.preset.name}" with ${result.customCategories.length} custom categories`);
  };

  const handleDelete = (preset: GamePreset) => {
    if (confirm(`Delete "${preset.name}"? This cannot be undone.`)) {
      onDeletePreset(preset.id);
      toast.success('Preset deleted');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Game Presets</h4>
        <div className="flex gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Upload className="h-3 w-3 mr-1" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Import Preset
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Preset Code</label>
                  <Input
                    value={importCode}
                    onChange={(e) => setImportCode(e.target.value)}
                    placeholder="Paste preset code here..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Get preset codes from friends to import their game settings
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsImportOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleImport} className="flex-1">
                    Import
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Save className="h-5 w-5" />
                  Save Preset
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Preset Name</label>
                  <Input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g., Party Mode, Quick Game"
                    maxLength={30}
                  />
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium mb-2">Will save:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• {currentSettings.categories.length + currentSettings.customCategoryIds.length} categories</li>
                    <li>• {currentSettings.modifiers.length} modifiers</li>
                    <li>• {currentSettings.imposterCount} imposter(s)</li>
                    <li>• {currentSettings.roundCount} round(s)</li>
                    <li>• {currentSettings.gameMode} mode</li>
                  </ul>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsSaveOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleSave} className="flex-1">
                    Save Preset
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {presets.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No presets saved yet. Save your current settings to quickly load them later!
        </p>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <Card key={preset.id} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">{preset.name}</p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleExport(preset)}
                    title="Share preset"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(preset)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {preset.categories.length + preset.customCategoryIds.length} categories • {preset.modifiers.length} modifiers • {preset.gameMode}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full h-8"
                onClick={() => onLoadPreset(preset)}
              >
                Load Preset
              </Button>
            </Card>
          ))}
        </div>
      )}

      {shareCode && (
        <Dialog open={!!shareCode} onOpenChange={() => setShareCode(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Share Preset</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Send this code to friends so they can import your preset:
              </p>
              <div className="relative">
                <Input
                  value={shareCode}
                  readOnly
                  className="pr-10 font-mono text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => {
                    navigator.clipboard.writeText(shareCode);
                    toast.success('Copied!');
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button onClick={() => setShareCode(null)} className="w-full">
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
