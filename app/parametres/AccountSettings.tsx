'use client'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/client'
import { Icon } from '@/app/ui/Icons'

export default function AccountSettings({email,name}:{email:string;name?:string|null}){const router=useRouter();async function signOut(){await authClient.signOut();router.push('/connexion');router.refresh()}return <section className="form-card" style={{maxWidth:720}}><div className="data-section" style={{marginTop:0}}><h3>Compte</h3><div className="data-list"><div className="data-row"><span>Utilisateur</span><strong>{name?.trim()||'Compte RIF'}</strong></div><div className="data-row"><span>Adresse e-mail</span><strong>{email}</strong></div><div className="data-row"><span>Authentification</span><strong>Neon Auth</strong><span className="status-badge status-badge--success"><span className="status-dot"/>Actif</span></div></div></div><div className="quality-actions"><button className="button" onClick={signOut}><Icon name="logout"/>Déconnexion</button></div></section>}
