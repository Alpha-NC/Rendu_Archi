import { redirect } from 'next/navigation'

export default function Page() {
  // La page d'accueil ne fait qu'orienter vers la liste des dossiers ;
  // proxy.ts garantit déjà une session avant d'atteindre /dossiers.
  redirect('/dossiers')
}
