import { Metadata } from 'next';
import SopClient from './sop.client';

export const metadata: Metadata = {
  title: 'Battle Plan | TBS Dashboard',
  description: 'View and manage your company\'s Battle Plan',
};

export default function SopPage() {
  return <SopClient />;
} 