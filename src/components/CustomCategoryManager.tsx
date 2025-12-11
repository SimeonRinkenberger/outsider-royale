import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, FolderPlus, Sparkles, Loader2 } from 'lucide-react';
import { CustomCategory } from '@/hooks/useCustomContent';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CustomCategoryManagerProps {
  categories: CustomCategory[];
  onAdd: (name: string, words: string[]) => void;
  onUpdate: (id: string, name: string, words: string[]) => void;
  onDelete: (id: string) => void;
}

export const CustomCategoryManager = ({
  categories,
  onAdd,
  onUpdate,
  onDelete,
}: CustomCategoryManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null);
  const [name, setName] = useState('');
  const [wordsText, setWordsText] = useState('');
  
  // AI generation state
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [aiExamples, setAiExamples] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const resetForm = () => {
    setName('');
    setWordsText('');
    setEditingCategory(null);
    setShowAiGenerator(false);
    setAiDescription('');
    setAiExamples('');
  };

  const openCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEdit = (category: CustomCategory) => {
    setEditingCategory(category);
    setName(category.name);
    setWordsText(category.words.join('\n'));
    setShowAiGenerator(false);
    setIsOpen(true);
  };

  const handleGenerateWithAi = async () => {
    const description = aiDescription.trim();
    const examples = aiExamples
      .split('\n')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (!description) {
      toast.error('Please enter a description');
      return;
    }

    if (examples.length < 2) {
      toast.error('Please provide at least 2 examples');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-category-words', {
        body: { description, examples }
      });

      if (error) throw error;

      if (data?.words && data.words.length > 0) {
        // Include user's examples + AI generated words
        const allWords = [...new Set([...examples, ...data.words])];
        setWordsText(allWords.join('\n'));
        
        // Auto-fill name if empty
        if (!name.trim()) {
          setName(description.slice(0, 30));
        }
        
        setShowAiGenerator(false);
        toast.success(`Generated ${data.words.length} words!`);
      } else {
        throw new Error('No words generated');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error('Failed to generate words. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Please enter a category name');
      return;
    }

    const words = wordsText
      .split('\n')
      .map(w => w.trim())
      .filter(w => w.length > 0);

    if (words.length < 5) {
      toast.error('Please add at least 5 words');
      return;
    }

    if (editingCategory) {
      onUpdate(editingCategory.id, trimmedName, words);
      toast.success('Category updated!');
    } else {
      onAdd(trimmedName, words);
      toast.success('Category created!');
    }

    setIsOpen(false);
    resetForm();
  };

  const handleDelete = (category: CustomCategory) => {
    if (confirm(`Delete "${category.name}"? This cannot be undone.`)) {
      onDelete(category.id);
      toast.success('Category deleted');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Custom Categories</h4>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={openCreate} className="h-8">
              <Plus className="h-3 w-3 mr-1" />
              Create
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5" />
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Category Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Inside Jokes, Work Terms"
                  maxLength={30}
                />
              </div>

              {/* AI Generator Toggle */}
              {!editingCategory && (
                <Button
                  type="button"
                  variant={showAiGenerator ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowAiGenerator(!showAiGenerator)}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {showAiGenerator ? 'Hide AI Generator' : 'Generate with AI'}
                </Button>
              )}

              {/* AI Generator Form */}
              {showAiGenerator && (
                <Card className="p-4 space-y-3 bg-muted/50 border-dashed">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Describe your category
                    </label>
                    <Input
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      placeholder="e.g., 90s TV shows, Types of pasta, Famous scientists"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Examples (one per line, min 2)
                    </label>
                    <Textarea
                      value={aiExamples}
                      onChange={(e) => setAiExamples(e.target.value)}
                      placeholder="Friends&#10;Seinfeld&#10;Fresh Prince"
                      rows={3}
                      className="font-mono text-sm"
                    />
                  </div>
                  <Button
                    onClick={handleGenerateWithAi}
                    disabled={isGenerating}
                    className="w-full"
                    size="sm"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Words
                      </>
                    )}
                  </Button>
                </Card>
              )}

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Words (one per line, minimum 5)
                </label>
                <Textarea
                  value={wordsText}
                  onChange={(e) => setWordsText(e.target.value)}
                  placeholder="Enter words, one per line..."
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {wordsText.split('\n').filter(w => w.trim()).length} words
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSave} className="flex-1">
                  {editingCategory ? 'Save Changes' : 'Create Category'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No custom categories yet. Create one to add your own words!
        </p>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <Card key={category.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{category.name}</p>
                <p className="text-xs text-muted-foreground">
                  {category.words.length} words
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(category)}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(category)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
