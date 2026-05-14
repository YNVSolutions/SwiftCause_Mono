'use client';

import { useRouter } from 'next/navigation';
import { HomePage } from '@/views/home/HomePage';
import { useAuth } from '@/shared/lib/auth-provider';
import { HomePageSkeleton } from '@/views/home/components/HomePageSkeleton';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();
  const { userRole, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth) {
      if (
        userRole === 'admin' ||
        userRole === 'super_admin' ||
        userRole === 'manager' ||
        userRole === 'operator' ||
        userRole === 'viewer'
      ) {
        router.push('/admin');
      } else if (userRole === 'kiosk') {
        router.push('/campaigns');
      }
    }
  }, [userRole, isLoadingAuth, router]);

  if (isLoadingAuth) {
    return <HomePageSkeleton />;
  }

  const handleNavigate = (screen: string) => {
    if (screen === 'home') {
      router.push('/');
      return;
    }
    if (screen === 'about') {
      router.push('/about?from=home');
      return;
    }
    if (screen === 'contact') {
      router.push('/contact?from=home');
      return;
    }
    if (screen === 'docs') {
      router.push('/docs?from=home');
      return;
    }
    if (screen === 'terms') {
      router.push('/terms?from=home');
      return;
    }
    router.push(`/${screen}`);
  };

  const handleSignup = () => {
    router.push('/signup');
  };

  return <HomePage onSignup={handleSignup} onNavigate={handleNavigate} />;
}
