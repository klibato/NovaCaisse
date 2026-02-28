'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';

export default function ClosuresPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Clôtures</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5" />
            Historique des clôtures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            L&apos;historique des clôtures Z journalières, mensuelles et annuelles sera disponible prochainement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
