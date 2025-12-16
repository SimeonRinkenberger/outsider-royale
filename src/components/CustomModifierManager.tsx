import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export interface CustomModifier {
  id: string;
  label: string;
  description: string;
  createdAt: string;
}

interface CustomModifierManagerProps {
  customModifiers: CustomModifier[];
  onAdd: (label: string, description: string) => void;
  onUpdate: (id: string, label: string, description: string) => void;
  onDelete: (id: string) => void;
}

export const CustomModifierManager = ({
  customModifiers,
  onAdd,
  onUpdate,
  onDelete,
}: CustomModifierManagerProps) => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setLabel('');
    setDescription('');
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (modifier: CustomModifier) => {
    setLabel(modifier.label);
    setDescription(modifier.description);
    setEditingId(modifier.id);
    setOpen(true);
  };

  const handleSave = () => {
    if (!label.trim()) {
      toast.error('Please enter a modifier name');
      return;
    }
    if (!description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    if (editingId) {
      onUpdate(editingId, label.trim(), description.trim());
      toast.success('Modifier updated!');
    } else {
      onAdd(label.trim(), description.trim());
      toast.success('Modifier created!');
    }

    setOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    toast.success('Modifier deleted');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Custom Modifiers</h4>
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {customModifiers.length > 0 ? (
        <div className="space-y-2">
          {customModifiers.map((modifier) => (
            <div
              key={modifier.id}
              className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex-1">
                <p className="font-medium text-sm">{modifier.label}</p>
                <p className="text-xs text-muted-foreground">{modifier.description}</p>
              </div>
              <div className="flex gap-1 ml-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(modifier)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(modifier.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Create custom game rules and modifiers
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Modifier' : 'Create Custom Modifier'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g., Reverse Order"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="e.g., Players give clues in reverse alphabetical order"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={100}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? 'Save' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
