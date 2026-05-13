'use client';

import { Suspense } from 'react';
import { ManageCheckEmailScreen } from '@/views/manage/ManageCheckEmailScreen';

export default function ManageCheckEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ManageCheckEmailScreen />
    </Suspense>
  );
}
