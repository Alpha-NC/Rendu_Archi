'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { DossierResume } from '@/lib/rif/depot'
import { Icon } from '@/app/ui/Icons'
import { EmptyState, PageHeader, StatusBadge, formatDate } from '@/app/ui/Primitives'

const labels: Record<string,string> = { BROUILLON:'Brouillon', SOURCES_RECUES:'Sources reçues', SOURCES_ANALYSEES:'Analysé', CONTEXTE_A_CONFIRMER:'À confirmer', PRET_A_GENERER:'Prêt', GENERATION_EN_COURS:'En cours', CONTROLE_A_EXAMINER:'À contrôler', VALIDE:'Validé', A_CORRIGER:'À corriger', A_REPRENDRE:'À reprendre', SUSPENDU:'Suspendu', ECHEC:'Échec' }

function tone(etat:string) { if(etat==='VALIDE') return 'success' as const; if(['ECHEC','A_REPRENDRE'].includes(etat)) return 'danger' as const; if(['A_CORRIGER','SUSPENDU','CONTEXTE_A_CONFIRMER'].includes(etat)) return 'warning' as const; return 'info' as const }

export default function ProjectDashboard({ dossiers }: { dossiers: DossierResume[] }) {
  const [recherche,setRecherche]=useState(''); const [filtre,setFiltre]=useState('tous')
  const visibles=useMemo(()=>dossiers.filter(d=>{
    const texte=`${d.projectInfo?.name??''} ${d.projectInfo?.location??''} ${d.projectInfo?.type??''} ${d.dossierRef}`.toLowerCase()
    const okFiltre=filtre==='tous'||(filtre==='actifs'&&!['VALIDE','SUSPENDU','ECHEC'].includes(d.etat))||(filtre==='valides'&&d.etat==='VALIDE')
    return okFiltre&&texte.includes(recherche.toLowerCase())
  }),[dossiers,recherche,filtre])
  return <main className="page-shell">
    <PageHeader eyebrow="Portefeuille" title="Projets" description="Tous vos projets, au même endroit." actions={<Link className="button button--primary" href="/nouveau"><Icon name="plus"/>Nouveau projet</Link>}/>
    <div className="search-row"><label className="search-box"><Icon name="search"/><span className="sr-only">Rechercher</span><input value={recherche} onChange={e=>setRecherche(e.target.value)} placeholder="Rechercher un projet, une adresse, une référence…"/></label><div className="filter-pills" role="group" aria-label="Filtrer les projets">{[['tous','Tous'],['actifs','En cours'],['valides','Validés']].map(([v,l])=><button key={v} className={`filter-pill ${filtre===v?'is-active':''}`} onClick={()=>setFiltre(v)}>{l}</button>)}</div></div>
    {dossiers.length===0?<EmptyState icon="projects" title="Aucun projet" description="Créez votre premier projet pour rassembler ses sources et préparer un rendu fidèle." action={<Link href="/nouveau" className="button button--primary"><Icon name="plus"/>Nouveau projet</Link>}/>:visibles.length===0?<EmptyState icon="search" title="Aucun résultat" description="Aucun projet ne correspond à cette recherche."/>:<div className="project-grid">{visibles.map(d=><Link href={`/dossiers/${d.id}`} className="project-card" key={d.id}><div className="project-card__visual"><div className="project-card__status"><StatusBadge tone={tone(d.etat)}>{labels[d.etat]??d.etat}</StatusBadge></div></div><div className="project-card__body"><h2>{d.projectInfo?.name??d.dossierRef}</h2><p className="project-card__meta">{[d.projectInfo?.type,d.projectInfo?.location].filter(Boolean).join(' · ')||d.dossierRef}</p><div className="project-card__foot"><div className="project-card__metric"><strong>{d.nombreGenerations}</strong><span>Génération{d.nombreGenerations>1?'s':''}</span></div><div className="project-card__metric"><strong>{d.generationCanoniqueId?'Oui':'—'}</strong><span>Référence</span></div><div className="project-card__metric"><strong>{formatDate(d.updatedAt).split(' à ')[0]}</strong><span>Activité</span></div><span className="project-card__arrow"><Icon name="arrow"/></span></div></div></Link>)}<Link href="/nouveau" className="project-card project-card--new"><div className="new-project-inner"><span><Icon name="plus"/></span><h2>Nouveau projet</h2><p>Initier un nouveau dossier RIF</p></div></Link></div>}
  </main>
}
