'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { toast } from '@/lib/hooks/use-toast';
import type { UserProfile, Spreadsheet } from '@/lib/types';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sheets, setSheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [voicePref, setVoicePref] = useState('default');
  const [defaultSheetId, setDefaultSheetId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [profileData, sheetsData] = await Promise.all([
        api.get<{ profile: UserProfile }>('/api/user/profile'),
        api.get<{ spreadsheets: Spreadsheet[] }>('/api/sheets/list'),
      ]);
      setProfile(profileData.profile);
      setSheets(sheetsData.spreadsheets);
      setName(profileData.profile.name || '');
      setLanguage(profileData.profile.preferredLanguage || 'en-US');
      setVoicePref(profileData.profile.voicePreference || 'default');
      setDefaultSheetId(profileData.profile.defaultSheetId || '');
    } catch {
      toast({ title: 'Failed to load settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.put('/api/user/profile', { name });
      toast({ title: 'Profile updated', variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      await api.put('/api/user/preferences', {
        preferredLanguage: language,
        voicePreference: voicePref,
        defaultSheetId: defaultSheetId || undefined,
      });
      toast({ title: 'Preferences saved', variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = profile?.name
    ? profile.name.split(' ').map((n) => n[0]).join('').toUpperCase()
    : '?';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={session?.user?.image || ''} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{profile?.email}</p>
              <p className="text-sm text-muted-foreground">
                Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ''}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize your voice assistant experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Preferred Language</Label>
            <Select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice">Voice Preference</Label>
            <Select
              id="voice"
              value={voicePref}
              onChange={(e) => setVoicePref(e.target.value)}
            >
              <option value="default">Default</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultSheet">Default Sheet</Label>
            <Select
              id="defaultSheet"
              value={defaultSheetId}
              onChange={(e) => setDefaultSheetId(e.target.value)}
            >
              <option value="">None</option>
              {sheets.map((sheet) => (
                <option key={sheet.id} value={sheet.id}>
                  {sheet.name}
                </option>
              ))}
            </Select>
          </div>

          <Button onClick={handleSavePreferences} disabled={savingPrefs}>
            {savingPrefs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Preferences
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
