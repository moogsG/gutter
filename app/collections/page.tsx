"use client";

import { useState } from "react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useGetCollectionsQuery, useCreateCollectionMutation } from "@/store/api/journalApi";
import Link from "next/link";
import { Plus, FolderOpen } from "lucide-react";

export default function CollectionsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState("");

  const { data: collections = [] } = useGetCollectionsQuery();
  const [createCollection] = useCreateCollectionMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createCollection({ title: title.trim() });
    setTitle("");
    setIsDialogOpen(false);
  };

  return (
    <>
      <JournalHeader
        date={new Date().toISOString().split("T")[0]}
        onPrevDay={() => {}}
        onNextDay={() => {}}
        onToday={() => {}}
      />
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-2xl font-bold text-foreground">Collections</h2>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Collection</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="mx-4 sm:mx-auto max-w-sm">
                <DialogHeader>
                  <DialogTitle>Create Collection</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Collection title"
                    autoFocus
                  />
                  <Button type="submit" disabled={!title.trim()} className="w-full">
                    Create
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {collections.length === 0 ? (
            <Card>
              <CardContent className="py-10 sm:py-12 text-center">
                <FolderOpen className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No collections yet. Create one to organize your entries.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((collection) => (
                <Link key={collection.id} href={`/collections/${collection.id}`}>
                  <Card className="hover:bg-muted/30 active:bg-muted/40 transition-colors cursor-pointer h-full">
                    <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-1 sm:pb-2">
                      <CardTitle className="text-base sm:text-lg">{collection.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                      <p className="text-sm text-muted-foreground">
                        {collection.entry_count || 0} entries
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
