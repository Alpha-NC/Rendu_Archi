'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { Icon, type IconName } from '@/app/ui/Icons'
import { ErrorState, PageHeader, formatBytes } from '@/app/ui/Primitives'
import { lireReponseApi } from '@/lib/rif/reponse-client'

type Slot='model_3d'|'revit_view'|'site_photo'|'axonometry'
const sources:Array<{slot:Slot;label:string;role:string;description:string;icon:IconName}>=[
  {slot:'model_3d',label:'Modèle 3D',role:'Autorité géométrique',description:'Maquette numérique du projet. Format ouvert, jusqu’à 500 Mo.',icon:'model'},
  {slot:'revit_view',label:'Vue projet',role:'Autorité de cadrage',description:'Perspective intentionnelle servant de référence caméra.',icon:'view'},
  {slot:'site_photo',label:'Photo réelle',role:'Autorité environnementale',description:'Le site, son contexte et sa lumière réelle.',icon:'photo'},
  {slot:'axonometry',label:'Axonométrie',role:'Contrôle spatial',description:'Garde-fou secondaire pour lever les ambiguïtés.',icon:'axonometry'},
]

export default function NewProjectWizard(){
  const router=useRouter();const[step,setStep]=useState(1);const[busy,setBusy]=useState(false);const[error,setError]=useState<string|null>(null)
  const[info,setInfo]=useState({name:'',type:'Maison individuelle',location:'',description:''});const[files,setFiles]=useState<Partial<Record<Slot,File>>>({})
  function setFile(slot:Slot,file?:File){setFiles(v=>({...v,[slot]:file}))}
  async function create(){setBusy(true);setError(null);try{
    const response=await fetch('/api/dossiers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(info)})
    const created=await lireReponseApi<{success:true;id:string}>(response);const dossierId=created.id
    for(const item of sources){const file=files[item.slot];if(!file)continue;const ext=file.name.split('.').pop()?.toLowerCase()??'bin'
      if(item.slot==='model_3d'){
        const pathname=`${dossierId}/modele-3d/${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`
        const blob=await upload(pathname,file,{access:'private',handleUploadUrl:`/api/dossiers/${dossierId}/modele-3d/token`})
        await lireReponseApi(await fetch(`/api/dossiers/${dossierId}/modele-3d`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pathname:blob.pathname,originalName:file.name,format:ext,sizeBytes:file.size})}))
      }else{
        const pathname=`${dossierId}/sources/${item.slot}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`
        const blob=await upload(pathname,file,{access:'private',contentType:file.type,handleUploadUrl:`/api/dossiers/${dossierId}/sources/token`})
        await lireReponseApi(await fetch(`/api/dossiers/${dossierId}/sources`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pathname:blob.pathname,originalName:file.name,role:item.slot})}))
      }
    }
    router.push(`/dossiers/${dossierId}`)
  }catch(e){setError(e instanceof Error?e.message:'Création du projet impossible.');setBusy(false)} }
  return <main className="wizard"><PageHeader eyebrow="Nouveau projet" title="Préparer un projet" description="Trois étapes pour réunir les informations et les sources réelles."/>
    <div className="steps">{['Projet','Sources','Récapitulatif'].map((x,i)=><div key={x} className={`step ${step===i+1?'is-active':step>i+1?'is-done':''}`}><span className="step-number">{step>i+1?<Icon name="check"/>:i+1}</span>{x}</div>)}</div>
    <section className="wizard-card">
      {step===1&&<><div className="wizard-heading"><h2>Informations du projet</h2><p>Ces données sont enregistrées dans le dossier et restent modifiables via la conversation RIF.</p></div><div className="field-grid"><label className="field"><span>Nom du projet</span><input autoFocus value={info.name} onChange={e=>setInfo({...info,name:e.target.value})} placeholder="Villa des Pins" required/></label><label className="field"><span>Type de projet</span><select value={info.type} onChange={e=>setInfo({...info,type:e.target.value})}><option>Maison individuelle</option><option>Extension</option><option>Rénovation</option><option>Petit collectif</option><option>Équipement</option><option>Autre</option></select></label><label className="field"><span>Localisation</span><input value={info.location} onChange={e=>setInfo({...info,location:e.target.value})} placeholder="Ville, département"/></label><label className="field"><span>Description <small>optionnelle</small></span><textarea rows={3} value={info.description} onChange={e=>setInfo({...info,description:e.target.value})} placeholder="Contexte et objectif du rendu…"/></label></div></>}
      {step===2&&<><div className="wizard-heading"><h2>Ajouter les sources</h2><p>Chaque source garde son domaine d’autorité. Vous pourrez compléter le dossier plus tard.</p></div><div className="source-choice-grid">{sources.map(s=><article className="source-choice" key={s.slot}><span className="source-choice__icon"><Icon name={s.icon}/></span><div><h3>{s.label}</h3><p><strong>{s.role}</strong><br/>{s.description}</p><label><Icon name="upload"/> {files[s.slot]?'Remplacer':'Choisir un fichier'}<input type="file" accept={s.slot==='model_3d'?undefined:'image/*'} onChange={e=>setFile(s.slot,e.target.files?.[0])}/></label>{files[s.slot]&&<span className="source-choice__file"><Icon name="check"/> {files[s.slot]!.name} · {formatBytes(files[s.slot]!.size)}</span>}</div></article>)}</div></>}
      {step===3&&<><div className="wizard-heading"><h2>Vérifiez les informations</h2><p>Le projet sera créé puis les fichiers sélectionnés seront déposés dans le stockage privé.</p></div><div className="review-grid"><div className="review-block"><h3>{info.name}</h3><div className="review-row"><span>Type</span><strong>{info.type}</strong></div><div className="review-row"><span>Localisation</span><strong>{info.location||'Non renseignée'}</strong></div><div className="review-row"><span>Description</span><strong>{info.description||'—'}</strong></div></div><div className="review-block"><h3>Sources ({Object.values(files).filter(Boolean).length}/4)</h3>{sources.map(s=><div className="review-row" key={s.slot}><span>{s.label}</span><strong>{files[s.slot]?files[s.slot]!.name:'À compléter'}</strong></div>)}</div></div><div className="notice notice--info"><Icon name="details"/><span>Le modèle 3D sera enregistré au statut <strong>UPLOADED</strong>. Aucun extracteur n’est configuré : aucune analyse ne sera simulée.</span></div></>}
      {error&&<div style={{marginTop:16}}><ErrorState message={error}/></div>}
      <div className="wizard-actions"><button className="button" type="button" onClick={()=>step===1?router.push('/dossiers'):setStep(step-1)} disabled={busy}>{step===1?'Annuler':'Précédent'}</button>{step<3?<button className="button button--primary" type="button" disabled={step===1&&!info.name.trim()} onClick={()=>setStep(step+1)}>Suivant<Icon name="arrow"/></button>:<button className="button button--primary" type="button" disabled={busy} onClick={create}>{busy?'Création et dépôt…':'Créer le projet'}<Icon name="arrow"/></button>}</div>
    </section>
  </main>
}
