'use client';

import { useRouter } from 'next/navigation';
import { ContactPage } from '@/views/home/ContactPage';

export default function ContactPageClient() {
  const router = useRouter();
  const handleNavigate = (screen: string) => {
    if (screen === 'home') {
      router.push('/');
      return;
    }
    router.push(`/${screen}`);
  };

  return <ContactPage onNavigate={handleNavigate} />;
}
